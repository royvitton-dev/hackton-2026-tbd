import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {multilevelPlan} from '../../scripts/ramps.mjs';
import {route,turn,pointAt,moveAgent,attachPosition,DEFAULT_VEHICLE} from '../../src/core/navigation.js';
import {parkingManeuverRoute} from '../../src/core/maneuver.js';
import {parkingBodyClear} from '../../src/core/collision.js';
import {doorLeaf} from '../../src/core/structures.js';
import {analyzeSvg,validatePlan,compileMeshes} from '../../src/core/analysis.js';
it('follows the source B2 ramp in both directions with real 3D distance and a disclosed assumed height',()=>{
 const p=JSON.parse(readFileSync(new URL('../../public/generated/changdong-b2.json',import.meta.url))).plan;
 expect(p.rampEvidence.heightAssumedM).toBe(3.3);expect(p.rampEvidence.connectedFloors).toEqual(['B2','upper-link']);
 for(const [from,to] of [['ramp-start','entrance'],['entrance','ramp-start']]){const r=route(p,from,to);expect(r).not.toBeNull();let max=0;
  for(let d=0;d<r.distance;d+=.05){const pose=pointAt(r,d);expect(parkingBodyClear(p,pose,DEFAULT_VEHICLE)).toBe(true);max=Math.max(max,Math.abs(Math.tan(pose.pitch)));}
  expect(max).toBeGreaterThan(.16);expect(max).toBeLessThan(.2);expect(pointAt(r,r.distance).y).toBeCloseTo(p.nodes.find(n=>n.id===to).y);
 }
 expect(route(p,'ramp-start','entrance',{vehicle:{maxGrade:.1}})).toBeNull();expect(route(p,'ramp-start','entrance',{vehicle:{height:2.6}})).toBeNull();
});
it('drives between levels and parks on the correct elevated deck without flattening the approach',()=>{
 const p=multilevelPlan(),r=parkingManeuverRoute(p,'entry','upper-bay',{parkingMode:'reverse'});expect(r).not.toBeNull();expect(r.points.some(n=>n.y>0&&n.y<3.3)).toBe(true);expect(pointAt(r,r.distance).y).toBe(3.3);
 const forward=parkingManeuverRoute(p,'entry','upper-bay',{parkingMode:'forward'});expect(forward).not.toBeNull();
 for(const x of [-30,-20,0,10]){const points=forward.points;const a=points.findIndex((n,i)=>i+1<points.length&&n.x<=x&&points[i+1].x>=x);expect(a).toBeGreaterThanOrEqual(0);const t=(x-points[a].x)/(points[a+1].x-points[a].x),y=points[a].y+(points[a+1].y-points[a].y)*t;expect(y).toBeCloseTo(x<=-20?0:(x+20)*.11);}
 expect(compileMeshes(p).floors).toEqual(p.floors);expect(route(p,'entry','upper-bay')).toBeNull();
});
it('follows ramp height in manual drive, reconnects at that height, and keeps unrelated decks separate',()=>{
 const p=multilevelPlan(),pose={x:0,y:2.2,z:0,heading:Math.PI/2},next=moveAgent(p,pose,{forward:1,turn:0},.1);
 expect(next.y).toBeCloseTo(2.2+.35*.11);expect(next.pitch).toBeCloseTo(Math.atan(.11));const attached=attachPosition(p,next);expect(attached.plan.nodes.at(-1).y).toBe(next.y);expect(route(attached.plan,attached.startId,'bay-access')).not.toBeNull();
 const lower={id:'isolated-low',x:28,y:0,z:10,kind:'entrance'};p.nodes.push(lower,{...lower,id:'isolated-end',z:20});p.edges.push({id:'isolated',from:lower.id,to:'isolated-end',width:8,modes:['car'],kind:'lane'});expect(route(p,lower.id,'bay-access')).toBeNull();
 expect(route(p,'stair-low','stair-high')).toBeNull();expect(route(p,'stair-low','stair-high',{mode:'person'})).not.toBeNull();
});
it('creates continuous graded turns and rejects vertical or excessive-grade vehicle edges',()=>{
 const t=turn({x:-20,y:0,z:0},{x:0,y:2,z:0},{x:0,y:4,z:20},5);expect(t.points[0].y).toBeCloseTo(1.5);expect(t.points.at(-1).y).toBeCloseTo(2.5);expect(t.points.every(p=>Number.isFinite(p.pitch))).toBe(true);
 const p=multilevelPlan();p.nodes.find(n=>n.id==='top').y=30;expect(route(p,'entry','bay-access')).toBeNull();
 const q=multilevelPlan(),a=q.nodes.find(n=>n.id==='stair-low'),b=q.nodes.find(n=>n.id==='stair-high');b.x=a.x;b.z=a.z;expect(route(q,a.id,b.id)).toBeNull();expect(route(q,a.id,b.id,{mode:'person'})).not.toBeNull();
});
it('uses the same hinged door leaf for display geometry and collision, including closed and rotated doors',()=>{
 const door={id:'door',kind:'door',x:0,z:0,width:3,depth:.06,height:2.2,openAngle:Math.PI/2},car={...DEFAULT_VEHICLE,width:.6,length:.6,clearance:.1},p={walls:[],objects:[door]},pose={x:0,z:0,heading:0};
 expect(doorLeaf(door)).toMatchObject({x:-1.5,z:-1.5,angle:Math.PI/2});expect(parkingBodyClear(p,pose,car)).toBe(true);expect(parkingBodyClear({...p,objects:[{...door,openAngle:0}]},pose,car)).toBe(false);
 const rotated=doorLeaf({...door,angle:Math.PI/2});expect(rotated.x).toBeCloseTo(-1.5);expect(rotated.z).toBeCloseTo(1.5);
 expect(parkingBodyClear(p,{x:-1.5,z:-1.5,heading:0},car)).toBe(false);
});
it('preserves explicit SVG elevations and rejects malformed floor, wall and object data',()=>{
 const svg='<svg viewBox="0 0 40 40" data-meters-per-unit="1"><circle id="a" data-kind="node" cx="10" cy="10" data-y="0"/><circle id="b" data-kind="node" cx="30" cy="10" data-y="3" data-floor="B1"/><line id="r" data-kind="edge" data-from="a" data-to="b" data-width="8" data-connection="ramp"/><rect id="bay" data-kind="space" x="26" y="15" width="3" height="5" data-y="3" data-floor="B1"/><line data-kind="wall" x1="10" y1="35" x2="30" y2="35" data-y="3"/></svg>';
 const p=analyzeSvg(svg);expect(p.nodes[1].y).toBe(3);expect(p.spaces[0].y).toBe(3);expect(Math.min(...compileMeshes(p).meshes[0].positions.filter((_,i)=>i%3===1))).toBe(3);
 for(const floors of [{},[{}],[{id:'x',x:0,y:0,z:0,width:0,depth:1}]])expect(()=>validatePlan({...p,floors})).toThrow();
 expect(()=>validatePlan({...p,walls:[{...p.walls[0],y:NaN}]})).toThrow();expect(()=>validatePlan({...multilevelPlan(),objects:[{...multilevelPlan().objects[2],openAngle:NaN}]})).toThrow();
});
