import {it,expect} from 'vitest';
import {driverView,drivingInput,turnSignal} from '../../src/core/driving.js';
import {moveAgent,route} from '../../src/core/navigation.js';
import {pointAt} from '../../src/core/geometry.js';
import {straightGraph} from '../../src/core/route-graph.js';

it('locks the driver view to the nose on every heading, incline and reverse gear',()=>{
 for(const heading of [0,Math.PI/2,-Math.PI/2,Math.PI,6.2])for(const pitch of [0,.18,-.18])for(const gear of [1,-1]){
  const p={x:4,y:3.3,z:7,heading,pitch,gear},v=driverView(p);
  expect(Math.hypot(v.forward.x,v.forward.y,v.forward.z)).toBeCloseTo(1);
  expect(v.forward).toEqual({x:Math.sin(heading)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(heading)*Math.cos(pitch)});
  expect(v.target.x-v.position.x).toBeCloseTo(v.forward.x*10);expect(v.target.y-v.position.y).toBeCloseTo(v.forward.y*10);expect(v.target.z-v.position.z).toBeCloseTo(v.forward.z*10);
 }
 expect(driverView({x:0,z:0}).forward).toEqual({x:0,y:0,z:1});
});
it('steers to the driver left and right relative to the nose, including reverse steering',()=>{
 const p={version:1,width:100,depth:100,walls:[],spaces:[],nodes:[{id:'a',x:0,z:-40},{id:'b',x:0,z:40}],edges:[{id:'ab',from:'a',to:'b',width:40,modes:['car']}]};
 for(const [key,turn] of [['a',1],['arrowleft',1],['d',-1],['arrowright',-1]])for(const [gearKey,forward] of [['w',1],['s',-1]]){
  const input=drivingInput(new Set([key,gearKey])),pose={x:0,y:0,z:0,heading:0};expect(input).toEqual({forward,turn});
  const next=moveAgent(p,pose,input,.1);expect(Math.sign(next.z)).toBe(forward);expect(Math.sign(next.heading)).toBe(turn*forward);
  expect(turnSignal(null,0,input)).toBe(turn>0?'left':'right');
 }
 expect(drivingInput(new Set(['a','d','arrowup','arrowdown']))).toEqual({forward:0,turn:0});expect(turnSignal(null,0,{turn:0})).toBeNull();
});
it('signals automatic curves on both sides, respects reverse gear and cancels on straight, arrival and gear changes',()=>{
 const plan={version:1,width:100,depth:100,walls:[],spaces:[],nodes:[{id:'a',x:0,z:-20},{id:'b',x:0,z:0},{id:'c',x:20,z:0}],edges:[{id:'a',from:'a',to:'b',width:12,modes:['car']},{id:'b',from:'b',to:'c',width:12,modes:['car']}]};
 const r=route(plan,'a','c');expect(turnSignal(r,2)).toBeNull();expect(turnSignal(r,18)).toBe('left');expect(turnSignal(r,r.distance)).toBeNull();expect(turnSignal(null,0)).toBeNull();
 const mirror={...r,points:r.points.map(p=>({...p,x:-p.x}))};expect(turnSignal(mirror,18)).toBe('right');
 const backing={...r,points:r.points.map((p,i)=>({...p,heading:pointAt(r,r.points.slice(1,i+1).reduce((sum,b,j)=>sum+Math.hypot(b.x-r.points[j].x,b.z-r.points[j].z),0)).heading+Math.PI,gear:-1}))};
 expect(turnSignal(backing,18)).toBe('right');
 const shifting={distance:3,points:[{x:0,z:0,heading:0,gear:1},{x:0,z:1,heading:0,gear:-1},{x:0,z:-1,heading:0,gear:-1}]};expect(turnSignal(shifting,.5)).toBeNull();
});
it('merges only collinear compatible segments and preserves source identities, arrows and blocked edges',()=>{
 const plan={nodes:[{id:'a',x:0,z:0},{id:'b',x:0,z:2},{id:'c',x:0,z:4},{id:'d',x:2,z:4}],edges:[{id:'ab',from:'a',to:'b',width:6,modes:['car']},{id:'bc',from:'b',to:'c',width:6,modes:['car']},{id:'cd',from:'c',to:'d',width:6,modes:['car']}]};
 expect(straightGraph(plan,'a','d','car').edges[1]).toMatchObject({chain:['a','b','c'],segments:['ab','bc']});
 expect(straightGraph(plan,'a','b','car').edges).toHaveLength(3);expect(straightGraph(plan,'a','d','car',['bc']).edges).toHaveLength(2);
 const changed=structuredClone(plan);changed.edges[1].width=5;expect(straightGraph(changed,'a','d','car').edges).toHaveLength(3);
 changed.edges[1].width=6;changed.edges[1].oneWay=true;expect(straightGraph(changed,'a','d','car').edges).toHaveLength(3);
 changed.edges[0].oneWay=true;expect(straightGraph(changed,'a','d','car').edges).toHaveLength(2);
});
