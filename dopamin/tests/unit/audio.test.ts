import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScore, midiFrequency } from '../../src/audio/music';
import { Synth } from '../../src/audio/synth';
import { demoDrivers } from '../../src/core/catalog';
import { simulateRace } from '../../src/core/race';
import type { RaceEvent } from '../../src/core/types';

class Param {
  value=0;calls:number[]=[];
  setValueAtTime(value:number){this.calls.push(value);this.value=value;return this;}
  exponentialRampToValueAtTime(value:number){expect(value).toBeGreaterThan(0);this.calls.push(value);this.value=value;return this;}
  setTargetAtTime(value:number){this.calls.push(value);this.value=value;return this;}
}
class Node {
  gain=new Param();frequency=new Param();Q=new Param();pan=new Param();threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();
  connected:unknown[]=[];disconnected=false;type='';loop=false;buffer:unknown;onended:(()=>void)|null=null;started=false;startTime=0;stopTime=Infinity;stopped=false;
  connect(node:unknown){this.connected.push(node);return node;}
  disconnect(){this.disconnected=true;}
  start(time=0){this.started=true;this.startTime=time;}
  stop(time?:number){if(time===undefined)this.stopped=true;else this.stopTime=time;}
}
class Context {
  static instances:Context[]=[];
  state='running';currentTime=0;sampleRate=24000;destination=new Node();nodes:Node[]=[];
  constructor(){Context.instances.push(this);}
  make(){const node=new Node();this.nodes.push(node);return node;}
  createGain(){return this.make();}createOscillator(){return this.make();}createBufferSource(){return this.make();}createBiquadFilter(){return this.make();}createStereoPanner(){return this.make();}createDynamicsCompressor(){return this.make();}
  createBuffer(_channels:number,length:number){const data=new Float32Array(length);return {getChannelData:()=>data};}
  async resume(){this.state='running';}async close(){this.state='closed';}
}
const created=()=>Context.instances.at(-1)!;
const active=(context=created())=>context.nodes.filter(n=>n.started&&!n.stopped);
const base=simulateRace(demoDrivers(),'roastery',1234,'2026-09-20T00:00:00Z');
let audio:typeof import('../../src/audio/raceSound');
let visibility:()=>void;
beforeEach(async()=>{
  vi.useFakeTimers();vi.resetModules();Context.instances=[];
  vi.stubGlobal('AudioContext',Context);
  vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn((_name:string,listener:()=>void)=>{visibility=listener;}),removeEventListener:vi.fn()});
  audio=await import('../../src/audio/raceSound');
});
afterEach(()=>{audio.disposeRaceAudio();vi.useRealTimers();vi.unstubAllGlobals();});

