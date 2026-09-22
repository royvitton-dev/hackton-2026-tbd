import test from 'node:test';import assert from 'node:assert/strict';import {Race,makeConfig,MAPS,STEP} from '../src/physics.js';import {devicePose} from '../src/devices.js';
const cfg=(n=2,mapId='neon')=>({...makeConfig(Array.from({length:n},(_,i)=>`탑승 ${i}`).join(','),1,'last',1),mapId,boardMotion:true});
function atDevice(kind,seed=11){const r=new Race(cfg(),seed);r.state='racing';const d=r.devices.find(d=>d.kind===kind),b=r.balls[0];Object.assign(b,{x:d.x,y:d.y-5,vx:0,vy:100});Object.assign(r.balls[1],{x:70,y:240,vx:0,vy:0});r.step();assert.ok(b.hold);return {r,d,b};}
test('magnet and cannon capture at physical position for magnet 0.5–2s and cannon 0.5–1s; pause freezes pose and ball',()=>{
 for(const kind of ['magnet','cannon'])for(let seed=1;seed<=20;seed++){
  const {r,d,b}=atDevice(kind,seed),h={...b.hold},x=b.x,y=b.y;assert.ok(h.duration>=.5&&h.duration<=(kind==='magnet'?2:1));assert.ok(Math.abs(y-(d.y-5))<2);assert.equal(x,d.x);
  r.pause();const frozen=r.snapshot();for(let i=0;i<30;i++)r.step(.1);assert.deepEqual(r.snapshot(),frozen);r.resume();
  while(b.hold){assert.equal(b.x,x);assert.equal(b.y,y);r.step();}
  const ev=r.events.find(e=>e.type===(kind==='cannon'?'launch':'release'));assert.ok(ev.heldFor>=.5&&ev.heldFor<=(kind==='magnet'?2:1)+1e-9);assert.ok(Math.hypot(b.x-x,b.y-y)<7);
  if(kind==='cannon'){assert.ok(Math.hypot(b.vx,b.vy)>700);assert.ok(Math.abs(Math.atan2(b.vy,b.vx)-Math.atan2(Math.sin(ev.angle),Math.cos(ev.angle)))<.004);assert.equal(devicePose(d,r.raceTime).angle,ev.angle);}
  else assert.ok(Math.hypot(b.vx,b.vy)<100);
  Object.assign(b,{x:d.x,y:d.y,vx:0,vy:0});r.step();assert.equal(b.hold,null,'cooldown prevents immediate recapture');
 }
});
test('each device stores multiple incoming balls with independent randomized release times',()=>{
 for(const kind of ['magnet','cannon']){const r=new Race(cfg(5),17);r.state='racing';const d=r.devices.find(d=>d.kind===kind);r.balls.forEach((b,i)=>Object.assign(b,{x:60+i*50,y:240,vx:0,vy:0}));
 for(const b of r.balls){Object.assign(b,{x:d.x,y:d.y,vx:0,vy:0});r.step();assert.ok(b.hold);}
 assert.equal(d.holds.length,5);assert.equal(new Set(d.holds.map(h=>h.releaseAt)).size,5);const holds=d.holds.map(h=>({...h}));while(d.holds.length)r.step();
 const releases=r.events.filter(e=>e.type===(kind==='cannon'?'launch':'release'));assert.equal(releases.length,5);assert.equal(new Set(releases.map(e=>e.ballId)).size,5);assert.ok(releases.every(e=>e.heldFor>=.5&&e.heldFor<=(kind==='magnet'?2:1)+1e-9));assert.ok(new Set(releases.map(e=>e.time)).size>=3);
 const fresh=new Race(cfg(5),17);assert.ok(fresh.devices.every(d=>d.holds.length===0));assert.ok(fresh.balls.every(b=>!b.hold));assert.equal(fresh.devices.filter(d=>d.kind==='magnet').length,2);assert.equal(fresh.devices.filter(d=>d.kind==='cannon').length,2);
 }
});
test('cannon boost cannot tunnel through a pin or boundary',()=>{
 for(const map of MAPS){const r=new Race(cfg(1,map.id),13);r.state='racing';const b=r.balls[0],p=map.pins[0];Object.assign(b,{x:p.x,y:p.y-24,vx:0,vy:740,boostUntil:10});r.step();assert.ok(b.y<p.y);Object.assign(b,{x:42,y:240,vx:-740,vy:0});r.step(.1);assert.ok(b.x>=40&&b.x<=580);}
});
test('device capture, timing and launch are deterministic and varied across seeds',()=>{
 const angles=new Set(),durations=new Set();for(let seed=1;seed<=12;seed++){const a=atDevice('cannon',seed),b=atDevice('cannon',seed);assert.deepEqual(a.b.hold,b.b.hold);angles.add(a.d.phase);durations.add(a.b.hold.duration);}assert.equal(angles.size,12);assert.equal(durations.size,12);
});

test('cannons complete a full revolution every 0.4 physical seconds in either direction',()=>{
 for(const map of MAPS){const r=new Race(cfg(1,map.id),31);for(const d of r.devices.filter(d=>d.kind==='cannon')){assert.ok(Math.abs(Math.abs(d.omega)-Math.PI*5)<1e-10);d.holds=[{start:0,releaseAt:1,duration:1}];d.spinStarted=0;const a=devicePose(d,0).angle,b=devicePose(d,.4).angle;assert.ok(Math.abs(Math.abs(b-a)-Math.PI*2)<1e-10);}}
});

test('all five maps use 0.5–2s magnets and preserve cannon ranges; long holds actually release',()=>{
 for(const map of MAPS){const r=new Race(cfg(2,map.id),19);for(const d of r.devices){if(d.kind==='magnet'){assert.equal(d.holdMin,.5);assert.equal(d.holdMax,2);}else{assert.equal(d.holdMin??.5,map.id==='parade'?.8:.5);assert.equal(d.holdMax??1,map.id==='parade'?1.5:1);}}}
 const durations=[];for(let seed=1;seed<=40;seed++){const {r,b}=atDevice('magnet',seed);durations.push(b.hold.duration);let steps=0;while(b.hold&&steps++<250)r.step();assert.equal(b.hold,null);const release=r.events.find(e=>e.type==='release');assert.ok(release.heldFor>=.5&&release.heldFor<=2+1e-9);}
 assert.ok(Math.min(...durations)<.7);assert.ok(Math.max(...durations)>1.8);assert.equal(new Set(durations).size,40);
});
