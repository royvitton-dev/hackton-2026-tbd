import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url)),work=path.join(root,'tmp/odyssey/cinematic');
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const shots=[];
for(const name of ['lift','victory']){
  const source=path.join(work,`${name}-raw.mp4`);
  const meta=JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=width,height,r_frame_rate,nb_frames:format=duration','-of','json',source]));
  assert(Number(meta.format.duration)>=(name==='lift'?6:5));
  run('ffmpeg',['-v','error','-i',source,'-f','null','-']);
  const request=JSON.parse(await readFile(path.join(work,`${name}-request.json`),'utf8'));
  assert.equal(request.status,'generated');
  await copyFile(source,path.join(root,`assets/odyssey/cinematic-${name}.mp4`));
  const frames=path.join(work,name);await mkdir(frames,{recursive:true});
  const args=['-hide_banner','-loglevel','error','-y','-i',source];
  if(name==='lift')args.push('-vf','tpad=stop_mode=clone:stop_duration=0.2,minterpolate=fps=32:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1','-frames:v','193');
  args.push('-q:v','2',path.join(frames,'%05d.jpg'));run('ffmpeg',args);
  shots.push({...request,asset:`assets/odyssey/cinematic-${name}.mp4`,media:meta,fullDecode:'passed',renderFrameRate:name==='lift'?32:24});
}
const file=path.join(root,'assets/odyssey/cinematic-generation.json');
const record=JSON.parse(await readFile(file,'utf8'));
record.video={status:'generated',method:'LTX-2.3 image-to-video, two continuous generated shots',shots};
await writeFile(file,JSON.stringify(record,null,2)+'\n');
console.log('Generated motion clips preserved; frame sequences ready for the 85-second edit.');