describe('original background score',()=>{
  it.each(['lobby','race','results'] as const)('creates a deterministic complete %s loop',mood=>{
    const score=createScore(mood);expect(score).toEqual(createScore(mood));expect(score.steps).toBe(128);
    expect(new Set(score.notes.map(n=>n.instrument)).size).toBe(6);
    expect(score.notes.every(n=>Number.isFinite(n.midi)&&n.step>=0&&n.step<score.steps&&n.length>0&&n.velocity>0)).toBe(true);
    expect(score.notes.filter(n=>n.instrument==='bass')).toHaveLength(32);
  });
  it('raises the final-lap tempo, transposes track themes and keeps the victory theme distinct',()=>{
    expect(createScore('race','snow',true).bpm).toBeGreaterThan(createScore('race').bpm);
    expect(createScore('race','snow').notes.find(n=>n.instrument==='lead')!.midi-createScore('race').notes.find(n=>n.instrument==='lead')!.midi).toBe(5);
    expect(createScore('race','missing')).toEqual(createScore('race'));
    expect(createScore('results').notes).not.toEqual(createScore('race').notes);expect(midiFrequency(69)).toBe(440);
  });
});
describe('audio scheduling and lifecycle',()=>{
  it('does not create audio before a user gesture and tolerates unavailable audio',()=>{
    audio.syncRaceAudio(null,0,true,false);expect(Context.instances).toHaveLength(0);
    vi.stubGlobal('AudioContext',class{constructor(){throw new Error('unavailable');}});expect(()=>audio.unlockRaceAudio()).not.toThrow();expect(()=>audio.playTone('click',true)).not.toThrow();
  });
  it('keeps a single context and one music scheduler across renders',()=>{
    audio.unlockRaceAudio();audio.unlockRaceAudio();audio.syncRaceAudio(null,0,true,false);const count=active().length;
    for(let i=0;i<10;i++)audio.syncRaceAudio(null,0,true,false);
    expect(Context.instances).toHaveLength(1);expect(vi.getTimerCount()).toBe(1);expect(active()).toHaveLength(count);
    created().currentTime=.3;vi.advanceTimersByTime(50);expect(active().length).toBeGreaterThan(count);
  });
  it('stops every scheduled note immediately on mute, pause or tab hiding and resumes cleanly',()=>{
    audio.unlockRaceAudio();audio.syncRaceAudio(null,0,true,false);expect(active().length).toBeGreaterThan(0);
    audio.syncRaceAudio(null,0,false,false);expect(active()).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);
    audio.syncRaceAudio(base,0,true,false);expect(active().length).toBeGreaterThan(0);audio.syncRaceAudio(base,0,true,true);expect(active()).toHaveLength(0);
    audio.syncRaceAudio(base,0,true,false);Object.defineProperty(document,'hidden',{value:true,writable:true});visibility();expect(active()).toHaveLength(0);audio.syncRaceAudio(base,0,true,false);expect(active()).toHaveLength(0);
    Object.defineProperty(document,'hidden',{value:false});audio.syncRaceAudio(base,0,true,false);expect(active().length).toBeGreaterThan(0);
  });
  it('schedules countdown music without the engine and changes to results music',()=>{
    audio.unlockRaceAudio();audio.syncRaceAudio(base,3,true,false,{countdown:true});const before=active();
    audio.syncRaceAudio(base,3,true,false,{mode:'results'});expect(before.every(n=>n.stopped)).toBe(true);expect(active().length).toBeGreaterThan(0);
    audio.syncRaceAudio(base,base.duration,true,false,{mode:'results'});expect(active().every(n=>n.startTime>=0)).toBe(true);
  });
  it('skips a timer backlog, loops without multiplying timers and handles suspended contexts',()=>{
    audio.unlockRaceAudio();audio.syncRaceAudio(null,0,true,false);created().currentTime=30;vi.advanceTimersByTime(25);
    const scheduled=active().filter(n=>n.startTime>=30);expect(scheduled.length).toBeGreaterThan(0);expect(scheduled.length).toBeLessThan(25);
    for(let i=1;i<160;i++){created().currentTime=30+i*.14;vi.advanceTimersByTime(25);}
    expect(vi.getTimerCount()).toBe(1);created().state='suspended';vi.advanceTimersByTime(25);audio.syncRaceAudio(base,0,true,false);expect(active()).toHaveLength(0);
  });
  it('recreates a closed context and safely disposes all resources',()=>{
    audio.unlockRaceAudio();created().state='closed';audio.unlockRaceAudio();expect(Context.instances).toHaveLength(2);
    audio.syncRaceAudio(null,0,true,false);const context=created();audio.disposeRaceAudio();expect(context.state).toBe('closed');expect(vi.getTimerCount()).toBe(0);expect(active(context)).toHaveLength(0);expect(document.removeEventListener).toHaveBeenCalled();
  });
  it.each(['click','start','go','finish','hit'] as const)('plays a distinct %s cue only when enabled',cue=>{
    audio.playTone(cue,false);expect(Context.instances).toHaveLength(0);audio.playTone(cue,true);expect(active().length).toBeGreaterThan(0);
    expect(active().every(n=>n.stopTime>n.startTime)).toBe(true);
  });
  it.each([
    ['launch','bean'],['launch','ice'],['launch','storm'],['hit','bean'],['hit','ice'],['hit','storm'],['blocked','bean'],['item','boost'],['item','shield'],
  ] as const)('plays %s/%s once when crossing its log event', (type,item)=>{
    const log={...base,events:[{time:.2,type,actor:'demo-1',target:'demo-2',item}] as RaceEvent[]};
    audio.unlockRaceAudio();audio.syncRaceAudio(log,0,true,false);const before=created().nodes.length;
    audio.syncRaceAudio(log,.25,true,false,{focus:'demo-2'});expect(created().nodes.length).toBeGreaterThan(before);const after=created().nodes.length;
    audio.syncRaceAudio(log,.25,true,false,{focus:'demo-2'});expect(created().nodes).toHaveLength(after);
  });
  it('does not replay crossed attacks during a seek and does play them on normal replay',()=>{
    const log={...base,events:[{time:1,type:'hit',actor:'demo-1',target:'demo-2',item:'bean'}] as RaceEvent[]};
    audio.unlockRaceAudio();audio.syncRaceAudio(log,0,true,false);audio.seekRaceAudio(log,1.2);const before=created().nodes.length;
    audio.syncRaceAudio(log,1.2,true,false);expect(created().nodes.length-before).toBeLessThan(10);
    audio.seekRaceAudio(log,.9);const second=created().nodes.length;audio.syncRaceAudio(log,1.1,true,false);expect(created().nodes.length-second).toBeGreaterThan(10);
    audio.syncRaceAudio(log,.1,true,false);expect(active().every(n=>n.stopTime>n.startTime)).toBe(true);
  });
  it('plays the final-lap cue and follows a focused racer engine',()=>{
    const log={...base,events:[{time:.2,type:'lap',actor:'demo-1',lap:2}] as RaceEvent[]};audio.unlockRaceAudio();audio.syncRaceAudio(log,0,true,false);
    created().currentTime=.2;audio.syncRaceAudio(log,.25,true,false,{focus:'demo-3'});expect(active().some(n=>n.frequency.calls.includes(midiFrequency(84)))).toBe(true);
  });
});
it('releases ended synth voices and supports bus-specific cleanup',()=>{
  const context=new Context(),synth=new Synth(context as unknown as AudioContext);
  synth.tone('effects',440,0,.2,.1);synth.note('lead',72,0,.3,.1);expect(synth.voices.size).toBe(3);
  const voice=[...synth.voices][0];(voice.source.onended as ()=>void)();expect(synth.voices.size).toBe(2);
  synth.stop('effects');expect(synth.voices.size).toBe(2);synth.stop('music');expect(synth.voices.size).toBe(0);synth.dispose();expect(context.nodes.every(n=>n.disconnected)).toBe(true);
});
