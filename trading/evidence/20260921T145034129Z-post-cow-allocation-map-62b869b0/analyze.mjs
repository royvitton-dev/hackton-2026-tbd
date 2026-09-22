import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(path.dirname(directory));
const prototype='evidence/20260921T134615285Z-cow-result-prototype-5d8dd1e4';
const rawFile=`${prototype}/output-01/raw-counts-and-results.jsonl`;
const raw=fs.readFileSync(path.join(root,rawFile));
const rows=raw.toString('utf8').trim().split(/\r?\n/).map((line,index)=>({...JSON.parse(line),raw_line:index+1}));
const summary=JSON.parse(fs.readFileSync(path.join(root,prototype,'output-01/summary.json')));
const operations=counts=>counts.allocations+counts.reallocations;
function aggregate(selected){
  assert.ok(selected.length>0);const values=selected.map(row=>operations(row.candidate_counts)).sort((a,b)=>a-b),histogram={};
  for(const n of values)histogram[n]=(histogram[n]||0)+1;
  return {rows:selected.length,allocations:selected.reduce((n,row)=>n+row.candidate_counts.allocations,0),reallocations:selected.reduce((n,row)=>n+row.candidate_counts.reallocations,0),requested_bytes:selected.reduce((n,row)=>n+row.candidate_counts.requested_bytes,0),allocation_calls_mean:values.reduce((a,b)=>a+b,0)/values.length,min:values[0],max:values.at(-1),histogram,trade_count_values:[...new Set(selected.map(row=>row.result?.trades?.length))],first_raw_line:selected[0].raw_line,last_raw_line:selected.at(-1).raw_line};
}
const groups=Object.fromEntries([...new Set(rows.map(row=>row.scope))].map(scope=>[scope,aggregate(rows.filter(row=>row.scope===scope))]));
for(const [name,group]of Object.entries(groups)){
  assert.equal(group.rows,summary.groups[name].operations);
  for(const key of ['allocations','reallocations','requested_bytes'])assert.equal(group[key],summary.groups[name].candidate[key]);
}
const normal=rows.filter(row=>row.scope==='normal_new');assert.equal(normal.length,6000);
const names=['maker sell1000x4','maker sell1005x2','buy1010x5 / two fills','cancel partial second maker','resting buy900x3','cancel resting buy'];
const steps=names.map((name,step)=>({step,name,...aggregate(normal.filter(row=>Number(row.result.request_id.split('-').at(-1))===step))}));
for(const group of steps)assert.equal(group.rows,1000);
for(const row of normal)assert.equal(operations(row.baseline_counts)-operations(row.candidate_counts),6);
assert.equal(groups.normal_new.allocation_calls_mean,8.331333333333333);assert.equal(groups.normal_new.min,4);assert.equal(groups.normal_new.max,23);
const sources=['engine/src/core.rs','engine/src/model.rs','engine/src/storage.rs','engine/src/main.rs','engine/examples/core_bench.rs','engine/Cargo.toml','engine/Cargo.lock','engine/target/release/leave-engine.exe','engine/target/release/examples/core_bench.exe',rawFile,`${prototype}/output-01/summary.json`,`${prototype}/probe/src/main.rs`,`${prototype}/candidate/src/core.rs`,`${prototype}/candidate/src/model.rs`,`${prototype}/suffix-replay-v2/README.md`].map(file=>{const bytes=fs.readFileSync(path.join(root,file));return{file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};});
const result={created_at:new Date().toISOString(),classification:'Read-only source investigation and offline aggregation of existing run-01; no new engine execution or allocation measurement',source_provenance:sources,raw_rows:rows.length,normal:groups.normal_new,normal_by_cycle_step:steps,groups,normal_every_row_saved_exactly_six_calls:true,reallocation_rows:normal.filter(row=>row.candidate_counts.reallocations).map(row=>({line:row.raw_line,request_id:row.result.request_id,candidate_counts:row.candidate_counts})),maximum_examples:normal.filter(row=>operations(row.candidate_counts)===23).slice(0,6).map(row=>({line:row.raw_line,request_id:row.result.request_id,candidate_counts:row.candidate_counts})),callsite_attribution_measured:false,full_core_clone_groups:'Only summary totals in original experiment; not part of execute rows',benchmarks_run:0,builds_run:0,production_edits:0};
fs.writeFileSync(path.join(directory,'analysis.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({raw_rows:rows.length,normal:groups.normal_new,steps,other_groups:Object.fromEntries(Object.entries(groups).filter(([name])=>name!=='normal_new').map(([name,g])=>[name,{rows:g.rows,mean:g.allocation_calls_mean,min:g.min,max:g.max,trade_count_values:g.trade_count_values}])),reallocation_rows:result.reallocation_rows}));
