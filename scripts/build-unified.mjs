import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {APPS,NEXT_BASE_PATH} from '../park/server/routes.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
async function run(args,cwd,env={}){
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd,stdio:'inherit',env:{...process.env,...env}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Build exited ${code}: ${args.join(' ')}`)));});
}
for(const app of APPS.filter(a=>a.kind==='vite')){
 console.log(`Building /${app.id}/`);
 await run([path.join(root,'node_modules/vite/bin/vite.js'),'build','--config',path.join(root,app.config),'--base',`/${app.id}/`,'--outDir',path.join(root,'.server-dist',app.id),'--emptyOutDir'],path.join(root,app.root));
}
await run([path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],root,{NEXT_PUBLIC_BASE_PATH:NEXT_BASE_PATH});
console.log('All routes built. Start with npm start.');
