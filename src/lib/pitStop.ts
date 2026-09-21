export const PIT_STOP_SECONDS = 6.8;
export type PitPhase = 'racing' | 'entering' | 'service' | 'ready';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function pitStopFrame(seconds: number) {
  const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const phase: PitPhase = t < 1.8 ? 'racing' : t < 3.1 ? 'entering' : t < 5.5 ? 'service' : 'ready';
  return {
    phase,
    progress: clamp(t / PIT_STOP_SECONDS),
    opacity: Math.min(clamp(t / .35), clamp((PIT_STOP_SECONDS - t) / .8)),
    carZ: 7 * (1 - ease(t / 3.1)),
    carX: -.9 * Math.sin(ease(t / 3.1) * Math.PI),
    carLift: phase === 'service' ? .13 * Math.sin(clamp((t - 3.1) / 2.4) * Math.PI) : 0,
    speed: 1 - ease((t - 1.4) / 1.7),
    toolPulse: phase === 'service' ? Math.max(0, Math.sin((t - 3.1) * 24)) : 0,
    done: t >= PIT_STOP_SECONDS,
  };
}

export const isPitStopEntry = (search: string) => new URLSearchParams(search).get('intro') === 'pitstop';

/** Local synthesized cinematic effects, not vehicle recordings or diagnostic audio. */
export function createPitStopAudio() {
  const context = new AudioContext();
  const output = context.createGain(); output.gain.value = .22; output.connect(context.destination);
  const engineGain = context.createGain(); engineGain.gain.value = 0; engineGain.connect(output);
  const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420; filter.connect(engineGain);
  const engine = context.createOscillator(); engine.type = 'sawtooth'; engine.connect(filter); engine.start();
  const rumble = context.createOscillator(); rumble.type = 'triangle'; rumble.connect(filter); rumble.start();
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
  const noiseFilter = context.createBiquadFilter(); noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 1600;
  const toolGain = context.createGain(); toolGain.gain.value = 0;
  noise.connect(noiseFilter); noiseFilter.connect(toolGain); toolGain.connect(output); noise.start();
  let disposed = false;
  return {
    async enable() { if (disposed) return false; try { await context.resume(); return !disposed && context.state === 'running'; } catch { return false; } },
    mute() { if (!disposed) void context.suspend().catch(() => {}); },
    update(seconds: number) {
      if (disposed || context.state !== 'running') return;
      const frame = pitStopFrame(seconds), now = context.currentTime;
      engine.frequency.setTargetAtTime(42 + frame.speed * 125, now, .08);
      rumble.frequency.setTargetAtTime(24 + frame.speed * 60, now, .08);
      engineGain.gain.setTargetAtTime((.05 + frame.speed * .15) * frame.opacity, now, .06);
      const braking = frame.phase === 'entering' ? .035 : 0;
      toolGain.gain.setTargetAtTime((braking + frame.toolPulse * .18) * frame.opacity, now, .015);
    },
    dispose() { if (disposed) return; disposed = true; engine.stop(); rumble.stop(); noise.stop(); output.disconnect(); void context.close().catch(() => {}); },
  };
}
