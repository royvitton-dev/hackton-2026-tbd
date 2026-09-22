import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,open} from 'node:fs/promises';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
export async function startTradingDemo(){
 const scratch=path.join(root,'movie/.movie-runtime');await mkdir(scratch,{recursive:true});
 const directory=await mkdtemp(path.join(scratch,'trading-demo-')),port=await freePort(),uiPort=await freePort();
 const api=`http://127.0.0.1:${port}`,url=`http://127.0.0.1:${uiPort}`,children=[];
 async function start(name,cmd,args=[],options={}){const log=await open(path.join(directory,`${name}.log`),'w');const child=spawn(cmd,args,{cwd:root,...options,stdio:['ignore',log.fd,log.fd]});children.push(child);child.on('error',e=>console.error(name,e.message));await log.close();return child;}
 async function until(check,ms=20000){const end=Date.now()+ms;while(Date.now()<end){try{if(await check())return;}catch{}await sleep(150);}throw Error('Trading demo did not become ready');}
 const close=async()=>{for(const child of children.slice(1))if(child.exitCode===null)child.kill('SIGTERM');try{await fetch(api+'/api/admin/shutdown',{method:'POST',headers:{'x-session-token':'demo-user-01'},signal:AbortSignal.timeout(2000)});}catch{}await sleep(800);for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');};
 try{
  await start('engine',path.join(scratch,'trading-build/debug/leave-engine'),[],{env:{...process.env,ENGINE_BIND:`127.0.0.1:${port}`,ENGINE_DATA_DIR:path.join(directory,'data'),ALLOWED_ORIGINS:url}});
  await until(async()=> (await fetch(api+'/health')).ok);
  await start('frontend',process.execPath,[path.join(root,'trading/frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(uiPort),'--strictPort'],{cwd:path.join(root,'trading/frontend'),env:{...process.env,VITE_API_URL:api,VITE_WS_URL:api.replace('http','ws')+'/ws'}});
  for(let i=1;i<=12;i++)await start(`bot-${i}`,process.execPath,[path.join(root,'trading/bots/bot.mjs'),String(i),directory],{env:{...process.env,ENGINE_API_URL:api}});
  await until(async()=> (await fetch(url)).ok);await sleep(7000);
  return {api,url,directory,close};
 }catch(error){await close();throw error;}
}
