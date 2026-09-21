// Prepared only. Do not run before the coordinated post-observation quiet window.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const preparation = path.dirname(fileURLToPath(import.meta.url));
const trading = path.dirname(path.dirname(preparation));
const readJson = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value,null,2)+'\n', {flag:'wx'});
const args=process.argv.slice(2), options={};
for(let i=0;i<args.length;i++) {
  if(args[i]==='--quiet-window') options.quiet=true;
  else if(['--launcher-owner-pid','--launcher-token','--additional-absent-pids','--quiet-note'].includes(args[i])) {
    assert.ok(args[i+1] && !args[i+1].startsWith('--'),`Missing ${args[i]} value`);
    assert.equal(options[args[i]],undefined,`Repeated ${args[i]}`);options[args[i]]=args[++i];
  } else throw new Error(`Unknown argument ${args[i]}`);
}
assert.equal(options.quiet,true,'Explicit --quiet-window is required');
assert.ok(Number.isSafeInteger(Number(options['--launcher-owner-pid'])) && Number(options['--launcher-owner-pid'])>0,'Expected live launcher owner PID is required');
assert.ok(options['--launcher-token'],'Expected launcher ownership token is required');
assert.ok(options['--quiet-note']?.trim(),'Record completed observation/stop/aged recovery and no competing build/test/preview work in --quiet-note');
const absent=(options['--additional-absent-pids']||'').split(',').filter(Boolean).map(Number);
assert.ok(absent.length>0 && absent.every(pid=>Number.isSafeInteger(pid)&&pid>0),'Supply the observer/helper PIDs explicitly');
const plan=readJson(path.join(preparation,'plan.json'));
assert.ok(Date.now()>=Date.parse(plan.not_before_utc),'Refusing execution before the planned post-observation window');
assert.deepEqual(plan.pair_order,['B','A','A','B','B','A']);
const manifestFile=path.join(trading,'data','demo-current.json');
const lockFile=path.join(trading,'data','demo-launcher.lock');
function alive(pid) {try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}}
function quietGuard() {
  const owner=readJson(lockFile);
  assert.equal(owner.pid,Number(options['--launcher-owner-pid']),'Launcher owner changed');
  assert.equal(owner.token,options['--launcher-token'],'Launcher token changed');
  assert.equal(alive(owner.pid),true,'Launcher owner is no longer alive');
  const manifest=readJson(manifestFile);
  assert.ok(Array.isArray(manifest.processes) && manifest.processes.length===14,'Require complete recorded 14-process demo manifest');
  assert.equal(new Set(manifest.processes.map(row=>row?.pid)).size,14,'Duplicate recorded PID');
  const names=new Set();
  for(const row of manifest.processes) {
    assert.ok(row && Number.isSafeInteger(row.pid) && row.pid>0 && typeof row.name==='string','Invalid recorded process');
    assert.ok(!names.has(row.name),'Duplicate recorded name');names.add(row.name);
    assert.equal(alive(row.pid),false,`Recorded demo ${row.name} PID ${row.pid} still exists; no service was stopped`);
  }
  assert.ok(names.has('engine')&&names.has('frontend'));
  for(let i=1;i<=12;i++)assert.ok(names.has(`bot-${String(i).padStart(2,'0')}`));
  for(const pid of absent)assert.equal(alive(pid),false,`Additional PID ${pid} still exists`);
  return {checked_at:new Date().toISOString(),manifest_sha256:sha(manifestFile),launcher_owner_pid:owner.pid,launcher_token:owner.token,recorded_pids:manifest.processes.map(x=>({name:x.name,pid:x.pid})),additional_absent_pids:absent};
}
function inventory() {
  const source="$ErrorActionPreference='Stop'; @(Get-Process | Select-Object Id,ProcessName,@{n='CPUSeconds';e={$_.TotalProcessorTime.TotalSeconds}},WorkingSet64,PrivateMemorySize64) | ConvertTo-Json -Compress -Depth 3";
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',source],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:4*1024*1024});
  if(result.error||result.status!==0)throw new Error(`Process inventory failed: ${result.error?.message||result.stderr}`);
  return {sampled_at:new Date().toISOString(),scope:'Point-in-time process inventory; CPUSeconds is cumulative, not utilization',processes:JSON.parse(result.stdout.replace(/^\uFEFF/,''))};
}
function verifyPinnedFiles() {
  for(const file of plan.pinned_files)assert.equal(sha(path.join(preparation,file.file)),file.sha256,`Pinned file changed: ${file.file}`);
}
const initialGuard=quietGuard();verifyPinnedFiles();
const runDirectory=path.join(trading,'evidence',`${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}-cow-paired-a-${crypto.randomUUID().slice(0,8)}`);
fs.mkdirSync(runDirectory);
write(path.join(runDirectory,'metadata.json'),{started_at:new Date().toISOString(),preparation,preparation_plan_sha256:sha(path.join(preparation,'plan.json')),runner_sha256:sha(fileURLToPath(import.meta.url)),plan,quiet_note:options['--quiet-note'],initial_guard:initialGuard,node:process.version,os:os.version(),release:os.release(),arch:os.arch(),cpus:os.cpus().map(x=>({model:x.model,speed:x.speed})),operator_scope:'Coordinated quiet window, not proof that every OS/desktop process is idle',no_live_service_controls:true});

