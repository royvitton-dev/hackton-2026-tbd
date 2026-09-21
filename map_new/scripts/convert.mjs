import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {analyzeBlueprint,analyzeSvg,compileMeshes} from '../src/core/analysis.js';
import {fixtureSvg} from './fixture.mjs';
import {neonadeuliSvg} from './neonadeuli.mjs';
import {alignNeonadeuliRoad} from '../src/core/georeference.js';
import {localPosition} from '../src/core/geometry.js';
import {execFileSync} from 'node:child_process';
import {annotateParking} from './parking-annotations.mjs';
import {normalizeStation} from '../src/core/radio.js';
import {enrichObjects} from './semantic-objects.mjs';
const root=fileURLToPath(new URL('../public/',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(path.join(root,'generated'),{recursive:true});
await writeFile(path.join(root,'sources/integration-lab.svg'),fixtureSvg());
await writeFile(path.join(root,'sources/neonadeuli-layers.svg'),neonadeuliSvg());
execFileSync('python3',[fileURLToPath(new URL('./extract-osm.py',import.meta.url))],{stdio:'inherit'});
const context=JSON.parse(await readFile(path.join(root,'generated/neonadeuli-context.json')));
const sites=JSON.parse(await readFile(path.join(root,'sources/catalog.json')));
const radioStationIds=new Set();
sites.push({id:'integration-lab',name:'도로 → 주차·EV · 검증용 시나리오',buildingType:'test',sourceAsset:{file:'sources/integration-lab.svg'},annotation:'sources/integration-lab.svg',synthetic:true});
for(const site of sites){
  if(site.siteId==='10000901')site.annotation='sources/neonadeuli-layers.svg';
  const bytes=await readFile(path.join(root,site.sourceAsset.file));
  if(site.sourceAsset.sha256&&sha(bytes)!==site.sourceAsset.sha256)throw Error(`Source hash mismatch: ${site.id}`);
  let plan;
  if(site.annotation)plan=analyzeSvg(await readFile(path.join(root,site.annotation),'utf8'));
  else{
    const {data,info}=await sharp(bytes).resize({width:1300,height:1000,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    plan=analyzeBlueprint({data,width:info.width,height:info.height},{metersPerPixel:site.metersAcross/info.width});
    if(site.buildingType==='park'){
      plan.walls=[];plan.warnings=['공원 안내도입니다. 벽체·개별 주차면·통행 허용 여부를 자동 확정하지 않습니다.'];
      const crop=site.id==='park-boramae'?{x:0,y:0,width:.5,height:1}:{x:76/1071,y:147/1515,width:919/1071,height:651/1515};
      plan.sourceCrop=crop;plan.width*=crop.width;plan.depth*=crop.height;
    }
  }
  if(site.siteId==='10000901'){
    plan=alignNeonadeuliRoad(plan,context);plan.sourceCrop={x:0,y:0,width:1,height:340/600};
    site.footprint=context.ways.find(w=>w.id==='843403989').coordinates.slice(0,-1).map(p=>localPosition(p,site.location));
    site.footprintSource={source:'https://www.openstreetmap.org/way/843403989',license:context.license,sha256:context.sha256};
    site.parkingEvidence={floor:'1F',note:'서울시 공개 평면도 상단: 차량 진입과 주차 차량 확인. 경계·차로는 분석가 추적, 교차점·주차구역 연결은 자동 생성. OSM 도로와 두 기준점 정합.',currentFacilityStatus:'not-surveyed'};
  }
  plan.id=site.id;plan.name=site.name;plan.sourceAsset=site.sourceAsset.file;
  plan=annotateParking(plan,site);
  plan=enrichObjects(plan,site);
  if(site.siteId==='10000901')plan.parkingAccess=plan.spaces.map((s,i)=>({spaceId:s.id,nodeId:i===0?'entrance':i===1?'P2':'P3',source:site.source,method:'source-reviewed-adjacent-lane',surveyed:false}));
  if(site.synthetic){plan.spaces[1].accessible=true;plan.spaces[1].label='장애인 전용 · 합성 검증';}
  if(site.id==='changdong-b2')plan.sourceCrop={x:550/1800,y:330/1350,width:1030/1800,height:830/1350};
  plan.provenance={kind:site.synthetic?'synthetic':site.annotation?'source-traced':'raster-extracted',source:site.source||null,sha256:sha(bytes),annotationSha256:site.annotation?sha(await readFile(path.join(root,site.annotation))):null};
  if(site.synthetic){plan.warnings=['합성 검증 도면입니다. 실제 시설 위치와 경로가 아닙니다.'];}
  try{
    const ocr=JSON.parse(await readFile(path.join(root,'sources/ocr',site.id+'.json')));if(ocr.sourceSha256!==sha(bytes))throw Error('OCR source hash mismatch: '+site.id);
    plan.documentLabels=ocr.labels;
    const crop=plan.sourceCrop||{x:0,y:0,width:1,height:1};
    plan.labels=ocr.labels.filter(t=>t.x>=crop.x&&t.x<=crop.x+crop.width&&t.z>=crop.y&&t.z<=crop.y+crop.height).map(t=>({...t,x:((t.x-crop.x)/crop.width-.5)*plan.width,z:((t.z-crop.y)/crop.height-.5)*plan.depth,width:t.width/crop.width*plan.width,depth:t.depth/crop.height*plan.depth,source:'machine-ocr-review-required'}));
    plan.ocr={method:ocr.method,sourceSha256:ocr.sourceSha256,count:plan.labels.length,status:ocr.status};
  }catch(error){if(error.code!=='ENOENT')throw error;plan.labels=[];}
  const model=compileMeshes(plan),result={plan,model};
  const output=JSON.stringify(result),modelFile=`generated/${site.id}.json`;
  await writeFile(path.join(root,modelFile),output+'\n');
  site.modelFile=modelFile;site.statistics={walls:plan.walls.length,nodes:plan.nodes.length,edges:plan.edges.length,spaces:plan.spaces.filter(s=>['parking','ev'].includes(s.kind)).length,objects:plan.objects.length,accessible:plan.spaces.filter(s=>s.accessible).length,ocrLabels:plan.documentLabels?.length||0,triangles:model.meshes.length*12};
  site.routingReady=plan.routingReady;site.modelHash=sha(output+'\n');
  try{
    const radioBytes=await readFile(path.join(root,'sources/radio',site.siteId+'.json')),raw=JSON.parse(radioBytes),stations=raw.data.map(r=>normalizeStation(r,raw.points.find(p=>p.uid===r.uid))).filter(Boolean),file=`generated/radio-${site.siteId}.json`;
    stations.forEach(s=>radioStationIds.add(s.id));
    await writeFile(path.join(root,file),JSON.stringify({source:raw.source,publisher:raw.publisher,acquiredAt:raw.acquiredAt,query:raw.query,selection:raw.selection,nearbyCount:raw.nearbyOutdoorLte5gCount,sourceFile:`sources/radio/${site.siteId}.json`,sha256:sha(radioBytes),stations,limitations:raw.limitations},null,2)+'\n');
    site.radio={file,count:stations.length,nearbyCount:raw.nearbyOutdoorLte5gCount,acquiredAt:raw.acquiredAt,source:raw.source};
  }catch(error){if(error.code!=='ENOENT')throw error;}
  console.log(`${site.id}: ${site.statistics.walls} walls, ${site.statistics.nodes} nodes, ${site.statistics.edges} edges`);
}
await writeFile(path.join(root,'generated/catalog.json'),JSON.stringify(sites,null,2)+'\n');
const real=sites.filter(s=>!s.synthetic),unique=[...new Map(real.map(s=>[s.siteId,s])).values()];
const inventory={places:unique.length,drawings:real.length,types:Object.fromEntries([...new Set(unique.map(s=>s.buildingType))].map(type=>[type,unique.filter(s=>s.buildingType===type).length])),radioPlaces:unique.filter(s=>s.radio).length,uniqueStations:radioStationIds.size,precisePlaces:unique.filter(s=>s.location&&s.location.precision!=='address-area').length,parkingPlans:real.filter(s=>s.statistics.spaces>0).length,parkingBays:real.reduce((sum,s)=>sum+s.statistics.spaces,0),objects:real.reduce((sum,s)=>sum+s.statistics.objects,0),ocrLabels:real.reduce((sum,s)=>sum+s.statistics.ocrLabels,0)};
await writeFile(path.join(root,'generated/inventory.json'),JSON.stringify(inventory,null,2)+'\n');console.log(inventory);
