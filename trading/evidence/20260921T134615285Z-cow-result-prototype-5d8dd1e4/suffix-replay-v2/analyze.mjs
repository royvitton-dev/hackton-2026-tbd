import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const experiment = path.dirname(root);
const trading = path.dirname(path.dirname(experiment));
const output = path.join(experiment, 'output-02');
const read = p => fs.readFileSync(p);
const json = p => JSON.parse(read(p).toString('utf8').replace(/^\uFEFF/, ''));
const sha = p => crypto.createHash('sha256').update(read(p)).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag:'wx'});
const table = Array.from({length:256}, (_, n) => {for(let k=0;k<8;k++) n = n&1 ? 0xedb88320^(n>>>1) : n>>>1;return n>>>0;});
function crc(buffer) {let n=0xffffffff;for(const byte of buffer)n=table[(n^byte)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function frames(file, expectedMagic) {
  const buffer=read(file), rows=[];
  for(let offset=0;offset<buffer.length;) {
    assert.ok(buffer.length-offset>=32);
    const header=buffer.subarray(offset,offset+32), length=header.readUInt32LE(12);
    const payload=buffer.subarray(offset+32,offset+32+length);
    assert.equal(payload.length,length);
    assert.equal(header.toString('ascii',0,8),expectedMagic);
    assert.equal(header.readUInt16LE(8),1);assert.equal(header.readUInt16LE(10),0);
    assert.equal(crc(header.subarray(0,28)),header.readUInt32LE(28));
    assert.equal(crc(payload),header.readUInt32LE(24));
    rows.push({sequence:Number(header.readBigUInt64LE(16)),offset,payload_bytes:length,payload:JSON.parse(payload)});
    offset+=32+length;
  }
  return rows;
}
const summary=json(path.join(output,'summary.json'));
assert.equal(summary.verified,true);assert.equal(summary.command_seq,11);
const frozen=json(path.join(experiment,'delivery.json')).file_list.map(x=>({...x,actual_sha256:sha(path.join(experiment,x.file))}));
for(const file of frozen)assert.equal(file.actual_sha256,file.sha256,`frozen ${file.file}`);
const originalPlan=json(path.join(experiment,'plan.json'));
const production=originalPlan.source_hashes.map(x=>({...x,actual_sha256:sha(path.join(trading,x.path))}));
for(const file of production)assert.equal(file.actual_sha256,file.sha256,`production ${file.path}`);
const history=json(path.join(experiment,'fixtures/status_reuse_before_trace.json'));
const keys=new Set(history.map(x=>`${x.command.account_id}\0${x.command.request_id}`));assert.equal(keys.size,11);
const directories={};
for(const name of ['baseline-written','candidate-written']) {
  const dir=path.join(output,name), names=fs.readdirSync(dir), snapshots=names.filter(x=>x.startsWith('snapshot-'));
  assert.equal(snapshots.length,1);
  const snapshot=frames(path.join(dir,snapshots[0]),'LVSNAP01');assert.equal(snapshot.length,1);assert.equal(snapshot[0].sequence,4);
  const journal=frames(path.join(dir,'journal.bin'),'LVJRNL01');assert.equal(journal.length,13);
  for(let i=0;i<13;i++){assert.equal(journal[i].sequence,i+1);assert.deepEqual(journal[i].payload,history[i].command);}
  directories[name]={snapshot_sequence:4,snapshot_sha256:sha(path.join(dir,snapshots[0])),journal_sha256:sha(path.join(dir,'journal.bin')),journal_frames:journal.map(({payload,...metadata})=>metadata)};
}
assert.equal(directories['baseline-written'].journal_sha256,directories['candidate-written'].journal_sha256);
const coreFiles=['baseline-before-drop-full-core.json','candidate-before-drop-full-core.json','forward-recovered-full-core.json','backward-recovered-full-core.json'];
const coreHashes=coreFiles.map(file=>({file,sha256:sha(path.join(output,file)),bytes:read(path.join(output,file)).length}));
assert.equal(new Set(coreHashes.map(x=>x.sha256)).size,1);
assert.deepEqual(json(path.join(output,coreFiles[0])),history.at(-1).full_core);
for(const direction of ['forward','backward']) {
  const report=json(path.join(output,`${direction}-recovery-report.json`));
  assert.equal(report.replayed_records,9);assert.equal(report.journal_records,13);assert.equal(report.truncated_bytes,0);
}
const checks=json(path.join(output,'all-13-request-checks.json'));assert.equal(checks.length,13);
for(const check of checks){assert.deepEqual(check.forward_lookup,check.expected_lookup);assert.deepEqual(check.backward_lookup,check.expected_lookup);assert.deepEqual(check.forward_retry,check.expected_retry);assert.deepEqual(check.backward_retry,check.expected_retry);}
const result={analyzed_at:new Date().toISOString(),verified:true,classification:'Offline suffix replay evidence validation; not a performance measurement',frozen_run01_files:frozen,production_files_unchanged:production,trace_inputs:history.length,unique_request_keys:keys.size,forward_replayed_records:9,backward_replayed_records:9,directories,full_core_files:coreHashes,all13_lookup_and_retry_comparisons_equal:true,format:'Actual v1 CRC framed JSON, not bincode'};
write(path.join(root,'analysis.json'),result);
console.log(JSON.stringify({verified:true,trace_inputs:13,unique_request_keys:11,replayed_records_each_direction:9,full_core_sha256:coreHashes[0].sha256,frozen_run01_files_unchanged:frozen.length,production_paths_unchanged:production.length}));
