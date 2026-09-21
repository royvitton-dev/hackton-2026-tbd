import test from 'node:test';import assert from 'node:assert/strict';import {Race,makeConfig,parseParticipants,MAPS} from '../src/physics.js';import {captureDevices} from '../src/devices.js';
test('comma-separated entries and name*count are explicit, with whitespace and duplicate labels',()=>{
 const p=parseParticipants(' 하늘, 지우*3, 민준 ,지우, ,');assert.deepEqual(p.map(x=>x.count),[1,3,1,1]);assert.equal(p[3].label,'지우 (2)');assert.equal(makeConfig('하늘,지우*3,민준',1,'nth',5).total,5);assert.equal(parseParticipants('하늘\n지우').length,1);assert.equal(parseParticipants('하늘,\n지우').length,2);for(const bad of ['지우*','지우*0','지우*-1','지우*1.5','지우*11','지우*3*2','*3'])assert.throws(()=>parseParticipants(bad));
});
test('Parade holds multiple balls independently for 0.8–1.5 seconds and freezes every timer when paused',()=>{
 for(let seed=1;seed<=12;seed++){
  const r=new Race({...makeConfig('A,B,C,D,E,F',1,'last',1),mapId:'parade'},seed);r.state='racing';const d=r.devices.find(d=>d.kind==='cannon');assert.equal(r.devices.filter(d=>d.kind==='cannon').length,9);
  for(const b of r.balls){Object.assign(b,{x:d.x,y:d.y,vx:0,vy:0});captureDevices(r,b);assert.ok(b.hold.duration>=.8&&b.hold.duration<=1.5);}
  assert.equal(d.holds.length,6);assert.equal(new Set(d.holds.map(h=>h.releaseAt)).size,6);r.pause();const frozen=r.snapshot();for(let i=0;i<100;i++)r.step();assert.deepEqual(r.snapshot(),frozen);r.resume();while(d.holds.length)r.step();const launches=r.events.filter(e=>e.type==='launch');assert.equal(launches.length,6);assert.ok(launches.every(e=>e.heldFor>=.8&&e.heldFor<=1.5+1e-9));assert.ok(new Set(launches.map(e=>e.time)).size>2);
 }
});
test('Parade has one goal, nine central cannons and a final gate that physically opens and blocks',()=>{
 const map=MAPS.find(m=>m.id==='parade');assert.equal(map.exits.length,1);assert.equal(map.exits[0].kind,'throat');assert.equal(map.returnPoint,null);const gate=map.rotors.at(-1);
 const contact=phase=>{const r=new Race({...makeConfig('A',1,'first',1),mapId:'parade'},8);r.map=structuredClone(map);r.map.rotors=[{...gate,phase,omega:0}];r.rotationTime=0;const b=r.balls[0];Object.assign(b,{x:gate.x+40,y:gate.y-11,vx:0,vy:250});r.segment(b,r.rotorSegments()[0],.65);return b;};assert.ok(contact(0).vy<0);assert.equal(contact(Math.PI/2).vy,250);
});
