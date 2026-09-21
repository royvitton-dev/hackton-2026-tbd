import { copyFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { directories, root, resource, publicRoot, manifestPath, readJson, writeJson } from './vehicle-assets.mjs';
await directories();
const entries = await readJson(manifestPath);
for (const e of entries) {
  for (const [ok,from,to] of [[e.downloaded,e.resourceOriginalPath,e.publicOriginalPath],[e.cutoutGenerated,e.resourceCutoutPath,e.publicCutoutPath]]) {
    const target=path.join(root,'public',to);
    if (ok) await copyFile(path.join(root,from),target);
    else await rm(target,{force:true}); // Only remove this tool's stale runtime copy.
  }
}
for (const f of await readdir(path.join(resource,'models'))) if (/\.glb$/i.test(f)) {
  const source=path.join(resource,'models',f),data=await readFile(source);
  if(data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(8)!==data.length)throw new Error(`Refusing to sync incomplete GLB: ${f}`);
  await copyFile(source,path.join(publicRoot,'models',f));
}
await copyFile(path.join(resource,'models/CREDITS.md'),path.join(publicRoot,'models/CREDITS.md'));
await mkdir(path.join(publicRoot,'decoders'),{recursive:true});
for(const file of ['draco_decoder.js','draco_decoder.wasm','draco_wasm_wrapper.js'])await copyFile(path.join(root,'node_modules/three/examples/jsm/libs/draco/gltf',file),path.join(publicRoot,'decoders',file));
await writeJson(path.join(publicRoot,'image_sources.json'),entries);
await writeJson(path.join(root,'src/data/vehicleImageSources.json'),entries);
const models=await readJson(path.join(resource,'model_sources.json'));
await writeJson(path.join(publicRoot,'model_sources.json'),models);
await writeJson(path.join(root,'src/data/vehicleModelSources.json'),models);
console.log(`Synced ${entries.filter(e=>e.downloaded).length} original mappings, ${entries.filter(e=>e.cutoutGenerated).length} cutout mappings.`);
