import { mkdir, writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const origin = 'https://soco.seoul.go.kr';
const target = new URL('../public/plans/', import.meta.url);
await mkdir(target, { recursive: true });
const candidates = ['20000367','10000901','20000474','10000921','20000582','20000555','20000409','10002143','20000441','20000410','20000422','20000536','10002042','20000570','20000516','20000581','20000476','20000522','20000380','20000481','20000543','20000009','20000494','20000467','20000423'];
const clean = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
async function get(url) { const res = await fetch(url, { signal: AbortSignal.timeout(25000) }); if (!res.ok) throw new Error(`${res.status} ${url}`); return res; }
const catalog = [];
for (const id of candidates) {
  if (catalog.length === 10) break;
  const source = `${origin}/coHouse/pgm/home/cohome/view.do?homeCode=${id}&menuNo=200015`;
  try {
    const html = await (await get(source)).text();
    const tags = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]).filter(t => /alt="[^"]*평면도/.test(t));
    if (!tags.length) continue;
    const address = clean(html.match(/<strong>주소\s*:\s*<\/strong>([^<]+)/)?.[1] || '');
    if (!address.includes('서울')) continue;
    const coordinates = html.match(/new naver.maps.Point\('([\d.]+)',\s*'([\d.]+)'\)/);
    if (!coordinates) continue;
    const addressKey = address.replace('서울특별시','서울').replace(/\s/g,'').match(/^(.*(?:로|길)\d+(?:-\d+)?)/)?.[1] || address;
    if (catalog.some(site => site.addressKey === addressKey)) continue;
    const assets = [];
    for (let i = 0; i < Math.min(tags.length, 3); i++) {
      const tag = tags[i];
      const assetUrl = new URL(clean(tag.match(/src="([^"]+)"/)[1]), origin).href;
      const res = await get(assetUrl);
      const data = Buffer.from(await res.arrayBuffer());
      // Reject error pages rather than counting them as acquired plans.
      const ext = data[0] === 0x89 && data[1] === 0x50 ? 'png' : data[0] === 0xff && data[1] === 0xd8 ? 'jpg' : data.toString('ascii',0,3)==='GIF' ? 'gif' : null;
      if (!ext) continue;
      const file = `${id}-${i + 1}.${ext}`;
      await writeFile(new URL(file, target), data);
      assets.push({ file: `/plans/${file}`, label: clean(tag.match(/alt="([^"]*)"/)[1]), url: assetUrl, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
    if (!assets.length) continue;
    catalog.push({ id, name: assets[0].label.split('_평면도')[0], address, addressKey, lat: Number(coordinates[2]), lng: Number(coordinates[1]), coordinateStatus: 'publisher-provided-unverified', source, publisher: '서울특별시 공동체주택 플랫폼', acquiredAt: new Date().toISOString(), kind: 'public-residential-plan', scaleStatus: 'uncalibrated', parkingStatus: 'not-verified', assets });
    console.log(`${catalog.length}/10 ${catalog.at(-1).name}: ${assets.length} plans`);
  } catch (error) { console.error(id, error.message); }
}
if(catalog.length===10){const parking=JSON.parse(await readFile(new URL('parking-sources.json',target),'utf8').catch(()=>'[]'));await writeFile(new URL('catalog.json', target), JSON.stringify([...catalog,...parking,...JSON.parse(await readFile(new URL('multilevel-sources.json',target),'utf8').catch(()=>'[]'))], null, 2));}
if (catalog.length !== 10) { console.error(`Only ${catalog.length}/10 sites acquired`); process.exitCode = 1; }
