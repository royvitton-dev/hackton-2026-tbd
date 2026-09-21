import { midiFrequency, type Instrument } from './music';
export type AudioBus='music'|'effects'|'engine';
type Voice={source:AudioScheduledSourceNode;nodes:AudioNode[];bus:AudioBus;end:number};

export class Synth {
  readonly master:GainNode;
  readonly buses:Record<AudioBus,GainNode>;
  readonly voices=new Set<Voice>();
  private noise:AudioBuffer;
  private compressor:DynamicsCompressorNode;
  constructor(readonly context:AudioContext){
    this.master=context.createGain();this.master.gain.value=.8;
    this.compressor=context.createDynamicsCompressor();this.compressor.threshold.value=-14;this.compressor.knee.value=14;this.compressor.ratio.value=5;this.compressor.attack.value=.003;this.compressor.release.value=.18;
    this.master.connect(this.compressor);this.compressor.connect(context.destination);
    this.buses={music:context.createGain(),effects:context.createGain(),engine:context.createGain()};
    this.buses.music.gain.value=.42;this.buses.effects.gain.value=.72;this.buses.engine.gain.value=.12;
    Object.values(this.buses).forEach(bus=>bus.connect(this.master));
    this.noise=context.createBuffer(1,context.sampleRate,context.sampleRate);const data=this.noise.getChannelData(0);let seed=781;
    for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=seed/2147483648-1;}
  }
  private attach(source:AudioScheduledSourceNode,nodes:AudioNode[],bus:AudioBus,start:number,end:number){
    let previous:AudioNode=source;for(const node of nodes){previous.connect(node);previous=node;}previous.connect(this.buses[bus]);
    const voice={source,nodes,bus,end};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();nodes.forEach(node=>node.disconnect());};
    source.start(start);source.stop(end);
  }
  tone(bus:AudioBus,hz:number,start:number,duration:number,volume:number,wave:OscillatorType='triangle',endHz=hz,pan=0){
    const ctx=this.context,oscillator=ctx.createOscillator(),envelope=ctx.createGain(),filter=ctx.createBiquadFilter(),stereo=ctx.createStereoPanner();
    oscillator.type=wave;oscillator.frequency.setValueAtTime(hz,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,endHz),start+duration);
    filter.type='lowpass';filter.frequency.value=wave==='square'?2600:4500;stereo.pan.value=pan;
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),start+.008);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
    this.attach(oscillator,[filter,envelope,stereo],bus,start,start+duration+.02);
  }
  hiss(bus:AudioBus,start:number,duration:number,volume:number,frequency:number,endFrequency=frequency,kind:BiquadFilterType='lowpass',pan=0){
    const ctx=this.context,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain(),stereo=ctx.createStereoPanner();source.buffer=this.noise;source.loop=true;
    filter.type=kind;filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(Math.max(10,endFrequency),start+duration);filter.Q.value=.7;stereo.pan.value=pan;
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),start+.006);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
    this.attach(source,[filter,envelope,stereo],bus,start,start+duration+.02);
  }
  note(instrument:Instrument,midi:number,start:number,duration:number,velocity:number){
    const hz=midiFrequency(midi);
    if(instrument==='kick'){this.tone('music',145,start,.17,velocity,'sine',42);return;}
    if(instrument==='snare'){this.hiss('music',start,.12,velocity,1800,700,'bandpass');this.tone('music',170,start,.08,velocity*.23,'triangle',80);return;}
    if(instrument==='hat'){this.hiss('music',start,.045,velocity,8000,5500,'highpass');return;}
    this.tone('music',hz,start,duration,velocity,instrument==='lead'?'square':'triangle',hz,instrument==='chord'?-.22:instrument==='lead'?.15:0);
    if(instrument==='lead')this.tone('music',hz*2,start,duration*.7,velocity*.16,'sine',hz*2,-.15);
  }
  stop(bus?:AudioBus){
    for(const voice of [...this.voices])if(!bus||voice.bus===bus){
      voice.source.onended=null;try{voice.source.stop();}catch{/* A voice may have ended between callbacks. */}
      voice.source.disconnect();voice.nodes.forEach(node=>node.disconnect());this.voices.delete(voice);
    }
  }
  dispose(){this.stop();Object.values(this.buses).forEach(bus=>bus.disconnect());this.master.disconnect();this.compressor.disconnect();}
}
