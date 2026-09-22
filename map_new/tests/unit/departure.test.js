import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parkingExitRoute,parkingDepartureRoute} from '../../src/core/departure.js';
import {route,DEFAULT_VEHICLE} from '../../src/core/navigation.js';
import {pointAt,distance} from '../../src/core/geometry.js';
import {parkingBodyClear} from '../../src/core/collision.js';
import {advanceRoute,remainingSeconds} from '../../src/core/playback.js';
const read=id=>JSON.parse(readFileSync(new URL('../../public/generated/'+id+'.json',import.meta.url))).plan;
it('connects every reviewed bay to an exit or a clearly identified drawing boundary without reversing one-way lanes',()=>{
 let count=0,boundaries=0;
 for(const id of ['changdong-b2','parking-131601-0','parking-168780-0','10000901-0']){
  const p=read(id);expect(p.routeCoverage.outboundReachable).toBe(p.parkingAccess.length);
  for(const a of p.parkingAccess){
   const r=parkingExitRoute(p,a.spaceId);expect(r,a.spaceId).not.toBeNull();count++;if(r.departure.arrival==='drawing-boundary')boundaries++;
   for(let i=0;i<r.edges.length;i++){const e=p.edges.find(e=>e.id===r.edges[i]);if(e.oneWay){expect(r.ids[i]).toBe(e.from);expect(r.ids[i+1]).toBe(e.to);}}
   for(let d=0;d<r.distance;d+=.4)expect(parkingBodyClear(p,pointAt(r,d),DEFAULT_VEHICLE),a.spaceId+' @ '+d).toBe(true);
  }
 }
 expect(count).toBe(187);expect(boundaries).toBe(114);
},45000);
it('departs a real bay with a continuous front heading, collision clearance, gear pauses and an onward exit route',()=>{
 const p=read('parking-131601-0'),r=parkingDepartureRoute(p,'entry-east','north-8');expect(r).not.toBeNull();expect(r.departure.from).toBe('inside-bay');expect(r.parking.direction).toBe('departure');expect(r.destination.id).toBe('entry-west');
 const bay=p.spaces.find(s=>s.id==='north-8'),first=pointAt(r,0);expect(Math.abs(first.x-bay.x)).toBeLessThan(.2);expect(Math.abs(first.z-bay.z)).toBeLessThan(.2);
 for(let d=0;d<r.distance;d+=.1)expect(parkingBodyClear(p,pointAt(r,d),DEFAULT_VEHICLE)).toBe(true);
 for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],delta=Math.abs(Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading)));expect(delta).toBeLessThanOrEqual(distance(a,b)/DEFAULT_VEHICLE.turnRadius+.006);}
 expect(r.gearChanges.length).toBeGreaterThan(1);expect(remainingSeconds(r,0,3.5)).toBeCloseTo(r.seconds);
 const end=advanceRoute(r,{travel:0,gear:first.gear,shiftIndex:0,pause:0},1000,3.5);expect(end.travel).toBeCloseTo(r.distance);
},60000);
it('preserves source restrictions, vehicle sizes, blocked edges and initial vehicle heading',()=>{
 const p=read('parking-168780-0');expect(parkingDepartureRoute(p,'west-deck-start','west-inner-1-1')).toBeNull();expect(parkingDepartureRoute(p,'west-deck-start','west-compact-0-1')).toBeNull();expect(parkingDepartureRoute(p,'west-deck-start','missing')).toBeNull();
 expect(parkingExitRoute(p,'west-outer-0-1',{blocked:p.edges.map(e=>e.id)})).toBeNull();expect(parkingExitRoute(p,'west-outer-0-1',{vehicle:{width:9}})).toBeNull();expect(parkingExitRoute(p,'west-outer-0-1',{mode:'person'})).toBeNull();
 expect(route(p,'west-deck-start','west-vehicle-exit',{startHeading:Math.PI})).toBeNull();expect(route(p,'west-deck-start','west-vehicle-exit',{startHeading:0})).not.toBeNull();
 const bay=p.spaces.find(s=>s.id==='west-outer-0-1');bay.blocked=true;expect(parkingExitRoute(p,bay.id)).toBeNull();expect(parkingDepartureRoute({...p,routingEvidence:{}},'west-deck-start',bay.id)).toBeNull();
});
it('retains reverse gear and the front-facing camera pose when leaving a forward-parked bay and descending a ramp',()=>{
 for(const [id,start,bay,vehicle] of [['10000901-0','road-start','bay-P2',{...DEFAULT_VEHICLE,width:1.7,length:4.1,turnRadius:4.2}],['multilevel-lab','entry','upper-bay',DEFAULT_VEHICLE]]){
  const p=read(id),r=parkingDepartureRoute(p,start,bay,{vehicle});expect(r).not.toBeNull();expect(pointAt(r,0).gear).toBe(-1);expect(r.departure.from).toBe('inside-bay');expect(r.parking.reverseDistance).toBeGreaterThan(0);
  for(let d=0;d<r.distance;d+=.15)expect(parkingBodyClear(p,pointAt(r,d),vehicle)).toBe(true);
  expect(remainingSeconds(r,0,vehicle.speed)).toBeCloseTo(r.seconds);
  if(id==='multilevel-lab'){expect(pointAt(r,0).y).toBe(3.3);expect(pointAt(r,r.distance).y).toBe(0);expect(parkingDepartureRoute(p,start,bay,{vehicle:{maxGrade:.05}})).toBeNull();}
 }
},60000);
