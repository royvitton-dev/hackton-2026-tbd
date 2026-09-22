import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyRasterEvidence} from '../../src/core/raster-evidence.js';
const candidate={id:'stroke-1',x1:10,y1:20,x2:90,y2:20,thickness:4,patternScore:78,status:'review-required',structuralStroke:true,tileIds:['tile-1-1']};
const analysis=()=>({id:'test',sourcePixels:{width:100,height:100},resizeScale:1,tiles:[{id:'tile-1-1'}],candidates:[{...candidate}],sourceSha256:'abc',method:'test',tileSize:1024,overlap:160,structuralStrokeCount:1});
const plan=()=>({width:10,depth:10,walls:[{x1:0,z1:0,x2:2,z2:0,thickness:.2,height:2.8}],spaces:[],warnings:[]});
it('projects native lines to metres and clips partial lines to the visible source crop',()=>{
  const p=plan();p.sourceCrop={x:.25,y:.1,width:.5,height:.5};p.width=5;p.depth=5;p.analysis={pixels:2500};p.warnings=['직교 구조선 추정: legacy'];
  const a=analysis();a.candidates.push({...candidate,id:'outside',y1:90,y2:90},{...candidate,id:'vertical',x1:50,x2:50,y1:0,y2:99},{...candidate,id:'left',x1:0,x2:0,y1:10,y2:90});
  applyRasterEvidence(p,a);expect(p.walls).toHaveLength(2);expect(p.walls[0]).toMatchObject({x1:-2.5,x2:2.5,z1:-1.5,z2:-1.5});expect(p.walls[1]).toMatchObject({z1:-2.5,z2:2.5});expect(p.rasterAnalysis.modelPolicy).toBe('automatic-structural-strokes');
  expect(p.wallDetection.walls[0].pixelSegment).toMatchObject({x1:10,x2:90});
  expect(p.analysis).toMatchObject({pixels:10000,wallCount:2,metersPerPixel:.1});expect(p.legacyRasterAnalysis.pixels).toBe(2500);expect(p.warnings.some(w=>w.startsWith('직교'))).toBe(false);
});
it('preserves reviewed navigation walls and never promotes a thin line, parking mark or context-map stroke',()=>{
  const p=plan(),before=structuredClone(p.walls);applyRasterEvidence(p,analysis(),{preserveWalls:true});expect(p.walls).toEqual(before);expect(p.rasterAnalysis.modelPolicy).toBe('reviewed-preserved');
  const marked=plan();marked.spaces=[{kind:'parking',x:0,z:-3,width:9,depth:2}];applyRasterEvidence(marked,analysis());expect(marked.walls).toEqual([]);expect(marked.wallDetection.walls[0].parkingMark).toBe(true);
  const a=analysis();a.candidates[0].structuralStroke=false;const thin=applyRasterEvidence(plan(),a);expect(thin.walls).toEqual([]);
  a.contextMap=true;const park=applyRasterEvidence(plan(),a);expect(park.walls).toEqual([]);expect(park.rasterAnalysis.modelPolicy).toBe('context-map');
  a.contextMap=false;a.planarDrawing=false;a.sourceReview={note:'입체도입니다.'};const reference=applyRasterEvidence(plan(),a);expect(reference.walls).toEqual([]);expect(reference.rasterAnalysis.modelPolicy).toBe('non-plan-drawing');expect(reference.warnings).toContain('입체도입니다.');
});
it('rejects corrupt evidence, duplicated candidate IDs and invalid source transforms',()=>{
  for(const mutation of [{sourcePixels:{}},{resizeScale:.5},{candidates:null},{tiles:[]},{candidates:[candidate,candidate]},{candidates:[{...candidate,x1:NaN}]},{candidates:[{...candidate,thickness:0}]},{candidates:[{...candidate,patternScore:101}]},{candidates:[{...candidate,status:'approved'}]},{candidates:[{...candidate,structuralStroke:undefined}]}])expect(()=>applyRasterEvidence(plan(),{...analysis(),...mutation})).toThrow();
  for(const crop of [{x:0,y:0,width:0,height:1},{x:-1,y:0,width:1,height:1},{x:0,y:0,width:1,height:2}])expect(()=>applyRasterEvidence({...plan(),sourceCrop:crop},analysis())).toThrow();
});
it('every archived drawing has hash-matched native Python tiles and explicit wall-model policy',()=>{
  const file=name=>readFileSync(new URL('../../public/'+name,import.meta.url)),read=name=>JSON.parse(file(name));
  const catalog=read('generated/catalog.json').filter(s=>!s.synthetic),inventory=read('generated/inventory.json'),index=read('analysis/index.json');
  expect(index.drawings).toBe(catalog.length);expect(inventory.pythonAnalyzedDrawings).toBe(63);
  let tiles=0;for(const site of catalog){
    const {plan}=read(site.modelFile),a=read(site.rasterAnalysis.file);expect(a.sourceSha256).toBe(plan.provenance.sha256);expect(plan.rasterAnalysis.signature).toBe(a.signature);expect(a.resizeScale).toBe(1);expect(a.tiles.length).toBeGreaterThan(0);
    for(const [asset,digest] of Object.entries(a.assetHashes))expect(createHash('sha256').update(file(`analysis/${site.id}/${asset}`)).digest('hex')).toBe(digest);
    for(const tile of a.tiles){expect(tile.x+tile.width).toBeLessThanOrEqual(a.sourcePixels.width);expect(tile.y+tile.height).toBeLessThanOrEqual(a.sourcePixels.height);}
    if(plan.provenance.kind==='source-traced')expect(plan.rasterAnalysis.modelPolicy).toBe('reviewed-preserved');
    if(site.buildingType==='park')expect(plan.walls).toEqual([]);
    if(a.planarDrawing===false)expect(plan.walls).toEqual([]);
    expect(plan.wallDetection.walls.every(w=>w.status==='review-required')).toBe(true);tiles+=a.tiles.length;
  }
  expect(tiles).toBe(index.tiles);expect(tiles).toBe(inventory.analysisTiles);
});
