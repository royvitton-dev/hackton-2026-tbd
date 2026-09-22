import {chromium} from '../../node_modules/playwright/index.mjs';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,readFile,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {film as fullFilm,scenes as fullScenes} from '../assets/odyssey/timeline.mjs';

const preview=process.argv.includes('--cut-preview');
const film={...fullFilm,duration:preview?70:fullFilm.duration};
const scenes=fullScenes.filter(s=>s.end<=film.duration);
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,preview?'output/odyssey/cinematic-preview':'output/odyssey');
await mkdir(out,{recursive:true});
for(const file of await readdir(out))if(/^still-\d+-[a-z]+\.jpg$/.test(file))await unlink(path.join(out,file));
const server=await serve(0),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader']});
let encoder;
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('console',message=>{if(message.type()==='error')console.error(message.text());});
  page.on('requestfailed',request=>console.error(`Resource failed: ${request.url()} ${request.failure()?.errorText}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/assets/odyssey/render.html`);
  await page.waitForFunction(()=>window.filmReady,null,{timeout:120000});
  const probes=[];
  for(const [i,s]of scenes.entries()){
    const t=s.start+(s.end-s.start)*.62;
    const capture=await page.evaluate(async t=>({probe:await window.drawFrame(t),pixels:document.querySelector('#film').toDataURL('image/jpeg',.92).split(',')[1]}),t);
    probes.push(capture.probe);
    await writeFile(path.join(out,`still-${String(i).padStart(2,'0')}-${s.id}.jpg`),Buffer.from(capture.pixels,'base64'));
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'storyboard.json'),JSON.stringify({film,scenes,probes},null,2)+'\n');
  const tiles=await Promise.all(scenes.map(async(s,i)=>({input:await sharp(path.join(out,`still-${String(i).padStart(2,'0')}-${s.id}.jpg`)).resize(384,216).toBuffer(),left:i%5*392+8,top:Math.floor(i/5)*224+8})));
  await sharp({create:{width:1968,height:Math.ceil(scenes.length/5)*224+8,channels:3,background:'#152028'}}).composite(tiles).jpeg({quality:92}).toFile(path.join(out,'contact-sheet.jpg'));
  if(process.argv.includes('--stills'))console.log(`PASS: ${scenes.length} scene previews, no browser errors.`);
  else{
    const candidate=path.join(root,preview?'tmp/odyssey/cinematic-cut-preview.mp4':'tmp/odyssey/gs-codeyssey-trailer.mp4');
    encoder=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(film.fps),'-i','pipe:0','-i',path.join(root,'assets/odyssey/soundtrack.wav'),'-map','0:v','-map','1:a','-c:v','libx264','-threads','4','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r',String(film.fps),'-c:a','aac','-b:a','256k','-ar','48000','-t',String(film.duration),'-movflags','+faststart','-metadata',`title=${film.title}`,'-metadata','comment=GS Hackathon participant parody. Re-edited excerpts from The Odyssey final trailer (Universal Pictures, zz2ZH13NOi8). Fictional Korean dialogue, synthetic voices and original score.',candidate],{stdio:['pipe','ignore','inherit']});
    let error;encoder.on('error',e=>error=e);encoder.stdin.on('error',e=>error=e);const finished=once(encoder,'close'),frames=film.duration*film.fps,started=Date.now();
    for(let frame=0;frame<frames;frame++){
      if(error)throw error;
      const data=await page.evaluate(async t=>{await window.drawFrame(t);return document.querySelector('#film').toDataURL('image/jpeg',.97).split(',')[1];},frame/film.fps);
      if(!encoder.stdin.write(Buffer.from(data,'base64')))await once(encoder.stdin,'drain');
      if(frame%240===0)console.log(`Codeyssey ${frame}/${frames} frames · ${Math.round((Date.now()-started)/1000)}s elapsed`);
    }
    encoder.stdin.end();const[code]=await finished;assert.equal(code,0);encoder=null;assert.deepEqual(errors,[]);
    const media=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames,channels:format=duration,size','-of','json',candidate],{encoding:'utf8'}));
    const v=media.streams.find(s=>s.codec_type==='video'),a=media.streams.find(s=>s.codec_type==='audio');
    assert.equal(Number(media.format.duration),film.duration);assert.equal(Number(v.nb_frames),frames);assert.equal(v.width,1920);assert.equal(v.height,1080);assert.equal(v.codec_name,'h264');assert.equal(a.codec_name,'aac');assert.equal(a.channels,2);
    execFileSync('ffmpeg',['-v','error','-i',candidate,'-f','null','-']);
    const sha256=createHash('sha256').update(await readFile(candidate)).digest('hex');
    await rename(candidate,path.join(root,preview?'output/odyssey/cinematic-cut-preview.mp4':'output/gs-codeyssey-trailer.mp4'));
    const poster=async(t,file)=>{const data=await page.evaluate(async t=>{await window.drawFrame(t);return document.querySelector('#film').toDataURL('image/jpeg',.96).split(',')[1];},t);await writeFile(path.join(out,file),Buffer.from(data,'base64'));};
    await poster(scenes.find(s=>s.id==='title').start+1.5,'poster.jpg');
    if(!preview)await poster(scenes.find(s=>s.id==='victory').start+2,'poster-macmini.jpg');
    await writeFile(path.join(out,'render-check.json'),JSON.stringify({sha256,frames,media,fullDecode:'passed',browserErrors:errors,opening:scenes.slice(0,2).map(s=>s.name)},null,2)+'\n');
    const stamp=t=>new Date(t*1000).toISOString().slice(11,23);
    await writeFile(path.join(out,'captions.vtt'),'WEBVTT\n\n'+scenes.map(s=>`${stamp(s.start)} --> ${stamp(s.end)}\n${[s.kicker,s.speaker,s.line??s.name].filter(Boolean).join('\n')}\n`).join('\n'));
    console.log(`PASS: ${film.duration}s / ${frames} frames / 1080p / H.264 + AAC / full decode.`);
  }
}finally{encoder?.kill('SIGTERM');await browser.close();server.close();}
