import {chromium} from '../../node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {serve} from './serve.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'output/tour/manifest.json'),'utf8'));
const rendering=JSON.parse(await readFile(path.join(root,'output/tour/render-check.json'),'utf8'));
const hash=createHash('sha256').update(await readFile(path.join(root,'output/wonder-park-tour.mp4'))).digest('hex');
assert.equal(rendering.sha256,hash);assert.equal(rendering.fullDecode,'passed');
const server=process.env.PARK_URL?null:await serve(0);
const base=process.env.PARK_URL?new URL('/movie',process.env.PARK_URL).href:`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?film=attractions');await page.waitForFunction(()=>document.body.dataset.film==='attractions'&&document.querySelector('video').readyState>=1);
 const media=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error,src:v.currentSrc}));
 assert.equal(media.duration,manifest.duration);assert.equal(media.width,1920);assert.equal(media.height,1080);assert.equal(media.error,null);assert(media.src.endsWith('wonder-park-tour.mp4'));
 assert.equal(await page.locator('.chapter').count(),manifest.attractionIds.length+2);
 await page.locator('video').evaluate(v=>{v.muted=true;v.textTracks[0].mode='hidden';});
 const moments=manifest.chapters.flatMap(c=>(c.segments||[]).map(s=>({attraction:c.id,id:s.id,time:c.demoStart+s.start})));
 assert.equal(await page.locator('.tour-moments .moment').count(),moments.length);
 for(const moment of moments){
  const at=moment.time;await page.locator(`.tour-moments[data-attraction="${moment.attraction}"] .moment[data-time="${at}"]`).click();
  await page.waitForFunction(t=>{const v=document.querySelector('video');return !v.seeking&&v.currentTime>=t&&v.currentTime<t+1.5;},at);
  await page.locator('video').evaluate(v=>v.pause());
 }
 await page.locator(`.chapter[data-time="${manifest.chapters.at(-1).start}"]`).click();
 await page.waitForFunction(t=>document.querySelector('video').currentTime>t+.5,manifest.chapters.at(-1).start);
 await page.locator('video').evaluate(v=>v.pause());
 await page.waitForFunction(n=>document.querySelector('video').textTracks[0].cues?.length===n,manifest.chapters.length);
 await page.locator('video').evaluate((v,t)=>{v.currentTime=t;},manifest.duration-4.5);
 await page.waitForFunction(()=>!document.querySelector('video').seeking);
 await page.screenshot({path:path.join(root,'output/tour/preview-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(root,'output/tour/preview-mobile.png'),fullPage:true});
 const partial=await page.request.get(base+'/output/wonder-park-tour.mp4',{headers:{Range:'bytes=0-255'}});assert.equal(partial.status(),206);assert.equal((await partial.body()).length,256);
 assert.deepEqual(errors,[]);
 await writeFile(path.join(root,'output/tour/playback-check.json'),JSON.stringify({sha256:hash,media,playbackAdvances:true,chapterSeeking:true,moments,captionCues:manifest.chapters.length,mobileOverflow:false,byteRanges:true,browserErrors:errors},null,2)+'\n');
 console.log('PASS: tour playback, all attraction moments, GS finale, all chapters, Korean captions, mobile and range requests.');
}finally{await browser.close();server?.close();}
