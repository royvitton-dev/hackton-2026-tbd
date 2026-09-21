import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {filterMobilitySources,parkingEnvelope,vehicleRoute} from '../../src/core/mobility.js';
import {analyzeSvg} from '../../src/core/analysis.js';

const catalog=JSON.parse(readFileSync(new URL('../../public/mobility/catalog.json',import.meta.url),'utf8'));
const plan=analyzeSvg(readFileSync(new URL('../../public/plans/changdong-parking-annotated.svg',import.meta.url),'utf8'));
describe('source-backed mobility category',()=>{
 it('filters by category, field, provider and normalized search',()=>{
  expect(filterMobilitySources(catalog.sources)).toHaveLength(9);
  expect(filterMobilitySources(catalog.sources,{category:'vehicles'}).map(s=>s.id)).toEqual(['ioniq5','ev6']);
  expect(filterMobilitySources(catalog.sources,{query:' ＣＡＬＴＥＣＨ '})).toHaveLength(2);
  expect(filterMobilitySources(catalog.sources,{query:'충전량'}).map(s=>s.id)).toEqual(['acn-data']);
  expect(filterMobilitySources(catalog.sources,{category:'plans',query:'없는자료'})).toEqual([]);
 });
 it('keeps public metadata provenance and never pretends an API is connected',()=>{
  expect(new Set(catalog.sources.map(s=>s.id)).size).toBe(9);
  for(const source of catalog.sources){expect(new URL(source.url).protocol).toBe('https:');expect(source.verifiedAt).toBe('2026-09-21');expect(source.limits.length).toBeGreaterThan(20);expect(source.license).toBeTruthy();}
  expect(catalog.sources.find(s=>s.id==='palo-alto').sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(catalog.sources.find(s=>s.id==='palo-alto').facts.chargerStalls).toBe(41);
  expect(catalog.sources.find(s=>s.id==='keco').access).toBe('키 필요');
  expect(catalog.vehicles.find(v=>v.id==='ev6').turningDiameter).toBeNull();
 });
 it('compares measured specification dimensions without certifying manoeuvres',()=>{
  const fit=parkingEnvelope(catalog.vehicles[0],{width:2.7432,length:5.4864});
  expect(fit.side).toBeCloseTo(.4266,6);expect(fit.length).toBeCloseTo(.8514,6);expect(fit.footprintFits).toBe(true);
  expect(parkingEnvelope({width:3,length:6},{width:2,length:5}).footprintFits).toBe(false);
  expect(parkingEnvelope({width:1,length:6},{width:2,length:5}).footprintFits).toBe(false);
 });
 it.each([0,-1,NaN,Infinity,undefined])('rejects invalid dimensions (%s)',width=>{
  expect(()=>parkingEnvelope({width,length:4},{width:2.5,length:5})).toThrow(/치수/);
 });
 it('uses actual vehicle width and side clearance on the source-traced B2 graph',()=>{
  const a=vehicleRoute(plan,'entrance','C',catalog.vehicles[0]);expect(a.path.distance).toBeGreaterThan(20);expect(a.minimumWidth).toBeCloseTo(2.59);expect(a.turningVerified).toBe(false);
  const b=vehicleRoute(plan,'entrance','C',catalog.vehicles[1],0);expect(b.minimumWidth).toBe(2.5);expect(b.path).toBeTruthy();
  const wide=vehicleRoute(plan,'entrance','C',catalog.vehicles[0],2);expect(wide.path).toBeNull();expect(wide.blocked.length).toBe(plan.edges.length);
  expect(vehicleRoute(plan,'entrance','unknown',catalog.vehicles[0]).path).toBeNull();
 });
 it.each([[0,.3],[-1,.3],[NaN,.3],[1.89,-1],[1.89,NaN]])('rejects invalid route dimensions', (width,clearance)=>{
  expect(()=>vehicleRoute(plan,'entrance','C',{width},clearance)).toThrow(/차폭/);
 });
});
