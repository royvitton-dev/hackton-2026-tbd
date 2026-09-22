import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base=process.env.TEST_URL||'http://127.0.0.1:4189';
const out='evidence/park-20260921/32-audio';await mkdir(out,{recursive:true});
const report={at:new Date().toISOString(),tests:[],limitations:['Audio rendered and measured; no human speaker listening assessment.','Mobile Chrome viewport emulation; not an Android/iOS device.']};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
async function test(name,fn){try{const data=await fn();report.tests.push({name,status:'PASS',...data});console.log('PASS',name);}catch(error){report.tests.push({name,status:'FAIL',error:error.stack});process.exitCode=1;console.error('FAIL',name,error.message);}}
try{
 await test('offline synthesis, headroom, independent cue palette and cleanup',async()=>{
  const page=await browser.newPage();await page.goto(base);
  const data=await page.evaluate(async()=>{
   const {ParkSoundscape}=await import('./src/soundscape.js');
   const cues=['enable','mix','countdown','start','hit','bumper','capture','launch','release','swing','return','finish','winner'];
   const results=[];
   for(const kind of cues){
    const c=new OfflineAudioContext(1,44100*3,44100),s=new ParkSoundscape();
    s.connect(c);s.enabled=true;s.master.gain.value=.55;
    // Offline contexts are suspended until rendering starts; admit the cue on its own clock.
    Object.defineProperty(c,'state',{get:()=> 'running'});
    s.cue(kind,{number:1,speed:400,kind:'magnet'});
    const b=await c.startRendering(),samples=b.getChannelData(0);
    let peak=0,energy=0,tail=0;
    for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));energy+=samples[i]**2;if(i>44100*2.3)tail=Math.max(tail,Math.abs(samples[i]));}
    results.push({kind,peak,rms:Math.sqrt(energy/samples.length),tail,active:s.voices.size,peakVoices:s.peakVoices});
   }
   // Export a single original cue preview, kept with evidence (not a session-log ZIP).
   const c=new OfflineAudioContext(1,44100*8,44100),s=new ParkSoundscape();s.connect(c);s.enabled=true;s.master.gain.value=.55;
   Object.defineProperty(c,'state',{get:()=> 'running'});
   for(const [kind,offset]of [['start',0],['bumper',1],['capture',2],['launch',3],['return',4],['winner',5]]){
    const suspend=c.suspend(offset+.01).then(()=>{s.cue(kind);return c.resume();});
   }
   const b=await c.startRendering();
   return {results,preview:Array.from(b.getChannelData(0),x=>Math.round(Math.max(-1,Math.min(1,x))*32767))};
  });
  for(const r of data.results){assert.ok(r.peak>.001,r.kind+' silent');assert.ok(r.peak<.85,r.kind+' clipping risk');assert.ok(r.rms>.0001);assert.ok(r.tail<.0001,r.kind+' tail');assert.equal(r.active,0);assert.ok(r.peakVoices<=40);}
  const wav=Buffer.alloc(44+data.preview.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(data.preview.length*2,40);data.preview.forEach((v,i)=>wav.writeInt16LE(v,44+i*2));await writeFile(out+'/park-cues.wav',wav);
  await page.close();return {cues:data.results};
 });
 await test('rapid enable→mute during pending resume stays silent',async()=>{
  const page=await browser.newPage();await page.addInitScript(()=>{
   const original=AudioContext.prototype.resume;
   AudioContext.prototype.resume=function(){return new Promise(resolve=>{window.releaseResume=()=>original.call(this).then(resolve);});};
  });await page.goto(base);await page.waitForFunction(()=>window.pinball);
  await page.locator('#sound').click();await page.locator('#sound').click();
  await page.evaluate(()=>window.releaseResume());await page.waitForTimeout(160);
  const s=await page.evaluate(()=>window.pinball.audio());assert.equal(s.enabled,false);assert.equal(s.activeVoices,0);assert.deepEqual(s.played,{});assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');
  await page.close();return {audio:s};
 });
 for(const mobile of [false,true])await test((mobile?'mobile':'desktop')+' sound on→race→pause→winner→replay→mute',async()=>{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.pinball);assert.equal((await page.evaluate(()=>window.pinball.audio())).contextState,'uninitialized');
  await page.locator('[data-map=parade]').click();await page.locator('[data-speed="3"]').click();await page.locator('#sound').click();
  await page.locator('#start').click();await page.waitForFunction(()=>window.pinball.snapshot().state==='racing');
  await page.locator('#pause').click();const snapshot=await page.evaluate(()=>window.pinball.snapshot());assert.equal((await page.evaluate(()=>window.pinball.audio())).activeVoices,0);
  await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),snapshot);
  await page.locator('#pause').click();await page.waitForFunction(()=>['complete','invalid'].includes(window.pinball.snapshot().state),null,{timeout:70000});
  const round=await page.evaluate(()=>window.pinball.exportRound()),audio=await page.evaluate(()=>window.pinball.audio());
  assert.equal(round.result.state,'complete');assert.equal(round.result.finishOrder.length,1);assert.equal(round.result.winner.id,round.result.finishOrder[0].id);
  assert.equal(await page.locator('#splash-name').textContent(),round.result.winner.label);
  for(const kind of ['enable','mix','countdown','start','hit','finish','winner'])assert.ok(audio.played[kind]>0,kind+' not played');
  assert.equal(audio.played.winner,1);assert.equal(audio.played.start,1);assert.equal(audio.played.countdown,3);assert.ok(audio.peakVoices<=40);
  await page.locator('#splash-replay').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');
  await page.locator('#sound').click();assert.equal((await page.evaluate(()=>window.pinball.audio())).activeVoices,0);
  const muted=await page.evaluate(()=>window.pinball.audio().played);await page.waitForTimeout(900);assert.deepEqual(await page.evaluate(()=>window.pinball.audio().played),muted);
  await page.locator('#reset').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'ready');
  assert.deepEqual(errors,[]);await writeFile(out+'/'+(mobile?'mobile':'desktop')+'-round.json',JSON.stringify(round,null,2));await context.close();return {audio,errors};
 });
 await test('60-ball cue burst is bounded and reset cancels scheduled fanfare',async()=>{
  const page=await browser.newPage();await page.goto(base);
  const result=await page.evaluate(async()=>{
   const {ParkSoundscape}=await import('./src/soundscape.js');const s=new ParkSoundscape();await s.setEnabled(true);s.setState('racing');
   const t=performance.now();for(let i=0;i<60;i++)for(const kind of ['hit','bumper','capture','launch','release','finish'])s.cue(kind,{speed:500});
   const burst={...s.snapshot(),schedulingMs:performance.now()-t};s.cue('winner');const winner=s.snapshot();s.setState('ready');const reset=s.snapshot();
   await new Promise(r=>setTimeout(r,1700));const after=s.snapshot();await s.context.close();return {burst,winner,reset,after};
  });assert.ok(result.burst.peakVoices<=40);assert.ok(result.winner.peakVoices<=40);assert.equal(result.reset.activeVoices,0);assert.equal(result.after.activeVoices,0);
  for(const kind of ['hit','bumper','launch'])assert.equal(result.burst.played[kind],1);await page.close();return result;
 });
}finally{await browser.close();report.status=report.tests.every(t=>t.status==='PASS')?'PASS':'FAIL';await writeFile(out+'/results.json',JSON.stringify(report,null,2));}
