import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {distanceMeters,dms,normalizeStation,freeSpaceLoss,prediction,wallCrossings,radioGeometry,signalForCandidate} from '../../src/core/radio.js';
import {optimizeCharging,signalScore,scoreColor,chargerPoint} from '../../src/core/charging.js';
import {validatePlan,compileMeshes,analyzeSvg} from '../../src/core/analysis.js';
import {createFixture} from '../../scripts/fixture.mjs';
const read=file=>JSON.parse(readFileSync(new URL('../../public/'+file,import.meta.url)));
const station={id:'cell-1',name:'공개 제원 테스트',lat:37.6009,lng:127.1,operator:'SKT',radio:'LTE',frequencyMHz:1800,powerW:30,gainDbi:14,heightM:15,outdoor:true};
const site={location:{lat:37.6,lng:127.1,precision:'publisher-naver-point'}};
describe('public radio data and explicitly modelled reception',()=>{
 it('parses DMS without substituting missing coordinates or properties',()=>{
  expect(dms(`127° 06' 35.05"`)).toBeCloseTo(127.1097361);expect(dms('-33')).toBe(-33);expect(dms(-33)).toBe(-33);expect(dms(`-33° 30' 00"`)).toBe(-33.5);
  expect(dms(`0° 30' 00"`)).toBe(.5);expect(dms(`-0° 30' 00"`)).toBe(-.5);
  for(const value of [null,undefined,'','bad',NaN,`37° 60' 00"`,`37° 30' 70"`])expect(dms(value)).toBeNull();
  const raw={uid:'real',lat:`37° 30' 00"`,lon:`127° 00' 00"`,frq_hz:'1800000000',arw_pwr_wtt:'30',arw_gan_nmv:14,arw_gnd_altd_het:15,service_name:'LTE 지상'};
  expect(normalizeStation(raw,{operator:'KT'})).toMatchObject({operator:'KT',frequencyMHz:1800,powerW:30,gainDbi:14,heightM:15,measurement:null,outdoor:true});
  expect(normalizeStation({...raw,lat:100})).toBeNull();expect(normalizeStation({...raw,uid:''})).toBeNull();expect(normalizeStation({...raw,lon:'bad'})).toBeNull();
  expect(normalizeStation({...raw,frq_hz:'1,2',arw_pwr_wtt:'',arw_gan_nmv:null,arw_gnd_altd_het:-1,service_name:'5G 옥내'})).toMatchObject({frequencyMHz:null,powerW:null,gainDbi:null,heightM:null,outdoor:false,radio:'5G'});
  expect(normalizeStation({...raw,service_name:'3G',frq_hz:1,arw_gan_nmv:100,arw_pwr_wtt:-2})).toMatchObject({radio:'other',gainDbi:null,powerW:null,frequencyMHz:null});
 });
 it('matches the free-space formula and handles coincident/antipodal locations',()=>{
  expect(freeSpaceLoss(1800,1000)).toBeCloseTo(97.555,2);expect(distanceMeters(site.location,site.location)).toBe(0);expect(distanceMeters({lat:0,lng:0},{lat:0,lng:180})).toBeCloseTo(20015086.8,0);
  expect(()=>distanceMeters({lat:91,lng:0},site.location)).toThrow();expect(()=>distanceMeters(site.location,{lat:0,lng:181})).toThrow();expect(()=>distanceMeters(null,site.location)).toThrow();expect(()=>freeSpaceLoss(-1,1)).toThrow();expect(()=>freeSpaceLoss(1800,0)).toThrow();
 });
 it('weakens with distance, frequency, walls and basement floors and exposes assumptions',()=>{
  const a=prediction(station,100),b=prediction(station,200),walls=prediction(station,100,{walls:2,basements:1});expect(b.dbm).toBeLessThan(a.dbm);expect(walls.dbm).toBeLessThan(a.dbm-29);expect(prediction({...station,frequencyMHz:3500},100).dbm).toBeLessThan(a.dbm);
  expect(a.highDbm-a.lowDbm).toBe(24);expect(a.metric).toBe('received-power-not-RSRP');expect(Number.isFinite(prediction(station,0).dbm)).toBe(true);
  expect(prediction({...station,powerW:null},100)).toBeNull();expect(prediction({...station,outdoor:false},100)).toBeNull();expect(prediction({...station,powerW:0},100)).toBeNull();
  for(const o of [{walls:-1},{basements:.5},{wallLossDb:-1},{floorLossDb:-1},{clutterLossDb:-1},{uncertaintyDb:-1},{minDistanceM:0},{pathLossExponent:7},{receiverHeightM:NaN}])expect(()=>prediction(station,100,o)).toThrow();expect(()=>prediction(station,-1)).toThrow();
 });
 it('counts only intersected walls and honors the original drawing georeference',()=>{
  expect(wallCrossings({x:0,z:0},{x:10,z:0},{walls:[{x1:5,z1:-2,x2:5,z2:2},{x1:5,z1:3,x2:5,z2:4},{x1:0,z1:1,x2:10,z2:1}]})).toBe(1);
  const {plan}=read('generated/10000901-0.json'),geo=radioGeometry(plan,site),p={x:3,z:-2},coordinate=geo.coordinate(p);expect(geo.station(coordinate).x).toBeCloseTo(p.x,6);expect(geo.station(coordinate).z).toBeCloseTo(p.z,6);
  expect(radioGeometry({},{})).toBeNull();expect(radioGeometry({},site).coordinate({x:0,z:0})).toMatchObject(site.location.lat?{lat:37.6,lng:127.1}:{});expect(radioGeometry({},site).station(station).z).toBeLessThan(0);
 });
 it('filters carriers and radio types and never scores neighborhood centroids as exact buildings',()=>{
  const plan={walls:[]},point={x:0,z:0},other={...station,id:'cell-2',operator:'KT',radio:'5G',frequencyMHz:3500};
  expect(signalForCandidate(point,plan,site,[station,other],{operator:'KT',radio:'5G'}).best.stationId).toBe('cell-2');
  expect(signalForCandidate(point,plan,site,[station,other],{radio:'all'}).alternatives).toHaveLength(2);
  expect(signalForCandidate(point,plan,site,[{...station,lat:38}]).status).toBe('no-station-data');
  expect(signalForCandidate(point,plan,{location:{...site.location,precision:'address-area'}},[station]).status).toBe('location-needed');
  expect(signalForCandidate(point,plan,{},[station]).best).toBeNull();
 });
});
describe('charging screening and protected parking spaces',()=>{
 it('uses green, red, amber and unknown with stable score thresholds',()=>{
  expect(signalScore(-105)).toBe(0);expect(signalScore(-65)).toBe(100);expect(signalScore(-85)).toBe(50);expect(signalScore(null)).toBeNull();expect(signalScore(-140)).toBe(0);
  expect(scoreColor(80)).toBe('#16845b');expect(scoreColor(20)).toBe('#d04444');expect(scoreColor(50)).toBe('#c18b25');expect(scoreColor(null)).toBe('#929d97');
  expect(chargerPoint({x:1,z:2,width:6,depth:3})).toEqual({x:3.78,y:0,z:2});expect(chargerPoint({x:1,z:2,width:3,depth:6,y:1}).z).toBeCloseTo(4.78);
 });
 it('preserves wheelchair, reserved, existing EV, blocked and hazardous areas',()=>{
  const plan=createFixture();plan.spaces[1].accessible=true;plan.spaces[2].reserved=true;plan.spaces[3].blocked=true;const point=chargerPoint(plan.spaces[4]);
  const result=optimizeCharging(plan,site,[station],{count:10,hazards:[{...point,radius:1}]});
  for(const id of ['p0','p1','p2','p3','p4']){expect(result.ranked.find(c=>c.id===id).excluded).toBe(true);expect(result.selected.some(c=>c.id===id)).toBe(false);}
  expect(result.selected.length).toBeGreaterThan(0);expect(result.electricalCapacityVerified).toBe(false);expect(result.ranked.every(c=>c.powerStatus==='not-verified')).toBe(true);
  const separated=optimizeCharging(plan,site,[station],{count:10,minimumSeparation:100});expect(separated.selected).toHaveLength(1);
  const weak=optimizeCharging(plan,site,[station],{basements:8});expect(weak.ranked.some(c=>c.score!==null&&c.score<40)).toBe(true);expect(weak.selected).toHaveLength(0);
 });
 it('keeps missing signal unknown and discloses missing lane geometry',()=>{
  const plan=createFixture();expect(optimizeCharging(plan,site,[]).selected).toHaveLength(0);expect(optimizeCharging(plan,{},[station]).ranked[0].score).toBeNull();
  const noLanes=optimizeCharging({...plan,edges:[],spaces:[{id:'tiny',kind:'parking',x:0,z:0,width:2,depth:3}]},site,[station]);expect(noLanes.ranked[0].spaceScore).toBe(30);expect(noLanes.ranked[0].accessScore).toBeNull();expect(noLanes.ranked[0].reasons).toContain('차로 접근성 미확인');expect(noLanes.ranked[0].excluded).toBe(true);expect(noLanes.selected).toEqual([]);
  for(const o of [{count:0},{count:21},{count:1.5},{minimumSeparation:-1}])expect(()=>optimizeCharging(plan,site,[],o)).toThrow();
 });
 it('round-trips accessibility and source objects and rejects malformed annotations',()=>{
  const svg='<svg viewBox="0 0 30 30" data-meters-per-unit="1"><rect id="a" data-kind="space" data-role="parking" data-accessible="true" data-reserved="false" x="2" y="2" width="3" height="5"/></svg>';
  expect(analyzeSvg(svg).spaces[0]).toMatchObject({accessible:true,reserved:false});expect(()=>analyzeSvg(svg.replace('data-accessible="true"','data-accessible="yes"'))).toThrow();
  const plan=createFixture();plan.spaces[0].accessible='true';expect(()=>validatePlan(plan)).toThrow();delete plan.spaces[0].accessible;
  plan.objects=[{id:'c',kind:'column',x:0,z:0,width:.5,depth:.5,height:3}];expect(compileMeshes(plan).objects[0].id).toBe('c');
  for(const objects of [{},[{...plan.objects[0],width:0}],[{...plan.objects[0],kind:'unknown'}],[plan.objects[0],plan.objects[0]],[{...plan.objects[0],kind:'stairs',steps:0}],[{...plan.objects[0],kind:'ramp',path:[]}]])expect(()=>validatePlan({...plan,objects})).toThrow();
 });
});
describe('archived library evidence',()=>{
 it('contains at least 30 distinct sourced real facilities, including parks and public parking',()=>{
  const catalog=read('generated/catalog.json'),places=[...new Map(catalog.filter(s=>!s.synthetic).map(s=>[s.siteId,s])).values()];expect(places.length).toBeGreaterThanOrEqual(30);expect(new Set(places.map(s=>s.buildingType)).size).toBeGreaterThanOrEqual(8);expect(places.some(s=>s.buildingType==='park')).toBe(true);expect(places.some(s=>s.buildingType==='parking')).toBe(true);
  for(const s of catalog.filter(s=>!s.synthetic)){const b=readFileSync(new URL('../../public/'+s.sourceAsset.file,import.meta.url));expect(createHash('sha256').update(b).digest('hex')).toBe(s.sourceAsset.sha256);expect(s.source).toMatch(/^https:/);}
 });
 it('retains source-backed wheelchair symbols, objects and original OCR rather than inferred live occupancy',()=>{
  const {plan}=read('generated/changdong-b2.json');expect(plan.spaces.filter(s=>s.accessible)).toHaveLength(4);expect(plan.objects.filter(o=>o.kind==='column').length).toBeGreaterThan(40);expect(plan.objects.filter(o=>o.kind==='stairs')).toHaveLength(3);expect(plan.labels.some(t=>t.text.includes('전기실'))).toBe(true);expect(plan.semanticCoverage.modeledParking).toBeLessThanOrEqual(plan.semanticCoverage.drawingDeclaredParking);
  const {plan:d}=read('generated/parking-168780-0.json');expect(d.spaces.filter(s=>s.accessible).length).toBeGreaterThan(5);expect(d.spaces.filter(s=>s.accessible).every(s=>s.accessibilityEvidence.method==='wheelchair-symbol-visual-review')).toBe(true);
 });
 it('archives actual KCA station properties and never fabricates measurements',()=>{
  const files=readdirSync(new URL('../../public/sources/radio/',import.meta.url));expect(files.length).toBeGreaterThanOrEqual(30);
  const data=read('generated/radio-10000901.json');expect(data.stations.length).toBeGreaterThan(10);expect(data.query.radiusM).toBe(1000);expect(data.source).toContain('spectrummap.kr');expect(data.stations.every(s=>s.measurement===null)).toBe(true);expect(data.stations.some(s=>s.frequencyMHz>300&&s.powerW>0&&s.gainDbi>0)).toBe(true);
 });
});
