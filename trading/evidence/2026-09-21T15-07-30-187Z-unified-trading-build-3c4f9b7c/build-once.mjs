import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const run = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(run, '../../..')
const frontend = path.join(root, 'trading/frontend')
const outDir = path.join(run, 'dist')
const sha = b => crypto.createHash('sha256').update(b).digest('hex')
const write = (name,value) => fs.writeFileSync(path.join(run,name),JSON.stringify(value,null,2)+'\n')
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)])
const relative = p => path.relative(root,p).replaceAll('\\','/')
const files = [...new Set([
  ...walk(path.join(frontend,'src')), ...walk(path.join(frontend,'public')),
  ...walk(path.join(root,'trading/engine/src')),
  ...['README.md','package.json','package-lock.json','scripts/build-unified.mjs','park/server/routes.mjs','park/server/apps.mjs',
    'trading/frontend/vite.config.ts','trading/frontend/tsconfig.json','trading/frontend/index.html','trading/frontend/package.json',
    'trading/frontend/pnpm-lock.yaml','trading/frontend/package-lock.json','trading/frontend/pnpm-workspace.yaml','trading/frontend/vercel.json',
    'trading/engine/Cargo.toml','trading/engine/Cargo.lock','trading/engine/target/release/leave-engine.exe',
    'node_modules/vite/package.json','node_modules/vite/bin/vite.js',
    'trading/frontend/.env','trading/frontend/.env.local','trading/frontend/.env.production','trading/frontend/.env.production.local',
  ].map(p=>path.join(root,p)),
])].sort()
const capture = () => files.map(file=>{
  if(!fs.existsSync(file))return {path:relative(file),exists:false}
  const b=fs.readFileSync(file)
  return {path:relative(file),exists:true,bytes:b.length,sha256:sha(b)}
})
const guardFile=path.join(run,'one-build-attempt.json')
fs.writeFileSync(guardFile,JSON.stringify({started_at:new Date().toISOString(),supervisor_pid:process.pid})+'\n',{flag:'wx'})
if(fs.existsSync(outDir))throw new Error('Fresh evidence outDir must not already exist')
const before=capture()
write('inputs.before.sha256.json',before)
const args=[path.join(root,'node_modules/vite/bin/vite.js'),'build','--config',path.join(frontend,'vite.config.ts'),'--base','/trading/','--outDir',outDir]
const command={executable:process.execPath,args,cwd:frontend,started_at:new Date().toISOString(),
  node_version:process.version,root_vite_version:JSON.parse(fs.readFileSync(path.join(root,'node_modules/vite/package.json'),'utf8')).version,
  frontend_vite_version:JSON.parse(fs.readFileSync(path.join(frontend,'node_modules/vite/package.json'),'utf8')).version,
  unified_recipe_source:'scripts/build-unified.mjs', differences:['outDir changed to a fresh unique trading/evidence run/dist','--emptyOutDir omitted as instructed; no existing directory is emptied'],
  production_scope:'Only the trading Vite step; no tsc, other app, Next build, server, browser, API, or deployment.',
  env_policy:'Inherited current process environment, as the unified build does. No values changed or full environment dumped; present dotenv files are hashed without copying content.',
}
write('command.json',command)
const stdout=fs.openSync(path.join(run,'build.stdout.log'),'wx'),stderr=fs.openSync(path.join(run,'build.stderr.log'),'wx'),combined=fs.openSync(path.join(run,'build.combined.log'),'wx')
let child,spawnError=null
try{
  child=spawn(process.execPath,args,{cwd:frontend,env:{...process.env},windowsHide:true,stdio:['ignore','pipe','pipe']})
  command.child_pid=child.pid??null
  write('command.json',command)
  child.stdout.on('data',b=>{fs.writeSync(stdout,b);fs.writeSync(combined,b)})
  child.stderr.on('data',b=>{fs.writeSync(stderr,b);fs.writeSync(combined,b)})
  child.on('error',error=>{spawnError={name:error.name,message:error.message,code:error.code}})
  const exited=await new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})))
  const after=capture()
  write('inputs.after.sha256.json',after)
  const unchanged=JSON.stringify(before)===JSON.stringify(after)
  const artifacts=fs.existsSync(outDir)?walk(outDir).sort().map(file=>{const b=fs.readFileSync(file);return {path:path.relative(run,file).replaceAll('\\','/'),absolute_path:file,bytes:b.length,sha256:sha(b)}}):[]
  write('artifacts.sha256.json',artifacts)
  const result={...exited,spawn_error:spawnError,finished_at:new Date().toISOString(),input_count:before.length,all_inputs_unchanged:unchanged,
    changed_inputs:before.filter((x,i)=>JSON.stringify(x)!==JSON.stringify(after[i])).map(x=>x.path),
    output_dir:outDir,artifact_count:artifacts.length,html_js_css:artifacts.filter(x=>/\.(html|js|css)$/.test(x.path)),
    scope:command.production_scope,command_file:'command.json',stdout:'build.stdout.log',stderr:'build.stderr.log',combined:'build.combined.log'}
  write('result.json',result)
  console.log(JSON.stringify(result,null,2))
  process.exitCode=exited.code===0&&unchanged&&!spawnError?0:1
}finally{fs.closeSync(stdout);fs.closeSync(stderr);fs.closeSync(combined)}
