import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync,readFileSync} from 'node:fs';
import path from 'node:path';
export function verificationState(root){
  try{const heartbeat=JSON.parse(readFileSync(path.join(root,'map_new/.runtime/heartbeat.json'),'utf8'));process.kill(heartbeat.pid,0);return {...heartbeat,alive:Date.now()-Date.parse(heartbeat.at)<30000};}catch{return {alive:false,busy:false};}
}
export function startVerification(root){
  if(process.env.ATLAS_VERIFY_WORKER==='1'||process.env.ATLAS_AUTO_VERIFY==='0'||verificationState(root).alive)return null;
  const runtime=path.join(root,'map_new/.runtime');mkdirSync(runtime,{recursive:true});
  const log=openSync(path.join(runtime,'watch.log'),'a');
  const child=spawn(process.execPath,[path.join(root,'map_new/scripts/verify.mjs'),'--watch'],{cwd:root,env:process.env,stdio:['ignore',log,log]});closeSync(log);child.on('error',e=>console.error('ATLAS verification:',e.message));return child;
}
