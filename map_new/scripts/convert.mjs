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
const root=fileURLToPath(new URL('../public/',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(path.join(root,'generated'),{recursive:true});
await writeFile(path.join(root,'sources/integration-lab.svg'),fixtureSvg());
await writeFile(path.join(root,'sources/neonadeuli-layers.svg'),neonadeuliSvg());
execFileSync('python3',[fileURLToPath(new URL('./extract-osm.py',import.meta.url))],{stdio:'inherit'});
const context=JSON.parse(await readFile(path.join(root,'generated/neonadeuli-context.json')));
const sites=JSON.parse(await readFile(path.join(root,'sources/catalog.json')));
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
  }
  if(site.siteId==='10000901'){
    plan=alignNeonadeuliRoad(plan,context);plan.sourceCrop={x:0,y:0,width:1,height:340/600};
    site.footprint=context.ways.find(w=>w.id==='843403989').coordinates.slice(0,-1).map(p=>localPosition(p,site.location));
    site.footprintSource={source:'https://www.openstreetmap.org/way/843403989',license:context.license,sha256:context.sha256};
    site.parkingEvidence={floor:'1F',note:'서울시 공개 평면도 상단: 차량 진입과 주차 차량 확인. 경계·차로는 분석가 추적, 교차점·주차구역 연결은 자동 생성. OSM 도로와 두 기준점 정합.',currentFacilityStatus:'not-surveyed'};
  }
  plan.id=site.id;plan.name=site.name;plan.sourceAsset=site.sourceAsset.file;
  if(site.id==='changdong-b2')plan.sourceCrop={x:550/1800,y:330/1350,width:1030/1800,height:830/1350};
  plan.provenance={kind:site.synthetic?'synthetic':site.annotation?'source-traced':'raster-extracted',source:site.source||null,sha256:sha(bytes),annotationSha256:site.annotation?sha(await readFile(path.join(root,site.annotation))):null};
  if(site.synthetic){plan.warnings=['합성 검증 도면입니다. 실제 시설 위치와 경로가 아닙니다.'];}
  const model=compileMeshes(plan),result={plan,model};
  const output=JSON.stringify(result),modelFile=`generated/${site.id}.json`;
  await writeFile(path.join(root,modelFile),output+'\n');
  site.modelFile=modelFile;site.statistics={walls:plan.walls.length,nodes:plan.nodes.length,edges:plan.edges.length,spaces:plan.spaces.length,triangles:model.meshes.length*12};
  site.routingReady=plan.routingReady;site.modelHash=sha(output+'\n');
  console.log(`${site.id}: ${site.statistics.walls} walls, ${site.statistics.nodes} nodes, ${site.statistics.edges} edges`);
}
await writeFile(path.join(root,'generated/catalog.json'),JSON.stringify(sites,null,2)+'\n');
