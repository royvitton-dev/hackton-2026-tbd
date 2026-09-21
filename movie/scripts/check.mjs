import {chromium} from '../../node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {serve} from './serve.mjs';
const file='output/wonder-park-30s.mp4';
const mediaProbe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels:format=duration,size','-of','json',file]));
const vs=mediaProbe.streams.find(s=>s.codec_type==='video'),as=mediaProbe.streams.find(s=>s.codec_type==='audio');
assert.equal(vs.codec_name,'h264');assert.equal(vs.width,1920);assert.equal(vs.height,1080);assert.equal(vs.nb_frames,'900');assert.equal(vs.r_frame_rate,'30/1');assert.equal(as.codec_name,'aac');assert.equal(as.channels,2);assert.equal(Number(mediaProbe.format.duration),30);
execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-']);
await writeFile('output/wonder/media-check.json',JSON.stringify({...mediaProbe,fullDecode:'passed'},null,2));
const server=await serve(0),port=server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
 const media=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error,source:v.currentSrc}));
 assert.equal(media.duration,30);assert.equal(media.width,1920);assert.equal(media.height,1080);assert.equal(media.error,null);assert(media.source.endsWith('/output/wonder-park-30s.mp4'));delete media.source;
 await page.locator('.chapter[data-time="18.5"]').click();await page.waitForFunction(()=>document.querySelector('video').currentTime>18.8);await page.locator('video').evaluate(v=>v.pause());
 assert.equal(await page.locator('.chapter.active').getAttribute('data-time'),'18.5');
 await page.locator('video').evaluate(v=>v.textTracks[0].mode='hidden');await page.waitForFunction(()=>document.querySelector('video').textTracks[0].cues?.length===11);
 await page.locator('video').evaluate(v=>v.currentTime=28.2);await page.waitForFunction(()=>!document.querySelector('video').seeking);await page.screenshot({path:'output/wonder/preview-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/wonder/preview-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 const hash=createHash('sha256').update(await readFile(file)).digest('hex');
 await writeFile('output/wonder/playback-check.json',JSON.stringify({sha256:hash,media,chapterSeeking:true,playbackAdvances:true,captionCues:11,mobileOverflow:false,browserErrors:errors},null,2));
 console.log('PASS: exact 30s, 900 frames, H.264/AAC, complete decode, playback, seek, captions, mobile.');
}finally{await browser.close();server.close();}
