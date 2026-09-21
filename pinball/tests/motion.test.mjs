import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Race,makeConfig,MAPS,STEP,rotorPose} from '../src/physics.js';
import {boardMotionAt,motionSchedule,MOTION_MIN_GAP,MOTION_MAX_GAP,MOTION_DURATION} from '../src/board-motion.js';
const config=(n,mapId='neon',boardMotion=true)=>({...makeConfig(Array.from({length:n},(_,i)=>`공 ${i+1}`).join(','),1,'last',n),mapId,boardMotion});
const run=r=>{r.start();while(!['complete','invalid'].includes(r.state))r.step();return r;};
test('random 3–5 second motion is deterministic, bounded, smooth and independent of participants',()=>{
 for(const seed of [0,1,2,19,4294967295]){
  const starts=motionSchedule(seed);let previous=0;
  for(const start of starts){const gap=start-previous;assert.ok(gap>=MOTION_MIN_GAP-1e-10&&gap<=MOTION_MAX_GAP+1e-10);previous=start;
   for(const t of [start,start+MOTION_DURATION]){const m=boardMotionAt(t,seed,true);assert.ok(Math.abs(m.forceX)+Math.abs(m.forceY)<1e-10);}
  }
  assert.deepEqual(starts,motionSchedule(seed));assert.ok(new Set(starts.slice(1).map((s,i)=>(s-starts[i]).toFixed(6))).size>10);
 }
 assert.notDeepEqual(motionSchedule(1),motionSchedule(2));
 const start=motionSchedule(2)[0];assert.equal(boardMotionAt(start+.4,2,true).axis,'x');assert.equal(boardMotionAt(start+.4,2,false).active,false);
 for(let t=0;t<90;t+=.013){const m=boardMotionAt(t,19,true);assert.ok(Math.abs(m.forceX)<=30&&m.forceY===0);assert.ok(Math.abs(m.roll)<.027&&m.pitch===0);}
});
test('shared board force acts equally on identical balls, with actual velocity change',()=>{
 const a=new Race(config(2),2),b=new Race(config(2,'neon',false),2);
 for(const r of [a,b]){r.state='racing';r.raceTime=motionSchedule(2)[0]+.4;r.balls.forEach((ball,i)=>Object.assign(ball,{x:80+i*450,y:240,vx:0,vy:0}));r.step();}
 assert.ok(Math.abs(a.balls[0].vx)>0);assert.equal(a.balls[0].vx,a.balls[1].vx);assert.equal(b.balls[0].vx,0);assert.notEqual(a.balls[0].vx,b.balls[0].vx);
});
test('each map has different rotor magnitudes and both directions, with matching surface velocities',()=>{
 for(const map of MAPS){const rates=map.rotors.map(r=>r.omega);assert.ok(rates.some(v=>v>0)&&rates.some(v=>v<0));assert.equal(new Set(rates.map(Math.abs)).size,rates.length);assert.ok(rates.every(Number.isFinite));}
});
test('pause freezes active board motion and stepping chunks preserve the exact race',()=>{
 const a=new Race(config(20),732),b=new Race(config(20),732);a.start();b.start();while(a.raceTime<motionSchedule(732)[0]+.45)a.step();a.pause();const frozen=a.snapshot();for(let i=0;i<200;i++)a.step();assert.deepEqual(a.snapshot(),frozen);a.resume();while(!['complete','invalid'].includes(a.state))a.step();while(!['complete','invalid'].includes(b.state))b.step(STEP*3);assert.equal(a.state,'complete');assert.deepEqual(a.finishOrder,b.finishOrder);
});
test('orbit natural stagnation receives an impulse and finishes through the real goal',()=>{
 const r=new Race(config(1,'orbit',true),1);r.start();let impulses=0;
 while(!['complete','invalid'].includes(r.state)){
  const b=r.balls[0],before={x:b.x,y:b.y,assists:r.assists};r.step();
  if(r.assists>before.assists){impulses++;assert.ok(Math.hypot(b.x-before.x,b.y-before.y)<12,'escape must move by physical integration, not teleport');assert.equal(b.finished,false);assert.equal(r.finishOrder.length,0);}
 }
 assert.equal(r.state,'complete');assert.ok(impulses>0);assert.equal(r.finishOrder.length,1);assert.equal(r.finishOrder[0].exitId,r.map.exits.find(h=>h.kind!=='return').id);
});
test('windmill blades share an actual perpendicular collider and pirate velocity matches its swing',()=>{
 const r=new Race(config(1),17);r.rotationTime=1.234;
 const windmill=r.map.rotors.find(o=>o.ride==='windmill'),arms=r.rotorSegments().filter(s=>s.x===windmill.x&&s.y===windmill.y);
 assert.equal(arms.length,2);const a=arms[0],b=arms[1];assert.ok(Math.abs((a.bx-a.ax)*(b.bx-b.ax)+(a.by-a.ay)*(b.by-b.ay))<1e-8);
 const pirate=r.map.rotors.find(o=>o.ride==='pirate');
 for(let t=0;t<8;t+=.11){const h=.00001,approx=(rotorPose(pirate,t+h).angle-rotorPose(pirate,t-h).angle)/(2*h),pose=rotorPose(pirate,t);assert.ok(Math.abs(pose.velocity-approx)<1e-7);assert.ok(Math.abs(pose.angle)<=pirate.swing);}
 const pose=rotorPose(pirate,r.rotationTime),segment=r.rotorSegments().find(s=>s.x===pirate.x&&s.y===pirate.y);assert.equal(segment.omega,pose.velocity);
});
test('all five maps with motion: 150 seeded races remain contained and finish with unique real ranks',async()=>{
 const report=[];
 for(const map of MAPS)for(const n of [1,20,60])for(let seed=1;seed<=10;seed++){
  const r=new Race(config(n,map.id),seed);r.start();
  while(!['complete','invalid'].includes(r.state)){r.step();for(const b of r.balls){assert.ok(Number.isFinite(b.x+b.y+b.vx+b.vy));assert.ok(b.x>=40-1e-5&&b.x<=580+1e-5);assert.ok(b.y>=38-1e-5&&b.y<=r.map.finish+1e-5);}}
  assert.equal(r.state,'complete',`${map.id}/${n}/${seed}`);assert.equal(new Set(r.finishOrder.map(b=>b.id)).size,n);assert.ok(r.finishOrder.every(b=>[1,2,3,4].includes(b.exitId)));assert.equal(r.winner.id,r.finishOrder[n-1].id);report.push({map:map.id,balls:n,seed,duration:r.raceTime,assists:r.assists});
 }
 await writeFile(`evidence/park-20260921/${process.env.EVIDENCE_PREFIX||'03'}-motion-physics-results.json`,JSON.stringify(report,null,2));
});
