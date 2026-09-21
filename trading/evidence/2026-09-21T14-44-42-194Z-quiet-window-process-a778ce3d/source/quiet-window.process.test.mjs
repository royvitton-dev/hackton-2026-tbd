import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { monitorBenchmarkChild, settleBenchmarkChild } from './network-bench-lifecycle.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-quiet-window-process-${crypto.randomUUID().slice(0,8)}`;
const runDir=path.join(root,'evidence',runId);fs.mkdirSync(runDir);
const expectedSources={'quiet-window.mjs':'c54498a51f66a18e9cefd3077e79539eb1e9a770a296a452111a8d206f185d73','demo-lifecycle.mjs':'d537c5e69f1edf3180042c5629e84a941e6b8a4bb174d4766b9801c65c2a2ba8'};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const save=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const records=[];let failed=false;
const pidState=pid=>{try{process.kill(pid,0);return {pid,alive:true};}catch(error){if(error.code!=='ESRCH')throw error;return {pid,alive:false,inspection_error_code:error.code};}};
function protectedState(){
  const bytes=fs.readFileSync(path.join(root,'data','demo-current.json')),manifest=JSON.parse(bytes),pids=[...manifest.processes.map(x=>x.pid),18184,15744,16840,19312];
  assert.equal(manifest.processes.length,14);assert.equal(new Set(pids).size,18);
  const processes=pids.map(pidState);assert.ok(processes.every(x=>x.alive),'Protected process absent; no keeper fixture launched');
  return {manifest_sha256:sha(bytes),processes,scope:'PID existence and unchanged manifest; not start-time/PID-reuse evidence'};
}
function absentPidFixture(){
  const inspected=[],selected=[];
  for(let candidate=700001;candidate<701001&&selected.length<17;candidate++){
    if(candidate===process.pid)continue;const state=pidState(candidate);inspected.push(state);if(!state.alive)selected.push(candidate);
  }
  assert.equal(selected.length,17,'Could not establish seventeen absent positive PIDs');
  assert.equal(new Set(selected).size,17);assert.ok(selected.every(x=>Number.isSafeInteger(x)&&x>0));
  return {selected,inspected};
}
async function within(promise,timeout,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),timeout);})]);}finally{clearTimeout(timer);}}

