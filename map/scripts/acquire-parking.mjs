import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../public/',import.meta.url);
const sites=JSON.parse(await readFile(new URL('plans/parking-sources.json',root),'utf8'));
await mkdir(new URL('plans/additional/',root),{recursive:true});
for(const site of sites)for(const asset of site.assets){
 const file=new URL(asset.file.slice(1),root),valid=bytes=>createHash('sha256').update(bytes).digest('hex')===asset.sha256;
 const existing=await readFile(file).catch(()=>null);if(existing&&valid(existing))continue;
 const response=await fetch(asset.url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${site.name}: HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());if(!valid(bytes))throw new Error(`${site.name}: source changed; review the drawing before updating its hash`);
 await writeFile(file,bytes);console.log(site.name,asset.label);
}
console.log(`${sites.length} parking sites verified`);
