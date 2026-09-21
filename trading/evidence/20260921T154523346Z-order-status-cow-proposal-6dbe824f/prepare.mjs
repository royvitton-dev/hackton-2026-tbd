import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Offline proposal generation only. Never writes source/target or invokes tools.
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const inputs = new Map();
const read = p => { const bytes=fs.readFileSync(path.join(root,p)); inputs.set(p,{path:p,sha256:sha(bytes),bytes:bytes.length}); return bytes; };
const assert = (value,message) => { if(!value) throw new Error(message); };
const expected = {
  'engine/src/core.rs':'714ba49e06155b3e245ded4db5a089930b348bea0348a3e490fbd6ac4cd8e8fa',
  'engine/src/model.rs':'b3b042ba9dbc2b0fda95eccccbe29301c7016d143889ef7dedbfc0d1271a88d7',
  'engine/target/release/leave-engine.exe':'65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512',
  'engine/target/release/examples/core_bench.exe':'7cfd820a78d0f2ce1cac442f5da941e817e23e880e8cf0653a76c7c037df1a86',
  'engine/target/debug/examples/aged_recovery.exe':'d2c8dd9ed9315d6859be5350f5b2e8c909594735d6000a4c7a0c30966ad14d43',
};
for(const [p,h] of Object.entries(expected)) assert(sha(read(p))===h,`Pinned input changed: ${p}`);
const changes = [
  {file:'engine/src/model.rs', edits:[['    pub status: String,',"    pub status: Cow<'static, str>,"]]},
  {file:'engine/src/core.rs', edits:[
    ['        // Reuse this buffer through open/partial/filled/cancelled transitions.\n        // Restored legacy strings may be smaller; push_str grows them if needed.\n        let mut status = String::with_capacity("partially_filled".len());\n        status.push_str(order_status(quantity - remaining, remaining));',
     '        // Fresh and transitioned statuses borrow fixed strings. Legacy JSON\n        // strings remain owned until a successful transition replaces them.\n        let status = order_status(quantity - remaining, remaining).into();'],
    ['            maker.status.clear();\n            maker\n                .status\n                .push_str(order_status(maker.filled, maker.remaining));',
     '            maker.status = order_status(maker.filled, maker.remaining).into();'],
    ['        order.status.clear();\n        order.status.push_str("cancelled");',
     '        order.status = "cancelled".into();'],
  ]},
  {file:'engine/tests/core_rules.rs', edits:[['            order.status.as_str()', '            order.status.as_ref()']]},
];
let patch='';
const candidates=[];
for(const {file,edits} of changes){
  const original=read(file).toString();
  assert(!original.includes('\r'),'Generator expects LF source');
  const lines=original.split('\n');
  const replacements=edits.map(([before,after])=>{
    assert(original.split(before).length===2,`Preimage must be unique: ${file}`);
    const index=original.slice(0,original.indexOf(before)).split('\n').length-1;
    return {index,old:before.split('\n'),replacement:after.split('\n')};
  }).sort((a,b)=>a.index-b.index);
  let candidate=original;
  for(const [before,after] of edits) candidate=candidate.replace(before,after);
  patch+=`diff --git a/trading/${file} b/trading/${file}\n--- a/trading/${file}\n+++ b/trading/${file}\n`;
  let delta=0, previousEnd=-1;
  for(const r of replacements){
    const start=Math.max(0,r.index-3),end=Math.min(lines.length-1,r.index+r.old.length+3);
    assert(start>=previousEnd,'Overlapping hunks');
    const pre=lines.slice(start,r.index),post=lines.slice(r.index+r.old.length,end);
    patch+=`@@ -${start+1},${pre.length+r.old.length+post.length} +${start+1+delta},${pre.length+r.replacement.length+post.length} @@\n`;
    patch+=[...pre.map(s=>' '+s),...r.old.map(s=>'-'+s),...r.replacement.map(s=>'+'+s),...post.map(s=>' '+s)].join('\n')+'\n';
    delta+=r.replacement.length-r.old.length; previousEnd=end;
  }
  candidates.push({file,before_sha256:sha(original),candidate_sha256:sha(candidate),original,candidate});
}
// Independently parse the generated unified hunks and apply only in memory.
const sections=patch.split('diff --git ').slice(1);
for(let index=0;index<sections.length;index++){
  const c=candidates[index], source=c.original.split('\n'), target=[];
  const rows=sections[index].split('\n');
  let cursor=0;
  for(let i=3;i<rows.length;i++){
    if(!rows[i]) continue;
    const m=/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(rows[i]);
    assert(m,'Invalid hunk header');
    const at=Number(m[1])-1;
    target.push(...source.slice(cursor,at));cursor=at;
    let oldCount=0,newCount=0;
    while(i+1<rows.length && rows[i+1] && !rows[i+1].startsWith('@@ ')){
      const row=rows[++i], marker=row[0], content=row.slice(1);
      assert([' ','-','+'].includes(marker),'Invalid hunk line');
      if(marker!=='+' ){assert(source[cursor]===content,`Hunk context mismatch: ${c.file}`);cursor++;oldCount++;}
      if(marker!=='-'){target.push(content);newCount++;}
    }
    assert(oldCount===Number(m[2]) && newCount===Number(m[4]),'Hunk counts differ');
  }
  target.push(...source.slice(cursor));
  assert(target.join('\n')===c.candidate,'In-memory patch result differs');
}
const rawPath='evidence/20260921T134615285Z-cow-result-prototype-5d8dd1e4/output-01/raw-counts-and-results.jsonl';
const raw=read(rawPath).toString().trim().split('\n').map(JSON.parse);
const normal=raw.filter(r=>r.scope==='normal_new');
const normalSteps=Array.from({length:6},(_,step)=>{
  const rows=normal.filter(r=>Number(r.result.request_id.split('-').at(-1))===step);
  return {step,rows:rows.length,observed_calls:rows.reduce((s,r)=>s+r.candidate_counts.allocations+r.candidate_counts.reallocations,0),has_new_order_status_path:[0,1,2,4].includes(step)};
});
read('engine/tests/core_status_compatibility.rs');read('engine/src/storage.rs');read('engine/Cargo.lock');
for(const p of ['engine/tests/fixtures/status_reuse_before_trace.json','engine/tests/fixtures/status_reuse_legacy_frames.json']) read(p);
for(const h of inputs.values()) assert(sha(fs.readFileSync(path.join(root,h.path)))===h.sha256,`Input changed during preparation: ${h.path}`);
fs.writeFileSync(path.join(out,'proposal.patch'),patch,{flag:'wx'});
fs.writeFileSync(path.join(out,'analysis.json'),JSON.stringify({created_at:new Date().toISOString(),scope:'Prepared proposal only; no source application, compiler, benchmark, API or service operation',patch_sha256:sha(patch),patch_hunks:changes.reduce((s,c)=>s+c.edits.length,0),patch_files:candidates.map(({file,before_sha256,candidate_sha256})=>({file,before_sha256,candidate_sha256})),in_memory_unified_patch_reconstruction:true,compiled:false,measured:false,raw_normal_rows:normal.length,normal_steps:normalSteps,static_hypothesis:{new_order_status_creation_sites:normalSteps.filter(s=>s.has_new_order_status_path).reduce((s,r)=>s+r.rows,0),meaning:'Source-derived affected events, NOT measured allocations saved; no aggregate candidate performance reported'},inputs:[...inputs.values()],all_inputs_unchanged:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ok:true,patch_files:candidates.length,hunks:5,in_memory_reconstruction:true,normal_steps:normalSteps,production_changes:0,compiled:false,measured:false}));