async function runCase(name,expectedExit,wrongToken){
  const caseRoot=path.join(runDir,name);fs.mkdirSync(caseRoot);const fixture=path.join(caseRoot,'fixture');
  const report={name,started_at:new Date().toISOString(),expected_exit_code:expectedExit,fixture_root:fixture,source_hashes:{},signals_to_existing_processes:'Only signal0 existence checks; no termination or control signals'};records.push(report);
  let monitor,stdout='',stderr='',failure;
  try{
    report.protected_before=protectedState();
    fs.mkdirSync(path.join(fixture,'scripts'),{recursive:true});fs.mkdirSync(path.join(fixture,'data','demo'),{recursive:true});fs.mkdirSync(path.join(fixture,'evidence'));
    for(const [file,expected]of Object.entries(expectedSources)){
      const bytes=fs.readFileSync(path.join(root,'scripts',file));assert.equal(sha(bytes),expected,`Source changed: ${file}`);
      fs.writeFileSync(path.join(fixture,'scripts',file),bytes,{flag:'wx'});report.source_hashes[file]=sha(bytes);
    }
    const absent=absentPidFixture();report.fake_pid_inspections=absent.inspected;
    const roles=['engine','frontend',...Array.from({length:12},(_,i)=>`bot-${String(i+1).padStart(2,'0')}`)];
    const manifest={run_id:'isolated-process-fixture',stopped_at:'2026-09-21T00:00:00.000Z',data_dir:path.join(fixture,'data','demo'),processes:roles.map((name,i)=>({name,pid:absent.selected[i]}))};
    const manifestFile=path.join(fixture,'data','demo-current.json'),lockFile=path.join(fixture,'data','demo-launcher.lock');save(manifestFile,manifest);
    report.manifest_sha256=sha(fs.readFileSync(manifestFile));report.additional_absent_pids=absent.selected.slice(14);
    const command=path.join(fixture,'scripts','quiet-window.mjs');
    const args=[command,'--manifest-sha256',report.manifest_sha256,'--absent-pids',report.additional_absent_pids.join(','),'--not-before','2026-09-21T00:00:00.000Z'];
    report.command=process.execPath;report.args=args;
    const child=spawn(process.execPath,args,{cwd:fixture,windowsHide:true,stdio:['ignore','pipe','pipe']});
    monitor=monitorBenchmarkChild(child,`keeper-${name}`,event=>fs.appendFileSync(path.join(caseRoot,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n'));
    report.owned_pid=child.pid;child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',value=>{stdout+=value;});child.stderr.on('data',value=>{stderr+=value;});
    const deadline=Date.now()+7000;let ready;
    while(Date.now()<deadline){monitor.assertAlive();ready=stdout.split(/\r?\n/).flatMap(line=>{try{return[JSON.parse(line)];}catch{return[];}}).find(value=>value.status==='ready');if(ready)break;await sleep(20);}
    assert.ok(ready,'Keeper did not publish READY');assert.equal(ready.pid,child.pid);assert.equal(pidState(child.pid).alive,true);
    const evidenceRoot=fs.realpathSync(path.join(fixture,'evidence'));
    assert.ok(fs.realpathSync(ready.directory).startsWith(evidenceRoot+path.sep));assert.equal(path.resolve(ready.lock_file),path.resolve(lockFile));
    const persisted=readJson(path.join(ready.directory,'ready.json'));
    assert.equal(persisted.pid,child.pid);assert.equal(persisted.token,ready.token);assert.equal(persisted.release_token,ready.release_token);assert.equal(fs.existsSync(path.join(ready.directory,'ready.pending.json')),false);
    const ownerBefore=fs.readFileSync(lockFile);assert.equal(JSON.parse(ownerBefore).pid,child.pid);assert.equal(JSON.parse(ownerBefore).token,ready.token);
    report.ready=ready;report.lock_sha256_at_ready=sha(ownerBefore);report.guard_pids_at_ready=ready.absent_pids.map(pidState);assert.ok(report.guard_pids_at_ready.every(x=>!x.alive));
    const proof=path.join(ready.directory,'fixture-diagnostics-completed.json');save(proof,{synthetic_fixture:true,no_diagnostic_processes_launched:true,at:new Date().toISOString()});
    const request={run_id:ready.run_id,pid:child.pid,release_token:wrongToken?`${ready.release_token}-incorrect`:ready.release_token,confirmed_no_running_diagnostics:true,evidence:[proof]};
    const pending=path.join(ready.directory,'release.pending'),published=path.join(ready.directory,'release.request');
    assert.equal(fs.existsSync(published),false);save(pending,request);report.release_pending_sha256=sha(fs.readFileSync(pending));
    fs.renameSync(pending,published);report.release_published_at=new Date().toISOString();report.release_request=request;
    assert.equal(fs.existsSync(pending),false);assert.equal(sha(fs.readFileSync(published)),report.release_pending_sha256);
    await within(monitor.closed,7000,'Keeper did not exit after release request');
    assert.equal(monitor.state.exit_code,expectedExit);assert.equal(monitor.closeState.close_code,expectedExit);assert.equal(monitor.state.exit_signal,null);assert.equal(monitor.closeState.close_signal,null);assert.equal(monitor.state.spawn_error,null);assert.equal(pidState(child.pid).alive,false);
    report.exit={...monitor.state,...monitor.closeState};report.owned_pid_absent=true;
    if(wrongToken){
      assert.deepEqual(fs.readFileSync(lockFile),ownerBefore);report.lock_sha256_after_exit=sha(fs.readFileSync(lockFile));
      const aborted=readJson(path.join(ready.directory,'aborted.json'));assert.equal(aborted.automatic_release_performed,false);assert.equal(aborted.lock_status.original_owner_matches,true);assert.match(aborted.error,/Wrong release token/);
      assert.equal(fs.existsSync(path.join(ready.directory,'released.json')),false);assert.equal(fs.existsSync(path.join(ready.directory,'release-intent.json')),false);assert.match(stderr,/Wrong release token/);
      report.aborted=aborted;report.lock_preserved_after_exit=true;
    }else{
      assert.equal(fs.existsSync(lockFile),false);assert.equal(stderr,'');const released=readJson(path.join(ready.directory,'released.json')),intent=readJson(path.join(ready.directory,'release-intent.json'));
      assert.equal(released.original_owner_released,true);assert.equal(released.current_lock_present,false);assert.deepEqual(released.request,request);assert.equal(intent.original_owner.token,ready.token);assert.deepEqual(intent.request,request);
      assert.ok(stdout.split(/\r?\n/).some(line=>{try{return JSON.parse(line).status==='released';}catch{return false;}}));report.released=released;report.original_owner_lock_removed=true;
    }
    assert.equal(sha(fs.readFileSync(manifestFile)),report.manifest_sha256);report.complete=true;
  }catch(error){failure=error;failed=true;report.failure={message:error.message,stack:error.stack};report.complete=false;}
  finally{
    if(monitor&&!monitor.closeState.closed){try{report.forced_cleanup=await settleBenchmarkChild(monitor,{graceMs:0,forceMs:5000});if(!monitor.closeState.closed)throw new Error('Owned keeper close not confirmed');}catch(error){report.cleanup_error=error.message;failure??=error;report.complete=false;failed=true;}}
    if(monitor){report.final_owned_pid_state=pidState(monitor.state.pid);if(report.final_owned_pid_state.alive){failure??=new Error('Owned keeper still exists');report.complete=false;failed=true;}}
    try{report.protected_after=protectedState();if(report.protected_before)assert.deepEqual(report.protected_after,report.protected_before);}catch(error){report.protected_error=error.message;failure??=error;report.complete=false;failed=true;}
    fs.writeFileSync(path.join(caseRoot,'stdout.log'),stdout,{flag:'wx'});fs.writeFileSync(path.join(caseRoot,'stderr.log'),stderr,{flag:'wx'});report.ended_at=new Date().toISOString();save(path.join(caseRoot,'report.json'),report);
  }
  if(failure)throw failure;
}
test('copied keeper CLI publishes READY and exits0 only after atomic exact release request',{timeout:30000},async()=>runCase('normal-release',0,false));
test('copied keeper CLI rejects wrong token with exit1 and preserves its owned lock',{timeout:30000},async t=>{if(failed){t.skip('Earlier case failed; no additional keeper launched');return;}await runCase('wrong-token',1,true);});
test.after(()=>{
  save(path.join(runDir,'summary.json'),{run_id:runId,ended_at:new Date().toISOString(),test_source_sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),expected_source_hashes:expectedSources,complete:records.length===2&&records.every(x=>x.complete),cases:records.map(x=>({name:x.name,complete:x.complete,pid:x.owned_pid,exit_code:x.exit?.exit_code,owned_pid_absent:x.owned_pid_absent,lock_preserved_after_exit:x.lock_preserved_after_exit??false,original_owner_lock_removed:x.original_owner_lock_removed??false})),real_trading_launcher_lock_accessed:false,live_services_controlled:false,synthetic_pid_absence_checks_use_real_signal0:true});
  console.log(`Evidence: ${runDir}`);
});
