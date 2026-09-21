import test from 'node:test';import assert from 'node:assert/strict';import {Race,makeConfig,STEP} from '../src/physics.js';import {returnPose} from '../src/return-portals.js';
const race=(n=2,mapId='orbit')=>new Race({...makeConfig(Array.from({length:n},(_,i)=>`공${i}`).join('\n'),1,'last',1),mapId},94);
test('return throat never ranks or wins; goal throat alone produces an arrival',()=>{
 for(const mapId of ['orbit','split']){const r=race(2,mapId);r.state='racing';r.balls.forEach((b,i)=>Object.assign(b,{x:i?380:240,y:r.map.finish-.1,vx:0,vy:150}));r.step();assert.equal(r.finishOrder.length,1);assert.equal(r.finishOrder[0].id,r.balls[0].id);assert.equal(r.finishOrder[0].exitId,1);assert.equal(r.returnCount,1);assert.equal(r.winner,null);assert.ok(r.balls[1].portal);assert.equal(r.balls[1].finished,false);assert.equal(r.balls[1].rank,null);}
});
test('return sink and fall both freeze on pause; landing returns to the actual middle of the board',()=>{
 const r=race();r.state='racing';const b=r.balls[0];Object.assign(b,{x:380,y:r.map.finish-.1,vx:0,vy:150});r.step();
 for(const phase of ['sink','fall']){if(phase==='fall')while(!b.portal.moved)r.step();r.pause();const before=r.snapshot(),pose=returnPose(b,r.raceTime);for(let i=0;i<30;i++)r.step(.1);assert.deepEqual(r.snapshot(),before);assert.deepEqual(returnPose(b,r.raceTime),pose);r.resume();}
 assert.equal(b.x,r.map.returnPoint.x);assert.equal(b.y,r.map.returnPoint.y);while(b.portal)r.step();assert.ok(Math.abs(b.x-r.map.returnPoint.x)<2);assert.ok(Math.abs(b.y-r.map.returnPoint.y)<2);assert.equal(b.finished,false);assert.equal(r.finishOrder.length,0);assert.ok(b.vy>0);assert.ok(Math.abs(b.vx)<=75);
});
test('repeated returns are explicit game events, never duplicate finishes',()=>{
 const r=race(1);r.state='racing';const b=r.balls[0];for(let i=0;i<3;i++){Object.assign(b,{x:380,y:r.map.finish-.1,vx:0,vy:150});r.step();while(b.portal)r.step();assert.equal(r.finishOrder.length,0);}assert.equal(r.returnCount,3);assert.equal(b.returnCount,3);
 Object.assign(b,{x:240,y:r.map.finish-.1,vx:0,vy:150});r.step();assert.equal(r.state,'complete');assert.equal(r.finishOrder.length,1);assert.equal(r.winner.id,b.id);assert.equal(r.finish(b,r.raceTime,1),false);
});
test('first target stops with a returning opponent still unfinished; replay does not advance its portal',()=>{
 const r=race();r.config.rule='first';r.config.target=1;r.config.finishMode='winner';r.state='racing';Object.assign(r.balls[0],{x:380,y:r.map.finish-.05,vx:0,vy:150});Object.assign(r.balls[1],{x:240,y:r.map.finish-.2,vx:0,vy:150});r.step(STEP*3);assert.equal(r.state,'complete');assert.equal(r.returnCount,1);assert.ok(r.balls[0].portal);assert.equal(r.balls[0].rank,null);assert.equal(r.winner.id,r.balls[1].id);const frozen=r.snapshot();r.step(.1);assert.deepEqual(r.snapshot(),frozen);
});

test('60-second finale blocks new return entry while balls already inside can drain without being ranked',()=>{
 const r=race(1);r.state='racing';r.raceTime=60;assert.equal(r.returnClosed(),true);assert.equal(r.returnGateSegments().length,2);const b=r.balls[0];Object.assign(b,{x:380,y:r.map.finish-.1,vx:0,vy:150});r.step();assert.equal(r.returnCount,1);assert.equal(r.finishOrder.length,0);assert.equal(b.finished,false);assert.ok(b.portal);assert.ok(r.events.some(e=>e.type==='finale'));
});
