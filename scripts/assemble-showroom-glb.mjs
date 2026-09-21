// Assemble manufacturer GLB parts with the public showroom's transforms,
// trim selection and materials. No vehicle geometry is generated.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat, KHRTextureTransform } from '@gltf-transform/extensions';
import { copyToDocument, dedup, prune, draco, unpartition, join } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { Color, Euler, Quaternion } from 'three';
import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';

const run = promisify(execFile);
const [specPath] = process.argv.slice(2);
if (!specPath) throw new Error('Usage: node scripts/assemble-showroom-glb.mjs source.json');
const spec = JSON.parse(await readFile(specPath, 'utf8'));
const directory = path.dirname(specPath), downloads = [];
await mkdir(path.join(directory, 'assets'), { recursive: true });
async function download(relative, local) {
  const url = new URL(relative, spec.baseUrl).href, target = path.join(directory, local);
  try { await readFile(target); } catch {
    try {
      await run('curl', ['-fLsS', '--max-time', '120', url, '-o', target + '.part']);
      await rename(target + '.part', target);
    } catch (error) {
      await writeFile(path.join(directory, 'failure.json'), JSON.stringify({ vehicle: spec.name, url, error: error.message, nextAction: 'Retry the original public download; do not generate a replacement.' }, null, 2));
      throw error;
    }
  }
  const data = await readFile(target);
  downloads.push({ url, file: local, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  return data;
}
const json = async (url, local) => JSON.parse((await download(url, local)).toString('utf8'));
const config = await json(spec.configUrl, 'config.json');
const source = await json(spec.sceneUrl, 'scene.json');
const format = source.compressedFormat;
function expand(value) {
  if (Array.isArray(value)) return value.map(expand);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const index = [...key].reduce((n, c) => n * format.fieldCodeBase + c.charCodeAt(0) - format.fieldFirstCode, 0);
    return [key.length <= 2 ? format.fieldArray[index] : key, expand(item)];
  }));
}
const entities = format ? expand(source.entities) : source.entities;
if (format) for (const entity of Object.values(entities)) {
  const offsets = entity.___1 ?? format.tripleVecs.slice(entity.___2, entity.___2 + 3);
  [entity.position, entity.rotation, entity.scale] = offsets.map(o => format.singleVecs.slice(o, o + 3));
}
const fsc = await json(spec.fscUrl, 'fsc.json'), partNames = await json(spec.partsUrl, 'fsc-map.json');
if (!fsc[spec.fsc]) throw new Error(`Unknown source trim ${spec.fsc}`);
const selectedParts = new Set(fsc[spec.fsc].parts.map(id => partNames[id]));
const colors = await json(spec.colorsUrl, 'color.json'), names = await json(spec.colorMapUrl, 'color-map.json');
const colorTable = colors[Object.keys(names).find(key => names[key] === spec.fsc)];
const replacements = {};
for (const color of spec.colors) {
  const key = Object.keys(colorTable).find(key => names[key] === color);
  if (!key) throw new Error(`Unknown source color ${color}`);
  for (const [from, to] of Object.entries(colorTable[key])) replacements[names[from]] = names[to];
}
const byName = new Map(Object.values(config.assets).filter(a => a.type === 'material').map(a => [a.name, a]));
const document = new Document(), scene = document.createScene(spec.name);
document.getRoot().setDefaultScene(scene);
document.getRoot().getAsset().copyright = spec.copyright;
const coat = document.createExtension(KHRMaterialsClearcoat), textureTransform = document.createExtension(KHRTextureTransform);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule(),
});
const containers = new Map(), materials = new Map(), textures = new Map();
const linear = rgb => new Color(...rgb).convertSRGBToLinear().toArray();
async function material(originalId) {
  const original = config.assets[originalId];
  const baseName = original.name.replace(/@$/, '');
  const asset = byName.get(replacements[baseName]) ?? byName.get(baseName) ?? original;
  if (materials.has(asset.id)) return materials.get(asset.id);
  const d = asset.data, paint = ['SAW', 'A2B'].includes(asset.name) || /PAINT/.test(asset.name);
  const result = document.createMaterial(asset.name)
    .setBaseColorFactor([...linear(d.diffuse ?? [1, 1, 1]), d.opacity ?? 1])
    .setMetallicFactor(d.useMetalness ? d.metalness ?? 0 : 0)
    .setRoughnessFactor(Math.max(.14, 1 - (d.shininess ?? 25) / 100))
    .setDoubleSided(d.cull === 0);
  if (d.opacity < 1) result.setAlphaMode('BLEND');
  if (d.alphaTest > 0) result.setAlphaMode('MASK').setAlphaCutoff(d.alphaTest);
  if (paint || d.clearCoat) result.setExtension('KHR_materials_clearcoat', coat.createClearcoat().setClearcoatFactor(d.clearCoat || .6).setClearcoatRoughnessFactor(.2));
  for (const [key, setter, info] of [
    ['diffuseMap', 'setBaseColorTexture', 'getBaseColorTextureInfo'],
    ['normalMap', 'setNormalTexture', 'getNormalTextureInfo'],
    ['aoMap', 'setOcclusionTexture', 'getOcclusionTextureInfo'],
    ['emissiveMap', 'setEmissiveTexture', 'getEmissiveTextureInfo'],
  ]) if (d[key]) {
    const id = d[key];
    if (!textures.has(id)) {
      const a = config.assets[id];
      const bytes = await download(a.file.url, `assets/${id}-${path.basename(a.file.filename)}`);
      const alpha = (await sharp(bytes).metadata()).hasAlpha;
      const pipeline = sharp(bytes).flip().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true });
      const image = await (alpha || key === 'normalMap' ? pipeline.png() : pipeline.jpeg({ quality: 92 })).toBuffer();
      textures.set(id, document.createTexture(a.name).setImage(image).setMimeType(alpha || key === 'normalMap' ? 'image/png' : 'image/jpeg'));
    }
    result[setter](textures.get(id));
    result[info]().setTexCoord(d[key + 'Uv'] ?? 0);
    result[info]().setExtension('KHR_texture_transform', textureTransform.createTransform().setScale(d[key + 'Tiling'] ?? [1, 1]).setOffset(d[key + 'Offset'] ?? [0, 0]));
  }
  result.setEmissiveFactor(linear(d.emissiveMap && !d.emissiveTint ? [1, 1, 1] : d.emissive ?? [0, 0, 0]));
  if (d.normalMap) result.setNormalScale(d.bumpMapFactor ?? 1);
  materials.set(asset.id, result);
  return result;
}
let triangles = 0, partCount = 0;
async function visit(id, parent, depth, variant) {
  const e = entities[id];
  if (spec.excludeNamePattern && new RegExp(spec.excludeNamePattern, 'i').test(e.name)) return;
  // Official configurator enables one set of parts, including one seat color.
  if (variant && depth === 2) {
    const seat = /_(NNB|YGU|YGN)$/.exec(e.name);
    if (seat ? seat[1] !== spec.seatColor || !selectedParts.has(e.name.slice(0, -seat[0].length)) : !selectedParts.has(e.name)) return;
    partCount++;
  } else if (depth > 2 && !e.enabled) return;
  const q = new Quaternion().setFromEuler(new Euler(...e.rotation.map(x => x * Math.PI / 180), 'ZYX'));
  const node = document.createNode(e.name).setTranslation(e.position).setRotation(q.toArray()).setScale(e.scale);
  parent.addChild(node);
  const render = e.components?.render;
  if (render?.enabled && render.asset) {
    const data = config.assets[render.asset].data;
    if (!containers.has(data.containerAsset)) {
      const asset = config.assets[data.containerAsset];
      const input = await io.readBinary(await download(asset.file.url, path.basename(asset.file.filename)));
      const sourceMeshes = input.getRoot().listMeshes();
      const copies = copyToDocument(document, input, sourceMeshes);
      containers.set(data.containerAsset, sourceMeshes.map(mesh => copies.get(mesh)));
    }
    const sourceMesh = containers.get(data.containerAsset)[data.renderIndex];
    if (!sourceMesh) throw new Error(`Missing original mesh: ${e.name}`);
    const mesh = document.createMesh(e.name);
    for (const [i, primitive] of sourceMesh.listPrimitives().entries()) {
      const copy = primitive.clone().setMaterial(await material(render.materialAssets[i]));
      mesh.addPrimitive(copy);
      triangles += copy.getIndices().getCount() / 3;
    }
    node.setMesh(mesh);
  }
  for (const child of e.children) await visit(child, node, depth + 1, variant);
}
for (const name of spec.renderRoots) {
  const entry = Object.entries(entities).find(([, e]) => e.name === name);
  if (!entry) throw new Error(`Missing source root ${name}`);
  await visit(entry[0], scene, 0, spec.variantRoots.includes(name));
}
// Merge compatible draw calls without decimating the manufacturer's geometry.
await document.transform(prune(), dedup(), join(), unpartition(), draco());
await io.write(spec.outputPath, document);
const output = await readFile(spec.outputPath), exported = await io.read(spec.outputPath);
let renderedTriangles = 0;
exported.getRoot().getDefaultScene().traverse(node => {
  for (const primitive of node.getMesh()?.listPrimitives() ?? []) renderedTriangles += primitive.getIndices().getCount() / 3;
});
const report = { name: spec.name, sourceUrl: spec.sourceUrl, license: spec.copyright, fsc: spec.fsc, colors: spec.colors, partCount, sourceTriangles: triangles, renderedTriangles, bytes: output.length, outputPath: spec.outputPath, sha256: createHash('sha256').update(output).digest('hex'), downloads };
await writeFile(path.join(directory, 'conversion.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ name: spec.name, triangles: renderedTriangles, bytes: output.length, partCount }));
