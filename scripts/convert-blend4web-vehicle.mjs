// Convert publicly delivered Blend4Web vehicle geometry; never synthesize bodywork.
// Binary layout reference: TriumphLLC/Blend4Web src/intern/data.js (6.01 format).
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { dedup, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { Matrix4, Quaternion, Vector3 } from 'three';
import sharp from 'sharp';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';

const run = promisify(execFile);
const [specPath] = process.argv.slice(2);
if (!specPath) throw new Error('Usage: node scripts/convert-blend4web-vehicle.mjs source.json');
const spec = JSON.parse(await readFile(specPath, 'utf8'));
const directory = path.dirname(specPath);
await mkdir(path.join(directory, 'assets'), { recursive: true });
const downloads = [];
const sha256 = data => createHash('sha256').update(data).digest('hex');
async function download(url, name) {
  const target = path.join(directory, name);
  try { await readFile(target); }
  catch {
    try {
      await run('curl', ['--fail', '--location', '--silent', '--show-error', '--max-time', '90', url, '-o', `${target}.part`]);
      await rename(`${target}.part`, target);
    } catch (error) {
      await writeFile(path.join(directory, 'failure.json'), JSON.stringify({ name: spec.name, url, file: name, failureReason: error.message, nextAction: 'Restore access to the official asset, then rerun conversion; no placeholder generated.' }, null, 2));
      throw error;
    }
  }
  const data = await readFile(target);
  downloads.push({ url, file: name, bytes: data.length, sha256: sha256(data) });
  return data[0] === 0x1f && data[1] === 0x8b ? gunzipSync(data) : data;
}
const document = new Document();
const buffer = document.createBuffer();
const scene = document.createScene(spec.name);
document.getRoot().setDefaultScene(scene);
document.getRoot().getAsset().copyright = spec.copyright;
const clearcoat = document.createExtension(KHRMaterialsClearcoat);
const imageCache = new Map();
const sourceReports = [];
async function source(label, url) {
  const data = JSON.parse((await download(url, `${label}.json`)).toString('utf8'));
  if (data.b4w_format_version !== '6.01' || data.binaries.length !== 1 || data.armatures.length) throw new Error(`Unsupported source format: ${label}`);
  const binary = await download(new URL(data.binaries[0].binfile, url).href, `${label}.bin`);
  if (binary.toString('ascii', 0, 4) !== 'b4wb') throw new Error(`Invalid geometry binary: ${label}`);
  const byId = key => new Map(data[key].map(item => [item.uuid, item]));
  return { label, url, data, binary, meshes: byId('meshes'), materials: byId('materials'), textures: byId('textures'), images: byId('images') };
}
function attribute(src, submesh, key) {
  const [offset, count] = submesh[key] ?? [0, 0];
  const type = key === 'indices' ? 'int' : key === 'normal' ? 'short' : 'float';
  const size = type === 'short' ? 2 : 4;
  const start = 12 + src.data.binaries[0][type] + offset * size;
  if (start + count * size > src.binary.length) throw new Error(`Out-of-bounds ${key} data`);
  const array = key === 'indices' ? new Uint32Array(count) : new Float32Array(count);
  for (let i = 0; i < count; i++) array[i] = type === 'int' ? src.binary.readUInt32LE(start + i * size) : type === 'short' ? src.binary.readInt16LE(start + i * size) / 32767 : src.binary.readFloatLE(start + i * size);
  if (!array.every(Number.isFinite)) throw new Error(`Invalid ${key} values`);
  return array;
}
async function texture(src, node) {
  const texture = src.textures.get(node?.texture?.uuid);
  const image = src.images.get(texture?.image?.uuid);
  if (!image || image.source !== 'FILE') return null;
  const url = new URL(image.filepath, src.url).href;
  if (!imageCache.has(url)) {
    const data = await download(url, `assets/${sha256(url).slice(0, 12)}-${path.basename(image.filepath)}`);
    const jpeg = /\.jpe?g$/i.test(image.filepath);
    const pipeline = sharp(data).flip().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true });
    const encoded = await (jpeg ? pipeline.jpeg({ quality: 92 }) : pipeline.png()).toBuffer();
    imageCache.set(url, document.createTexture(image.name).setImage(encoded).setMimeType(jpeg ? 'image/jpeg' : 'image/png'));
  }
  return imageCache.get(url);
}
const materials = new Map();
async function material(src, id, mesh) {
  const key = `${src.label}:${id}`;
  if (materials.has(key)) return materials.get(key);
  const source = src.materials.get(id);
  const name = source.name.toLowerCase();
  const nodes = source.node_tree?.nodes ?? [];
  const lookup = name => nodes.find(n => n.name === name);
  const rgb = lookup('rgb_colour') ?? lookup('RGB');
  let color = rgb?.outputs[0]?.default_value?.slice(0, 3) ?? [1, 1, 1];
  let opacity = 1, metallic = 0, roughness = .65;
  const paint = name.includes('carpaint');
  if (paint) { color = spec.paint; metallic = .42; roughness = .24; }
  else if (name.includes('blackpaint')) { color = [.009, .012, .015]; metallic = .35; roughness = .24; }
  else if (/chrome|aluminium/.test(name)) { color = [.65, .68, .72]; metallic = .95; roughness = name.includes('brushed') ? .35 : .18; }
  else if (name.includes('glass')) {
    const window = /Door|Body|Boot/.test(mesh.name) && !/mirror/i.test(mesh.name);
    color = name.includes('red') ? [.45, .015, .008] : window ? [.025, .045, .06] : [.12, .16, .19];
    opacity = window ? .72 : .2; metallic = .12; roughness = .16;
  }
  else if (/tyre|rubber/.test(name)) { color = [.025, .027, .03]; roughness = .86; }
  else if (/plastic|leather|fabrics/.test(name)) { color = [.075, .08, .085]; roughness = name.includes('shiny') ? .26 : .75; }
  const result = document.createMaterial(source.name).setBaseColorFactor([...color, opacity]).setMetallicFactor(metallic).setRoughnessFactor(roughness).setDoubleSided(!source.game_settings.use_backface_culling);
  if (opacity < 1) result.setAlphaMode('BLEND');
  else if (/alpha|cutoff/.test(name)) result.setAlphaMode('MASK').setAlphaCutoff(.15);
  if (paint) result.setExtension('KHR_materials_clearcoat', clearcoat.createClearcoat().setClearcoatFactor(.7).setClearcoatRoughnessFactor(.22));
  // Translate named source texture channels; environment maps use our studio lighting.
  for (const [nodeName, setter, info] of [
    ['colour_tex', 'setBaseColorTexture', 'getBaseColorTextureInfo'],
    ['ao_tex', 'setOcclusionTexture', 'getOcclusionTextureInfo'],
    ['normal_tex', 'setNormalTexture', 'getNormalTextureInfo'],
    ['illum_tex', 'setEmissiveTexture', 'getEmissiveTextureInfo'],
  ]) {
    const node = lookup(nodeName);
    const map = await texture(src, node);
    if (!map) continue;
    result[setter](map);
    const link = source.node_tree.links.find(l => l.to_node.name === nodeName && l.to_socket.identifier === 'Vector');
    const uv = lookup(link?.from_node?.name)?.uv_layer;
    result[info]().setTexCoord(Math.max(0, mesh.uv_textures.indexOf(uv)));
    if (nodeName === 'colour_tex') result.setBaseColorFactor([1, 1, 1, opacity]);
    if (nodeName === 'illum_tex') {
      result.setEmissiveFactor([.4, .4, .4]);
      if (/alpha/.test(name)) result.setBaseColorTexture(map);
    }
  }
  materials.set(key, result);
  return result;
}
let triangles = 0;
const meshCache = new Map();
async function mesh(src, id) {
  const key = `${src.label}:${id}`;
  if (meshCache.has(key)) return meshCache.get(key);
  const source = src.meshes.get(id);
  if (source.b4w_shape_keys.length || source.vertex_groups.length) throw new Error(`Deformed geometry needs explicit conversion: ${source.name}`);
  const result = document.createMesh(source.name);
  for (const [index, submesh] of source.submeshes.entries()) {
    const primitive = document.createPrimitive().setMaterial(await material(src, source.materials[index].uuid, source));
    for (const [key, semantic, type] of [['position', 'POSITION', 'VEC3'], ['normal', 'NORMAL', 'VEC3'], ['texcoord', 'TEXCOORD_0', 'VEC2'], ['texcoord2', 'TEXCOORD_1', 'VEC2']]) {
      const array = attribute(src, submesh, key);
      if (array.length) primitive.setAttribute(semantic, document.createAccessor().setType(type).setArray(array).setBuffer(buffer));
    }
    const indices = attribute(src, submesh, 'indices');
    if (!indices.length || indices.length % 3) throw new Error(`Invalid triangles: ${source.name}`);
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
    result.addPrimitive(primitive);
  }
  meshCache.set(key, result);
  return result;
}
function transform(source) {
  const [w, x, y, z] = source.rotation_quaternion;
  if (source.pinverse_tsr && source.pinverse_tsr.some((v, i) => v !== [0, 0, 0, 1, 0, 0, 0, 1][i])) throw new Error(`Non-identity parent inverse: ${source.name}`);
  return new Matrix4().compose(new Vector3(...source.location), new Quaternion(x, y, z, w).normalize(), new Vector3(...source.scale));
}
const body = await source('body', spec.bodyUrl);
const objects = new Map(body.data.objects.map(o => [o.uuid, o]));
const world = new Map();
const toYUp = new Matrix4().makeRotationX(-Math.PI / 2);
function worldMatrix(object) {
  if (world.has(object.uuid)) return world.get(object.uuid);
  const matrix = transform(object);
  if (object.parent) matrix.premultiply(worldMatrix(objects.get(object.parent.uuid)));
  else matrix.premultiply(toYUp);
  world.set(object.uuid, matrix);
  return matrix;
}
async function addMesh(src, object, matrix, suffix = '') {
  const geometry = await mesh(src, object.data.uuid);
  const node = document.createNode(object.name + suffix).setMesh(geometry).setMatrix(matrix.toArray());
  scene.addChild(node);
  triangles += geometry.listPrimitives().reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0);
}
for (const object of body.data.objects) if (object.type === 'MESH' && !object.b4w_do_not_render && !object.b4w_hidden_on_load && !spec.excludeNodes.includes(object.name)) await addMesh(body, object, worldMatrix(object));
sourceReports.push({ label: 'body', meshCount: body.data.meshes.length });
if (spec.rimUrl) {
  const rim = await source('rim', spec.rimUrl);
  const anchors = body.data.objects.filter(o => /^Wheel_[FR][LR]$/.test(o.name));
  if (anchors.length !== 4) throw new Error(`Expected four official wheel anchors, received ${anchors.length}`);
  // Rims are modeled in the same centimeter local frame as body wheel anchors.
  // The rim scene's export unit/up-axis wrapper is already present in the body hierarchy.
  for (const anchor of anchors) for (const object of rim.data.objects) if (object.type === 'MESH') await addMesh(rim, object, worldMatrix(anchor).clone().multiply(transform(object)), `-${anchor.name}`);
  sourceReports.push({ label: 'rim', instances: anchors.map(a => a.name) });
}
await document.transform(dedup(), prune(), draco());
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() });
await io.write(spec.outputPath, document);
const output = await readFile(spec.outputPath);
const exported = await io.read(spec.outputPath);
let renderedTriangles = 0;
exported.getRoot().getDefaultScene().traverse(node => { for (const primitive of node.getMesh()?.listPrimitives() ?? []) renderedTriangles += primitive.getIndices().getCount() / 3; });
const report = { name: spec.name, sourceUrl: spec.sourceUrl, license: spec.copyright, sourceTriangles: triangles, renderedTriangles, outputPath: spec.outputPath, bytes: output.length, sha256: sha256(output), sourceReports, downloads };
await writeFile(path.join(directory, 'conversion.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ name: spec.name, triangles: renderedTriangles, bytes: output.length }));
