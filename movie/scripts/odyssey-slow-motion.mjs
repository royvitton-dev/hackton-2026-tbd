import {mkdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {scenes} from '../assets/odyssey/timeline.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const slow=scenes.filter(s=>s.source!=null&&(s.speed??1)<1);
for(const s of slow){
  const out=path.join(root,'tmp/odyssey/smooth',s.id);await mkdir(out,{recursive:true});
  const last=path.join(out,`${String((s.end-s.start)*24).padStart(5,'0')}.jpg`);
  if(process.argv.includes('--only-new')&&await stat(last).then(()=>true,()=>false))continue;
  console.log('Interpolating original movie motion:',s.id);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-ss',String(s.source),'-t',String((s.end-s.start)*s.speed),'-i',path.join(root,'tmp/odyssey/source.mp4'),
    '-vf',`crop=1494:624:213:138,setpts=PTS/${s.speed},tpad=stop_mode=clone:stop_duration=0.3,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
    '-frames:v',String((s.end-s.start)*24),'-q:v','2',path.join(out,'%05d.jpg')],{stdio:'inherit'});
  await stat(last);
}
console.log(`${slow.length} slow shots have interpolated motion at 24 fps.`);
