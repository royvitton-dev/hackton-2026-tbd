import { chromium } from '../../webpage/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve } from './serve.mjs';
if(process.argv.includes('--verify')){await import('./check.mjs');process.exit(0);}
await mkdir('output',{recursive:true});await mkdir('tmp',{recursive:true});
const server=await serve(0),port=server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/film.html`);await page.waitForFunction(()=>window.filmReady);
if(process.argv.includes('--stills')){
 for(const t of [.8,3.5,7,8.7,12,16.6,19,21.5,23.8,25.7,28.3]){
  await page.evaluate(t=>window.drawFrame(t),t);
  await page.locator('canvas').screenshot({path:`output/still-${String(t).replace('.','-')}.png`});
 }
}else{
 const ff=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-vcodec','mjpeg','-framerate','30','-i','pipe:0','-i','assets/soundtrack.wav','-map','0:v','-map','1:a','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','256k','-ar','48000','-t','30','-movflags','+faststart','-metadata','title=VITALIS — MAKE IT COME ALIVE','-metadata','comment=Hackathon sample. AI reenactment stills and synthetic interview; actual VITALIS app capture; original music.','output/vitalis-hackathon-30s.mp4'],{stdio:['pipe','ignore','inherit']});
 const completed=once(ff,'close');
 for(let frame=0;frame<900;frame++){
  const b64=await page.evaluate(async t=>{await window.drawFrame(t);return document.querySelector('canvas').toDataURL('image/jpeg',.96).split(',')[1];},frame/30);
  if(!ff.stdin.write(Buffer.from(b64,'base64')))await once(ff.stdin,'drain');
  if(frame%150===0)console.log(`Rendered ${frame}/900 frames (${frame/30}s)`);
 }
 ff.stdin.end();const [exit]=await completed;if(exit!==0)throw new Error(`ffmpeg exit ${exit}`);
 await page.evaluate(()=>window.drawFrame(.8));await page.locator('canvas').screenshot({path:'output/poster.png'});
}
await writeFile('output/render-check.json',JSON.stringify({frames:900,fps:30,duration:30,width:1920,height:1080,browserErrors:errors},null,2));
await browser.close();server.close();if(errors.length)throw new Error(errors.join('\n'));
console.log('Done.');
