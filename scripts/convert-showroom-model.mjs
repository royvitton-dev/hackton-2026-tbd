// Convert public PlayCanvas showroom geometry to a self-contained glTF model.
// No geometry is synthesized: keep source vertices, normals, UVs and part transforms.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { dedup, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { Euler, Quaternion, Color } from 'three';
import sharp from 'sharp';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';

const run = promisify(execFile);
const [specPath] = process.argv.slice(2);
if (!specPath) throw new Error('Usage: node scripts/convert-showroom-model.mjs source-spec.json');
const spec = JSON.parse(await readFile(specPath, 'utf8'));
const directory = path.dirname(specPath);
await mkdir(path.join(directory, 'assets'), { recursive: true });
const downloads = [];
async function download(relativeUrl, localName) {
  const url = new URL(relativeUrl, spec.baseUrl).href;
  const target = path.join(directory, localName);
  try { await readFile(target); }
  catch {
    await run('curl', ['--fail', '--location', '--silent', '--show-error', '--max-time', '90', url, '-o', `${target}.part`]);
    await rename(`${target}.part`, target);
  }
  const data = await readFile(target);
  downloads.push({ url, file: localName, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  return { target, data };
}
async function readSourceJson(url, name) {
  const { target, data } = await download(url, name);
  if (data[0] === 0x50 && data[1] === 0x4b) {
    const { stdout } = await run('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); sys.stdout.buffer.write(z.read(z.namelist()[0]))', target], { maxBuffer: 128 * 1024 * 1024 });
    return JSON.parse(stdout);
  }
  return JSON.parse(data.toString('utf8'));
}
const config = await readSourceJson(spec.configUrl, 'config.source');
const sourceScene = await readSourceJson(spec.sceneUrl, 'scene.source');
if (sourceScene.compressedFormat) {
  const format = sourceScene.compressedFormat;
  const expand = value => {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const index = [...key].reduce((n, c) => n * format.fieldCodeBase + c.charCodeAt(0) - format.fieldFirstCode, 0);
      return [key.length <= 2 ? format.fieldArray[index] : key, expand(item)];
    }));
  };
  sourceScene.entities = expand(sourceScene.entities);
  for (const entity of Object.values(sourceScene.entities)) {
    const offsets = entity.___1 ?? format.tripleVecs.slice(entity.___2, entity.___2 + 3);
    [entity.position, entity.rotation, entity.scale] = offsets.map(offset => format.singleVecs.slice(offset, offset + 3));
  }
}
const document = new Document();
const buffer = document.createBuffer();
const scene = document.createScene(spec.name);
document.getRoot().setDefaultScene(scene);
document.getRoot().getAsset().copyright = spec.copyright;
const clearcoat = document.createExtension(KHRMaterialsClearcoat);
const materials = new Map();
const textures = new Map();
const linear = rgb => new Color(...rgb).convertSRGBToLinear().toArray();
async function texture(id) {
  if (textures.has(id)) return textures.get(id);
  const asset = config.assets[id];
  if (!asset?.file) throw new Error(`Missing source texture ${id}`);
  const { data } = await download(asset.file.url, `assets/${id}-${path.basename(asset.file.filename)}`);
  // PlayCanvas uses bottom-left UV origin. Flip images for glTF's top-left origin.
  const jpeg = /\.jpe?g$/i.test(asset.file.filename);
  const pipeline = sharp(data).flip().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true });
  const encoded = await (jpeg ? pipeline.jpeg({ quality: 92 }) : pipeline.png()).toBuffer();
  const result = document.createTexture(asset.name).setImage(encoded).setMimeType(jpeg ? 'image/jpeg' : 'image/png');
  textures.set(id, result);
  return result;
}
async function material(id) {
  if (materials.has(id)) return materials.get(id);
  const asset = config.assets[id];
  if (!asset) throw new Error(`Missing source material ${id}`);
  const data = asset.data;
  const paint = /carpaint/i.test(asset.name);
  const color = paint && spec.paint ? linear(spec.paint) : linear(data.diffuse ?? [1, 1, 1]);
  const result = document.createMaterial(`${asset.name}-${id}`)
    .setBaseColorFactor([...color, data.opacity ?? 1])
    .setMetallicFactor(paint ? .48 : data.useMetalness ? (data.metalness ?? 0) : 0)
    .setRoughnessFactor(Math.max(.16, 1 - (data.shininess ?? 25) / 100))
    .setDoubleSided(data.cull === 0);
  if ((data.opacity ?? 1) < 1) result.setAlphaMode('BLEND');
  if (data.alphaTest > 0) result.setAlphaMode('MASK').setAlphaCutoff(data.alphaTest);
  if (paint) result.setExtension('KHR_materials_clearcoat', clearcoat.createClearcoat().setClearcoatFactor(.7).setClearcoatRoughnessFactor(.23));
  for (const [key, setter, info] of [
    ['diffuseMap', 'setBaseColorTexture', 'getBaseColorTextureInfo'],
    ['aoMap', 'setOcclusionTexture', 'getOcclusionTextureInfo'],
    ['normalMap', 'setNormalTexture', 'getNormalTextureInfo'],
    ['emissiveMap', 'setEmissiveTexture', 'getEmissiveTextureInfo'],
  ]) if (data[key]) {
    result[setter](await texture(data[key]));
    result[info]().setTexCoord(data[`${key}Uv`] ?? 0);
  }
  if (data.emissiveMap) result.setEmissiveFactor(linear(data.emissiveMapTint ? data.emissive : [1, 1, 1]));
  if (data.normalMap) result.setNormalScale(data.bumpMapFactor ?? 1);
  materials.set(id, result);
  return result;
}
function nodeFrom(source) {
  const rotation = new Quaternion().setFromEuler(new Euler(...source.rotation.map(v => v * Math.PI / 180), 'ZYX'));
  return document.createNode(source.name).setTranslation(source.position).setRotation(rotation.toArray()).setScale(source.scale);
}
let triangles = 0;
for (const modelId of spec.modelAssetIds) {
  const asset = config.assets[modelId];
  if (!asset?.file) throw new Error(`Missing source model ${modelId}`);
  const { model } = await readSourceJson(asset.file.url, `assets/${modelId}.source`);
  if (model.skins?.length || model.morphs?.length) throw new Error('Skinned showroom models require an explicit conversion');
  const instance = Object.values(sourceScene.entities).find(e => e.components?.model?.asset === modelId);
  if (!instance) throw new Error(`No scene instance for ${modelId}`);
  const ancestors = [];
  for (let entity = instance; entity; entity = sourceScene.entities[entity.parent]) ancestors.unshift(entity);
  let parent = scene;
  for (const ancestor of ancestors) { const node = nodeFrom(ancestor); parent.addChild(node); parent = node; }
  const nodes = model.nodes.map(nodeFrom);
  model.parents.forEach((p, i) => (p < 0 ? parent : nodes[p]).addChild(nodes[i]));
  for (let i = 0; i < model.meshInstances.length; i++) {
    const instance = model.meshInstances[i];
    if (spec.excludeNodes?.includes(model.nodes[instance.node].name)) continue;
    const source = model.meshes[instance.mesh];
    if (source.type !== 'triangles') throw new Error(`Unsupported primitive: ${source.type}`);
    const vertices = model.vertices[source.vertices];
    const primitive = document.createPrimitive().setMaterial(await material(asset.data.mapping[i].material));
    for (const [key, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['texCoord0', 'TEXCOORD_0'], ['texCoord1', 'TEXCOORD_1']]) {
      if (!vertices[key]) continue;
      const { components, data } = vertices[key];
      primitive.setAttribute(semantic, document.createAccessor().setType(`VEC${components}`).setArray(new Float32Array(data)).setBuffer(buffer));
    }
    const indices = source.indices.slice(source.base, source.base + source.count);
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer));
    triangles += indices.length / 3;
    let mesh = nodes[instance.node].getMesh();
    if (!mesh) { mesh = document.createMesh(nodes[instance.node].getName()); nodes[instance.node].setMesh(mesh); }
    mesh.addPrimitive(primitive);
  }
}
await document.transform(dedup(), prune(), draco());
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() });
await io.write(spec.outputPath, document);
const output = await readFile(spec.outputPath);
let renderedTriangles = 0;
// Draco removes degenerate faces; report the count in the exported file.
const exported = await io.read(spec.outputPath);
exported.getRoot().getDefaultScene().traverse(node => { for (const primitive of node.getMesh()?.listPrimitives() ?? []) renderedTriangles += primitive.getIndices().getCount() / 3; });
const report = { name: spec.name, sourceUrl: spec.sourceUrl, license: spec.copyright, sourceTriangles: triangles, renderedTriangles, outputPath: spec.outputPath, bytes: output.length, sha256: createHash('sha256').update(output).digest('hex'), downloads };
await writeFile(path.join(directory, 'conversion.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ name: spec.name, triangles: renderedTriangles, bytes: output.length }));
