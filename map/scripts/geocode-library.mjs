import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../public/plans/',import.meta.url),file=new URL('locations.json',root);
const sites=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
const cache=JSON.parse(await readFile(file,'utf8').catch(()=>'{}'));
const endpoint=process.env.ATLAS_GEOCODER_URL||'https://nominatim.openstreetmap.org/search';
const queryCache=new Map();let last=0;
async function lookup(q){
 if(queryCache.has(q))return queryCache.get(q);
 await new Promise(r=>setTimeout(r,Math.max(0,1100-(Date.now()-last))));last=Date.now();
 const url=new URL(endpoint);url.search=new URLSearchParams({q,format:'jsonv2',limit:'1',countrycodes:'kr'});
 const response=await fetch(url,{headers:{'User-Agent':'ATLAS-Blueprint-Research/1.0 (https://github.com/royvitton-dev/hackton-2026-tbd)'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`Geocoder HTTP ${response.status}`);
 const result=(await response.json())[0]||null;queryCache.set(q,result);return result;
}
for(const site of sites){
 if(cache[site.id])continue;
 const address=site.address.replace(/^대한민국\s*/,'').replace(/\([^)]*\)/g,'').replace(/[A-Za-z].*$/,'').replace(/서울시/g,'서울특별시').replace(/(길)(\d)/g,'$1 $2').trim();
 let result,query;
 try{for(const q of [...new Set([address,address.split(' ').slice(0,3).join(' '),address.split(' ').slice(0,2).join(' ')])]){query=q;result=await lookup(q);if(result)break;}}
 catch(e){console.error(site.id,e.message);break;}
 if(result){cache[site.id]={lat:Number(result.lat),lng:Number(result.lon),query,precision:['building','house','amenity'].includes(result.addresstype)?'address-result':'address-area',displayName:result.display_name,bounds:result.boundingbox.map(Number),source:`https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,license:'© OpenStreetMap contributors · ODbL 1.0',checkedAt:new Date().toISOString()};}
 else if(Number.isFinite(site.lat)){cache[site.id]={lat:site.lat,lng:site.lng,query:site.address,precision:'publisher-unverified',source:site.source};}
 console.log(site.id,cache[site.id]?.precision||'unresolved',query);
 await writeFile(file,JSON.stringify(cache,null,2));
}
console.log(`${Object.keys(cache).length}/${sites.length} address locations recorded`);
