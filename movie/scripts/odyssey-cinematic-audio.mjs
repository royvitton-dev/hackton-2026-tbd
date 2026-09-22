import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {film,voices} from '../assets/odyssey/timeline.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const work=path.join(root,'tmp/odyssey/cinematic-voice');
const manifest=JSON.parse(await readFile(path.join(work,'manifest.json'),'utf8'));
assert.equal(manifest.length,voices.length);
const inputs=['-i',path.join(root,'tmp/odyssey/audio/score.wav')],filters=[];
for(const [i,v] of manifest.entries()){
  assert.equal(v.text,voices[i].text);
  assert.equal(v.at,voices[i].at);
  assert(v.duration<=v.until-v.at+.02,`Speech needs more room: ${v.text}`);
  inputs.push('-i',path.join(root,'assets/odyssey',v.file));
  filters.push(`[${i+1}:a]adelay=${Math.round(v.at*1000)}|${Math.round(v.at*1000)}[v${i}]`);
}
filters.push(`[0:a]${manifest.map((_,i)=>`[v${i}]`).join('')}amix=inputs=${manifest.length+1}:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=10[out]`);
const soundtrack=path.join(work,'soundtrack.wav');
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...inputs,
  '-filter_complex',filters.join(';'),'-map','[out]','-ar','48000','-ac','2',
  '-t',String(film.duration),soundtrack]);
await copyFile(soundtrack,path.join(root,'assets/odyssey/soundtrack.wav'));
await writeFile(path.join(root,'assets/odyssey/voice-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await copyFile(path.join(work,'voice-design.json'),path.join(root,'assets/odyssey/voice-design.json'));
console.log(`Mixed ${manifest.length} bass narrator lines at natural pitch and speed.`);
