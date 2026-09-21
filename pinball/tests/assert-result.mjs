import assert from 'node:assert/strict';
export function assertGameResult(s){
 assert.equal(s.state,'complete');
 const last=s.winner?.criterion==='last-remaining',expected=last?s.total-1:s.target;
 assert.equal(s.finishOrder.length,expected);assert.equal(new Set(s.finishOrder.map(r=>r.id)).size,expected);
 assert.ok(s.finishOrder.every((r,i)=>r.rank===i+1&&[1,2,3,4].includes(r.exitId)&&(!i||r.time>=s.finishOrder[i-1].time)));
 if(last){
  assert.equal(s.completionReason,'last-remaining');assert.equal(s.winner.crossedFinish,false);assert.equal(s.winner.exitId,null);
  const remaining=s.balls.filter(b=>!b.finished);assert.equal(remaining.length,1);assert.equal(s.winner.id,remaining[0].id);assert.equal(remaining[0].rank,null);
  assert.ok(!s.finishOrder.some(r=>r.id===s.winner.id));
 }else{assert.equal(s.completionReason,'target-arrived');assert.equal(s.winner.crossedFinish,true);assert.equal(s.winner.id,s.finishOrder[s.target-1].id);}
}
