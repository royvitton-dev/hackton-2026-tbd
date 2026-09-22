import {chromium} from '../../node_modules/playwright/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {film,scenes} from '../assets/odyssey/timeline.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'output/odyssey/';
await mkdir(out,{recursive:true});
const generation=JSON.parse(await readFile(root+'assets/odyssey/cinematic-generation.json','utf8'));
assert.equal(generation.video.status,'generated');
assert.equal(scenes.filter(s=>s.source!=null||s.kind==='montage').reduce((n,s)=>n+s.end-s.start,0),62);
assert.equal(scenes.filter(s=>s.kind==='motion').reduce((n,s)=>n+s.end-s.start,0),13);
const server=await serve(0),browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/assets/odyssey/render.html`);
  await page.waitForFunction(()=>window.filmReady,null,{timeout:120000});
  const sample=async t=>{
    const r=await page.evaluate(async time=>{const probe=await window.drawFrame(time);return {probe,pixels:document.querySelector('#film').toDataURL('image/png').split(',')[1]};},t);
    return {probe:r.probe,hash:createHash('sha256').update(Buffer.from(r.pixels,'base64')).digest('hex')};
  };
  const checks=[];
  for(const s of scenes.filter(s=>s.kind==='motion')){
    const aTime=s.start+.3,bTime=s.end-.45,a=await sample(aTime),b=await sample(bTime);
    assert.notEqual(a.hash,b.hash,`Frozen image in ${s.id}`);
    assert.equal(a.probe.motion.kind,'generated-video');
    assert(b.probe.motion.frame>a.probe.motion.frame);
    const readSource=async p=>readFile(root+`tmp/odyssey/cinematic/${p.motion.shot}/${String(p.motion.frame).padStart(5,'0')}.jpg`);
    assert.notDeepEqual(await readSource(a.probe),await readSource(b.probe),`Frozen underlying video ${s.id}`);
    await sample(21);
    const again=await sample(aTime);
    assert.equal(a.hash,again.hash,`Seek-dependent state in ${s.id}`);
    checks.push({scene:s.id,shot:s.shot,start:aTime,end:bTime,firstFrame:a.probe.motion.frame,lastFrame:b.probe.motion.frame,sourceFramesChange:true,deterministic:true,startHash:a.hash,endHash:b.hash});
  }
  const evidence=[['lift-start',70.3],['lift-middle',74],['lift-end',77.7],['victory',81]];
  for(const [name,t]of evidence){await sample(t);const data=await page.evaluate(()=>document.querySelector('#film').toDataURL('image/jpeg',.95).split(',')[1]);await writeFile(out+`motion-${name}.jpg`,Buffer.from(data,'base64'));}
  assert.deepEqual(errors,[]);
  await writeFile(out+'motion-check.json',JSON.stringify({duration:film.duration,sourceFootageSeconds:62,generatedMotionSeconds:13,checks,browserErrors:errors},null,2)+'\n');
  console.log('PASS: generated video frames advance across the 13-second finale; deterministic seeking.');
}finally{await browser.close();server.close();}
