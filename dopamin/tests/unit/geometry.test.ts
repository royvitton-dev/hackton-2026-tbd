import { it, expect } from 'vitest';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bakeStatic } from '../../src/graphics/scenery';

it('preserves both indexed and non-indexed kart geometry when batching one material',()=>{
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:'#ff663a'});
  const chassis=new THREE.Mesh(new RoundedBoxGeometry(2,.5,3,3,.1),material),spoiler=new THREE.Mesh(new THREE.BoxGeometry(2,.2,.4),material);spoiler.position.set(0,1,-2);group.add(chassis,spoiler);
  const before=new THREE.Box3().setFromObject(group);bakeStatic(group);const after=new THREE.Box3().setFromObject(group);
  expect(group.children).toHaveLength(2);for(let i=0;i<3;i++){expect(after.min.getComponent(i)).toBeCloseTo(before.min.getComponent(i),5);expect(after.max.getComponent(i)).toBeCloseTo(before.max.getComponent(i),5);}
});
it('batches compatible meshes without applying a moving parent transform twice',()=>{
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial();group.position.set(12,3,-5);group.rotation.y=.4;
  for(let i=0;i<3;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);mesh.position.x=i*2;group.add(mesh);}
  const before=new THREE.Box3().setFromObject(group);bakeStatic(group);const after=new THREE.Box3().setFromObject(group);
  expect(group.children).toHaveLength(1);for(let i=0;i<3;i++){expect(after.min.getComponent(i)).toBeCloseTo(before.min.getComponent(i),5);expect(after.max.getComponent(i)).toBeCloseTo(before.max.getComponent(i),5);}
});

import { TRACKS } from '../../src/core/catalog';
import { trackCurve } from '../../src/graphics/world';
import { sponsorLots, VENUE_CLEARANCE } from '../../src/graphics/sponsorVenues';

for(const track of TRACKS)it(`keeps all eight ${track.id} sponsor buildings clear of the road and each other`,()=>{
  const curve=trackCurve(track),road=curve.getSpacedPoints(2200),lots=sponsorLots(curve);
  expect(lots).toHaveLength(8);expect(new Set(lots.map(lot=>lot.sponsor.name)).size).toBe(8);
  lots.forEach((lot,index)=>{
    expect(lot.position.y).toBe(-.25);expect(Number.isFinite(lot.rotation)).toBe(true);
    expect(Math.min(...road.map(point=>Math.hypot(point.x-lot.position.x,point.z-lot.position.z)))).toBeGreaterThan(VENUE_CLEARANCE-.1);
    for(const other of lots.slice(index+1))expect(lot.position.distanceTo(other.position)).toBeGreaterThan(23.99);
    const front=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),lot.rotation);
    expect(front.dot(curve.getPointAt(.035+index*.12).sub(lot.position).setY(0).normalize())).toBeCloseTo(1,5);
  });
});
