import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { resource, readJson, writeJson } from './vehicle-assets.mjs';

// Select the manufacturer's stock trim and paint without changing the geometry.
const source = await readFile(path.join(resource, 'sources/hyundai-ioniq5-original.glb'));
assert.equal(source.toString('ascii', 0, 4), 'glTF');
assert.equal(source.readUInt32LE(8), source.length, 'Incomplete official GLB');
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
const config = await readJson(path.join(resource, 'sources/hyundai-ioniq5-config.json'));
const stock = config.options.find(o => o.name === 'IONIQ 5');
assert(stock, 'Official stock trim configuration missing');
const visible = new Set(stock.visibleObjs);
const variants = gltf.extensions.KHR_materials_variants.variants;
const paint = variants.findIndex(v => v.name === 'CyberGrey');
assert(paint >= 0, 'Official CyberGrey material missing');
let triangles = 0;
for (const node of gltf.nodes) {
  if (node.mesh !== undefined && !visible.has(node.name)) delete node.mesh;
  if (node.mesh !== undefined) {
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      triangles += gltf.accessors[primitive.indices].count / 3;
    }
  }
  if (node.extensions) delete node.extensions.KHR_lights_punctual;
}
assert(triangles > 100000, 'Stock body, wheels or interior missing');
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  const mapping = primitive.extensions?.KHR_materials_variants?.mappings.find(m => m.variants.includes(paint));
  if (mapping) primitive.material = mapping.material;
  if (primitive.extensions) delete primitive.extensions.KHR_materials_variants;
}
for (const key of ['KHR_materials_variants', 'KHR_lights_punctual']) delete gltf.extensions[key];
for (const key of ['extensionsUsed', 'extensionsRequired']) {
  gltf[key] = gltf[key].filter(e => !['KHR_materials_variants', 'KHR_lights_punctual'].includes(e));
}
gltf.asset.copyright = 'Hyundai Motor Company / Hyundai Motor Company Australia. No open redistribution license asserted.';
gltf.asset.extras = {
  sourceUrl: 'https://www.hyundai.com/au/en/cars/eco/ioniq5',
  modification: 'Stock IONIQ 5 trim, CyberGrey paint, configurator lights and other trim parts disabled. Original geometry retained.',
};
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
json.copy(padded);
const remainingChunks = source.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.write('glTF'); header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + remainingChunks.length, 8);
header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const result = Buffer.concat([header, padded, remainingChunks]);
await writeFile(path.join(resource, 'models/hyundai_ioniq5.glb'), result);
await writeJson(path.join(resource, 'sources/hyundai-ioniq5-preparation.json'), {
  sourceUrl: gltf.asset.extras.sourceUrl,
  downloadUrl: 'https://www.hyundai.com/content/dam/hyundai/au/en/cgi/ioniq5/IONIQ5-7.glb',
  configUrl: 'https://www.hyundai.com/content/dam/hyundai/au/en/cgi/ioniq5/IONIQ5-2026.json',
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  outputSha256: createHash('sha256').update(result).digest('hex'),
  visibleNodes: [...visible].filter(name => gltf.nodes.some(n => n.name === name && n.mesh !== undefined)),
  triangles, modification: gltf.asset.extras.modification,
  license: 'Manufacturer copyright; public configurator asset. Open redistribution permission not stated.',
});
console.log(`Prepared genuine Hyundai IONIQ 5: ${triangles.toLocaleString()} triangles, ${result.length} bytes.`);
