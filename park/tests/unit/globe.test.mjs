import {describe,it,expect} from 'vitest';
import {PLANET_RADIUS,surfacePoint,surfaceDrop,themeCoordinates,fireworkPhase} from '../../lib/globe.mjs';

describe('theme placement on the storybook planet',()=>{
 it('keeps existing and newly discovered themes on the spherical surface',()=>{
  const positions=Array.from({length:30},(_,i)=>surfacePoint(...themeCoordinates(i)));
  for(const point of positions){expect(Math.hypot(...point)).toBeCloseTo(PLANET_RADIUS,8);expect(point.every(Number.isFinite)).toBe(true);}
  expect(new Set(positions.map(p=>p.join(','))).size).toBe(positions.length);
  for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)expect(Math.hypot(...positions[i].map((v,k)=>v-positions[j][k]))).toBeGreaterThan(11.4);
 });
 it('places the poles and equator correctly at a requested radius',()=>{
  expect(surfacePoint(0,0,10)).toEqual([0,0,10]);
  expect(surfacePoint(90,45,10)[1]).toBeCloseTo(10,10);
  expect(surfacePoint(-90,45,10)[1]).toBeCloseTo(-10,10);
 });
 it('drapes wide foundations onto the sphere without floating edges',()=>{
  for(const [x,z]of [[0,0],[5,0],[-4,5],[7,-2]])expect(Math.hypot(x,PLANET_RADIUS+surfaceDrop(x,z),z)).toBeCloseTo(PLANET_RADIUS,9);
  expect(surfaceDrop(6,4)).toBeLessThan(-1);expect(surfaceDrop(99,99)).toBe(-PLANET_RADIUS);
 });
});
describe('endless castle fireworks',()=>{
 it('launches, blooms and fades before the next cycle',()=>{
  expect(fireworkPhase(.5,0)).toMatchObject({stage:'launch',progress:.5,opacity:1});
  expect(fireworkPhase(1,0)).toMatchObject({stage:'burst',progress:0,opacity:1});
  expect(fireworkPhase(3,0).opacity).toBeLessThan(fireworkPhase(2,0).opacity);
  expect(fireworkPhase(4,0)).toMatchObject({stage:'rest',opacity:0});
 });
 it('repeats without accumulating particles and staggers launch times',()=>{
  for(let i=0;i<5;i++)for(const t of [0,1.5,3,6.25]){
   const a=fireworkPhase(t,i),b=fireworkPhase(t+800,i);
   expect(b.stage).toBe(a.stage);expect(b.progress).toBeCloseTo(a.progress,9);expect(b.opacity).toBeCloseTo(a.opacity,9);
  }
  expect(fireworkPhase(1.5,0).stage).toBe('burst');expect(fireworkPhase(1.5,1).stage).toBe('launch');
 });
});
