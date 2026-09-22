import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'public/sources/ocr'),runtime=path.join(root,'.runtime');await mkdir(dir,{recursive:true});await mkdir(runtime,{recursive:true});
const sites=JSON.parse(await readFile(path.join(root,'public/sources/catalog.json'))),manifest=[];
for(const site of sites){const file=path.join(root,'public',site.sourceAsset.file),bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex');const target=path.join(dir,site.id+'.json');let prior;try{prior=JSON.parse(await readFile(target));}catch{}if(prior?.sourceSha256===sha256)continue;manifest.push({id:site.id,file,sha256});}
if(!manifest.length){console.log('All archived OCR hashes match the current drawings.');process.exit(0);}
const list=path.join(runtime,'ocr-manifest.json');await writeFile(list,JSON.stringify(manifest));
const result=spawnSync('swift',['-module-cache-path',path.join(runtime,'swift-cache'),fileURLToPath(new URL('./recognize-text.swift',import.meta.url)),list,dir],{stdio:'inherit',env:{...process.env,CLANG_MODULE_CACHE_PATH:path.join(runtime,'clang-cache')}});process.exitCode=result.status??1;
