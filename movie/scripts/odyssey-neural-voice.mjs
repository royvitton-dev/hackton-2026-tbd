import {mkdir,readFile,writeFile,copyFile,access,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {film,voices} from '../assets/odyssey/timeline.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=path.join(root,'tmp/odyssey/neural'),out=path.join(root,'assets/odyssey');
await mkdir(scratch,{recursive:true});await mkdir(path.join(out,'voices-neural'),{recursive:true});
const cli=process.env.EDGE_TTS_BIN||path.join(root,'tmp/odyssey/venv/bin/edge-tts');
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024,...options});
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames,channels:format=duration,size','-of','json',file]));
const exists=async file=>{try{await access(file);return true;}catch{return false;}};
const backup=path.join(scratch,'before-neural.mp4'),target=path.join(root,'output/gs-codeyssey-trailer.mp4');
const remux=!process.argv.includes('--audio-only');
if(remux&&!await exists(backup))await copyFile(target,backup);
const shorter={};
const manifest=[],inputs=['-i',path.join(root,'tmp/odyssey/audio/score.wav')],filters=[],problems=[];
for(const [i,v]of voices.entries()){
  const voice={narrator:'ko-KR-HyunsuMultilingualNeural',ai:'ko-KR-SunHiNeural',developer:'ko-KR-InJoonNeural'}[v.role];
  const rate=v.at>=60?'-5%':'+0%';
  let spoken=v.text,source,duration,file;
  for(let attempt=0;attempt<2;attempt++){
    const signature=createHash('sha256').update(JSON.stringify({voice,rate,text:spoken,revision:1})).digest('hex').slice(0,16);
    source=path.join(scratch,`${signature}.mp3`);const subtitles=path.join(scratch,`${signature}.srt`);
    if(!await exists(source)||!await exists(subtitles))run(cli,['--voice',voice,`--rate=${rate}`,'--text',spoken,'--write-media',source,'--write-subtitles',subtitles],{timeout:60000});
    const raw=probe(source);assert(Number(raw.format.duration)>.2,`Empty neural voice ${i}`);
    const cues=[...(await readFile(subtitles,'utf8')).matchAll(/(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})/g)];
    const stamp=parts=>Number(parts[0])*3600+Number(parts[1])*60+Number(parts[2])+Number(parts[3])/1000;
    const start=cues.length?Math.max(0,stamp(cues[0].slice(1,5))-.05):0;
    const end=cues.length?Math.min(Number(raw.format.duration),stamp(cues.at(-1).slice(5,9))+.12):Number(raw.format.duration);
    file=path.join(out,`voices-neural/${String(i).padStart(2,'0')}.wav`);
    run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',source,'-af',`atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,highpass=f=70,loudnorm=I=-18:TP=-2:LRA=9`,'-ar','48000','-ac','2',file]);
    duration=Number(probe(file).format.duration);
    if(duration<=v.until-v.at-.02)break;
    if(attempt===0&&shorter[i])spoken=shorter[i];
    else {problems.push(`${i}: ${duration.toFixed(2)}s for ${(v.until-v.at).toFixed(2)}s · ${spoken}`);break;}
  }
  inputs.push('-i',file);filters.push(`[${i+1}:a]adelay=${Math.round(v.at*1000)}|${Math.round(v.at*1000)}[v${i}]`);
  manifest.push({...v,text:spoken,scriptText:v.text,voice,engine:'Microsoft Edge Neural',nativeRate:rate,rawDuration:Number(probe(source).format.duration),duration,tempo:1,pitch:1,file:`voices-neural/${String(i).padStart(2,'0')}.wav`});
  console.log(`Natural voice ${i+1}/${voices.length}: ${voice} · ${duration.toFixed(2)}s · ${spoken}`);
}
if(problems.length)throw new Error(`Natural delivery needs more room. Revise the lines, not playback speed:\n${problems.join('\n')}`);
const soundtrack=path.join(scratch,'soundtrack.wav');
filters.push(`[0:a]${voices.map((_,i)=>`[v${i}]`).join('')}amix=inputs=${voices.length+1}:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=10[out]`);
run('ffmpeg',['-hide_banner','-loglevel','error','-y',...inputs,'-filter_complex',filters.join(';'),'-map','[out]','-ar','48000','-ac','2','-t',String(film.duration),soundtrack]);
assert.equal(Number(probe(soundtrack).format.duration),film.duration);
if(!remux){
  await copyFile(soundtrack,path.join(out,'soundtrack.wav'));
  await writeFile(path.join(out,'voice-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('PASS: Korean neural soundtrack ready; no pitch shift or audio speed changes.');
}else{
const candidate=path.join(scratch,'natural-voice-trailer.mp4');
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',target,'-i',soundtrack,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t',String(film.duration),'-movflags','+faststart','-metadata',`title=${film.title}`,'-metadata','comment=Korean neural voices at natural pitch and playback speed. GS Hackathon participant parody.',candidate]);
const media=probe(candidate);assert.equal(Number(media.format.duration),film.duration);assert.equal(Number(media.streams.find(s=>s.codec_type==='video').nb_frames),film.duration*film.fps);
run('ffmpeg',['-v','error','-i',candidate,'-f','null','-']);
const videoHash=file=>run('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
assert.equal(videoHash(candidate),videoHash(target),'Voice revision must retain the encoded picture');
await copyFile(soundtrack,path.join(out,'soundtrack.wav'));
await writeFile(path.join(out,'voice-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await rename(candidate,target);
const renderFile=path.join(root,'output/odyssey/render-check.json'),previous=JSON.parse(await readFile(renderFile,'utf8'));
const sha256=createHash('sha256').update(await readFile(target)).digest('hex');
await writeFile(renderFile,JSON.stringify({...previous,sha256,media,voiceRevision:{engine:'Microsoft Edge Neural',voices:[...new Set(manifest.map(v=>v.voice))],pitchShift:false,playbackSpeedChange:false,sourcePictureHash:videoHash(target)},fullDecode:'passed'},null,2)+'\n');
console.log(`PASS: ${film.duration}-second film with Korean neural voices, no pitch shift or audio speed changes; original picture stream preserved.`);
}
