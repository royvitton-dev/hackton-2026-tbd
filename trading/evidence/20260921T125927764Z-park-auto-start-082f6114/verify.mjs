import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
const directory=import.meta.dirname, root=path.resolve(directory,'../..'), project=path.dirname(root);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write=(name,value)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2));
const manifestPath=path.join(root,'data/demo-current.json');
const original=fs.readFileSync(manifestPath); write('manifest-before.json',JSON.parse(original));
const out=fs.openSync(path.join(directory,'park.stdout.log'),'wx'),err=fs.openSync(path.join(directory,'park.stderr.log'),'wx');
const child=spawn(process.execPath,['park/server.mjs'],{cwd:project,windowsHide:true,stdio:['ignore',out,err],env:{...process.env,PARK_PORT:'5196',PARK_SERVER_STATE_FILE:path.join(directory,'park-server.json')}});
fs.closeSync(out);fs.closeSync(err);
let ended=false,exit, failure;
child.once('exit',(code,signal)=>{ended=true;exit={code,signal,at:new Date().toISOString()};});
const state={started_at:new Date().toISOString(),status:'starting',supervisor_pid:process.pid,park_pid:child.pid,url:'http://127.0.0.1:5196',server_source_sha256:sha(path.join(project,'park/server.mjs')),launcher_source_sha256:sha(path.join(root,'scripts/park-launcher.mjs')),demo_source_sha256:sha(path.join(root,'scripts/demo.mjs'))};
write('run.json',state);
try {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline){if(ended)throw new Error('Owned park exited during startup');const log=fs.readFileSync(path.join(directory,'park.stdout.log'),'utf8');if(log.includes('Trading reused: http://127.0.0.1:5175'))break;await sleep(100);}
  assert.match(fs.readFileSync(path.join(directory,'park.stdout.log'),'utf8'),/Trading reused: http:\/\/127\.0\.0\.1:5175/);
  const catalog=await fetch(state.url+'/api/park').then(r=>r.json());write('trading-catalog.json',catalog.attractions.find(a=>a.id==='trading'));
  const launched=await fetch(state.url+'/api/launch?id=trading',{method:'POST'});const body=await launched.json();assert.equal(launched.status,200);assert.equal(body.url,'http://127.0.0.1:5175');write('launch-response.json',{status:launched.status,body});
  assert.equal(sha(manifestPath),createHash('sha256').update(original).digest('hex'));state.status='ready';state.ready_at=new Date().toISOString();write('run.json',state);
  console.log(JSON.stringify({event:'ready',directory,...state}));
  const stopDeadline=Date.now()+600000;
  while(!fs.existsSync(path.join(directory,'stop.request'))&&Date.now()<stopDeadline&&!ended)await sleep(250);
} catch(error){failure=error.stack;console.error(failure);process.exitCode=1;}
finally {
  if(!ended)child.kill('SIGTERM');const deadline=Date.now()+5000;while(!ended&&Date.now()<deadline)await sleep(50);
  state.status=failure||!ended?'failed':'stopped';state.failure=failure;state.exit=exit;state.ended_at=new Date().toISOString();state.manifest_unchanged=sha(manifestPath)===createHash('sha256').update(original).digest('hex');write('run.json',state);
  if(!ended||!state.manifest_unchanged)process.exitCode=1;
  console.log(JSON.stringify({event:'ended',...state}));
}
