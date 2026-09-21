import test from 'node:test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {Race,makeConfig,MAPS} from '../src/physics.js';
test('course variety: one or two goals per map, five Cloud ramps, Garden timing gate, Candy side bumpers',()=>{
 const [star,candy,cloud,garden]=MAPS;assert.deepEqual(star.exits.map(h=>h.x),[310]);assert.equal(star.rotors.filter(r=>r.y===1970).length,1);
 assert.equal(cloud.rails.filter(r=>Math.abs(r.ax-r.bx)>300).length,5);assert.ok(cloud.rotors.some(r=>r.y===1165&&r.blades===4));
 assert.equal(garden.rotors.filter(r=>r.ride==='flower-gate').length,2);assert.deepEqual(MAPS.map(m=>m.exits.length),[1,2,1,2,1]);assert.deepEqual(MAPS.map(m=>m.exits[0].x),[310,240,310,240,310]);assert.ok(candy.bumpers.some(b=>b.x===104&&b.y===1995));assert.ok(candy.bumpers.some(b=>b.x===516&&b.y===1995));
});
test('Garden final flower gate physically blocks and opens with its rotation',()=>{
 const map=MAPS.find(m=>m.id==='split'),gate=map.rotors.find(r=>r.ride==='flower-gate');
 function contact(phase){const r=new Race({...makeConfig('A',1,'first',1),mapId:'split'},8);r.map=structuredClone(map);r.map.rotors=[{...gate,phase,omega:0}];r.rotationTime=0;const b=r.balls[0];Object.assign(b,{x:gate.x+40,y:gate.y-11,vx:0,vy:250});r.segment(b,r.rotorSegments()[0],.65);return b;}
 const closed=contact(0),open=contact(Math.PI/2);assert.ok(closed.vy<0);assert.equal(open.vy,250);
});
test('all new rides activate in natural seeded races and finish with contained unique arrivals',async()=>{
 const report=[];
 for(const map of MAPS){const counts={magnet:0,cannon:0};for(let seed=1;seed<=10;seed++){
  const r=new Race({...makeConfig(Array.from({length:20},(_,i)=>`R${i}`).join(','),1,'last',1),mapId:map.id,boardMotion:true},seed);r.start();let captures=0,launches=0;
  while(!['complete','invalid'].includes(r.state)){r.step();for(const e of r.events.splice(0)){if(e.type==='capture'){counts[e.kind]++;captures++;assert.ok(e.duration>=(map.id==='parade'&&e.kind==='cannon'?.8:.5)&&e.duration<=(map.id==='parade'&&e.kind==='cannon'?1.5:1));}if(e.type==='launch')launches++;}for(const b of r.balls){assert.ok(b.x>=40-1e-5&&b.x<=580+1e-5);assert.ok(b.y<=map.finish+1e-5);}}
  assert.equal(r.state,'complete',`${map.id}/${seed}: ${JSON.stringify(r.balls.filter(b=>!b.finished))}`);assert.equal(new Set(r.finishOrder.map(b=>b.id)).size,20);assert.ok(r.finishOrder.every(b=>map.exits.some(h=>h.id===b.exitId)));report.push({map:map.id,seed,time:r.raceTime,captures,launches,assists:r.assists});
 }assert.ok(counts.magnet>0&&counts.cannon>0,JSON.stringify({map:map.id,counts}));}
 await writeFile(`evidence/park-20260921/${process.env.EVIDENCE_PREFIX||'09'}-course-device-results.json`,JSON.stringify({status:'PASS',cases:report},null,2));
});
