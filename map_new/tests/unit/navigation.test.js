import {it,expect,describe} from 'vitest';
import {createFixture} from '../../scripts/fixture.mjs';
import {route,evacuation,turn,attachPosition,moveAgent,pointAt,DEFAULT_VEHICLE} from '../../src/core/navigation.js';
import {distance,project,localPosition,geographicPosition} from '../../src/core/geometry.js';
const plan=()=>createFixture();
it('joins exterior road, entrance and the requested EV node in a continuous curved route',()=>{
  const p=plan(),r=route(p,'road-west','ev');expect(r.ids).toEqual(['road-west','road-gate','entrance','south','north','ev']);expect(r.points.length).toBeGreaterThan(r.ids.length);
  expect(r.seconds).toBeCloseTo(r.distance/3.5);expect(r.destination.kind).toBe('ev');expect(r.points[0].x).toBe(-62);expect(r.points.at(-1).x).toBe(-12);
  for(let d=0;d<r.distance;d+=.5){const pose=pointAt(r,d);expect(Number.isFinite(pose.x)).toBe(true);expect(pose.arrived).toBe(false);}
  expect(pointAt(r,r.distance+10).arrived).toBe(true);expect(pointAt(null,0)).toBeNull();expect(pointAt(r,-1).x).toBe(-62);
});
it('accounts for width, height, one-way entrance and car-only restrictions',()=>{
  expect(route(plan(),'road-west','ev',{vehicle:{width:9}})).toBeNull();
  expect(route(plan(),'road-west','ev',{vehicle:{height:3}})).toBeNull();
  expect(route(plan(),'ev','road-west')).toBeNull();expect(route(plan(),'ev','road-west',{mode:'person'})).not.toBeNull();
  expect(route(plan(),'north-west','shelter-west')).toBeNull();expect(route(plan(),'north-west','shelter-west',{mode:'person'}).ids).toContain('exit-west');
});
it('rejects turns a car cannot negotiate instead of rotating in place',()=>{
  const a={x:-20,z:0},b={x:0,z:0},c={x:0,z:20};const t=turn(a,b,c,5);
  expect(t.tangent).toBeCloseTo(5);expect(t.points[0].x).toBeCloseTo(-5);expect(t.points.at(-1).z).toBeCloseTo(5);
  for(let i=1;i<t.points.length;i++)expect(distance(t.points[i-1],t.points[i])).toBeLessThan(.26);
  expect(turn(a,b,c,21)).toBeNull();expect(turn(a,b,a,5)).toBeNull();expect(turn(a,b,{x:20,z:0},5).points).toEqual([]);expect(turn(a,a,b,5)).toBeNull();expect(turn(a,b,{x:0,y:3,z:20},5).points.at(-1).y).toBeCloseTo(.75);
  expect(route(plan(),'road-west','ev',{vehicle:{turnRadius:30}})).toBeNull();
});
it('reroutes around fire and never uses a blocked assembly point',()=>{
  const p=plan(),west=[{x:-24,z:0,radius:6}],r=evacuation(p,'south',{hazards:west});expect(r.destination.id).toBe('shelter-east');
  for(const point of r.points)expect(Math.hypot(point.x+24,point.z)).toBeGreaterThan(6);
  expect(evacuation(p,'south',{hazards:p.nodes.filter(n=>n.safe).map(n=>({...n,radius:6}))})).toBeNull();
  expect(route(p,'south','ev',{hazards:[{x:0,z:12,radius:2}]})).toBeNull();
  expect(route(p,'south','ev',{hazards:[{x:0,y:10,z:0,radius:10}]})).not.toBeNull();
  expect(route(p,'south','ev',{blocked:['e11']})).not.toBeNull();
});
it('excludes elevators during fire but preserves ordinary pedestrian access',()=>{
  const p=plan();p.edges.find(e=>e.to==='exit-east').kind='elevator';
  expect(route(p,'east','shelter-east',{mode:'person'})).not.toBeNull();
  expect(route(p,'east','shelter-east',{mode:'person',hazards:[{x:100,z:100,radius:1}]})).toBeNull();
});
it('starts evacuation at the actual moving position and preserves the one-way segment',()=>{
  const p=plan(),at=attachPosition(p,{x:0,z:30},{mode:'person'});expect(at.plan.nodes.at(-1).z).toBe(30);expect(evacuation(at.plan,at.startId)).not.toBeNull();
  expect(attachPosition(p,{x:1000,z:1000})).toBeNull();expect(attachPosition(p,{x:-62,z:42}).startId).toBe('road-west');expect(attachPosition(p,{x:40,z:42}).startId).toBe('road-east');
  const car=attachPosition(p,{x:0,z:30});expect(route(car.plan,car.startId,'road-west')).toBeNull();
  expect(()=>attachPosition(at.plan,{x:0,z:32})).toThrow();
});
it('car steering depends on distance, enforces lane bounds and stops at hazards',()=>{
  const p=plan(),pose={x:-30,y:0,z:42,heading:Math.PI/2};
  expect(moveAgent(p,pose,{forward:0,turn:1},.1)).toEqual(pose);
  const next=moveAgent(p,pose,{forward:1,turn:1},.1);expect(next.heading-pose.heading).toBeCloseTo(.35/5.2);expect(next.x).toBeGreaterThan(pose.x);
  expect(moveAgent(p,pose,{forward:1,turn:0},.1,{hazards:[{x:-30,z:42,radius:2}]})).toEqual(pose);
  expect(moveAgent(p,{...pose,z:46},{forward:1,turn:1},.1).z).toBe(46);
  expect(moveAgent(p,pose,{forward:0,turn:1},.1,{mode:'person'}).heading).toBeCloseTo(pose.heading+.2);
  for(const delta of [-1,NaN])expect(()=>moveAgent(p,pose,{forward:1,turn:0},delta)).toThrow();
});
it('does not route through a wall even if a graph edge claims a connection',()=>{
  const p=plan();p.walls=[{x1:-40,z1:30,x2:-40,z2:50,height:3,thickness:1}];expect(route(p,'road-west','ev')).toBeNull();
});
it('validates options and supports unreachable, missing and already-arrived endpoints',()=>{
  expect(route(plan(),'missing','ev')).toBeNull();expect(route(plan(),'ev','ev').distance).toBe(0);
  for(const options of [{mode:'truck'},{vehicle:{turnRadius:0}},{hazards:[{x:0,z:0,radius:-1}]}])expect(()=>route(plan(),'south','ev',options)).toThrow();
});
it('projects metric geometry and round-trips georeferenced entrances',()=>{
  const anchor={lat:37.6,lng:127.1},target={lat:37.6001,lng:127.1002,altitude:3};expect(geographicPosition(localPosition(target,anchor),anchor)).toEqual(target);
  expect(project({x:4,z:5},{x:0,z:0},{x:10,z:0})).toMatchObject({x:4,z:0,t:.4,distance:5});expect(project({x:3,z:0},{x:0,z:0},{x:0,z:0}).distance).toBe(3);
  expect(()=>localPosition(target,{lat:90,lng:0})).toThrow();
});
