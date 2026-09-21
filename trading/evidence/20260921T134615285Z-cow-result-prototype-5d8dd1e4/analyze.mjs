import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const trading=path.resolve(root,'../..');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const plan=read(path.join(root,'plan.json'));
const summary=read(path.join(root,'output-01','summary.json'));
const rows=fs.readFileSync(path.join(root,'output-01','raw-counts-and-results.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const groups={};
for(const row of rows) {
  const group=groups[row.scope]??={commands:0,baseline_ops:0,candidate_ops:0,baseline_bytes:0,candidate_bytes:0,delta_histogram:{},codes:{},fills:0};
  const b=row.baseline_counts.allocations+row.baseline_counts.reallocations;
  const c=row.candidate_counts.allocations+row.candidate_counts.reallocations;
  group.commands++;group.baseline_ops+=b;group.candidate_ops+=c;group.baseline_bytes+=row.baseline_counts.requested_bytes;group.candidate_bytes+=row.candidate_counts.requested_bytes;
  group.delta_histogram[b-c]=(group.delta_histogram[b-c]??0)+1;
  group.codes[row.result.code]=(group.codes[row.result.code]??0)+1;
  group.fills+=row.result.trades.length;
  assert.equal(row.candidate_result_json_bytes_equal,true);
}
for(const [name,group] of Object.entries(groups)) {
  const recorded=summary.groups[name];
  assert.equal(group.commands,recorded.operations);
  assert.equal(group.baseline_ops,recorded.baseline.allocations+recorded.baseline.reallocations);
  assert.equal(group.candidate_ops,recorded.candidate.allocations+recorded.candidate.reallocations);
  assert.equal(group.baseline_bytes,recorded.baseline.requested_bytes);
  assert.equal(group.candidate_bytes,recorded.candidate.requested_bytes);
}
assert.deepEqual(groups.normal_new.delta_histogram,{'6':6000});
assert.deepEqual(groups.normal_new.codes,{OK:6000});assert.equal(groups.normal_new.fills,2000);
assert.deepEqual(groups.restored_owned_duplicate.delta_histogram,{'0':128});
assert.deepEqual(groups.restored_owned_lookup.delta_histogram,{'0':128});

const unchanged=plan.source_hashes.map(item=>({...item,after_sha256:sha(path.join(trading,item.path))}));
for(const item of unchanged) assert.equal(item.after_sha256,item.sha256,`Production byte change: ${item.path}`);
const files=[];
for(const directory of ['baseline','candidate','probe','fixtures']) {
  function visit(dir) { for(const item of fs.readdirSync(dir,{withFileTypes:true})) { const file=path.join(dir,item.name);if(item.isDirectory())visit(file);else files.push(file); } }
  visit(path.join(root,directory));
}
for(const name of ['Cargo.toml','Cargo.lock','production-Cargo.lock','plan.json','build-01.json','build-01.log','failed-build-01-model.rs','build-02.json','build-02.log','run-01.json','run-01.log','analyze.mjs','target/release/cow-result-probe.exe'])files.push(path.join(root,name));
function outputFiles(dir) { for(const item of fs.readdirSync(dir,{withFileTypes:true})) {const file=path.join(dir,item.name);if(item.isDirectory())outputFiles(file);else files.push(file);} }
outputFiles(path.join(root,'output-01'));
const hashes=files.map(file=>({file:path.relative(root,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:sha(file)}));
const fullB=hashes.find(row=>row.file==='output-01/baseline-full-core.json');
const fullC=hashes.find(row=>row.file==='output-01/candidate-full-core.json');assert.equal(fullB.sha256,fullC.sha256);
for(const file of ['storage.rs','lib.rs'])assert.equal(sha(path.join(root,'baseline/src',file)),sha(path.join(root,'candidate/src',file)));
const baselineModel=fs.readFileSync(path.join(root,'baseline/src/model.rs'),'utf8');
const resultStart=baselineModel.indexOf('pub struct CommandResult {');
let expectedModel='use std::borrow::Cow;\n'+baselineModel.slice(0,resultStart)+baselineModel.slice(resultStart).replace('pub status: String','pub status: Cow<\'static, str>').replace('pub code: String','pub code: Cow<\'static, str>').replace('pub message: String','pub message: Cow<\'static, str>');
assert.equal(fs.readFileSync(path.join(root,'candidate/src/model.rs'),'utf8'),expectedModel);
let expectedCore=fs.readFileSync(path.join(root,'baseline/src/core.rs'),'utf8');
for(const [from,to] of [
  ['status: "accepted".to_owned()','status: "accepted".into()'],['code: "OK".to_owned()','code: "OK".into()'],['message: "명령 처리가 완료되었습니다.".to_owned()','message: "명령 처리가 완료되었습니다.".into()'],
  ['fn rejection(&self, command: &Command, code: &str, message: &str)',"fn rejection(&self, command: &Command, code: &'static str, message: &'static str)"],
  ['status: "rejected".to_owned()','status: "rejected".into()'],['code: code.to_owned()','code: code.into()'],['message: message.to_owned()','message: message.into()']
]) {assert.ok(expectedCore.includes(from));expectedCore=expectedCore.replace(from,to);}
assert.equal(fs.readFileSync(path.join(root,'candidate/src/core.rs'),'utf8'),expectedCore);
function packages(file) {return fs.readFileSync(file,'utf8').split('[[package]]').slice(1).map(block=>({name:/^name = "(.+)"/m.exec(block)?.[1],version:/^version = "(.+)"/m.exec(block)?.[1]}));}
const originalPackages=packages(path.join(root,'production-Cargo.lock'));
const prototypePackages=packages(path.join(root,'Cargo.lock')).filter(item=>!item.name.startsWith('cow-result-'));
for(const item of prototypePackages)assert.ok(originalPackages.some(old=>old.name===item.name&&old.version===item.version),`Changed dependency ${item.name}@${item.version}`);
const finding={recorded_at:new Date().toISOString(),raw_rows:rows.length,raw_recalculation_matches:true,groups,
  normal_allocation_reduction_percent:100*(groups.normal_new.baseline_ops-groups.normal_new.candidate_ops)/groups.normal_new.baseline_ops,
  normal_bytes_reduction:groups.normal_new.baseline_bytes-groups.normal_new.candidate_bytes,normal_bytes_reduction_per_command:(groups.normal_new.baseline_bytes-groups.normal_new.candidate_bytes)/6000,
  full_core_sha256:fullB.sha256,full_core_bytes:fullB.bytes,all_production_source_binary_and_manifest_hashes_unchanged:true,production_hashes:unchanged,
  only_proposed_source_changes:true,dependency_versions_match_production_lock:true,prototype_dependency_packages:prototypePackages,
  wire_format:'JSON and v1 CRC-framed JSON; production has no bincode dependency',no_latency_or_tps_claim:true,zero_allocation:false};
fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify(finding,null,2),{flag:'wx'});
fs.writeFileSync(path.join(root,'sha256.json'),JSON.stringify({algorithm:'SHA-256',files:hashes},null,2),{flag:'wx'});
console.log(JSON.stringify({raw_rows:rows.length,normal_delta:groups.normal_new.delta_histogram,normal_reduction_percent:finding.normal_allocation_reduction_percent,full_core_sha256:fullB.sha256,full_core_bytes:fullB.bytes,production_unchanged:true},null,2));
