import {chromium} from '../../node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {film,scenes,voices} from '../assets/odyssey/timeline.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'output/odyssey');
const rendering=JSON.parse(await readFile(path.join(out,'render-check.json'),'utf8'));
const sha256=createHash('sha256').update(await readFile(path.join(root,'output/gs-codeyssey-trailer.mp4'))).digest('hex');
assert.equal(rendering.sha256,sha256);assert.equal(rendering.fullDecode,'passed');
assert.deepEqual(rendering.opening,['GS','GS차지비']);
let end=0;
for(const s of scenes){assert.equal(s.start,end,`Gap before ${s.id}`);assert(s.end>s.start);end=s.end;}
assert.equal(end,film.duration);
assert.equal(film.duration,85,'The cinematic edition is 85 seconds');
const voiceManifest=JSON.parse(await readFile(path.join(root,'assets/odyssey/voice-manifest.json'),'utf8'));
assert.equal(voiceManifest.length,voices.length);
for(const v of voiceManifest){
  assert.equal(v.engine,'Qwen3-TTS · MLX');assert.equal(v.tempo,1);assert.equal(v.pitch,1);
  const meta=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=channels:format=duration','-of','json',path.join(root,'assets/odyssey',v.file)],{encoding:'utf8'}));
  assert(Number(meta.format.duration)>.2,`Empty voice: ${v.text}`);
  assert(Number(meta.format.duration)<=v.until-v.at+.08,`Voice crosses cut: ${v.text}`);
}
const audioResult=spawnSync('ffmpeg',['-hide_banner','-i',path.join(root,'output/gs-codeyssey-trailer.mp4'),'-af','ebur128=peak=true','-f','null','-'],{encoding:'utf8',stdio:['ignore','ignore','pipe']});
assert.equal(audioResult.status,0);
const summary=audioResult.stderr.split('Summary:').at(-1);
const audio={integratedLUFS:Number(summary.match(/I:\s+([\d.-]+) LUFS/)?.[1]),truePeakDBFS:Number(summary.match(/Peak:\s+([\d.-]+) dBFS/)?.[1])};
assert(audio.integratedLUFS>=-18&&audio.integratedLUFS<=-14,'Audible, balanced mix');assert(audio.truePeakDBFS<=-.5,'Audio must not clip');
const server=process.env.PARK_URL?null:await serve(0);
const base=process.env.PARK_URL?new URL('/movie/',process.env.PARK_URL).href:`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  await page.goto(base+'assets/odyssey/index.html');
  await page.waitForFunction(()=>document.querySelector('video').readyState>=1,null,{timeout:30000});
  const media=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error,src:v.currentSrc}));
  assert.equal(media.duration,film.duration);assert.equal(media.width,1920);assert.equal(media.height,1080);assert.equal(media.error,null);
  await page.locator('video').evaluate(async v=>{v.muted=true;v.textTracks[0].mode='hidden';await v.play();});
  await page.waitForFunction(()=>document.querySelector('video').currentTime>.4);
  const finale=scenes.find(s=>s.id==='purpose').start,prize=scenes.find(s=>s.id==='victory').start+2;
  await page.locator(`.chapter[data-time="${finale}"]`).click();
  await page.waitForFunction(t=>document.querySelector('video').currentTime>t+.3,finale);
  await page.locator('video').evaluate((v,t)=>{v.pause();v.currentTime=t;},prize);
  await page.waitForFunction(()=>!document.querySelector('video').seeking);
  await page.waitForFunction(n=>document.querySelector('video').textTracks[0].cues?.length===n,scenes.length);
  assert.equal(await page.locator('.chapter[aria-current="true"]').getAttribute('data-time'),String(finale));
  await page.screenshot({path:path.join(out,'preview-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
  await page.screenshot({path:path.join(out,'preview-mobile.png'),fullPage:true});
  const link=await page.locator('.download').getAttribute('href');assert(new URL(link,page.url()).pathname.endsWith('/gs-codeyssey-trailer.mp4'));
  const range=await page.request.get(base+'output/gs-codeyssey-trailer.mp4',{headers:{Range:'bytes=0-255'}});
  assert.equal(range.status(),206);assert.equal((await range.body()).length,256);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const notes=await page.request.get(base+'assets/odyssey/STORYBOARD.md');assert.equal(notes.status(),200);
  await writeFile(path.join(out,process.env.PARK_URL?'shared-playback-check.json':'playback-check.json'),JSON.stringify({sha256,media,audio,base,playbackAdvances:true,finaleSeeking:true,captions:scenes.length,voiceFiles:voiceManifest.length,voiceTiming:'passed',voiceEngine:'Qwen3-TTS · MLX',pitchShift:false,playbackSpeedChange:false,mobileOverflow:false,byteRanges:true,browserErrors:errors,failedRequests:failed},null,2)+'\n');
  console.log(`PASS: ${film.duration}s, actual MP4 playback, Mac mini finale seek, ${scenes.length} captions, ${voices.length} nonempty timed voices, mobile layout, download and byte ranges.`);
}finally{await browser.close();server?.close();}
