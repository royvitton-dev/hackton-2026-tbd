import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {applySourceUpgrades} from './source-upgrades.mjs';
const root=fileURLToPath(new URL('../public/',import.meta.url)),catalogFile=path.join(root,'sources/catalog.json'),catalog=JSON.parse(await readFile(catalogFile,'utf8'));
const target=path.join(root,'sources/resolution-upgrades.json'),sha=b=>createHash('sha256').update(b).digest('hex'),inspectedAt=new Date().toISOString();
const key=url=>{const u=new URL(url);return u.hostname+decodeURIComponent(u.pathname).normalize('NFC').replace(/-\d+x\d+(?=\.[^.]+$)/,'');};
const clean=s=>s.replaceAll('&amp;','&').replaceAll('&#038;','&');
let previous;try{previous=JSON.parse(await readFile(target,'utf8'));}catch{}
const result={inspectedAt,method:'largest-publisher-srcset-up-to-4096px',upgrades:previous?.upgrades||[],checks:[]},pages=new Map();
await mkdir(path.join(root,'sources/high-resolution'),{recursive:true});
async function get(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok){const error=Error('HTTP '+response.status+' '+url);error.stop=response.status===403||response.status===429;throw error;}
 if(Number(response.headers.get('content-length')||0)>20e6)throw Error('Source exceeds 20MB: '+url);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>20e6)throw Error('Source exceeds 20MB: '+url);return bytes;
}
for(const site of catalog.filter(s=>new URL(s.source).hostname==='magazine.brique.co')){
 try{
  const old=site.previewAsset||site.sourceAsset;
  let page=pages.get(site.source);if(!page){page=await get(site.source);pages.set(site.source,page);}
  const html=page.toString('utf8'),choices=[];
  for(const match of html.matchAll(/<img\b[^>]*>/gi)){
   const set=match[0].match(/\bsrcset="([^"]+)"/i)?.[1];if(!set)continue;
   for(const item of clean(set).split(',')){
    const pair=item.trim().match(/^(https:\/\/\S+)\s+(\d+)w$/);if(!pair)continue;
    const url=pair[1],width=Number(pair[2]);
    if(new URL(url).hostname==='media.brique.co'&&key(url)===key(old.url)&&width<=4096)choices.push({url,width});
   }
  }
  choices.sort((a,b)=>b.width-a.width);const selected=choices[0];
  const original=await sharp(await readFile(path.join(root,old.file))).metadata();
  if(!selected||selected.width<=original.width){result.checks.push({id:site.id,status:'no-larger-published-image'});console.log(site.id,'no larger published image');continue;}
  const cached=result.upgrades.find(r=>r.id===site.id&&r.asset.url===selected.url);if(cached){result.checks.push({id:site.id,status:'cached'});continue;}
  const bytes=await get(selected.url),meta=await sharp(bytes).metadata();
  if(!['jpeg','png','webp'].includes(meta.format)||meta.width*meta.height>16e6)throw Error('Unsupported source dimensions or format');
  const extension=meta.format==='jpeg'?'jpg':meta.format,file=`sources/high-resolution/${site.id}.${extension}`;
  await writeFile(path.join(root,file),bytes);
  const record={id:site.id,publisherPage:site.source,inspectedAt,pageSha256:sha(page),previous:{file:old.file,url:old.url,sha256:old.sha256,width:original.width,height:original.height},asset:{file,url:selected.url,width:meta.width,height:meta.height,bytes:bytes.length,sha256:sha(bytes)}};
  result.upgrades=result.upgrades.filter(r=>r.id!==site.id);result.upgrades.push(record);result.checks.push({id:site.id,status:'upgraded',width:meta.width,height:meta.height});
  console.log(`${site.id}: ${original.width}×${original.height} → ${meta.width}×${meta.height}`);
 }catch(error){result.checks.push({id:site.id,status:'unavailable',reason:error.message});console.error(site.id,error.message);if(error.stop)break;}
 await writeFile(target,JSON.stringify(result,null,2)+'\n');
 await new Promise(resolve=>setTimeout(resolve,350));
}
await writeFile(target,JSON.stringify(result,null,2)+'\n');
await applySourceUpgrades(catalog,root);
await writeFile(catalogFile,JSON.stringify(catalog,null,2)+'\n');
console.log(`${result.upgrades.length} publisher-declared higher-resolution drawings archived.`);
