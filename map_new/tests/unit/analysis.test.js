import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeSvg,analyzeBlueprint,validatePlan,compileMeshes,connectRoads} from '../../src/core/analysis.js';
import {analyzeRaster} from '../../src/vendor/analysis-v1.js';
import {fixtureSvg,createFixture} from '../../scripts/fixture.mjs';
import {geographicPosition} from '../../src/core/geometry.js';
const svg=fixtureSvg();
it('automatically converts explicit parking, EV, entrance, stairs and shelters into graph and mesh data',()=>{
  const p=analyzeSvg(svg);expect(p.nodes).toHaveLength(15);expect(p.edges).toHaveLength(16);expect(p.spaces).toHaveLength(20);expect(p.nodes.find(n=>n.id==='ev').kind).toBe('ev');expect(p.edges.find(e=>e.kind==='entrance').oneWay).toBe(true);expect(p.edges.find(e=>e.kind==='stairs').modes).toEqual(['person']);expect(p.edges[0].height).toBe(2.4);expect(p.routingReady).toBe(true);
});
it('preserves source-traced disclosure and golden conversion of the actual Korean B2 drawing',()=>{
  const original=readFileSync(new URL('../../public/sources/changdong-parking-annotated.svg',import.meta.url),'utf8'),p=analyzeSvg(original);
  expect(p.layoutType).toBe('source-traced');expect(p.scaleStatus).toBe('estimated');expect(p.nodes.some(n=>n.safe)).toBe(false);
  const golden=JSON.parse(readFileSync(new URL('../golden/changdong-model.json',import.meta.url),'utf8'));expect(compileMeshes(p)).toEqual(golden);
});
it('records source checksums and never silently substitutes a synthetic plan for a public source',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../../public/generated/catalog.json',import.meta.url)));
  expect(catalog.filter(s=>!s.synthetic)).toHaveLength(13);
  for(const site of catalog){const bytes=readFileSync(new URL('../../public/'+site.sourceAsset.file,import.meta.url));const result=JSON.parse(readFileSync(new URL('../../public/'+site.modelFile,import.meta.url)));expect(createHash('sha256').update(bytes).digest('hex')).toBe(result.plan.provenance.sha256);expect(result.plan.provenance.kind==='synthetic').toBe(!!site.synthetic);if(!site.synthetic)expect(site.source).toMatch(/^https:/);}
  const neon=catalog.find(s=>s.photo);expect(neon.location.precision).toBe('publisher-naver-point');const bytes=readFileSync(new URL('../../public/'+neon.photo.file,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(neon.photo.sha256);
});
it('rejects unsafe SVG, missing scale, duplicate IDs, degenerate edges and corrupt spaces',()=>{
  for(const input of [null,'','<!ENTITY x>','<script/>','<foreignObject/>',svg.replace('data-meters-per-unit="1"','')])expect(()=>analyzeSvg(input)).toThrow();
  const p=createFixture();for(const invalid of [{...p,nodes:[p.nodes[0],p.nodes[0]]},{...p,nodes:[{...p.nodes[0],y:NaN}]},{...p,edges:[p.edges[0],p.edges[0]]},{...p,edges:[{...p.edges[0],height:-1}]},{...p,edges:[{...p.edges[0],from:p.edges[0].to}]},{...p,edges:[{...p.edges[0],oneWay:'yes'}]},{...p,spaces:[{...p.spaces[0],depth:NaN}]}])expect(()=>validatePlan(invalid)).toThrow();
});
it('extracts raster walls, distinguishes uncalibrated scale, and rejects invalid pixels',()=>{
  const width=100,height=80,data=new Uint8ClampedArray(width*height*4).fill(255),rect=(x,z,w,h,value=0)=>{for(let j=z;j<z+h;j++)for(let i=x;i<x+w;i++){const off=(j*width+i)*4;data[off]=data[off+1]=data[off+2]=value;}};
  rect(10,10,70,4);rect(10,10,4,60);rect(20,50,60,1);rect(50,30,2,2);
  const p=analyzeRaster({data,width,height},{metersPerPixel:.1});expect(p.walls).toHaveLength(2);expect(p.nodes).toHaveLength(0);expect(p.routingReady).toBe(false);expect(analyzeRaster({data,width,height},{calibrated:true}).scaleStatus).toBe('user-calibrated');
  expect(compileMeshes(p).meshes[0].positions).toHaveLength(24);expect(compileMeshes(p).meshes[0].indices).toHaveLength(36);
  expect(()=>analyzeRaster({data,width:0,height})).toThrow();expect(()=>analyzeRaster({data,width,height},{metersPerPixel:-1})).toThrow();expect(()=>validatePlan({...p,walls:[{x1:NaN}]})).toThrow();expect(()=>validatePlan({version:1,width:10,depth:10})).toThrow();
  data.fill(255);rect(0,1,100,1,140);rect(0,30,100,1,140);expect(analyzeBlueprint({data,width,height}).walls).toHaveLength(1);data.fill(0);expect(analyzeRaster({data,width,height}).walls).toEqual([]);
});
it('joins real geographic roads only through an explicit verified entrance path',()=>{
  const p=createFixture();p.anchor={lat:37.6,lng:127.1};const roads={nodes:[{id:'a',...geographicPosition({x:0,z:42},p.anchor)},{id:'b',...geographicPosition({x:40,z:42},p.anchor)}],edges:[{id:'ab',from:'a',to:'b',width:9,modes:['car','person']}]};
  const portal={verified:true,indoorId:'entrance',roadId:'a',width:9,height:2.4,path:[{x:0,z:34}]};expect(connectRoads(p,roads,portal).nodes.some(n=>n.id==='road:a')).toBe(true);
  expect(()=>connectRoads(p,roads,{...portal,verified:false})).toThrow();expect(()=>connectRoads(p,roads,{...portal,indoorId:'missing'})).toThrow();expect(()=>connectRoads(p,roads,{...portal,path:undefined})).toThrow();
});
