import {readFile,copyFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='output/wonder-park-30s.mp4',digest=b=>createHash('sha256').update(b).digest('hex');
const check=JSON.parse(await readFile('output/wonder/playback-check.json','utf8'));
const original=await readFile(source),hash=digest(original);
if(check.sha256!==hash||check.media.duration!==30||check.browserErrors.length)throw new Error('Verify this exact MP4 before updating the cinema compatibility path.');
await copyFile(source,'output/vitalis-hackathon-30s.mp4');
await writeFile('output/wonder/cinema-link.json',JSON.stringify({canonical:source,compatibility:'output/vitalis-hackathon-30s.mp4',sha256:hash,identical:digest(await readFile('output/vitalis-hackathon-30s.mp4'))===hash},null,2));
console.log('Existing cinema path now contains the new Wonder Park film.');
