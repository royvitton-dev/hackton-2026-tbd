import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parkingApproachRoute,parkingBodyClear} from '../../src/core/parking.js';
import {route,pointAt,DEFAULT_VEHICLE} from '../../src/core/navigation.js';
import {validatePlan} from '../../src/core/analysis.js';
const source=()=>JSON.parse(readFileSync(new URL('../../public/generated/parking-168780-0.json',import.meta.url))).plan;
it('connects all 13 ordinary Dongtan bays to reviewed one-way deck origins and preserves the 18 protected bays',()=>{
 const p=source();expect(p.spaces).toHaveLength(31);expect(p.parkingAccess).toHaveLength(13);
 expect(p.spaces.filter(s=>s.accessible)).toHaveLength(12);expect(p.spaces.filter(s=>s.reserved)).toHaveLength(6);
 for(const a of p.parkingAccess){
  const r=parkingApproachRoute(p,a.startNodeId,a.spaceId);expect(r,a.spaceId).not.toBeNull();expect(r.approach.arrival).toBe('adjacent-aisle');
  for(let d=0;d<=r.distance;d+=.3)expect(parkingBodyClear(p,pointAt(r,d),DEFAULT_VEHICLE)).toBe(true);
 }
 for(const s of p.spaces.filter(s=>s.accessible||s.reserved))expect(parkingApproachRoute(p,'west-deck-start',s.id)).toBeNull();
});
it('does not reverse source arrows or connect across the central void and unreviewed ramps',()=>{
 const p=source(),west='west-deck-start',east='east-deck-start',end='west-vehicle-exit';
 expect(route(p,west,end)?.distance).toBeGreaterThan(33);expect(route(p,end,west)).toBeNull();
 expect(route(p,west,east)).toBeNull();expect(route(p,east,west)).toBeNull();
 expect(parkingApproachRoute(p,west,'east-inner-6-1')).toBeNull();expect(parkingApproachRoute(p,east,'west-inner-8-1')).toBeNull();
 expect(route(p,end,west,{mode:'person'})).not.toBeNull();
 expect(parkingApproachRoute(p,west,'west-inner-8-1',{vehicle:{width:6}})).toBeNull();
 const start=p.nodes.find(n=>n.id===west),obstacle={kind:'column',id:'closed-aisle',x:start.x,z:start.z+3,width:1,depth:1,height:3};
 expect(parkingApproachRoute({...p,objects:[...p.objects,obstacle]},west,'west-inner-8-1')).toBeNull();
});
it('uses the printed grid, reviewed core openings and original PS/lift locations',()=>{
 const p=source();expect(p.scaleEvidence).toMatchObject({method:'printed-grid-dimensions',pixelLength:1130,meters:92.75,surveyed:false});
 expect(p.width).toBeCloseTo(1536*92.75/1130);expect(p.depth).toBeCloseTo(822*92.75/1130);
 expect(p.walls).toHaveLength(48);expect(p.rasterAnalysis.modelPolicy).toBe('reviewed-preserved');
 expect(p.objects.filter(o=>o.kind==='lift').map(o=>o.evidence.sourcePixel.y)).toEqual([585.5,583.5]);
 expect(p.objects.filter(o=>o.label.includes('PS')).every(o=>o.kind==='room')).toBe(true);
 expect(p.semanticCoverage).toMatchObject({drawingDeclaredParking:87,modeledParking:31});
 const bad=source();bad.parkingAccess[0].startNodeId='missing';expect(()=>validatePlan(bad)).toThrow('주차면');
});
