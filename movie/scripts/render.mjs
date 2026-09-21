import { chromium } from '../../node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir,writeFile } from 'node:fs/promises';
import {serve} from './serve.mjs';
if(process.argv.includes('--verify')){await import('./check.mjs');process.exit(0);}
await mkdir('output/wonder',{recursive:true});
const server=await serve(0),port=server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(`http://127.0.0.1:${port}/film.html`);await page.waitForFunction(()=>window.filmReady,{},{timeout:120000});
 if(process.argv.includes('--stills')){
  for(const t of [1.6,4.7,6.9,8.5,10.3,12,14.5,17.5,19.5,21.7,23.5,28.2]){await page.evaluate(t=>window.drawFrame(t),t);await page.locator('canvas#film').screenshot({path:`output/wonder/still-${String(t).replace('.','-')}.png`});}
 }else{
  const ff=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-vcodec','mjpeg','-framerate','30','-i','pipe:0','-i','assets/wonder/soundtrack.wav','-map','0:v','-map','1:a','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','256k','-ar','48000','-t','30','-movflags','+faststart','-metadata','title=Wonder Park — A Park Is Born','-metadata','comment=Original castle-opening-inspired film. Actual park models and app capture; illustrative build sequence; sample synthetic interview; original score.','output/wonder-park-30s.mp4'],{stdio:['pipe','ignore','inherit']});
  const completed=once(ff,'close');
  for(let frame=0;frame<900;frame++){
   const data=await page.evaluate(async t=>{await window.drawFrame(t);return document.querySelector('canvas#film').toDataURL('image/jpeg',.97).split(',')[1];},frame/30);
   if(!ff.stdin.write(Buffer.from(data,'base64')))await once(ff.stdin,'drain');
   if(frame%90===0)console.log(`Wonder Park: ${frame}/900 frames (${frame/30}s)`);
  }
  ff.stdin.end();const [exit]=await completed;if(exit!==0)throw new Error(`ffmpeg exit ${exit}`);
  await page.evaluate(()=>window.drawFrame(28.2));await page.locator('canvas#film').screenshot({path:'output/wonder/poster.png'});
  await writeFile('output/wonder/render-check.json',JSON.stringify({frames:900,fps:30,duration:30,width:1920,height:1080,browserErrors:errors},null,2));
 }
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Wonder Park rendering complete.');
}finally{await browser.close();server.close();}
