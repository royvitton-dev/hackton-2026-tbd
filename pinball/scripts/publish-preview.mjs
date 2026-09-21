// Publish only the exact main commit already visible on the approved remote.
// Existing pages keep their immutable asset URLs; a refresh selects this release.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes('--repo')||!args.includes('--releases'))throw new Error('Usage: node scripts/publish-preview.mjs --repo <main checkout> --releases <local release directory>');
const repo=path.resolve(option('--repo')),releases=path.resolve(option('--releases'));
const git=(...args)=>execFileSync('git',['-C',repo,...args],{timeout:30000,maxBuffer:16*1024*1024});
if(git('branch','--show-current').toString().trim()!=='main')throw new Error('The checkout must be on main.');
const commit=git('rev-parse','HEAD').toString().trim();
const remote=git('ls-remote','origin','refs/heads/main').toString().trim().split(/\s+/)[0];
if(commit!==remote)throw new Error('Remote main does not match HEAD; finish the normal push first.');
const version='main-'+commit.slice(0,12),root=path.join(releases,version);
const files=git('ls-tree','-r','-z','--name-only',commit,'--','pinball/index.html','pinball/src','pinball/vendor','pinball/samples').toString().split('\0').filter(Boolean);
if(!files.includes('pinball/index.html')||!files.includes('pinball/src/app.js'))throw new Error('Committed pinball runtime is missing.');
const hashes={};
for(const file of files){
 const relative=file.slice('pinball/'.length),target=path.resolve(root,relative);
 if(!target.startsWith(root+path.sep))throw new Error('Invalid committed path.');
 const data=git('show',commit+':'+file);hashes[relative]=createHash('sha256').update(data).digest('hex');
 await mkdir(path.dirname(target),{recursive:true});
 try{const existing=await readFile(target);if(!existing.equals(data))throw new Error('Immutable release mismatch: '+relative);}
 catch(error){if(error.code!=='ENOENT')throw error;await writeFile(target,data,{flag:'wx'});}
}
const receipt={commit,branch:'main',version,verifiedAt:new Date().toISOString(),files:hashes};
await writeFile(path.join(root,'release.json'),JSON.stringify(receipt,null,2)+'\n');
await writeFile(path.join(releases,'current.incoming'),version+'\n');
await rename(path.join(releases,'current.incoming'),path.join(releases,'current'));
console.log(JSON.stringify({status:'PASS',commit,version,assets:files.length,refresh:'http://127.0.0.1:4188/'}));
