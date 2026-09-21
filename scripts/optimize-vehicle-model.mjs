import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, draco, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: node scripts/optimize-vehicle-model.mjs source.glb output.glb');
const data=await readFile(input);
if(data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(8)!==data.length)throw new Error('Incomplete or invalid GLB; refusing to publish');
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder':await draco3d.createDecoderModule(),
  'draco3d.encoder':await draco3d.createEncoderModule(),
});
const document=await io.read(input);
const triangles=()=>document.getRoot().listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
const before=triangles();
await document.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.18,error:.001}),prune(),textureCompress({encoder:sharp,resize:[2048,2048]}),draco());
await io.write(output,document);
console.log(JSON.stringify({input,output,sourceTriangles:before,optimizedTriangles:triangles(),bytes:(await readFile(output)).length}));
