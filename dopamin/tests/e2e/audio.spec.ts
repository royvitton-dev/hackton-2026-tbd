import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadReplay, seek } from './replay';

async function installAudioProbe(page:Page){
  await page.addInitScript(()=>{
    const probes:AnalyserNode[]=[];const original=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(destination:AudioNode|AudioParam,...args:number[]){
      if(destination instanceof AudioDestinationNode){
        const analyser=this.context.createAnalyser();analyser.fftSize=2048;probes.push(analyser);
        // Keep the measurement graph processing when all game sources disconnect.
        // A zero-valued source cannot mask any audible residual game output.
        const silence=this.context.createConstantSource();silence.offset.value=0;
        Reflect.apply(original,silence,[analyser]);silence.start();
        Reflect.apply(original,this,[analyser]);return Reflect.apply(original,analyser,[destination]);
      }
      return Reflect.apply(original,this,[destination,...args]);
    } as typeof original;
    (window as unknown as {audioLevel:()=>number}).audioLevel=()=>{
      let peak=0;for(const analyser of probes){if(analyser.context.state!=='running')throw new Error(`Audio probe is ${analyser.context.state}; cannot measure live output`);const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);for(const value of data)peak=Math.max(peak,Math.abs(value));}return peak;
    };
  });
}
const level=(page:Page)=>page.evaluate(()=>(window as unknown as {audioLevel:()=>number}).audioLevel());

test('BGM produces real audio, obeys mute/pause/recording and remembers the setting',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await installAudioProbe(page);await loadReplay(page);await seek(page,5.1);
  await expect.poll(()=>level(page)).toBeLessThan(.0001);
  await page.getByRole('button',{name:'재생',exact:true}).click();await expect.poll(()=>level(page),{timeout:5000}).toBeGreaterThan(.005);
  await page.getByRole('button',{name:'일시 정지',exact:true}).click();await expect.poll(()=>level(page)).toBeLessThan(.0001);
  await page.getByRole('button',{name:'BREW RACERS 홈'}).click();await expect.poll(()=>level(page)).toBeGreaterThan(.002);
  await page.getByRole('button',{name:'레이서 추가',exact:true}).click();await expect.poll(()=>level(page)).toBeLessThan(.0001);
  await page.getByRole('button',{name:'닫기',exact:true}).click();await expect.poll(()=>level(page)).toBeGreaterThan(.002);
  await page.getByRole('button',{name:'사운드 끄기',exact:true}).click();await expect.poll(()=>level(page)).toBeLessThan(.0001);
  await page.reload();await expect(page.getByRole('button',{name:'사운드 켜기',exact:true})).toBeVisible();await expect.poll(()=>level(page)).toBeLessThan(.0001);
  await page.getByRole('button',{name:'사운드 켜기',exact:true}).click();await expect.poll(()=>level(page)).toBeGreaterThan(.002);expect(errors).toEqual([]);
});

test('renders non-silent unclipped music and distinct item samples through real Web Audio',async({page},testInfo)=>{
  // This sample renderer imports source modules and requires the development server.
  await page.goto(process.env.AUDIO_TEST_URL||'http://127.0.0.1:5173');await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready','true');
  const samples=await page.evaluate(async()=>{
    const scorePath='/src/audio/music.ts',synthPath='/src/audio/synth.ts',effectsPath='/src/audio/effects.ts';
    const {createScore}=await import(scorePath),{Synth}=await import(synthPath),{scheduleItemSound}=await import(effectsPath);
    const output:{name:string;rms:number;peak:number;wav:string}[]=[];
    for(const name of ['lobby','race','results','launch-bean','hit-bean','hit-ice','hit-storm','blocked-bean','item-boost','item-shield']){
      const isMusic=!name.includes('-'),score=isMusic?createScore(name):null,duration=score?score.steps*60/score.bpm/4:1.2;
      const context=new OfflineAudioContext(2,Math.ceil(duration*24000),24000),synth=new Synth(context);
      if(score)for(const note of score.notes)synth.note(note.instrument,note.midi,note.step*60/score.bpm/4,note.length*60/score.bpm/4,note.velocity);
      else{const [type,item]=name.split('-');scheduleItemSound(synth,{type,item,time:0,actor:'a',target:'b'},.02);}
      const buffer=await context.startRendering(),left=buffer.getChannelData(0),right=buffer.getChannelData(1);let squares=0,peak=0;
      const wav=new ArrayBuffer(44+buffer.length*4),view=new DataView(wav),str=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
      str(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,24000,true);view.setUint32(28,96000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,buffer.length*4,true);
      for(let i=0;i<buffer.length;i++)for(let c=0;c<2;c++){const value=(c?right:left)[i];squares+=value*value;peak=Math.max(peak,Math.abs(value));view.setInt16(44+i*4+c*2,Math.max(-32768,Math.min(32767,Math.round(value*32767))),true);}
      let binary='';const bytes=new Uint8Array(wav);for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      output.push({name,rms:Math.sqrt(squares/(buffer.length*2)),peak,wav:btoa(binary)});synth.dispose();
    }
    return output;
  });
  await fs.mkdir('reports/audio/samples',{recursive:true});
  for(const sample of samples){expect(sample.rms).toBeGreaterThan(.002);expect(sample.peak).toBeLessThan(.98);await fs.writeFile(`reports/audio/samples/${sample.name}.wav`,Buffer.from(sample.wav,'base64'));}
  const stats=samples.map(({name,rms,peak})=>({name,rms,peak}));expect(new Set(samples.map(s=>createHash('sha256').update(Buffer.from(s.wav,'base64').subarray(44)).digest('hex'))).size).toBe(samples.length);
  await fs.writeFile('reports/audio/levels.json',JSON.stringify(stats,null,2));await testInfo.attach('real-web-audio-levels',{body:JSON.stringify(stats),contentType:'application/json'});
});
