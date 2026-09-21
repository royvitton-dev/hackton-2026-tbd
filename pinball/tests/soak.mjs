import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Race,makeConfig,MAPS} from '../src/physics.js';
const report={at:new Date().toISOString(),status:'RUNNING',target:2400,cases:[],failure:null},started=performance.now();
const save=()=>{report.elapsedSeconds=(performance.now()-started)/1000;writeFileSync('evidence/park-20260921/08-soak-results.json',JSON.stringify(report,null,2));};
try{
 for(let seed=11;seed<=60;seed++)for(const map of MAPS)for(const n of [1,2,7,20,40,60])for(const boardMotion of [false,true]){
  const rule=['first','last','nth'][seed%3],config={...makeConfig(Array.from({length:n},(_,i)=>`검증 ${i+1}`).join('\n'),1,rule,Math.ceil(n/2)),mapId:map.id,boardMotion};
  const r=new Race(config,seed);r.start();let steps=0;
  try{
   while(!['complete','invalid'].includes(r.state)&&steps<12000){r.step();steps++;if(steps%12===0)for(const b of r.balls){assert.ok(Number.isFinite(b.x+b.y+b.vx+b.vy));assert.ok(b.x>=40-1e-5&&b.x<=580+1e-5&&b.y>=38-1e-5&&b.y<=r.map.finish+1e-5);}}
   assert.equal(r.state,'complete');assert.equal(r.finishOrder.length,n);assert.equal(new Set(r.finishOrder.map(x=>x.id)).size,n);assert.equal(r.winner.id,r.finishOrder[r.config.target-1].id);
   assert.ok(r.finishOrder.every((x,i)=>x.rank===i+1&&[1,2,3,4].includes(x.exitId)&&(!i||x.time>=r.finishOrder[i-1].time)));
  }catch(e){report.failure={map:map.id,n,seed,boardMotion,error:e.stack,snapshot:r.snapshot()};throw e;}
  report.cases.push({map:map.id,n,seed,boardMotion,rule,time:r.raceTime,assists:r.assists});
  if(report.cases.length%48===0){save();console.log(`PASS ${report.cases.length}/${report.target} races, seed ${seed}, wall ${report.elapsedSeconds.toFixed(1)}s`);}
 }
 report.status='PASS';console.log('PASS extended physics soak',report.cases.length,'races');
}catch(e){report.status='FAIL';process.exitCode=1;console.error(report.failure?.map,report.failure?.n,report.failure?.seed,report.failure?.boardMotion,e.message);}finally{save();}
