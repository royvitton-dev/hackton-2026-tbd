import type { RaceEvent, RaceLog } from '../core/types';
import { visualEvents } from '../core/presentation';
import { sampleRace } from '../core/race';
import { createScore, midiFrequency, type MusicMood, type Score } from './music';
import { Synth } from './synth';
import { scheduleItemSound } from './effects';

export type AudioCue='click'|'start'|'go'|'hit'|'finish';
export type AudioOptions={mode?:'lobby'|'race'|'results';countdown?:boolean;focus?:string|null};
let synth:Synth|undefined,lastLog:RaceLog|null=null,lastTime=0;
let timer:ReturnType<typeof setInterval>|undefined,score:Score|undefined,musicKey='',nextStep=0,nextStepTime=0,engineTime=-1,duckUntil=0;
let visibilityAttached=false;
const hidden=()=>typeof document!=='undefined'&&document.hidden;

export function unlockRaceAudio(){
  try{
    if(!synth||synth.context.state==='closed'){
      synth=new Synth(new AudioContext());musicKey='';score=undefined;engineTime=-1;
    }
    void synth.context.resume().catch(()=>{});
    if(!visibilityAttached&&typeof document!=='undefined'){
      document.addEventListener('visibilitychange',onVisibility);visibilityAttached=true;
    }
  }catch{/* Unsupported or denied audio must not stop the game. */}
}
function onVisibility(){if(hidden())stopRaceAudio();}

function scheduleMusic(){
  if(!synth||!score||hidden()||synth.context.state!=='running')return;
  const now=synth.context.currentTime,stepSeconds=60/score.bpm/4;
  // A delayed browser timer skips stale notes rather than playing a backlog.
  if(nextStepTime<now-.12){nextStep=(nextStep+Math.ceil((now-nextStepTime)/stepSeconds))%score.steps;nextStepTime=now+.025;}
  while(nextStepTime<now+.16){
    for(const note of score.notes)if(note.step>=nextStep&&note.step<nextStep+1){
      synth.note(note.instrument,note.midi,nextStepTime+(note.step-nextStep)*stepSeconds,note.length*stepSeconds,note.velocity);
    }
    nextStep=(nextStep+1)%score.steps;nextStepTime+=stepSeconds;
  }
}
function music(mood:MusicMood,track:string,finalLap:boolean){
  const key=`${mood}:${track}:${finalLap}`;
  if(key!==musicKey){synth!.stop('music');score=createScore(mood,track,finalLap);musicKey=key;nextStep=0;nextStepTime=synth!.context.currentTime+.035;}
  if(timer===undefined){nextStepTime=synth!.context.currentTime+.035;scheduleMusic();timer=setInterval(scheduleMusic,25);}
  const ctx=synth!.context;synth!.buses.music.gain.setTargetAtTime(ctx.currentTime<duckUntil?.16:.42,ctx.currentTime,.08);
}
export function stopRaceAudio(){
  if(timer!==undefined){clearInterval(timer);timer=undefined;}
  synth?.stop();engineTime=-1;
}
export function disposeRaceAudio(){
  stopRaceAudio();if(visibilityAttached){document.removeEventListener('visibilitychange',onVisibility);visibilityAttached=false;}
  if(synth){synth.dispose();void synth.context.close().catch(()=>{});synth=undefined;}
  score=undefined;musicKey='';lastLog=null;lastTime=0;duckUntil=0;
}
export function seekRaceAudio(log:RaceLog|null,time:number){
  synth?.stop('effects');synth?.stop('engine');engineTime=-1;lastLog=log;lastTime=time;
}
export function duckRaceMusic(seconds=5){
  if(!synth)return;duckUntil=synth.context.currentTime+seconds;synth.buses.music.gain.setTargetAtTime(.16,synth.context.currentTime,.04);
}

export function playTone(cue:AudioCue,enabled:boolean){
  if(!enabled||hidden())return;unlockRaceAudio();if(!synth)return;
  const s=synth,now=s.context.currentTime+.008;
  if(cue==='click'){s.tone('effects',740,now,.1,.085,'sine',1046);return;}
  if(cue==='start'){s.tone('effects',523,now,.16,.19,'square');s.tone('effects',1046,now,.12,.045,'sine');return;}
  if(cue==='go'){
    for(const [i,midi] of [72,76,79,84].entries())s.tone('effects',midiFrequency(midi),now+i*.055,.35,.15,'triangle');
    s.hiss('effects',now,.3,.12,500,6000,'bandpass');return;
  }
  if(cue==='finish'){
    duckRaceMusic();
    [72,76,79,84,79,84,88].forEach((midi,i)=>s.tone('effects',midiFrequency(midi),now+i*.115,i===6?.75:.25,.15,'triangle',midiFrequency(midi),i%2?.18:-.18));
    [60,64,67,72].forEach(midi=>s.tone('effects',midiFrequency(midi),now+.68,1,.075,'sine'));return;
  }
  itemSound({time:0,type:'hit',actor:'',item:'bean'});
}
function itemSound(event:RaceEvent){
  if(!synth)return;const now=synth.context.currentTime+.005;
  if(event.type==='hit')duckUntil=now+.65;
  scheduleItemSound(synth,event,now);
}
export function syncRaceAudio(log:RaceLog|null,time:number,enabled:boolean,paused:boolean,options:AudioOptions={}){
  if(!enabled||paused||hidden()||!synth||synth.context.state!=='running'){
    stopRaceAudio();lastLog=log;lastTime=time;return;
  }
  const mood=options.mode==='results'?'results':options.mode==='lobby'||!log?'lobby':'race';
  const finalLap=mood==='race'&&Boolean(log&&time>= (log.events.find(e=>e.type==='lap')?.time??Infinity));
  music(mood,log?.trackId||'roastery',finalLap);
  if(!log||options.countdown){synth.stop('engine');engineTime=-1;lastLog=log;lastTime=time;return;}
  const discontinuity=lastLog!==log||time<lastTime||time-lastTime>.6;
  if(discontinuity)seekRaceAudio(log,time);
  else{
    const events=visualEvents(log).filter(e=>e.time>lastTime&&e.time<=time);
    for(const event of events){
      if(event.type==='launch'||event.type==='hit'||event.type==='blocked'||event.type==='item'&&(event.item==='boost'||event.item==='shield'))itemSound(event);
      if(event.type==='lap'&&event===log.events.find(e=>e.type==='lap'))[76,79,84].forEach((midi,i)=>synth!.tone('effects',midiFrequency(midi),synth!.context.currentTime+i*.09,.24,.10,'triangle'));
    }
  }
  const now=synth.context.currentTime;
  if(now-engineTime>=.12){
    engineTime=now;const cars=sampleRace(log,time).cars,car=cars.find(c=>c.id===options.focus)||cars[0];
    if(car.finish===null&&car.speed>2){const rpm=52+car.speed*1.6;synth.tone('engine',rpm,now+.005,.25,.07,'sawtooth',rpm*1.04);synth.hiss('engine',now+.005,.25,.035,900,1400,'bandpass');}
  }
  lastLog=log;lastTime=time;
}
