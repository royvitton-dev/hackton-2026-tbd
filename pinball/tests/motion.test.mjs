import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Race,makeConfig,MAPS,STEP} from '../src/physics.js';
import {boardMotionAt,MOTION_START,MOTION_PERIOD,MOTION_DURATION} from '../src/board-motion.js';
const config=(n,mapId='neon',boardMotion=true)=>({...makeConfig(Array.from({length:n},(_,i)=>`공 ${i+1}`).join('\n'),1,'last',n),mapId,boardMotion});
const run=r=>{r.start();while(!['complete','invalid'].includes(r.state))r.step();return r;};
test('gentle motion is bounded, smooth at boundaries, alternates axes and ignores participant state',()=>{
 for(const t of [0,MOTION_START,MOTION_START+MOTION_DURATION,MOTION_START+MOTION_PERIOD]){const m=boardMotionAt(t,2,true);assert.ok(Math.abs(m.forceX)+Math.abs(m.forceY)<1e-10);}
 assert.equal(boardMotionAt(7.4,2,true).axis,'x');assert.equal(boardMotionAt(16.4,2,true).axis,'y');assert.equal(boardMotionAt(7.4,2,false).active,false);
 for(let t=0;t<90;t+=.013){const m=boardMotionAt(t,19,true);assert.ok(Math.abs(m.forceX)<=30&&Math.abs(m.forceY)<=24);assert.ok(Math.abs(m.roll)<.027&&Math.abs(m.pitch)<.021);}
 assert.deepEqual(boardMotionAt(7.5,44,true),boardMotionAt(7.5,44,true));
});
test('shared board force acts equally on identical balls, with actual velocity change',()=>{
 const a=new Race(config(2),2),b=new Race(config(2,'neon',false),2);
 for(const r of [a,b]){r.state='racing';r.raceTime=7.4;r.balls.forEach((ball,i)=>Object.assign(ball,{x:80+i*450,y:240,vx:0,vy:0}));r.step();}
 assert.ok(Math.abs(a.balls[0].vx)>0);assert.equal(a.balls[0].vx,a.balls[1].vx);assert.equal(b.balls[0].vx,0);assert.notEqual(a.balls[0].vx,b.balls[0].vx);
});
test('each map has different rotor magnitudes and both directions, with matching surface velocities',()=>{
 for(const map of MAPS){const rates=map.rotors.map(r=>r.omega);assert.ok(rates.some(v=>v>0)&&rates.some(v=>v<0));assert.equal(new Set(rates.map(Math.abs)).size,rates.length);assert.ok(rates.every(Number.isFinite));}
});
test('pause freezes active board motion and stepping chunks preserve the exact race',()=>{
 const a=new Race(config(20),732),b=new Race(config(20),732);a.start();b.start();while(a.raceTime<7.45)a.step();a.pause();const frozen=a.snapshot();for(let i=0;i<200;i++)a.step();assert.deepEqual(a.snapshot(),frozen);a.resume();while(!['complete','invalid'].includes(a.state))a.step();while(!['complete','invalid'].includes(b.state))b.step(STEP*3);assert.equal(a.state,'complete');assert.deepEqual(a.finishOrder,b.finishOrder);
});
test('orbit single-ball oscillation is detected and escapes without fabricated finish',()=>{
 const r=run(new Race(config(1,'orbit',false),5));assert.equal(r.state,'complete');assert.ok(r.assists>0);assert.equal(r.finishOrder.length,1);assert.ok([1,2,3,4].includes(r.finishOrder[0].exitId));
});
test('all four maps with motion: 120 seeded races remain contained and finish with unique real ranks',async()=>{
 const report=[];
 for(const map of MAPS)for(const n of [1,20,60])for(let seed=1;seed<=10;seed++){
  const r=new Race(config(n,map.id),seed);r.start();
  while(!['complete','invalid'].includes(r.state)){r.step();for(const b of r.balls){assert.ok(Number.isFinite(b.x+b.y+b.vx+b.vy));assert.ok(b.x>=40-1e-5&&b.x<=580+1e-5);assert.ok(b.y>=38-1e-5&&b.y<=r.map.finish+1e-5);}}
  assert.equal(r.state,'complete',`${map.id}/${n}/${seed}`);assert.equal(new Set(r.finishOrder.map(b=>b.id)).size,n);assert.ok(r.finishOrder.every(b=>[1,2,3,4].includes(b.exitId)));assert.equal(r.winner.id,r.finishOrder[n-1].id);report.push({map:map.id,balls:n,seed,duration:r.raceTime,assists:r.assists});
 }
 await writeFile('evidence/park-20260921/03-motion-physics-results.json',JSON.stringify(report,null,2));
});
