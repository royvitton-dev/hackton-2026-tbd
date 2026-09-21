// Read-only requests to the same public endpoints used by the KCA map and its
// "목록 보기 / 엑셀 내보내기" interface. No account or third-party API key is used.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../public/sources/',import.meta.url)),dir=path.join(root,'radio');await mkdir(dir,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),source='https://spectrummap.kr/gis/mobile_service.do?menuNo=300480';
const sites=JSON.parse(await readFile(path.join(root,'catalog.json'))).filter((s,i,a)=>s.location&&a.findIndex(x=>x.siteId===s.siteId)===i);
const requested=process.argv.find(s=>s.startsWith('--site='))?.slice(7),refresh=process.argv.includes('--refresh');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),pointCache=new Map();
const distance=(a,b)=>{const rad=Math.PI/180,dlat=(a.lat-b.lat)*rad,dlng=(a.lng-b.lng)*rad;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2)));};
try{
 await page.goto(source,{waitUntil:'domcontentloaded',timeout:45000});
 const json=async(url,ids)=>page.evaluate(async({url,ids})=>{const response=await fetch(url,{signal:AbortSignal.timeout(30000),...(ids?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:ids})}:{})});if(!response.ok)throw Error(`KCA HTTP ${response.status}`);const text=await response.text();if(!text.trim()&&url.startsWith('/geojson.do'))return [];return JSON.parse(text);},{url,ids});
 for(const site of sites){
  if(requested&&site.siteId!==requested)continue;
  const file=path.join(dir,site.siteId+'.json');if(!refresh){try{const old=JSON.parse(await readFile(file));if(old.query.lat===site.location.lat&&old.query.lng===site.location.lng){console.log(site.siteId,'cached');continue;}}catch{}}
  const query={lat:site.location.lat,lng:site.location.lng,radiusM:1000,coordinatePrecision:site.location.precision,locationSource:site.location.source};
  const url=`/gis/mobile_service.json?menuNo=300480&type=&latitude=${query.lat}&longitude=${query.lng}&zoom=16&visibleRadius=1000`;
  const index=await json(url),all=[];
  for(const endpoint of index.points||[]){if(!pointCache.has(endpoint))pointCache.set(endpoint,await json(endpoint));all.push(...pointCache.get(endpoint));}
  const unique=[...new Map(all.map(p=>[p.uid,p])).values()];
  const nearby=unique.filter(p=>Array.isArray(p.position)&&/LTE|5G/.test(p.service_name)&&/지상/.test(p.service_name)).map(p=>({...p,distanceM:distance({lng:p.position[0],lat:p.position[1]},query)})).filter(p=>p.distanceM<=1000).sort((a,b)=>a.distanceM-b.distanceM||a.uid.localeCompare(b.uid));
  // Preserve carrier diversity and both radio technologies. This is a bounded
  // nearest-station sample, never presented as the full active network.
  const chosen=nearby.filter((p,i,a)=>a.slice(0,i).filter(x=>x.customer_no===p.customer_no&&/5G/.test(x.service_name)===/5G/.test(p.service_name)).length<8).slice(0,48);
  const response=chosen.length?await json('/gis/mobile_service.json?menuNo=300480&type=type1&curPage=1&pageSize=100',chosen.map(p=>p.uid)):{data:[]};
  if(response.data.length!==chosen.length)throw Error(`Partial KCA details for ${site.siteId}: ${response.data.length}/${chosen.length}`);
  const data={source,publisher:'한국방송통신전파진흥원 · 전파누리',acquiredAt:new Date().toISOString(),query,nearbyOutdoorLte5gCount:nearby.length,selection:'nearest 8 per carrier and technology, maximum 48; radius 1000m',detailsResponseSha256:sha(JSON.stringify(response)),points:chosen.map(p=>({uid:p.uid,position:p.position,operator:p.customer_name,distanceM:p.distanceM})),data:response.data,limitations:['허가·공개 기록이며 현재 가동 상태 및 실내 수신 측정값은 제공하지 않습니다.','기지국 데이터 현행화 과정으로 실제와 차이가 있을 수 있습니다.']};
  await writeFile(file,JSON.stringify(data,null,2)+'\n');console.log(site.siteId,`${response.data.length}/${nearby.length} public stations`);await new Promise(r=>setTimeout(r,1100));
 }
}finally{await browser.close();}
