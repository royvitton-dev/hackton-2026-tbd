import {mkdir,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';

export default async function setup(){
 const directory=path.resolve('park/reports/browser-coverage/raw');
 await mkdir(directory,{recursive:true});
 for(const file of await readdir(directory))if(file.endsWith('.json'))await unlink(path.join(directory,file));
}
