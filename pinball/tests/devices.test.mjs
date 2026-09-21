import test from 'node:test';import assert from 'node:assert/strict';import {Race,makeConfig,MAPS,STEP} from '../src/physics.js';import {devicePose} from '../src/devices.js';
const cfg=(n=2,mapId='neon')=>({...makeConfig(Array.from({length:n},(_,i)=>`탑승 ${i}`).join('\n'),1,'last',1),mapId,boardMotion:true});
function atDevice(kind,seed=11){const r=new Race(cfg(),seed);r.state='racing';const d=r.devices.find(d=>d.kind===kind),b=r.balls[0];Object.assign(b,{x:d.x,y:d.y-5,vx:0,vy:100});Object.assign(r.balls[1],{x:70,y:240,vx:0,vy:0});r.step();assert.ok(b.hold);return {r,d,b};}
test('magnet and cannon capture at physical position for 0.5–1 seconds; pause freezes pose and ball',()=>{
 for(const kind of ['magnet','cannon'])for(let seed=1;seed<=20;seed++){
  const {r,d,b}=atDevice(kind,seed),h={...b.hold},x=b.x,y=b.y;assert.ok(h.duration>=.5&&h.duration<=1);assert.ok(Math.abs(y-(d.y-5))<2);assert.equal(x,d.x);
  r.pause();const frozen=r.snapshot();for(let i=0;i<30;i++)r.step(.1);assert.deepEqual(r.snapshot(),frozen);r.resume();
  while(b.hold){assert.equal(b.x,x);assert.equal(b.y,y);r.step();}
  const ev=r.events.find(e=>e.type===(kind==='cannon'?'launch':'release'));assert.ok(ev.heldFor>=.5&&ev.heldFor<=1+1e-9);assert.ok(Math.hypot(b.x-x,b.y-y)<7);
  if(kind==='cannon'){assert.ok(Math.hypot(b.vx,b.vy)>700);assert.ok(Math.abs(Math.atan2(b.vy,b.vx)-Math.atan2(Math.sin(ev.angle),Math.cos(ev.angle)))<.004);assert.ok(Math.sin(ev.angle)>0);assert.equal(devicePose(d,r.raceTime).angle,h.endAngle);}
  else assert.ok(Math.hypot(b.vx,b.vy)<100);
  Object.assign(b,{x:d.x,y:d.y,vx:0,vy:0});r.step();assert.equal(b.hold,null,'cooldown prevents immediate recapture');
 }
});
test('held ball remains solid, one ball per device, and restart clears holds',()=>{
 for(const kind of ['magnet','cannon']){const {r,d,b}=atDevice(kind),other=r.balls[1],x=b.x,y=b.y;Object.assign(other,{x:x+17,y,vx:-100,vy:0});r.step();assert.equal(b.x,x);assert.equal(b.y,y);assert.ok(Math.hypot(other.x-b.x,other.y-b.y)>=20-1e-8);assert.equal(other.hold,undefined);assert.equal(d.hold.ballId,b.id);const fresh=new Race(cfg(),r.seed);assert.ok(fresh.devices.every(d=>!d.hold));assert.ok(fresh.balls.every(b=>!b.hold));}
});
test('cannon boost cannot tunnel through a pin or boundary',()=>{
 for(const map of MAPS){const r=new Race(cfg(1,map.id),13);r.state='racing';const b=r.balls[0],p=map.pins[0];Object.assign(b,{x:p.x,y:p.y-24,vx:0,vy:740,boostUntil:10});r.step();assert.ok(b.y<p.y);Object.assign(b,{x:42,y:240,vx:-740,vy:0});r.step(.1);assert.ok(b.x>=40&&b.x<=580);}
});
test('device capture, timing and launch are deterministic and varied across seeds',()=>{
 const angles=new Set(),durations=new Set();for(let seed=1;seed<=12;seed++){const a=atDevice('cannon',seed),b=atDevice('cannon',seed);assert.deepEqual(a.b.hold,b.b.hold);angles.add(a.b.hold.endAngle);durations.add(a.b.hold.duration);}assert.equal(angles.size,12);assert.equal(durations.size,12);
});