async function runOne(label, ordinal) {
  const binary=path.join(preparation,plan.binaries[label].file);
  const prefix=`${String(ordinal).padStart(2,'0')}-${label}`;
  const guardBefore=quietGuard();verifyPinnedFiles();
  const binaryHashBefore=sha(binary);
  const startedAt=new Date().toISOString();
  const commandArgs=['--cycles','20000','--warmup-cycles','1000'];
  const child=spawn(binary,commandArgs,{cwd:trading,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',spawnError=null,timedOut=false,forced=false,overflow=false,exitCode=null,exitSignal=null,exitSeen=false,closeSeen=false;
  let finish;
  const closed=new Promise(resolve=>{finish=resolve;});
  const capture=(chunk,isError)=>{const value=chunk.toString('utf8');if(stdout.length+stderr.length+value.length>2*1024*1024){overflow=true;forced=true;child.kill('SIGKILL');return;}if(isError)stderr+=value;else stdout+=value;};
  child.stdout.on('data',chunk=>capture(chunk,false));child.stderr.on('data',chunk=>capture(chunk,true));
  child.on('error',error=>{spawnError=error.message;});
  child.on('exit',(code,signal)=>{exitSeen=true;exitCode=code;exitSignal=signal;});
  child.on('close',(code,signal)=>{closeSeen=true;exitCode=code;exitSignal=signal;finish();});
  let timeoutTimer,cleanupTimer;
  const watchdog=new Promise(resolve=>{timeoutTimer=setTimeout(()=>{timedOut=true;forced=true;child.kill('SIGKILL');cleanupTimer=setTimeout(resolve,5000);},30000);});
  await Promise.race([closed,watchdog]);clearTimeout(timeoutTimer);clearTimeout(cleanupTimer);
  const endedAt=new Date().toISOString();
  let guardAfter=null,guardFailure=null;
  try{guardAfter=quietGuard();verifyPinnedFiles();}catch(error){guardFailure=error.message;}
  fs.writeFileSync(path.join(runDirectory,`${prefix}-stdout.json`),stdout,{flag:'wx'});
  fs.writeFileSync(path.join(runDirectory,`${prefix}-stderr.log`),stderr,{flag:'wx'});
  const record={ordinal,pair:Math.ceil(ordinal/2),label,command:binary,args:commandArgs,binary_sha256_verified_before:binaryHashBefore,pid:child.pid??null,started_at:startedAt,ended_at:endedAt,exit_code:exitCode,exit_signal:exitSignal,exit_seen:exitSeen,close_seen:closeSeen,spawn_error:spawnError,timed_out:timedOut,forced_exit:forced,output_overflow:overflow,guard_before:guardBefore,guard_after:guardAfter,guard_failure:guardFailure};
  write(path.join(runDirectory,`${prefix}-run.json`),record);
  assert.ok(exitSeen&&closeSeen&&exitCode===0&&!exitSignal&&!spawnError&&!timedOut&&!forced&&!overflow&&!guardFailure,'Run failed; raw output and exit data preserved, no retry');
  assert.equal(stderr,'','Unexpected stderr retained; stop for inspection');
  const result=JSON.parse(stdout);
  assert.equal(result.benchmark,'A_pure_core');assert.equal(result.commands,120000);assert.equal(result.warmup_commands,6000);assert.equal(result.cycles,20000);
  assert.equal(result.seed,20260921);assert.equal(result.concurrency,1);assert.equal(result.queue,null);assert.equal(result.journal,'none');assert.equal(result.includes_queue_wait,false);
  assert.equal(result.rejected_commands,0);assert.equal(result.fills,40000);assert.equal(result.durability_or_network_measured,false);
  assert.equal(result.predeclared_target.commands_per_second_min,20000);assert.equal(result.predeclared_target.p99_ns_max,250000);
  assert.ok(Number.isFinite(result.commands_per_second)&&result.commands_per_second>0);
  for(const key of ['p50','p95','p99','max'])assert.ok(Number.isFinite(result.latency_ns[key])&&result.latency_ns[key]>=0);
  for(const key of ['allocation_calls','reallocation_calls','allocation_requested_bytes'])assert.ok(Number.isSafeInteger(result[key])&&result[key]>=0);
  for(const memory of [result.process_memory_before,result.process_memory_after]) {
    assert.equal(memory.available,true,'Resource values unavailable; retain run as incomplete');
    for(const key of ['working_set_bytes','peak_working_set_bytes','private_commit_bytes','peak_private_commit_bytes'])assert.ok(Number.isFinite(memory[key])&&memory[key]>=0);
  }
  assert.equal(result.allocation_calls_per_command.mean,(result.allocation_calls+result.reallocation_calls)/120000);
  write(path.join(runDirectory,`${prefix}-verification.json`),{verified:true,exit0_assertion_scope:'Binary performs warmup and final complete Core invariants, zero rejections, exactly two fills per measured cycle',predeclared_target_met:result.predeclared_target.met,zero_allocation:result.zero_allocation,full_core_json_exported:false,per_command_raw_arrays_exported:false});
  return {record,result};
}
const runs=[];let failure=null;
try {
  write(path.join(runDirectory,'processes-before.json'),inventory());
  for(let i=0;i<plan.pair_order.length;i++)runs.push(await runOne(plan.pair_order[i],i+1));
} catch(error){failure={message:error.message,stack:error.stack};}
finally {
  try{write(path.join(runDirectory,'processes-after.json'),inventory());}catch(error){failure??={message:error.message};}
  try{write(path.join(runDirectory,'final-guard.json'),quietGuard());verifyPinnedFiles();}catch(error){failure??={message:error.message};}
  write(path.join(runDirectory,'completion.json'),{ended_at:new Date().toISOString(),complete:!failure&&runs.length===6,completed_runs:runs.length,failure,launcher_lock_released_by_runner:false,live_services_controlled:false});
}
if(failure){console.error(JSON.stringify({run_directory:runDirectory,failure}));process.exitCode=1;}
else {
  const pairs=[];
  for(let i=0;i<6;i+=2){const pair=runs.slice(i,i+2),b=pair.find(x=>x.record.label==='B').result,a=pair.find(x=>x.record.label==='A').result;pairs.push({pair:i/2+1,order:plan.pair_order.slice(i,i+2),baseline:b,candidate:a,allocation_calls_delta:(a.allocation_calls+a.reallocation_calls)-(b.allocation_calls+b.reallocation_calls),requested_bytes_delta:a.allocation_requested_bytes-b.allocation_requested_bytes,throughput_ratio:a.commands_per_second/b.commands_per_second,p99_ns_delta:a.latency_ns.p99-b.latency_ns.p99,peak_working_set_delta:a.process_memory_after.peak_working_set_bytes-b.process_memory_after.peak_working_set_bytes});}
  write(path.join(runDirectory,'comparison.json'),{classification:'Three fixed-order paired measurements with existing instrumented core benchmark; retain each raw stdout and do not infer service TPS',pairs,all_targets_met:runs.every(x=>x.result.predeclared_target.met),all_runs_zero_allocation:runs.every(x=>x.result.zero_allocation)});
  console.log(JSON.stringify({run_directory:runDirectory,complete:true}));
}
