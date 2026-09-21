import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { root, publicRoot, manifestPath, readJson } from './vehicle-assets.mjs';
const entries = await readJson(manifestPath);
const {vehicles} = await readJson(path.join(root,'src/data/battery/workbook.json'));
assert.deepEqual(entries.map(e=>e.vehicleId).sort(),vehicles.map(v=>v.vehicleId).sort());
assert.deepEqual(entries,await readJson(path.join(publicRoot,'image_sources.json')));
assert.deepEqual(entries,await readJson(path.join(root,'src/data/vehicleImageSources.json')));
const failures=[];
for (const e of entries) {
  try {
    assert(e.downloaded && e.cutoutGenerated, e.failureReason??'Asset not prepared');
    assert(e.sourceUrl && e.downloadUrl && e.license && e.author,'Missing attribution');
    for (const [source,dest] of [[e.resourceOriginalPath,e.publicOriginalPath],[e.resourceCutoutPath,e.publicCutoutPath]]) {
      const a=await readFile(path.join(root,source)),b=await readFile(path.join(root,'public',dest));
      assert(a.equals(b),'Public asset differs from original');
    }
    assert.equal((await sharp(path.join(root,e.resourceOriginalPath)).metadata()).format,'jpeg');
    const png=sharp(path.join(root,e.resourceCutoutPath));
    const meta=await png.metadata();
    assert.equal(meta.format,'png'); assert(meta.hasAlpha);
    const {data,info}=await png.raw().toBuffer({resolveWithObject:true});
    let clear=0,solid=0;
    for(let i=info.channels-1;i<data.length;i+=info.channels){if(data[i]<16)clear++;if(data[i]>240)solid++;}
    assert(clear>info.width*info.height*.08 && solid>info.width*info.height*.08,'Opaque or empty placeholder mask');
  } catch(error){failures.push(`${e.vehicleId}: ${error.message}`);}
}
const models=await readJson(path.join(root,'battery_health/resoures/images/model_sources.json'));
assert.deepEqual(models,await readJson(path.join(publicRoot,'model_sources.json')));
assert.deepEqual(models,await readJson(path.join(root,'src/data/vehicleModelSources.json')));
for(const model of models.filter(m=>m.available)){
  try{
    const name=path.basename(model.glbPath),source=await readFile(path.join(root,'battery_health/resoures/images/models',name));
    assert.equal(source.toString('ascii',0,4),'glTF');assert.equal(source.readUInt32LE(8),source.length,'Partial GLB download');
    const json=JSON.parse(source.toString('utf8',20,20+source.readUInt32LE(12)));
    let triangles=0;
    const visit=index=>{
      const node=json.nodes[index];
      if(node.mesh!==undefined)for(const primitive of json.meshes[node.mesh].primitives){
        const mode=primitive.mode??4;
        if(model.surfaceOnly)assert.equal(mode,4,'Construction lines must not overlay vehicle surfaces');
        if(mode===4)triangles+=json.accessors[primitive.indices??primitive.attributes.POSITION].count/3;
      }
      for(const child of node.children??[])visit(child);
    };
    for(const node of json.scenes[json.scene??0].nodes)visit(node);
    assert(triangles>10000,'Detailed vehicle triangle geometry missing');
    if(model.sourceTriangles)assert.equal(triangles,model.sourceTriangles,'Unexpected vehicle geometry loss');
    assert(source.equals(await readFile(path.join(root,'public',model.glbPath))),'GLB public copy differs');
    assert(model.license&&model.author&&model.sourceUrl,'GLB provenance missing');
  }catch(error){failures.push(`${model.vehicleId}: ${error.message}`);}
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else{
  console.log(`PASS: ${entries.length} vehicle mappings / ${new Set(entries.map(e=>e.fileName)).size} originals + alpha cutouts; public copies and provenance match.`);
  console.log(`GLB: ${models.filter(m=>m.available).length}/${models.length} profiles available and valid; ${models.filter(m=>!m.available).length} unavailable and explicitly recorded (not substituted).`);
}
