import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {metres,carAccess,chargingRecord,roadGraph,roadRoute,nearestRoad,sampleRoadRoute} from '../../src/core/road-maps.js';
const node=(id,x,y=0,tags={})=>({type:'node',id,lon:127+x*.001,lat:37+y*.001,tags});
const way=(id,nodes,tags={})=>({type:'way',id,nodes,tags:{highway:'residential',...tags}});
const restriction=(tags={},members=[{type:'way',role:'from',ref:10},{type:'node',role:'via',ref:2},{type:'way',role:'to',ref:20}])=>({type:'relation',id:100,tags:{type:'restriction',restriction:'no_left_turn',...tags},members});
const fixture=(extra=[])=>({elements:[node(1,0),node(2,1),node(3,2),node(4,1,1),way(10,[1,2]),way(20,[2,3]),way(30,[2,4,3]),...extra]});
describe('real road routing and charging evidence',()=>{
 it('uses spherical distances and road geometry for animation, with clamped endpoints',()=>{
  expect(metres([0,0],[0,1])).toBeCloseTo(111194.93,1);expect(metres([0,0],[0,0])).toBe(0);
  const graph=roadGraph(fixture()),path=roadRoute(graph,1,3);
  expect(path.nodes).toEqual([1,2,3]);expect(sampleRoadRoute(path,-1).coordinates).toEqual(path.coordinates[0]);
  expect(sampleRoadRoute(path,path.distance/2).coordinates[0]).toBeCloseTo(127.001);expect(sampleRoadRoute(path,1e6).arrived).toBe(true);
  expect(sampleRoadRoute(null,0)).toBeNull();expect(sampleRoadRoute({coordinates:[]},0)).toBeNull();
  expect(sampleRoadRoute({coordinates:[[127,37]],distance:0},0)).toEqual({coordinates:[127,37],bearing:0,arrived:true});
  expect(sampleRoadRoute({coordinates:[[0,0],[0,0]],distance:0},0).coordinates).toEqual([0,0]);
 });
 it('honors access precedence and excludes uncertain time conditions and non-car ways',()=>{
  expect(carAccess()).toBe(false);expect(carAccess({highway:'footway'})).toBe(false);
  for(const access of ['no','private','agricultural','forestry','delivery'])expect(carAccess({highway:'service',access})).toBe(false);
  expect(carAccess({highway:'service',access:'private',motorcar:'yes'})).toBe(true);
  expect(carAccess({highway:'service',vehicle:'no'})).toBe(false);expect(carAccess({highway:'service',motor_vehicle:'no'})).toBe(false);
  expect(carAccess({highway:'residential',area:'yes'})).toBe(false);
  for(const key of ['access:conditional','motor_vehicle:conditional','motorcar:conditional','oneway:conditional'])expect(carAccess({highway:'service',[key]:'no @ (Mo-Fr)'})).toBe(false);
 });
 it('respects one-way, reverse one-way and implicit roundabout or motorway directions',()=>{
  for(const tags of [{oneway:'yes'},{oneway:'1'},{oneway:'true'},{junction:'roundabout'},{highway:'motorway'}]){
   const graph=roadGraph({elements:[node(1,0),node(2,1),way(10,[1,2],tags)]});expect(roadRoute(graph,1,2)).not.toBeNull();expect(roadRoute(graph,2,1)).toBeNull();
  }
  const reverse=roadGraph({elements:[node(1,0),node(2,1),way(10,[1,2],{oneway:'-1'})]});expect(roadRoute(reverse,1,2)).toBeNull();expect(roadRoute(reverse,2,1)).not.toBeNull();
 });
 it('does not join crossing coordinates without shared OSM nodes and handles missing or blocked nodes',()=>{
  const raw={elements:[node(1,0),node(2,1),node(3,1),node(4,2),way(10,[1,2,99]),way(20,[3,4]),way(30,[1,1])]};const graph=roadGraph(raw);
  expect(roadRoute(graph,1,4)).toBeNull();expect(roadRoute(graph,99,4)).toBeNull();expect(roadRoute(graph,1,1).distance).toBe(0);
  expect(roadGraph({elements:[node(1,0),node(2,1,0,{barrier:'bollard'}),way(10,[1,2])]}).edges).toHaveLength(0);
  expect(roadGraph({elements:[node(1,0),node(2,1,0,{barrier:'gate',motorcar:'yes'}),way(10,[1,2])]}).edges).toHaveLength(2);
  expect(roadGraph({elements:[node(1,0),node(2,1,0,{barrier:'toll_booth'}),way(10,[1,2])]}).edges).toHaveLength(2);
 });
 it('keeps incoming way state so turn bans cause a detour',()=>{
  const banned=roadGraph(fixture([restriction()]));expect(roadRoute(banned,1,3).nodes).toEqual([1,2,4,3]);
  const only=roadGraph(fixture([restriction({restriction:'only_straight_on'})]));expect(roadRoute(only,1,4).nodes).toEqual([1,2,3,4]);
  const except=roadGraph(fixture([restriction({except:'bus;motorcar'})]));expect(roadRoute(except,1,3).nodes).toEqual([1,2,3]);
  const u=roadGraph({elements:[node(1,0),node(2,1),node(3,2),way(10,[1,2,3]),restriction({restriction:'no_u_turn'},[{type:'way',role:'from',ref:10},{type:'node',role:'via',ref:2},{type:'way',role:'to',ref:10}])]});expect(roadRoute(u,1,3).nodes).toEqual([1,2,3]);
 });
 it('excludes unsupported via-way and conditional turns rather than inventing permission',()=>{
  const viaWay=restriction({},[{type:'way',role:'from',ref:10},{type:'way',role:'via',ref:30},{type:'way',role:'to',ref:20}]);
  const conditional=restriction({'restriction:conditional':'no_left_turn @ (Mo-Fr)'});
  for(const r of [viaWay,conditional,restriction({restriction:null}),restriction({restriction:'unsupported'})])expect(roadGraph(fixture([r])).excludedWays).toContain(10);
  expect(roadGraph(fixture([restriction({},[])])).excludedWays).toEqual([]);
  expect(roadGraph(fixture([restriction({'restriction:motorcar':'no_left_turn'})])).restrictions[0].kind).toBe('no_left_turn');
  expect(roadGraph(fixture([restriction({'restriction:motor_vehicle':'no_left_turn'})])).restrictions[0].kind).toBe('no_left_turn');
 });
 it('only snaps within a declared distance and deduplicates raw road records',()=>{
  const graph=roadGraph(fixture([way(10,[1,2])]));expect(graph.ways).toHaveLength(3);
  expect(nearestRoad(graph,[127,37],1).nodeId).toBe(1);expect(nearestRoad(graph,[0,0])).toBeNull();expect(nearestRoad(graph,[127.0009,37]).nodeId).toBe(2);
 });
 it('preserves original charger fields without deriving availability, port sums or unknown power',()=>{
  const charger=chargingRecord({...node(9,0),tags:{amenity:'charging_station',name:'현장명',operator:'기관',capacity:'2','socket:type1':'yes','socket:type2':'4','socket:type2:output':'22 kW','socket:chademo':'0',opening_hours:'24/7',access:'customers',fee:'yes','charging_station:output':'44 kW'}});
  expect(charger.capacity).toBe(2);expect(charger.status).toBeNull();expect(charger.sockets).toEqual([{type:'type1',count:null,output:null},{type:'type2',count:4,output:'22 kW'}]);
  const empty=chargingRecord({...node(10,0),tags:{amenity:'charging_station'}});expect(empty.capacity).toBeNull();expect(empty.name).toBe('충전소 10');expect(empty.sockets).toEqual([]);
  expect(chargingRecord({type:'way',id:2,center:{lat:37,lon:127},tags:{amenity:'charging_station',brand:'브랜드','name:ko':'한국어'}}).name).toBe('한국어');
  expect(chargingRecord({...node(10,0),tags:{amenity:'charging_station',brand:'브랜드'}}).name).toBe('브랜드');
  for(const key of ['motorcar','motor_vehicle','access'])expect(chargingRecord({...node(1,0),tags:{amenity:'charging_station',[key]:'no'}})).toBeNull();
  expect(chargingRecord({})).toBeNull();expect(chargingRecord({tags:{amenity:'charging_station'}})).toBeNull();
 });
});
describe('20 acquired maps are locally runnable datasets',()=>{
 it('verifies distinct sources, hashes, real charger coordinates and drivable default routes for every map',()=>{
  const index=JSON.parse(readFileSync(new URL('../../public/mobility/maps/index.json',import.meta.url),'utf8'));expect(index.maps).toHaveLength(20);
  expect(new Set(index.maps.map(m=>m.id)).size).toBe(20);expect(new Set(index.maps.map(m=>m.station)).size).toBe(20);
  for(const item of index.maps){
   const bytes=readFileSync(new URL('../../public'+item.raw,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.source.sha256);
   const raw=JSON.parse(bytes),graph=roadGraph(raw),path=roadRoute(graph,item.defaultRoute.start,item.defaultRoute.end);
   expect(item.source.osmBase).toBe(raw.osm3s.timestamp_osm_base);expect(graph.ways.length).toBe(item.counts.roads);expect(path.distance).toBeCloseTo(item.defaultRoute.distance,6);expect(path.distance).toBeGreaterThan(450);
   const charger=item.chargers.find(c=>c.id===item.defaultRoute.chargerId);expect(charger.approach.distance).toBeLessThanOrEqual(150);expect(charger.status).toBeNull();expect(charger.coordinates[0]).toBeGreaterThan(124);expect(charger.coordinates[0]).toBeLessThan(130);
   expect(path.edges.every(e=>raw.elements.some(w=>w.type==='way'&&w.id===e.wayId))).toBe(true);
  }
 });
});
