import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {detectParking,matchReviewedParking,rectangleOverlap} from '../../src/core/detect-parking.js';
import {analyzeBlueprint,compileMeshes,validatePlan} from '../../src/core/analysis.js';
import {createFixture} from '../../scripts/fixture.mjs';

function drawing({horizontal=false,bays=4,value=0,alpha=255,end=true,thickness=1}={}){
 const width=240,height=240,data=new Uint8ClampedArray(width*height*4).fill(255);
 const ink=(x,y)=>{if(horizontal)[x,y]=[y,x];const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=alpha;};
 for(let n=0;n<=bays;n++)for(let y=40;y<90;y++)for(let t=0;t<thickness;t++)ink(30+n*25+t,y);
 if(end)for(let x=30;x<=30+bays*25;x++)ink(x,40);
 return {data,width,height};
}
it('detects perpendicular rows at physical scale and deduplicates contrast passes',()=>{
 for(const horizontal of [false,true]){
  const d=detectParking(drawing({horizontal,thickness:2}),{metersPerPixel:.1});expect(d.spaces).toHaveLength(4);
  for(const s of d.spaces){expect(s.width).toBeCloseTo(horizontal?5:2.5);expect(s.depth).toBeCloseTo(horizontal?2.5:5);expect(s.status).toBe('review-required');expect(s.classification).toBe('unknown');expect(s.patternScore).toBeGreaterThan(85);}
  const first=d.spaces[0];expect(first.x).toBeCloseTo(horizontal?-5.5:-7.7);expect(first.z).toBeCloseTo(horizontal?-7.7:-5.5);
 }
});
it('requires repeated stems and an end line; handles pale and transparent pixels',()=>{
 for(const input of [{bays:2},{end:false},{alpha:0}])expect(detectParking(drawing(input),{metersPerPixel:.1}).spaces).toHaveLength(0);
 expect(detectParking(drawing({value:245}),{metersPerPixel:.1,thresholds:[185]}).spaces).toHaveLength(0);
 expect(detectParking(drawing({value:245}),{metersPerPixel:.1}).spaces).toHaveLength(4);
});
it('limits analysis to the drawing crop and projects into its local coordinate frame',()=>{
 const pixels=drawing(),cropped=detectParking(pixels,{metersPerPixel:.1,crop:{x:0,y:0,width:.625,height:.5}});
 expect(cropped.spaces).toHaveLength(4);expect(cropped.spaces[0].x).toBeCloseTo(-3.25);expect(cropped.spaces[0].z).toBeCloseTo(.5);
 expect(detectParking(pixels,{metersPerPixel:.1,crop:{x:0,y:.5,width:1,height:.5}}).spaces).toHaveLength(0);
 expect(detectParking(pixels,{metersPerPixel:.1,crop:{x:0,y:0,width:1.000001,height:1.000001}}).spaces).toHaveLength(4);
});
it('rejects malformed image, physical scale and crop settings',()=>{
 const p=drawing();for(const pixels of [{...p,width:0},{...p,height:2.5},{...p,width:3000,height:3000},{...p,data:[]}])expect(()=>detectParking(pixels)).toThrow();
 for(const options of [{metersPerPixel:NaN},{metersPerPixel:0},{metersPerPixel:11},{crop:{x:-1,y:0,width:1,height:1}},{crop:{x:0,y:0,width:0,height:1}},{crop:{x:0,y:0,width:2,height:1}},{thresholds:[]},{thresholds:[0]},{thresholds:[256]},{thresholds:[.1]},{thresholds:Array(13).fill(85)}])expect(()=>detectParking(p,options)).toThrow();
});
it('matches one reviewed bay once while preserving accessibility and reserved status',()=>{
 const detected=detectParking(drawing(),{metersPerPixel:.1}),reviewed=detected.spaces.map((s,i)=>({...s,id:'reviewed-'+i,kind:i===2?'ev':'parking',accessible:i===0,reserved:i===1}));
 const matched=matchReviewedParking({...detected,spaces:[...detected.spaces,detected.spaces[0],{...detected.spaces[0],x:50}]},[...reviewed,{...reviewed[0],id:'room',kind:'room'}]);
 expect(matched.spaces.slice(0,4).map(s=>s.classification)).toEqual(['accessible','reserved','ev','parking']);expect(matched.spaces.filter(s=>s.reviewedSpaceId)).toHaveLength(4);
 expect(matched.spaces.every(s=>s.status==='review-required')).toBe(true);expect(detected.spaces.every(s=>!s.reviewedSpaceId)).toBe(true);
 expect(rectangleOverlap(reviewed[0],reviewed[0])).toBe(1);expect(rectangleOverlap(reviewed[0],{...reviewed[0],x:50})).toBe(0);
 expect(matchReviewedParking(detected,[{...reviewed[0],x:reviewed[0].x+1}]).spaces.every(s=>!s.reviewedSpaceId)).toBe(true);
});
it('exports candidate geometry separately from actual parking, destinations and routing',()=>{
 const plan=analyzeBlueprint(drawing(),{metersPerPixel:.1}),model=compileMeshes(plan);
 expect(model.parkingCandidates).toHaveLength(4);expect(model.spaces).toEqual([]);expect(model.nodes).toEqual([]);expect(plan.routingReady).toBe(false);
 expect(analyzeBlueprint(drawing(),{parkingDetection:false}).parkingDetection).toBeUndefined();
 const fixture=createFixture(),good=plan.parkingDetection.spaces[0];
 for(const detection of [null,{spaces:null},{spaces:Array(401).fill(good)},{spaces:[good,good]},{spaces:[{...good,id:1}]},{spaces:[{...good,x:NaN}]},{spaces:[{...good,width:0}]},{spaces:[{...good,patternScore:101}]},{spaces:[{...good,patternScore:-1}]}])expect(()=>validatePlan({...fixture,parkingDetection:detection})).toThrow();
});
it('archives higher resolution and OCR hashes without promoting detected bays into confirmed inventory',()=>{
 const read=file=>JSON.parse(readFileSync(new URL('../../public/'+file,import.meta.url)));
 const catalog=read('generated/catalog.json'),inventory=read('generated/inventory.json');let candidates=0,matched=0;
 expect(catalog.filter(s=>s.sourceResolution)).toHaveLength(31);
 for(const site of catalog.filter(s=>!s.synthetic)){
  const {plan,model}=read(site.modelFile),ocr=read('sources/ocr/'+site.id+'.json');expect(ocr.sourceSha256).toBe(plan.provenance.sha256);
  if(site.sourceResolution){expect(site.sourceResolution.selectedWidth).toBeGreaterThan(site.sourceResolution.previous.width);expect(site.previewAsset.file).not.toBe(site.sourceAsset.file);}
  if(!plan.parkingDetection)continue;
  expect(plan.parkingDetection.sourceSha256).toBe(plan.provenance.sha256);expect(model.parkingCandidates).toEqual(plan.parkingDetection.spaces);
  const ids=new Set(plan.spaces.map(s=>s.id));for(const candidate of plan.parkingDetection.spaces){expect(ids.has(candidate.id)).toBe(false);expect(candidate.status).toBe('review-required');if(candidate.reviewedSpaceId)expect(ids.has(candidate.reviewedSpaceId)).toBe(true);}
  candidates+=plan.parkingDetection.spaces.length;matched+=plan.parkingDetection.spaces.filter(s=>s.reviewedSpaceId).length;
 }
 expect(candidates).toBe(inventory.detectedParking);expect(matched).toBe(inventory.matchedParking);expect(inventory.parkingBays).toBe(187);
 const site=catalog.find(s=>s.id==='parking-131601-0'),{plan}=read(site.modelFile);
 expect(plan.parkingDetection.spaces.length).toBeGreaterThan(40);expect(plan.parkingDetection.spaces.filter(s=>s.reviewedSpaceId).length).toBeGreaterThan(10);
 expect(createHash('sha256').update(readFileSync(new URL('../../public/'+site.sourceAsset.file,import.meta.url))).digest('hex')).toBe(plan.parkingDetection.sourceSha256);
});
