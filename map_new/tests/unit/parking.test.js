import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parkingRoute,parkingBodyClear} from '../../src/core/parking.js';
import {DEFAULT_VEHICLE,pointAt} from '../../src/core/navigation.js';
import {validatePlan,compileMeshes} from '../../src/core/analysis.js';
import {distance} from '../../src/core/geometry.js';
const source=()=>JSON.parse(readFileSync(new URL('../../public/generated/10000901-0.json',import.meta.url))).plan;
const compact={...DEFAULT_VEHICLE,width:1.7,length:4.1,turnRadius:4.2};

it('reaches a real source bay from the OSM road with a compact vehicle and a continuous radius-constrained maneuver',()=>{
 const plan=source(),r=parkingRoute(plan,'road-start','bay-P2',{vehicle:compact}),bay=plan.spaces.find(s=>s.id==='bay-P2');
 expect(r.ids).toEqual(['road-start','road-portal','entrance','P2','parking:bay-P2']);expect(r.parking.source).toBe(plan.provenance.source);expect(r.parking.surveyed).toBe(false);
 const end=pointAt(r,r.distance);expect(end.arrived).toBe(true);expect(end.heading).toBeCloseTo(Math.PI/2);expect(Math.abs(end.z-bay.z)+compact.width/2+compact.clearance).toBeLessThan(bay.depth/2);
 expect(Math.abs(end.x-bay.x)+compact.length/2+compact.clearance).toBeLessThan(bay.width/2);expect(r.seconds).toBeCloseTo(r.distance/compact.speed);
 for(let d=0;d<=r.distance;d+=.05)expect(parkingBodyClear(plan,pointAt(r,d),compact)).toBe(true);
 for(let i=2;i<r.points.length;i++){
  const [a,b,c]=r.points.slice(i-2,i+1),area=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x));
  if(area>1e-8)expect(distance(a,b)*distance(b,c)*distance(c,a)/(2*area)).toBeGreaterThanOrEqual(compact.turnRadius-.04);
 }
 expect(parkingRoute(plan,'road-start','bay-P3',{vehicle:compact})).not.toBeNull();
 // The longer default vehicle does not get a made-up wider aisle.
 expect(parkingRoute(plan,'road-start','bay-P2')).toBeNull();
});
it('requires an explicit connection and keeps protected, blocked and undersized bays unavailable',()=>{
 const p=source(),run=plan=>parkingRoute(plan,'road-start','bay-P2',{vehicle:compact});
 expect(run({...p,parkingAccess:undefined})).toBeNull();expect(parkingRoute(p,'road-start','missing')).toBeNull();
 for(const key of ['blocked','reserved','accessible']){const plan=source();plan.spaces.find(s=>s.id==='bay-P2')[key]=true;expect(run(plan)).toBeNull();}
 expect(parkingRoute(p,'road-start','bay-P2',{mode:'person'})).toBeNull();expect(parkingRoute(p,'P2','bay-P2',{vehicle:compact})).toBeNull();
 expect(parkingRoute(p,'missing','bay-P2',{vehicle:compact})).toBeNull();expect(parkingRoute(p,'road-start','bay-P2',{vehicle:{length:7}})).toBeNull();
 const narrow=source();narrow.spaces.find(s=>s.id==='bay-P2').depth=1.5;expect(run(narrow)).toBeNull();
 expect(parkingRoute(p,'road-start','bay-P2',{vehicle:compact,blocked:['osm-road']})).toBeNull();
 expect(parkingRoute(p,'road-start','bay-P1',{vehicle:compact})).toBeNull();
});
it('detects a thin wall or column inside the body even when no car corner touches it',()=>{
 const pose={x:0,y:0,z:0,heading:Math.PI/4},p={walls:[]},column={id:'pillar',kind:'column',x:0,z:0,width:.15,depth:.15,height:3};
 expect(parkingBodyClear({...p,objects:[column]},pose,compact)).toBe(false);
 expect(parkingBodyClear({...p,objects:[{...column,x:10}]},pose,compact)).toBe(true);
 expect(parkingBodyClear({...p,objects:[{...column,y:5}]},pose,compact)).toBe(true);
 expect(parkingBodyClear({...p,objects:[{...column,kind:'room'}]},pose,compact)).toBe(true);
 const wall={x1:-.1,x2:.1,z1:0,z2:0,height:3,thickness:.02};
 expect(parkingBodyClear({walls:[wall]},pose,compact)).toBe(false);expect(parkingBodyClear({walls:[{...wall,y:4}]},pose,compact)).toBe(true);
 expect(parkingBodyClear(p,pose,compact,[{x:0,z:0,radius:.1}])).toBe(false);expect(parkingBodyClear(p,pose,compact,[{x:0,y:5,z:0,radius:1}])).toBe(true);
});
it('rejects the complete maneuver if a bay obstacle or fire blocks its final position',()=>{
 const p=source(),bay=p.spaces.find(s=>s.id==='bay-P2');
 p.objects.push({...bay,id:'temporary-obstacle',kind:'column',width:2,depth:2,height:3});expect(parkingRoute(p,'road-start',bay.id,{vehicle:compact})).toBeNull();
 expect(parkingRoute(p,'road-start',bay.id,{vehicle:{...compact,turnRadius:.01}})).toBeNull();
 expect(parkingRoute(source(),'road-start',bay.id,{vehicle:compact,hazards:[{x:bay.x,z:bay.z,radius:2}]})).toBeNull();
 const highFire=parkingRoute(source(),'road-start',bay.id,{vehicle:compact,hazards:[{x:bay.x,y:8,z:bay.z,radius:2}]});expect(highFire).not.toBeNull();
});
it('handles the same lane and bay geometry rotated by ninety degrees',()=>{
 const p=source(),rotate=v=>({...v,x:-v.z,z:v.x});p.nodes=p.nodes.map(rotate);p.spaces=p.spaces.map(s=>({...rotate(s),width:s.depth,depth:s.width}));p.objects=p.objects.map(o=>({...rotate(o),width:o.depth,depth:o.width}));p.walls=p.walls.map(w=>({...w,x1:-w.z1,z1:w.x1,x2:-w.z2,z2:w.x2}));
 const r=parkingRoute(p,'road-start','bay-P2',{vehicle:compact});expect(r).not.toBeNull();expect(pointAt(r,r.distance).heading).toBeCloseTo(0);
});
it('validates connection references and preserves reviewed access in the exported model',()=>{
 const p=source();expect(compileMeshes(p).parkingAccess).toEqual(p.parkingAccess);
 for(const access of [{},[null],[{spaceId:'missing',nodeId:'P2'}],[{spaceId:'bay-P2',nodeId:'missing'}],[p.parkingAccess[0],p.parkingAccess[0]]])expect(()=>validatePlan({...p,parkingAccess:access})).toThrow('연결');
});
