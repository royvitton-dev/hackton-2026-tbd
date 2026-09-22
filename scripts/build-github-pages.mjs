import { cp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const workspace=path.join(root,'.github-pages-work');
const source=path.join(workspace,'source');
const output=path.join(root,'out');
const basePath=process.env.GITHUB_PAGES_BASE_PATH??'';
if(basePath&&!/^\/[A-Za-z0-9._-]+$/.test(basePath))throw new Error(`Invalid GitHub Pages base path: ${basePath}`);

function run(command,args,cwd,env={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,stdio:'inherit',env:{...process.env,...env}});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`${command} exited with ${code}`)));
  });
}

await rm(workspace,{recursive:true,force:true});
await mkdir(source,{recursive:true});
for(const name of ['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','src','public']){
  await cp(path.join(root,name),path.join(source,name),{recursive:true});
}
await cp(path.join(root,'battery_health/src'),path.join(source,'battery_health/src'),{recursive:true});
await rm(path.join(source,'src/app/api'),{recursive:true,force:true});
await symlink(path.join(root,'node_modules'),path.join(source,'node_modules'),'dir');
await run(process.execPath,[path.join(root,'node_modules/tsx/dist/cli.mjs'),path.join(root,'scripts/generate-github-pages-data.ts'),path.join(source,'public/data')],root);
await run(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],source,{
  GITHUB_PAGES:'1',
  NEXT_PUBLIC_BASE_PATH:basePath,
  NEXT_PUBLIC_PROJECT_HOME_URL:`${basePath}/`,
  NEXT_PUBLIC_STATIC_DATA_PATH:'/data',
});
await rm(output,{recursive:true,force:true});
await cp(path.join(source,'out'),output,{recursive:true});
await writeFile(path.join(output,'.nojekyll'),'');
await rm(workspace,{recursive:true,force:true});
console.log(`GitHub Pages export ready: ${output}${basePath?` (base path ${basePath})`:''}`);
