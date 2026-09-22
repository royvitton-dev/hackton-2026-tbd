import {it,expect,beforeAll} from 'vitest';
import {readFileSync} from 'node:fs';
import {parkingManeuverRoute,motion} from '../../src/core/maneuver.js';
import {DEFAULT_VEHICLE,pointAt} from '../../src/core/navigation.js';
import {parkingBodyClear} from '../../src/core/collision.js';
import {distance} from '../../src/core/geometry.js';
import {advanceRoute,remainingSeconds} from '../../src/core/playback.js';
const source=id=>JSON.parse(readFileSync(new URL(`../../public/generated/${id}.json`,import.meta.url))).plan;
const vehicle=DEFAULT_VEHICLE,small={...vehicle,width:1.6,length:3.5,turnRadius:3.5};
let plan,path;
beforeAll(()=>{plan=source('parking-131601-0');path=parkingManeuverRoute(plan,'entry-east','north-8',{parkingMode:'reverse'});},60000);
it('reverses a full-size car into a reviewed bay with bounded curvature and no adjacent-bay intrusion',()=>{
 expect(path?.parking.method).toBe('bounded-kinematic-search');expect(path.parking.visitedStates).toBeLessThanOrEqual(24000);expect(path.gearChanges.length).toBeGreaterThan(1);
 const bay=plan.spaces.find(s=>s.id==='north-8'),end=pointAt(path,path.distance),neighbors=plan.spaces.filter(s=>s.id!==bay.id);
 expect(end.arrived).toBe(true);expect(end.gear).toBe(-1);expect(Math.abs(end.x-bay.x)+vehicle.width/2+vehicle.clearance).toBeLessThanOrEqual(bay.width/2);
 expect(Math.abs(end.z-bay.z)+vehicle.length/2+vehicle.clearance).toBeLessThanOrEqual(bay.depth/2);
 for(let d=0;d<path.distance;d+=.06){const pose=pointAt(path,d);expect(parkingBodyClear(plan,pose,vehicle)).toBe(true);
  for(const x of [-1,0,1])for(const z of [-1,0,1]){const w=x*(vehicle.width/2+vehicle.clearance),l=z*(vehicle.length/2+vehicle.clearance),q={x:pose.x+Math.cos(pose.heading)*w+Math.sin(pose.heading)*l,z:pose.z-Math.sin(pose.heading)*w+Math.cos(pose.heading)*l};expect(neighbors.some(s=>Math.abs(q.x-s.x)<s.width/2-.02&&Math.abs(q.z-s.z)<s.depth/2-.02)).toBe(false);}
 }
 for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],d=distance(a,b),angle=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));if(a.gear===b.gear&&d<.11)expect(Math.abs(angle)/d).toBeLessThanOrEqual(1/vehicle.turnRadius+.001);}
 expect(path.parking.surveyed).toBe(false);expect(path.parking.source).toContain('brique.co');
});
it('keeps the nose continuous at gear changes and moves opposite the heading in reverse',()=>{
 for(const shift of path.gearChanges){const a=pointAt(path,shift.distance-.001),b=pointAt(path,shift.distance+.001);expect(Math.abs(Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading)))).toBeLessThan(.001);}
 const points=motion({x:0,y:0,z:0,heading:0},Math.PI*2,1/4,-1),r={points,distance:points.slice(1).reduce((s,p,i)=>s+distance(points[i],p),0)};
 const a=pointAt(r,.4),b=pointAt(r,.41);expect((b.x-a.x)*Math.sin(a.heading)+(b.z-a.z)*Math.cos(a.heading)).toBeLessThan(0);
 expect(points.at(-1).heading).toBeCloseTo(-Math.PI/2);expect(pointAt(r,r.distance+1).heading).toBeCloseTo(-Math.PI/2);
});
it('uses an analytic reverse maneuver when a smaller vehicle fits, including a rotated drawing',()=>{
 const r=parkingManeuverRoute(plan,'entry-east','north-8',{vehicle:small,parkingMode:'reverse'});expect(r.parking.method).toBe('forward-setup-reverse-circular-arc');expect(r.gearChanges).toHaveLength(1);
 const p=structuredClone(plan),rotate=v=>({...v,x:-v.z,z:v.x});p.nodes=p.nodes.map(rotate);p.spaces=p.spaces.map(s=>({...rotate(s),width:s.depth,depth:s.width}));p.objects=p.objects.map(o=>({...rotate(o),width:o.depth,depth:o.width}));p.walls=p.walls.map(w=>({...w,x1:-w.z1,z1:w.x1,x2:-w.z2,z2:w.x2}));
 const rotated=parkingManeuverRoute(p,'entry-east','north-8',{vehicle:small,parkingMode:'reverse'});expect(rotated).not.toBeNull();expect(Math.sin(pointAt(rotated,rotated.distance).heading)).toBeCloseTo(-1);
});
it('supports forward-only and automatic choices while preserving bay restrictions',()=>{
 const neon=source('10000901-0'),compact={width:1.7,length:4.1,turnRadius:4.2};
 expect(parkingManeuverRoute(neon,'road-start','bay-P2',{vehicle:compact}).parking.method).toBe('forward-circular-fillet');
 expect(parkingManeuverRoute(neon,'road-start','bay-P2',{parkingMode:'forward'})).toBeNull();
 expect(()=>parkingManeuverRoute(plan,'entry-east','north-8',{parkingMode:'sideways'})).toThrow();
 for(const key of ['accessible','reserved','blocked']){const p=structuredClone(plan);p.spaces.find(s=>s.id==='north-8')[key]=true;expect(parkingManeuverRoute(p,'entry-east','north-8',{parkingMode:'reverse'})).toBeNull();}
 for(const options of [{mode:'person'},{vehicle:{width:4}},{vehicle:{length:7}}])expect(parkingManeuverRoute(plan,'entry-east','north-8',{parkingMode:'reverse',...options})).toBeNull();
 expect(()=>parkingManeuverRoute(plan,'entry-east','north-8',{parkingMode:'reverse',vehicle:{turnRadius:.01}})).not.toThrow();
 expect(parkingManeuverRoute({...plan,parkingAccess:[]},'entry-east','north-8',{parkingMode:'reverse'})).toBeNull();
 expect(parkingManeuverRoute(plan,'missing','north-8',{parkingMode:'reverse'})).toBeNull();
 expect(parkingManeuverRoute(plan,plan.parkingAccess.find(a=>a.spaceId==='north-8').nodeId,'north-8',{parkingMode:'reverse'})).toBeNull();
});
it('does not force a maneuver through a bay obstruction or a blocked approach',()=>{
 const p=structuredClone(plan),bay=p.spaces.find(s=>s.id==='north-8');p.objects.push({...bay,id:'blocked-bay',kind:'column',height:3});
 expect(parkingManeuverRoute(p,'entry-east','north-8',{parkingMode:'reverse',vehicle:small})).toBeNull();
 expect(parkingManeuverRoute(plan,'entry-east','north-8',{parkingMode:'reverse',blocked:plan.edges.map(e=>e.id)})).toBeNull();
},60000);
it('stops for every shift at high playback speed and includes reverse speed and pauses in ETA',()=>{
 let state={travel:0,gear:1,shiftIndex:0,pause:0};const shift=path.gearChanges[0];
 state=advanceRoute(path,state,shift.distance/vehicle.speed+.3,vehicle.speed);expect(state.travel).toBeCloseTo(shift.distance);expect(state.pause).toBeCloseTo(.5);expect(state.gear).toBe(-1);
 const waiting=advanceRoute(path,state,.2,vehicle.speed);expect(waiting.travel).toBe(state.travel);expect(waiting.pause).toBeCloseTo(.3);
 const moving=advanceRoute(path,waiting,.4,vehicle.speed);expect(moving.travel).toBeCloseTo(waiting.travel+.12);expect(moving.pause).toBe(0);
 expect(remainingSeconds(path,0,vehicle.speed)).toBeCloseTo(path.seconds);expect(remainingSeconds(path,path.distance,vehicle.speed)).toBe(0);
 state=advanceRoute(path,state,1000,vehicle.speed);expect(state.travel).toBe(path.distance);expect(state.shiftIndex).toBe(path.gearChanges.length);
 const straight={points:[{x:0,z:0},{x:0,z:10}],distance:10};expect(advanceRoute(straight,{travel:0},2,2).travel).toBe(4);expect(remainingSeconds(straight,4,2)).toBe(3);
});
