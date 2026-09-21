import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {hasParking,parkingCoverage} from '../../src/core/route-coverage.js';
import {parkingApproachRoute} from '../../src/core/parking.js';
import {parkingBodyClear} from '../../src/core/collision.js';
import {pointAt} from '../../src/core/geometry.js';
import {DEFAULT_VEHICLE} from '../../src/core/navigation.js';
const read=id=>JSON.parse(readFileSync(new URL('../../public/generated/'+id+'.json',import.meta.url))).plan;
it('covers every reviewed parking bay on all four actual plans and independently selects the farthest feasible entry-to-bay route',()=>{
 let total=0;
 for(const id of ['changdong-b2','parking-131601-0','parking-168780-0','10000901-0']){
  const p=read(id),c=parkingCoverage(p);expect(c.reachable).toBe(c.total);expect(c.rows).toHaveLength(c.total);expect(c).toEqual(p.routeCoverage);total+=c.total;
  let maximum=0;for(const a of p.parkingAccess)for(const start of c.starts){const s=p.spaces.find(s=>s.id===a.spaceId);if(s.accessible||s.reserved)continue;const r=parkingApproachRoute(p,start,s.id);if(r)maximum=Math.max(maximum,r.distance);}
  expect(c.longest.distance).toBeCloseTo(maximum);expect(c.longest.restricted).toBe(false);
  const r=parkingApproachRoute(p,c.longest.startId,c.longest.spaceId);
  for(let d=0;d<=r.distance;d+=.2)expect(parkingBodyClear(p,pointAt(r,d),DEFAULT_VEHICLE),id+' @ '+d).toBe(true);
 }
 expect(total).toBe(187);
},30000);
it('keeps every B2 approach outside adjacent parking interiors, not just walls and pillars',()=>{
 const p=read('changdong-b2'),bays={walls:[],objects:p.spaces.filter(s=>s.kind==='parking').map(s=>({...s,kind:'column',height:2}))};
 for(const a of p.parkingAccess){const r=parkingApproachRoute(p,'ramp-start',a.spaceId);for(let d=0;d<=r.distance;d+=.25)expect(parkingBodyClear(bays,pointAt(r,d),DEFAULT_VEHICLE),a.spaceId+' @ '+d).toBe(true);}
},30000);
it('does not create vehicle routes from building type, empty parking data or unreviewed raster candidates',()=>{
 for(const id of ['park-boramae','parking-168780-1','10002143-0']){const p=read(id);expect(hasParking(p)).toBe(false);expect(parkingCoverage(p).longest).toBeNull();}
 const p=read('10000901-0');p.routingReady=false;expect(parkingCoverage(p).reachable).toBe(0);
});
it('rechecks vehicle clearance and reports unavailable bays without falling back to a made-up route',()=>{
 const p=read('parking-168780-0'),c=parkingCoverage(p,{vehicle:{width:9}});expect(c.reachable).toBe(0);expect(c.longest).toBeNull();expect(c.rows.every(r=>r.reason&&r.distance===null)).toBe(true);
 p.parkingAccess=[];expect(parkingCoverage(p).longest).toBeNull();
 const lab=read('integration-lab');expect(parkingCoverage(lab).longest).not.toBeNull();
});
