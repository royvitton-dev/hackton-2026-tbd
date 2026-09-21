import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {getDocument} from '../../map/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '../../map/node_modules/@napi-rs/canvas/index.js';
const root=fileURLToPath(new URL('../public/sources/',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const catalog=JSON.parse(await readFile(path.join(root,'catalog.json')));
const locations=JSON.parse(await readFile(path.join(root,'precise-locations.json')).catch(()=>'{}'));
for(const site of catalog.filter((s,i,a)=>s.source?.includes('soco.seoul.go.kr')&&a.findIndex(x=>x.siteId===s.siteId)===i)){
  if(locations[site.siteId])continue;
  const r=await fetch(site.source,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Location source HTTP ${r.status}`);
  const html=await r.text(),m=html.match(/new naver\.maps\.Point\(['"]([\d.]+)['"],\s*['"]([\d.]+)['"]\)/);
  if(m){locations[site.siteId]={lat:Number(m[2]),lng:Number(m[1]),precision:'publisher-naver-point',source:site.source,sourcePageSha256:sha(html),checkedAt:new Date().toISOString()};console.log(site.siteId,'publisher Naver point');}
  await new Promise(r=>setTimeout(r,1100));
}
const parks=[
  {id:'park-boramae',name:'보라매공원',address:'서울특별시 동작구 여의대방로20길 33',source:'https://gov.seoul.go.kr/festa/files/2025/05/682bc1be350963.28180700.pdf',page:1,metersAcross:1250,note:'서울시 2025 공원 안내도. P 주차장과 장애인 전용 주차장 범례 확인. 개별 주차면 치수는 제공되지 않습니다.'},
  {id:'park-seoul-forest',name:'서울숲',address:'서울특별시 성동구 뚝섬로 273',source:'https://www.seoul.go.kr/festa/files/2026/03/69a93ec17497e4.06719720.pdf',page:5,metersAcross:1200,note:'서울시 2026-02-27 안내 자료 5쪽. 당시 이용 안내도이며 현재 운영·공사 현황을 뜻하지 않습니다. 오른쪽 아래 서울숲 주차장 표기.'},
];
const output=[];
for(const park of parks){
  const pdfFile=path.join(root,park.id+'.pdf');let bytes;
  try{bytes=await readFile(pdfFile);}catch{const r=await fetch(park.source,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`Park PDF HTTP ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Park source is not PDF');await writeFile(pdfFile,bytes);}
  const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true}),doc=await loading.promise,p=await doc.getPage(park.page),v=p.getViewport({scale:1.8}),c=createCanvas(v.width,v.height);
  await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;const image=c.toBuffer('image/png');await writeFile(path.join(root,park.id+'.png'),image);await loading.destroy();
  if(!locations[park.id]){
    const url=new URL('https://nominatim.openstreetmap.org/search');url.search=new URLSearchParams({q:park.name,format:'jsonv2',limit:'1',countrycodes:'kr'});
    const r=await fetch(url,{headers:{'User-Agent':'ATLAS-Blueprint-Research/1.0 (https://github.com/royvitton-dev/hackton-2026-tbd)'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Park location HTTP ${r.status}`);
    const [point]=await r.json();if(!point)throw Error('Park coordinate missing');locations[park.id]={lat:Number(point.lat),lng:Number(point.lon),precision:'park-centroid',source:`https://www.openstreetmap.org/${point.osm_type}/${point.osm_id}`,license:'© OpenStreetMap contributors · ODbL 1.0',bounds:point.boundingbox.map(Number),checkedAt:new Date().toISOString()};await new Promise(r=>setTimeout(r,1100));
  }
  output.push({id:park.id,siteId:park.id,name:park.name,address:park.address,buildingType:'park',source:park.source+'#page='+park.page,publisher:'서울특별시',acquiredAt:new Date().toISOString(),sourceDocument:{file:'sources/'+park.id+'.pdf',sha256:sha(bytes),bytes:bytes.length},sourceAsset:{file:'sources/'+park.id+'.png',url:park.source,label:'공원 안내도',kind:'park-guide',sourcePage:park.page,sha256:sha(image),bytes:image.length},location:locations[park.id],scaleStatus:'estimated',metersAcross:park.metersAcross,parkingEvidence:{note:park.note,currentFacilityStatus:'not-surveyed'}});
}
await writeFile(path.join(root,'precise-locations.json'),JSON.stringify(locations,null,2)+'\n');
await writeFile(path.join(root,'parks-catalog.json'),JSON.stringify(output,null,2)+'\n');
console.log(`${Object.keys(locations).length} publisher/park locations, ${output.length} public park guides`);
