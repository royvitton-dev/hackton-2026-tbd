// Address-workspace assets only: never rewrite the shared source/generated catalogs.
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {isExteriorPhoto} from '../src/address/facades.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const out = path.join(root, 'address');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(path.join(out, 'photos'), {recursive:true});
const catalog = JSON.parse(await readFile(path.join(root, 'generated/catalog.json'), 'utf8'));
const previous = JSON.parse(await readFile(path.join(out, 'evidence.json'), 'utf8').catch(() => '{"places":[]}'));
const places = [], failures = [];
const ids = new Set();
for (const site of catalog) {
  if (ids.has(site.siteId) || !site.source?.startsWith('https://soco.seoul.go.kr/')) continue;
  ids.add(site.siteId);
  const old = previous.places.find(p => p.siteId === site.siteId);
  if(old)old.photos=old.photos.filter(isExteriorPhoto);
  if (old && !process.argv.includes('--refresh')) { places.push(old); continue; }
  try {
    const response = await fetch(site.source, {signal:AbortSignal.timeout(40000)});
    if (!response.ok) throw Error('Publisher HTTP ' + response.status);
    const html = await response.text(), photos = [];
    if (site.photo) photos.push({...old?.photos.find(p=>p.file===site.photo.file),...site.photo, alt:site.name+' 외관', source:site.photo.source || site.source});
    for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
      const src = tag[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const alt = tag[0].match(/\balt=["']([^"']+)["']/i)?.[1] || '';
      if (!src || !/(외부|외관|전경)/.test(alt) || !isExteriorPhoto({alt}) || photos.length >= 2) continue;
      const url = new URL(src.replaceAll('&amp;', '&'), site.source);
      if (url.hostname !== 'soco.seoul.go.kr' || !url.pathname.endsWith('/fileDown.do')) continue;
      if (old?.excludedPhotos?.some(p=>p.url===url.href)) continue;
      if (photos.some(p => p.url === url.href)) continue;
      const image = await fetch(url, {signal:AbortSignal.timeout(40000)});
      if (!image.ok) throw Error('Exterior photo HTTP '+image.status);
      const bytes = Buffer.from(await image.arrayBuffer());
      if (bytes.length > 15000000) throw Error('Exterior photo too large');
      const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = bytes[0] === 255 && bytes[1] === 216;
      if (!png && !jpeg) throw Error('Exterior response is not a PNG/JPEG');
      const ext = png ? 'png' : 'jpg';
      const reviewed=old?.photos.find(p=>p.url===url.href);
      if(reviewed?.reviewStatus==='reviewed-exterior'&&reviewed.sha256!==hash(bytes))throw Error('Reviewed exterior photo changed at publisher; preserving the previous asset for review');
      const file = reviewed?.file || `address/photos/${site.siteId}-${hash(url.href).slice(0,12)}.${ext}`;
      await writeFile(path.join(root, file), bytes);
      photos.push({...reviewed,file, url:url.href, alt, source:site.source, publisher:'서울특별시 공동체주택 플랫폼', sha256:hash(bytes), bytes:bytes.length, acquiredAt:new Date().toISOString()});
    }
    const item = {siteId:site.siteId, address:site.address, source:site.source, sourcePageSha256:hash(html), photos, ...(old?.excludedPhotos?{excludedPhotos:old.excludedPhotos}:{})};
    places.push(item); console.log(site.siteId, photos.length, 'exterior photos');
  } catch (error) { failures.push({siteId:site.siteId, error:error.message}); if (old) places.push(old); }
}
const result = {version:1, acquiredAt:new Date().toISOString(), rights:'발행처 공개 사진. 출처를 보존하며 별도 재배포 허가를 뜻하지 않습니다.', places, failures};
await writeFile(path.join(out, 'evidence.json.tmp'), JSON.stringify(result,null,2)+'\n');
await rename(path.join(out, 'evidence.json.tmp'), path.join(out, 'evidence.json'));
console.log(JSON.stringify({places:places.length, photos:places.reduce((sum,p)=>sum+p.photos.length,0), failures}));
if (failures.length) process.exitCode = 1;
