import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeSvg } from '../../src/core/analysis.js';
import { route,evacuation,edgeCost,attachPosition,sampleRoute,canMove,project } from '../../src/core/routing.js';
const plan=analyzeSvg(readFileSync(new URL('../../public/plans/parking-lab.svg',import.meta.url),'utf8'));
describe('parking and emergency navigation',()=>{
 it.each(['A','B','C','D'])('navigates from the vehicle entrance to building %s',id=>{
  const r=route(plan,'entrance',id);expect(r.ids[0]).toBe('entrance');expect(r.ids.at(-1)).toBe(id);expect(r.distance).toBeGreaterThan(0);expect(r.points.every(p=>canMove(plan,p))).toBe(true);
 });
 it('calculates a known shortest path and excludes pedestrian-only exits for cars',()=>{
  expect(route(plan,'entrance','C').distance).toBe(46);expect(route(plan,'entrance','exit-west')).toBeNull();expect(route(plan,'missing','A')).toBeNull();
 });
 it('routes pedestrians to a safe exterior exit with hazard avoidance',()=>{
  const h=[{x:-22,z:0,radius:5}];const r=evacuation(plan,'n12',{hazards:h});expect(r.destination.id).toBe('exit-east');expect(r.points.every(p=>canMove(plan,p,{mode:'person',hazards:h}))).toBe(true);
 });
 it('detects fire between endpoints, blocks named edges and checks clearances',()=>{
  const a={x:-10,z:0},b={x:10,z:0},edge={id:'e',modes:['car','person'],width:6};
  expect(edgeCost(a,b,edge,{hazards:[{x:0,z:0,radius:1}]})).toBe(Infinity);
  expect(edgeCost(a,b,edge,{blocked:['e']})).toBe(Infinity);
  expect(edgeCost(a,b,{...edge,width:2})).toBe(Infinity);
  expect(edgeCost(a,b,edge,{hazards:[{x:0,z:4,radius:1}]})).toBeGreaterThan(20);
  expect(edgeCost(a,b,edge,{hazards:[{x:0,z:20,radius:1}]})).toBe(20);
 });
 it('reports no safe route when all exits are blocked',()=>{
  expect(evacuation(plan,'entrance',{hazards:[{x:-40,z:0,radius:4},{x:40,z:0,radius:4}]})).toBeNull();
 });
 it('preserves the actual moving position when rerouting',()=>{
  const p={x:7,z:18};const attached=attachPosition(plan,p);const r=evacuation(attached,'@position');expect(r.points[0]).toMatchObject(p);expect(r.distance).toBeGreaterThan(0);expect(attachPosition(plan,{x:999,z:999})).toBeNull();expect(attachPosition({...plan,edges:[]},p)).toBeNull();
 });
 it('honors vehicle direction and allows emergency pedestrian reverse movement',()=>{
  const simple={nodes:[{id:'a',x:0,z:0},{id:'b',x:10,z:0}],edges:[{id:'ab',from:'a',to:'b',width:6,modes:['car','person'],oneWay:true}]};
  expect(route(simple,'b','a')).toBeNull();expect(route(simple,'b','a',{mode:'person'}).distance).toBe(10);expect(attachPosition(simple,{x:4,z:0},'car').edges[0].oneWay).toBe(true);
 });
 it('samples motion by distance without overshooting endpoints',()=>{
  const r=route(plan,'entrance','A');expect(sampleRoute(r,0)).toMatchObject({x:0,z:27,arrived:false});expect(sampleRoute(r,3).z).toBe(24);expect(sampleRoute(r,999)).toMatchObject({x:-30,z:-25,arrived:true});expect(sampleRoute(null,0)).toBeNull();expect(sampleRoute(route(plan,'A','A'),0).arrived).toBe(true);
 });
 it('keeps manual motion on lanes with mode-appropriate clearance',()=>{
  expect(canMove(plan,{x:0,z:18})).toBe(true);expect(canMove(plan,{x:7,z:9})).toBe(false);expect(canMove(plan,{x:-39,z:0})).toBe(false);expect(canMove(plan,{x:-39,z:0},{mode:'person'})).toBe(true);expect(canMove(plan,{x:0,z:18},{hazards:[{x:0,z:18,radius:2}]})).toBe(false);expect(project({x:1,z:2},{x:0,z:0},{x:0,z:0}).distance).toBe(Math.sqrt(5));
 });
});
