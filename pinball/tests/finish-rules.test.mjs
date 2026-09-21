import test from 'node:test';import assert from 'node:assert/strict';
import {Race,makeConfig,MAPS,STEP} from '../src/physics.js';
import {assertGameResult} from './assert-result.mjs';
const cfg=(n,rule,target=1,mapId='neon')=>({...makeConfig(Array.from({length:n},(_,i)=>`공 ${i+1}`).join('\n'),1,rule,target),mapId,boardMotion:true,finishMode:'winner'});
const run=(r,dt=STEP)=>{r.start();while(!['complete','invalid'].includes(r.state))r.step(dt);return r;};
test('first/Nth stop at the actual target crossing; last stops with one unfinished ball',()=>{
 for(const map of MAPS)for(const n of [1,7,20])for(const rule of ['first','nth','last']){
  const r=run(new Race(cfg(n,rule,Math.ceil(n/2),map.id),821));assertGameResult(r.snapshot());
  const frozen=r.snapshot(),rotation=r.rotationTime;for(let i=0;i<30;i++)r.step(STEP*10);assert.deepEqual(r.snapshot(),frozen);assert.equal(r.rotationTime,rotation);assert.equal(r.pause(),false);assert.equal(r.resume(),false);
 }
});
test('ending rule preserves the prefix of the same physical race and has no chosen winner',()=>{
 for(const map of MAPS){
  const full=run(new Race({...cfg(12,'last',1,map.id),finishMode:'all'},932));
  for(const rule of ['first','nth','last']){
   const r=run(new Race(cfg(12,rule,5,map.id),932));const count=rule==='first'?1:rule==='nth'?5:11;
   assert.deepEqual(r.finishOrder,full.finishOrder.slice(0,count));assert.equal(r.winner.id,full.finishOrder[rule==='last'?11:count-1].id);assertGameResult(r.snapshot());
  }
 }
});
test('same-substep ties stop by crossing time and seeded priority without extra ranks',()=>{
 for(const rule of ['first','nth','last']){
  const r=new Race(cfg(3,rule,2,'orbit'),4);r.map=structuredClone(r.map);r.map.exits=[100,240,380].map((x,i)=>({id:i+1,x,width:80}));r.map.rails=r.map.rails.filter(s=>s.ay<2000&&s.by<2000);r.state='racing';r.balls.forEach((b,i)=>Object.assign(b,{x:100+i*140,y:r.map.finish-.1,vx:0,vy:100,tieKey:[.8,.2,.5][i]}));r.step(STEP*3);assertGameResult(r.snapshot());
  assert.equal(r.finishOrder[0].id,r.balls[1].id);assert.equal(r.winner.id,r.balls[rule==='first'?1:rule==='nth'?2:0].id);
 }
});
test('1x and 3x step chunks stop at identical positions, time, winner and ranks',()=>{
 for(const rule of ['first','nth','last']){const a=run(new Race(cfg(20,rule,9),444)),b=run(new Race(cfg(20,rule,9),444),STEP*3);const {roundId:x,...sa}=a.snapshot(),{roundId:y,...sb}=b.snapshot();assert.deepEqual(sa,sb);}
});
