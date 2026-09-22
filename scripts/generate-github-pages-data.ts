import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getMockUserVehicles, getUserChargeSessions, getUserVehicleOptions } from '../src/data/mockVehicles';

const output=process.argv[2];
if(!output)throw new Error('Usage: generate-github-pages-data.ts <output-directory>');
const usersDirectory=path.join(output,'users');
const sessionsDirectory=path.join(output,'sessions');
await mkdir(usersDirectory,{recursive:true});
await mkdir(sessionsDirectory,{recursive:true});
await writeFile(path.join(output,'users.json'),JSON.stringify({users:getUserVehicleOptions()}));
for(const user of getMockUserVehicles()){
  await Promise.all([
    writeFile(path.join(usersDirectory,`${user.userId}.json`),JSON.stringify({user})),
    writeFile(path.join(sessionsDirectory,`${user.userId}.json`),JSON.stringify({userId:user.userId,sessions:getUserChargeSessions(user.userId)??[]})),
  ]);
}
console.log(`Generated static GitHub Pages data for ${getUserVehicleOptions().length} users.`);
