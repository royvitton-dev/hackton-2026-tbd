import {chromium} from '../../node_modules/playwright/index.mjs';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {composeTourScore} from './tour-audio.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'output/tour'),scratch=path.join(root,'.movie-runtime/tour');
const parkUrl=process.env.PARK_URL||'http://127.0.0.1:5190',stills=process.argv.includes('--stills');
await mkdir(out,{recursive:true});await mkdir(scratch,{recursive:true});
const response=await fetch(new URL('/api/park',parkUrl));if(!response.ok)throw new Error('Park catalog unavailable');const catalog=await response.json();
assert(catalog.attractions.length>0,'A tour needs attractions');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader']});
let encoder;
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 // Ignore development hot reloads during the deterministic export.
 await page.routeWebSocket('**',socket=>{const server=socket.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['update','full-reload'].includes(JSON.parse(message).type))return;}catch{}}socket.send(message);});});
 await page.route('**/api/park',route=>route.fulfill({json:catalog}));
 // The shared Park Vite watcher excludes movie/. Use content-keyed module URLs
 // so the renderer always sees the current edit without restarting the park.
 const revision=createHash('sha256').update(await readFile(path.join(root,'tour-film.js'))).update(await readFile(path.join(root,'tour-demo.js'))).digest('hex').slice(0,12);
 await page.route('**/park/movie/*.js*',route=>{const url=new URL(route.request().url());url.searchParams.set('cut',revision);return route.continue({url:url.href});});
 await page.goto(new URL('/park/movie/tour-film.html',parkUrl).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.tourReady,null,{timeout:120000});
 const film=await page.evaluate(()=>window.tour),frames=Math.round(film.duration*film.fps);
 assert.deepEqual(film.attractionIds,catalog.attractions.map(a=>a.id));
 const recordings=[];
 for(const id of film.attractionIds){
  const file=path.join(root,'assets/tour-demo',`${id==='voice'?'voice-session':id}.json`),proof=JSON.parse(await readFile(file,'utf8'));
  if(id==='voice'){assert(proof.events.some(e=>e.type==='preview'));recordings.push({id,kind:proof.kind,execution:proof.execution});continue;}
  const chapter=film.chapters.find(c=>c.id===id);assert.equal(proof.recordedSeconds,chapter.demoDuration);assert.deepEqual(proof.browserErrors,[]);
  if(chapter.segments)assert.deepEqual(proof.segments,chapter.segments);
  if(id==='dopamin'){assert.equal(proof.podium.trophy,'raised');assert(Number(proof.coffee.served)>=2);}
  if(id==='map_new'){assert(proof.parking.after.pose.arrived);assert.equal(proof.charging.filteredCount,1);assert.equal(proof.evacuation.mode,'person');assert(proof.evacuation.after>proof.evacuation.before);}
  const clip=path.join(root,'assets/tour-demo',`${id}.mp4`),media=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',clip],{encoding:'utf8'}));assert.equal(Number(media.format.duration),chapter.demoDuration);
  recordings.push({id,features:proof.features,segments:proof.segments,sha256:createHash('sha256').update(await readFile(clip)).digest('hex'),duration:chapter.demoDuration});
 }
 const snapshot={...film,recordings,capturedAt:new Date().toISOString(),sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),catalog:catalog.attractions};
 await writeFile(path.join(scratch,'manifest.json'),JSON.stringify(snapshot,null,2)+'\n');
 const sampleTimes=[...film.chapters.slice(0,-1).map(c=>(c.start+c.end)/2),film.duration-8,film.duration-6,film.duration-4.5,film.duration-2.5,film.duration-1];
 const probes=[];
 for(const [i,t] of sampleTimes.entries()){
  probes.push(await page.evaluate(t=>window.drawTourFrame(t),t));
  await page.locator('#tour-film').screenshot({path:path.join(out,`still-${String(i).padStart(2,'0')}.png`)});
 }
 await writeFile(path.join(out,'frame-check.json'),JSON.stringify(probes,null,2)+'\n');
 assert(probes.some(p=>p.chapter==='finale'&&p.gsStage==='hold'),'GS must appear in the finale');
 assert.deepEqual(probes.filter(p=>p.demonstration).map(p=>p.chapter),film.attractionIds,'Every attraction must show its actual function demo');
 const moments=[];
 for(const chapter of film.chapters)for(const segment of chapter.segments||[]){
  const probe=await page.evaluate(t=>window.drawTourFrame(t),chapter.demoStart+(segment.start+segment.end)/2);assert.equal(probe.demonstration.segment,segment.id);moments.push(probe);
  await page.locator('#tour-film').screenshot({path:path.join(out,`${chapter.id}-${segment.id}.png`)});
 }
 assert.deepEqual(moments.map(p=>`${p.chapter}/${p.demonstration.segment}`),film.chapters.flatMap(c=>(c.segments||[]).map(s=>`${c.id}/${s.id}`)));
 await writeFile(path.join(out,'moments-check.json'),JSON.stringify(moments,null,2)+'\n');
 if(stills){assert.deepEqual(errors,[]);console.log(`Tour stills ready: ${film.attractionIds.length} attractions, ${film.duration}s.`);}
 else{
  const audio=path.join(scratch,'score.wav'),candidate=path.join(scratch,'wonder-park-tour.mp4');
  await composeTourScore(audio,film);
  encoder=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(film.fps),'-i','pipe:0','-i',audio,'-map','0:v','-map','1:a','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r',String(film.fps),'-af','loudnorm=I=-16:TP=-1.5:LRA=10','-c:a','aac','-b:a','192k','-ar','48000','-t',String(film.duration),'-movflags','+faststart','-metadata','title=Wonder Park — Eight Wonders, One Park','-metadata','comment=All current park attractions, original score and actual GS particle fireworks.',candidate],{stdio:['pipe','ignore','inherit']});
  let encoderError;encoder.on('error',e=>encoderError=e);encoder.stdin.on('error',e=>encoderError=e);const finished=once(encoder,'close');
  const started=Date.now();
  for(let frame=0;frame<frames;frame++){
   if(encoderError)throw encoderError;
   const image=await page.evaluate(async t=>{await window.drawTourFrame(t);return document.querySelector('#tour-film').toDataURL('image/jpeg',.96).split(',')[1];},frame/film.fps);
   if(!encoder.stdin.write(Buffer.from(image,'base64')))await once(encoder.stdin,'drain');
   if(frame%150===0)console.log(`Tour ${frame}/${frames} frames · ${Math.round((Date.now()-started)/1000)}s elapsed`);
  }
  encoder.stdin.end();const [code]=await finished;assert.equal(code,0,'Video encoder failed');encoder=null;assert.deepEqual(errors,[]);
  const media=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames,channels:format=duration,size','-of','json',candidate],{encoding:'utf8'}));
  const video=media.streams.find(s=>s.codec_type==='video'),sound=media.streams.find(s=>s.codec_type==='audio');
  assert.equal(Number(media.format.duration),film.duration);assert.equal(Number(video.nb_frames),frames);assert.equal(video.width,1920);assert.equal(video.height,1080);assert.equal(video.codec_name,'h264');assert.equal(sound.codec_name,'aac');assert.equal(sound.channels,2);
  execFileSync('ffmpeg',['-v','error','-i',candidate,'-f','null','-']);
  const hash=createHash('sha256').update(await readFile(candidate)).digest('hex');
  await rename(candidate,path.join(root,'output/wonder-park-tour.mp4'));
  await rename(path.join(scratch,'manifest.json'),path.join(out,'manifest.json'));
  await page.evaluate(t=>window.drawTourFrame(t),film.duration-4.5);await page.locator('#tour-film').screenshot({path:path.join(out,'poster.png')});
  const stamp=t=>new Date(t*1000).toISOString().slice(11,23);
  await writeFile(path.join(out,'captions.vtt'),'WEBVTT\n\n'+film.chapters.map(c=>`${stamp(c.start)} --> ${stamp(c.end)}\n${c.id==='opening'?'Wonder Park':c.name}\n${c.summary}\n`).join('\n'));
  await writeFile(path.join(out,'render-check.json'),JSON.stringify({sha256:hash,frames,media,fullDecode:'passed',browserErrors:errors,attractionIds:film.attractionIds,demonstrations:probes.filter(p=>p.demonstration),moments,gsFinale:probes.filter(p=>p.chapter==='finale')},null,2)+'\n');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(root,'output/wonder-park-tour.mp4'),'-vf',`fps=12/${film.duration},scale=480:270,tile=4x3:padding=8:margin=8:color=0x091426`,'-frames:v','1','-update','1',path.join(out,'contact-sheet.jpg')]);
  console.log(`PASS: ${film.duration}s / ${frames} frames / all ${film.attractionIds.length} attractions / GS finale / full decode.`);
 }
}finally{encoder?.kill('SIGTERM');await browser.close();}
