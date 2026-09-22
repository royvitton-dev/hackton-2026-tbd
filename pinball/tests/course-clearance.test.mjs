import test from 'node:test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {Race,makeConfig,MAPS,RADIUS,rotorPose} from '../src/physics.js';
const segmentDistance=(x,y,s)=>{const dx=s.bx-s.ax,dy=s.by-s.ay,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(y-s.ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-s.ax-t*dx,y-s.ay-t*dy);};
test('Candy lower cannon has at least two ball diameters between its funnel and nearby bumpers',()=>{
 const map=MAPS.find(m=>m.id==='orbit'),device=map.devices.find(d=>d.kind==='cannon'&&d.y>1600),walls=map.rails.filter(s=>s.by===device.y+9);
 assert.equal(walls.length,2);for(const wall of walls)for(const bumper of map.bumpers)assert.ok(segmentDistance(bumper.x,bumper.y,wall)-bumper.r-wall.r>=RADIUS*4,'cannon funnel/bumpers too close');
});
test('Cloud has four cannons; both lower funnels are clear of static pins, bumpers and magnet poles',()=>{
 const map=MAPS.find(m=>m.id==='zigzag'),cannons=map.devices.filter(d=>d.kind==='cannon');assert.equal(cannons.length,4);
 for(const d of cannons.filter(d=>d.y>1800)){const walls=map.rails.filter(s=>s.by===d.y+9);assert.equal(walls.length,2);for(const wall of walls)for(const p of [...map.pins,...map.bumpers,...map.devicePoles])assert.ok(segmentDistance(p.x,p.y,wall)-p.r-wall.r>RADIUS*2,JSON.stringify({d,p}));}
});
test('Changed courses complete real seeded races at 5, 20 and 60 balls with unique physical arrivals',async()=>{
 const cases=[];for(const mapId of ['orbit','zigzag'])for(const n of [5,20,60])for(const seed of [1,7,19,43]){
  const r=new Race({...makeConfig(Array.from({length:n},(_,i)=>`P${i}`).join(','),1,'last',1),mapId,boardMotion:true},seed);r.start();const used=new Set();const begin=performance.now();
  while(!['complete','invalid'].includes(r.state)){r.step();for(const e of r.events.splice(0))if(e.type==='launch')used.add(e.deviceId);for(const b of r.balls)assert.ok(Number.isFinite(b.x+b.y)&&b.x>=40-1e-5&&b.x<=580+1e-5&&b.y<=r.map.finish+1e-5);}
  const result={mapId,n,seed,state:r.state,time:r.raceTime,assists:r.assists,returns:r.returnCount,launchDevices:[...used],wallMs:performance.now()-begin};cases.push(result);
  await writeFile('evidence/park-20260921/34-course-results.json',JSON.stringify({cases},null,2));
  assert.equal(r.state,'complete',JSON.stringify(result));assert.equal(r.finishOrder.length,n);assert.equal(new Set(r.finishOrder.map(b=>b.id)).size,n);assert.equal(r.winner.id,r.finishOrder.at(-1).id);assert.ok(r.finishOrder.every((b,i)=>b.rank===i+1&&b.exitLabel==='골인'&&(!i||b.time>=r.finishOrder[i-1].time)));
 }
 const cloud=MAPS.find(m=>m.id==='zigzag');for(const d of cloud.devices.filter(d=>d.kind==='cannon'&&d.y>1800))assert.ok(cases.some(c=>c.mapId==='zigzag'&&c.launchDevices.includes(d.id)),'new cannon never used '+d.id);
 await writeFile('evidence/park-20260921/34-course-results.json',JSON.stringify({status:'PASS',cases},null,2));
});

test('Garden BACK gate rotates counterclockwise in the top view',()=>{const map=MAPS.find(m=>m.id==='split'),back=map.exits.find(h=>h.kind==='return'),gate=map.rotors.find(r=>r.ride==='flower-gate'&&r.x===back.x-40);assert.ok(gate);assert.equal(gate.omega,-.93);assert.ok(rotorPose(gate,.2).angle<rotorPose(gate,0).angle);});

test('Candy and Cloud winner modes preserve the actual complete-race arrival prefix',()=>{
 for(const mapId of ['orbit','zigzag']){const cfg={...makeConfig('A,B,C,D,E,F,G',1,'last',1),mapId,boardMotion:true};const run=c=>{const r=new Race(c,71);r.start();while(!['complete','invalid'].includes(r.state))r.step();assert.equal(r.state,'complete');return r;};const full=run(cfg);
  for(const [rule,target,count]of [['first',1,1],['nth',4,4],['last',7,6]]){const r=run({...cfg,rule,target,finishMode:'winner'});assert.deepEqual(r.finishOrder,full.finishOrder.slice(0,count));assert.equal(r.winner.id,full.finishOrder[target-1].id);if(rule==='last')assert.equal(r.balls.filter(b=>!b.finished).length,1);}
 }
});
