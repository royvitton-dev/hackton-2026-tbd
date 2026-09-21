import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parkingApproachRoute,parkingBodyClear} from '../../src/core/parking.js';
import {route,pointAt,DEFAULT_VEHICLE} from '../../src/core/navigation.js';
import {distance} from '../../src/core/geometry.js';
const source=()=>JSON.parse(readFileSync(new URL('../../public/generated/parking-131601-0.json',import.meta.url))).plan;
it('routes from the source entrance to all 50 reviewed ordinary bays while protecting accessible bays',()=>{
 const p=source();expect(p.spaces).toHaveLength(52);expect(p.parkingAccess).toHaveLength(50);
 for(const a of p.parkingAccess){const r=parkingApproachRoute(p,'entry-east',a.spaceId);expect(r, a.spaceId).not.toBeNull();expect(r.approach).toMatchObject({spaceId:a.spaceId,arrival:'adjacent-aisle',surveyed:false});expect(r.destination.label).toContain('주차면 앞');}
 for(const id of ['missing','accessible-1','accessible-2'])expect(parkingApproachRoute(p,'entry-east',id)).toBeNull();
 const blocked=source();blocked.spaces.find(s=>s.id==='north-8').blocked=true;expect(parkingApproachRoute(blocked,'entry-east','north-8')).toBeNull();
 expect(parkingApproachRoute(p,'entry-east','north-8',{vehicle:{width:7}})).toBeNull();
 expect(parkingApproachRoute(p,'entry-east','west-5',{mode:'person'})).not.toBeNull();
});
it('keeps the west-turn trajectory clear of source walls and pillars with continuous vehicle curvature',()=>{
 const p=source(),r=parkingApproachRoute(p,'entry-east','west-5');expect(r.distance).toBeGreaterThan(80);
 for(let d=0;d<r.distance;d+=.2)expect(parkingBodyClear(p,pointAt(r,d),DEFAULT_VEHICLE)).toBe(true);
 for(let i=2;i<r.points.length;i++){const [a,b,c]=r.points.slice(i-2,i+1),area=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x));if(area>1e-8)expect(distance(a,b)*distance(b,c)*distance(c,a)/(2*area)).toBeGreaterThan(5.16);}
 const end=pointAt(r,r.distance);expect(end.arrived).toBe(true);expect(end.x).toBeCloseTo(r.destination.x);expect(end.z).toBeCloseTo(r.destination.z);
 const obstacle={id:'closed-entrance',kind:'column',x:p.nodes.find(n=>n.id==='entry-east').x-1,z:p.nodes.find(n=>n.id==='entry-east').z,width:.2,depth:.2,height:3};
 expect(parkingApproachRoute({...p,objects:[...p.objects,obstacle]},'entry-east','west-5')).toBeNull();
});
it('preserves separately reviewed opaque walls, glass, openings and printed scale',()=>{
 const p=source();expect(p.wallEvidence).toMatchObject({solid:62,glazing:10,doorOpenings:'preserved',surveyed:false});expect(p.walls).toHaveLength(72);
 expect(p.width).toBeCloseTo(2000*10/274);expect(p.scaleEvidence.pixelLength).toBe(274);
 expect(p.walls.every(w=>w.z1<(1100-1513/2)*10/274&&w.z2<(1100-1513/2)*10/274)).toBe(true);
 const model=JSON.parse(readFileSync(new URL('../../public/generated/parking-131601-0.json',import.meta.url))).model;expect(model.meshes.filter(m=>m.material==='glazing')).toHaveLength(10);
});
it('allows a car to straddle small graph splits without borrowing a disconnected parallel lane',()=>{
 const nodes=Array.from({length:31},(_,i)=>({id:String(i),x:i-5,z:0})),edges=nodes.slice(1).map((n,i)=>({id:'e'+i,from:String(i),to:n.id,width:3.4,modes:['car']}));
 const p={version:1,width:40,depth:10,walls:[],spaces:[],nodes,edges};expect(route(p,'5','25')).not.toBeNull();
 const bad={...p,edges:edges.map(e=>e.id==='e15'?{...e,width:1.8}:e)};expect(route(bad,'5','25')).toBeNull();
});
