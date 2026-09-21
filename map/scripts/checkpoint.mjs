import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=fileURLToPath(new URL('../../',import.meta.url)),runtime=new URL('../.runtime/',import.meta.url),watch=process.argv.includes('--watch');
await mkdir(runtime,{recursive:true});
const run=(command,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},...options,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(new Error(`${command} ${args[0]} (${code})\n${output.slice(-4500)}`)));});
let busy=false;
async function fingerprint(){const paths=(await run('git',['ls-files','-z','--cached','--others','--exclude-standard','--','map'],{cwd:root})).split('\0').filter(Boolean).sort();const hash=createHash('sha256');for(const path of paths){hash.update(path);hash.update(await readFile(root+path).catch(()=>'deleted'));}return hash.digest('hex');}
async function checkpoint(){
 if(busy)return;busy=true;const status={pid:process.pid,at:new Date().toISOString(),phase:'checking',intervalMinutes:10};
 const save=async()=>writeFile(new URL('checkpoint.json',runtime),JSON.stringify(status,null,2));
 let server;
 try{
  const dirty=await run('git',['status','--porcelain','--','map'],{cwd:root});if(!dirty.trim()){status.phase='idle';await save();return;}
  const tested=await fingerprint();status.phase='testing';await save();await run('npm',['run','test:coverage']);await run('npm',['run','build']);
  server=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'preview','--host','127.0.0.1','--port','5187','--strictPort'],{cwd,stdio:'ignore'});
  let available=false;for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:5187');if(r.ok){available=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!available)throw new Error('Checkpoint preview did not start');
  await run('npm',['run','test:e2e'],{env:{...process.env,MAP_TEST_URL:'http://127.0.0.1:5187'}});await run('npm',['run','reports']);
  if(await fingerprint()!==tested)throw new Error('Files changed during verification; defer this checkpoint until the next interval.');
  status.phase='committing';await save();await run('git',['add','-A','--','map'],{cwd:root});
  await run('git',['diff','--cached','--check','--','map'],{cwd:root});await run('git',['commit','--only','-m',`Verify ATLAS checkpoint ${new Date().toISOString().slice(0,16)}`,'--','map'],{cwd:root});
  status.commit=(await run('git',['rev-parse','HEAD'],{cwd:root})).trim();status.phase='pushing';await save();
  const branch=(await run('git',['branch','--show-current'],{cwd:root})).trim();
  try{await run('git',['push','origin',`HEAD:${branch}`],{cwd:root});status.branch=branch;}
  catch(error){
   // Preserve other work if a busy shared branch advances; never force-push.
   if(!/rejected|fetch first|non-fast-forward/.test(error.message))throw error;
   await run('git',['push','origin',`HEAD:refs/heads/map/checkpoint-${status.commit.slice(0,12)}`],{cwd:root});status.branch=`map/checkpoint-${status.commit.slice(0,12)}`;
  }
  status.phase='pushed';console.log(`${status.commit} → origin/${status.branch}`);
 }catch(error){status.phase='failed';status.error=error.message;console.error(error.message);if(!watch)process.exitCode=1;}
 finally{server?.kill('SIGTERM');await save();busy=false;}
}
if(watch){await writeFile(new URL('watcher.json',runtime),JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));console.log(`ATLAS checkpoint watcher PID ${process.pid}, every 10 minutes`);await checkpoint();setInterval(checkpoint,10*60*1000);}
else await checkpoint();
