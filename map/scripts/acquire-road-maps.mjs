import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {roadGraph,chargingRecord,nearestRoad,roadRoute,metres} from '../src/core/road-maps.js';
const root=new URL('../public/mobility/maps/',import.meta.url),regions=JSON.parse(await readFile(new URL('./map-regions.json',import.meta.url),'utf8'));
await mkdir(new URL('raw/',root),{recursive:true});
const maps=[];
for(const region of regions){
 const [lng,lat]=region.center,dy=.0065,dx=dy/Math.cos(lat*Math.PI/180),bbox=[lat-dy,lng-dx,lat+dy,lng+dx].map(n=>Number(n.toFixed(7)));
 const file=new URL(`raw/${region.id}.json`,root),metadata=new URL(`raw/${region.id}.source.json`,root);
 // Index the committed local snapshots; acquisition is a separate, explicit step.
 const bytes=await readFile(file),source=JSON.parse(await readFile(metadata,'utf8'));
 if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error(`Source hash mismatch: ${region.id}`);
 const raw=JSON.parse(bytes),graph=roadGraph(raw),chargers=raw.elements.map(chargingRecord).filter(Boolean).filter((c,i,all)=>all.findIndex(x=>x.id===c.id)===i);
 const targets=chargers.map(c=>({...c,approach:nearestRoad(graph,c.coordinates,150)})).filter(c=>c.approach).sort((a,b)=>(a.id===region.station?-1:b.id===region.station?1:a.approach.distance-b.approach.distance));
 let defaultRoute;
 for(const charger of targets){
  const candidates=[...graph.nodes.values()].filter(n=>{const d=metres(n.coordinates,charger.approach.coordinates);return d>450&&d<900;}).sort((a,b)=>a.id-b.id);
  for(const node of candidates){const path=roadRoute(graph,node.id,charger.approach.nodeId);if(path&&path.distance>=450&&path.distance<3500){defaultRoute={start:node.id,end:charger.approach.nodeId,chargerId:charger.id,distance:path.distance};break;}}
  if(defaultRoute)break;
 }
 if(!defaultRoute)throw Error(`No verified route: ${region.id}`);
 const entry={...region,bbox,raw:`/mobility/maps/raw/${region.id}.json`,source:{...source,osmBase:raw.osm3s.timestamp_osm_base,license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',copyrightUrl:'https://www.openstreetmap.org/copyright'},counts:{roads:graph.ways.length,roadNodes:graph.nodes.size,chargers:chargers.length,buildings:raw.elements.filter(e=>e.type==='way'&&e.tags?.building).length},chargers:chargers.map(c=>({...c,approach:nearestRoad(graph,c.coordinates,150)})),defaultRoute};
 maps.push(entry);console.log(`${region.id}: ${entry.counts.roads} roads / ${chargers.length} chargers / ${Math.round(defaultRoute.distance)} m`);
}
await writeFile(new URL('index.json',root),JSON.stringify({version:1,collectedAt:maps.map(m=>m.source.fetchedAt).sort().at(-1),maps},null,2));
console.log(`Saved ${maps.length} working map datasets`);
