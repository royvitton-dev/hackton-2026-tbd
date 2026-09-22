// Original, locally synthesized amusement-park cues. No samples or network access.
// Sound has its own clock/variation counter and never consumes the race RNG.
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const LIMIT = 40;
const COOLDOWN = {hit:.10, bumper:.14, capture:.20, launch:.16, release:.18, finish:.12, swing:.8, return:.3};

export class ParkSoundscape {
  constructor(createContext = () => new (window.AudioContext || window.webkitAudioContext)()) {
    this.createContext = createContext;
    this.context = null;
    this.enabled = false;
    this.state = 'ready';
    this.generation = 0;
    this.voices = new Set();
    this.lastCue = new Map();
    this.variation = 0;
    this.played = {};
    this.peakVoices = 0;
  }

  connect(context) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    compressor.attack.value = .003;
    compressor.release.value = .18;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5800;
    this.bus = context.createGain();
    this.bus.connect(filter).connect(compressor).connect(this.master).connect(context.destination);
    // A short, quiet sparkle tail; no unbounded feedback or per-frame nodes.
    this.delay = context.createDelay(.3);
    this.delay.delayTime.value = .115;
    const wet = this.wet = context.createGain();
    wet.gain.value = .12;
    this.bus.connect(this.delay).connect(wet).connect(filter);
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 731;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      data[i] = (seed >>> 0) / 2147483648 - 1;
    }
  }

  async setEnabled(enabled) {
    const generation = ++this.generation;
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      if (this.master) this.master.gain.setValueAtTime(0, this.context.currentTime);
      return false;
    }
    try {
      if (!this.context) this.connect(this.createContext());
      await this.context.resume();
      if (generation !== this.generation || !this.enabled) return this.enabled;
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(.55, this.context.currentTime);
      this.cue('enable');
      return true;
    } catch (error) {
      if (generation !== this.generation) return this.enabled;
      this.enabled = false;
      this.stop();
      throw error;
    }
  }

  stop() {
    const now = this.context?.currentTime || 0;
    for (const voice of this.voices) {
      voice.envelope.gain.cancelScheduledValues(now);
      voice.envelope.gain.setValueAtTime(0, now);
      try { voice.source.stop(now); } catch {}
      voice.source.disconnect();
      voice.envelope.disconnect();
      voice.filter?.disconnect();
    }
    this.voices.clear();
    this.lastCue.clear();
    // Flush delayed notes as well, including on a fast pause/resume or replay.
    if (this.delay && this.dirty) {
      this.dirty = false;
      this.bus.disconnect(this.delay); this.delay.disconnect();
      this.delay = this.context.createDelay(.3);
      this.delay.delayTime.value = .115;
      this.bus.connect(this.delay).connect(this.wet);
    }
  }

  setState(state) {
    if (state === this.state) return;
    const previous = this.state;
    this.state = state;
    if (['ready', 'paused', 'invalid', 'mixing'].includes(state)) this.stop();
    if (state === 'mixing' && previous !== 'paused') this.cue('mix');
    if (state === 'racing' && previous !== 'paused') this.cue('start');
  }

  voice(frequency, offset, duration, volume, type = 'sine', endFrequency) {
    if (this.voices.size >= LIMIT) return;
    const c = this.context, t = c.currentTime + .008 + offset;
    const envelope = c.createGain();
    const source = type === 'noise' ? c.createBufferSource() : c.createOscillator();
    let filter;
    if (type === 'noise') {
      source.buffer = this.noise;
      filter = c.createBiquadFilter();
      filter.type = 'bandpass'; filter.Q.value = .65;
      filter.frequency.setValueAtTime(frequency, t);
      filter.frequency.exponentialRampToValueAtTime(endFrequency || frequency, t + duration);
      source.connect(filter).connect(envelope);
    } else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, t);
      if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, t + duration);
      source.connect(envelope);
    }
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(volume, t + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, t + duration);
    envelope.connect(this.bus);
    const voice = {source, envelope, filter};
    this.voices.add(voice);
    this.peakVoices = Math.max(this.peakVoices, this.voices.size);
    source.onended = () => {
      source.disconnect(); envelope.disconnect(); filter?.disconnect(); this.voices.delete(voice);
    };
    source.start(t); source.stop(t + duration + .01);
  }

  bell(note, at = 0, length = .22, volume = .05) {
    this.voice(hz(note), at, length, volume);
    this.voice(hz(note) * 2, at, length * .45, volume * .22);
  }

  cue(kind, detail = {}) {
    const c = this.context;
    if (!this.enabled || !c || c.state !== 'running' || (this.state === 'paused' && kind !== 'enable')) return false;
    const now = c.currentTime;
    if (now - (this.lastCue.get(kind) ?? -Infinity) < (COOLDOWN[kind] || 0)) return false;
    if (kind === 'winner') this.stop();
    // Reserve space for prominent cues; drop incidental sounds under heavy load.
    if (this.voices.size > LIMIT - 8 && !['winner', 'start', 'countdown'].includes(kind)) return false;
    this.dirty = true;
    this.lastCue.set(kind, now);
    this.played[kind] = (this.played[kind] || 0) + 1;
    this.delay.delayTime.setValueAtTime(.115, now);
    const note = [74, 78, 81, 83, 86][this.variation++ % 5];
    switch (kind) {
      case 'enable': [74, 81, 86].forEach((n, i) => this.bell(n, i * .07, .2, .045)); break;
      case 'mix': [62, 69, 74, 78, 81].forEach((n, i) => this.voice(hz(n), i * .09, .16, .055, 'triangle')); break;
      case 'countdown':
        this.bell(detail.number === 1 ? 81 : 74, 0, .12, .065);
        this.voice(140, 0, .09, .07, 'sine', 65); break;
      case 'start':
        [74, 78, 81, 86].forEach((n, i) => this.bell(n, i * .085, .28, .07));
        this.voice(400, 0, .32, .07, 'noise', 2600); break;
      case 'hit':
        this.voice(hz(note - 12), 0, .09, .024 + Math.min(Math.max(detail.speed || 0, 0), 600) / 600 * .012, 'triangle'); break;
      case 'bumper': this.bell(note, 0, .18, .045); this.voice(hz(note - 24), 0, .1, .045, 'sine', hz(note - 12)); break;
      case 'capture':
        this.voice(detail.kind === 'magnet' ? 350 : 250, 0, .17, .045, 'triangle', 900);
        this.bell(86, .11, .12, .025); break;
      case 'launch':
        this.voice(180, 0, .2, .13, 'sine', 48);
        this.voice(600, 0, .24, .13, 'noise', 3000);
        this.bell(86, .08, .18, .04); break;
      case 'release': this.bell(81, 0, .12, .04); this.bell(86, .06, .18, .04); break;
      case 'swing':
        this.voice(300, 0, .25, .055, 'noise', 1400);
        [69, 74, 81].forEach((n, i) => this.voice(hz(n), i * .07, .14, .035, 'triangle')); break;
      case 'return':
        [86, 81, 78, 74].forEach((n, i) => this.bell(n, i * .055, .15, .04)); break;
      case 'finish': this.bell(81, 0, .18, .05); this.bell(86, .07, .25, .055); break;
      case 'winner':
        // Original D-major fanfare: a bouncy pickup, brass harmony, sparkling coda.
        [[74,0],[78,.12],[81,.24],[78,.42],[83,.62],[81,.82],[86,1.04]].forEach(([n, t]) => {
          this.voice(hz(n), t, t > 1 ? .5 : .18, .085, 'triangle');
          this.bell(n + 12, t, .26, .038);
        });
        [50, 62, 66, 69].forEach(n => this.voice(hz(n), 1.04, .58, .055, 'triangle'));
        [0, .24, .62, 1.04].forEach(t => this.voice(130, t, .13, .075, 'sine', 50));
        this.voice(1700, 1.04, .42, .07, 'noise', 4400); break;
    }
    return true;
  }

  snapshot() {
    return {enabled:this.enabled, state:this.state, contextState:this.context?.state || 'uninitialized', activeVoices:this.voices.size, peakVoices:this.peakVoices, voiceLimit:LIMIT, played:{...this.played}};
  }
}
