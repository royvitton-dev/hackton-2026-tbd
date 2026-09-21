import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverAttractions, gitState, resolveAsset, safeName } from './lib/registry.mjs';
import { readState } from './lib/sync.mjs';
import { APPS, appPath, matchApp, privatePath, staticPath, redirectPath } from './server/routes.mjs';
import { createAppMiddleware } from './server/apps.mjs';
import { createTradingProxy } from './server/trading-proxy.mjs';
import { directory, voiceGuide } from './server/pages.mjs';
import { infrastructurePlugin } from '../map/src/server/infrastructure.js';
import { loadEnv } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const port = Number(process.env.PORT || process.env.PARK_PORT || 5190);
const serverStateFile = process.env.PARK_SERVER_STATE_FILE || path.join(root, '.park-runtime/server.json');
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.vtt':'text/vtt; charset=utf-8','.glb':'model/gltf-binary','.woff2':'font/woff2','.woff':'font/woff','.wasm':'application/wasm','.pdf':'application/pdf','.md':'text/plain; charset=utf-8' };
const clients = new Set();
const json = (res,data,status=200) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const html = (res,body) => {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(body);};
const notFound = res => json(res,{error:'Not found'},404);
const trading = createTradingProxy(process.env.TRADING_ENGINE_URL || process.env.ENGINE_API_URL);
let infrastructure;
infrastructurePlugin(loadEnv('development',path.join(root,'map'),'').OPENCELLID_API_KEY).configureServer({middlewares:{use(fn){infrastructure=fn;}}});
async function sendFile(req, res, file, boundary) {
  const actual = await realpath(file); const base = await realpath(boundary);
  if (!actual.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
  const info = await stat(actual); if (!info.isFile()) throw new Error('Not a file');
  const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes' };
  let start=0, end=info.size-1;
  if (req.headers.range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!m || (!m[1] && !m[2])) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}); res.end(); return; }
    if (m[1]) { start=Number(m[1]); end=m[2] ? Math.min(Number(m[2]),end) : end; }
    else start=Math.max(0,info.size-Number(m[2]));
    if(start>end || start>=info.size) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}); res.end(); return; }
    headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length']=end-start+1;
  res.writeHead(req.headers.range?206:200, headers);
  if(req.method==='HEAD')res.end(); else createReadStream(actual,{start,end}).pipe(res);
}
async function catalog() {
  const [attractions, git, sync] = await Promise.all([discoverAttractions(root),gitState(root),readState(root)]);
  let watcher = false;
  try { const beat=JSON.parse(await readFile(path.join(root,'.park-runtime/heartbeat.json'),'utf8')); process.kill(beat.pid,0); watcher=Date.now()-Date.parse(beat.at)<45000; } catch {}
  return { attractions, git, sync, watcher, intervalMs:600000 };
}

const server = http.createServer(async (req,res) => {
 try {
  const url=new URL(req.url,'http://localhost');
  if(privatePath(req.url.split('?')[0]))return json(res,{error:'Invalid path'},403);
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host&&req.method!=='GET'&&req.method!=='HEAD')return json(res,{error:'Origin denied'},403);
  const redirect=redirectPath(url.pathname,url.search);
  if(redirect){res.writeHead(308,{Location:redirect});res.end();return;}
  if(url.pathname==='/projects/'||url.pathname==='/projects')return html(res,directory());
  if(url.pathname==='/api/apps')return json(res,{port,apps:APPS.map(({id,name})=>({id,name,path:appPath(id)}))});
  if(url.pathname.startsWith('/trading/backend/'))return trading.request(req,res);
  if(url.pathname.startsWith('/map/api/infrastructure/')){
   req.url=req.url.slice(4);return infrastructure(req,res,()=>notFound(res));
  }
  if(url.pathname.startsWith('/api/')){
   if(origin&&new URL(origin).host!==req.headers.host)return json(res,{error:'Origin denied'},403);
   if(url.pathname==='/api/park')return json(res,await catalog());
   if(url.pathname==='/api/events'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});res.write('retry: 3000\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
   }
   if(url.pathname==='/api/refresh'&&req.method==='POST'){
    await mkdir(path.join(root,'.park-runtime'),{recursive:true});await writeFile(path.join(root,'.park-runtime/refresh.json'),JSON.stringify({event:'manual',at:new Date().toISOString()}));return json(res,await catalog());
   }
   if(url.pathname.startsWith('/api/project-asset/')){
    const [,,,id,...parts]=decodeURIComponent(url.pathname).split('/'),relative=parts.join('/');
    if(!/\.(mp4|webm|png|jpe?g|webp|glb|vtt|wav)$/i.test(relative))return json(res,{error:'Unsupported asset'},403);
    const file=resolveAsset(root,id,relative);if(!file)return json(res,{error:'Invalid asset path'},403);
    return await sendFile(req,res,file,path.join(root,id));
   }
   if(url.pathname==='/api/launch'&&req.method==='POST'){
    const id=url.searchParams.get('id'),attraction=(await discoverAttractions(root)).find(a=>a.id===id);
    // Catalog launch remains restricted to visible attractions. The directory also offers /webpage/.
    if(!attraction||!safeName(id)||!appPath(id))return json(res,{error:'Unknown attraction'},404);
    return json(res,{url:new URL(appPath(id),`http://${req.headers.host}`).href,path:appPath(id)});
   }
   return notFound(res);
  }
  const report=/^\/(?:park\/)?reports\/(.*)$/.exec(url.pathname);
  if(report){const rel=decodeURIComponent(report[1])||'index.html';return await sendFile(req,res,path.resolve(root,'park/reports',rel.endsWith('/')?rel+'index.html':rel),path.join(root,'park/reports'));}
  const app=matchApp(url.pathname);if(!app)return notFound(res);
  if(app.kind==='guide'){if(url.pathname!==appPath(app.id))return notFound(res);return html(res,voiceGuide());}
  if(app.kind==='static'){
   const relative=staticPath(app,url.pathname);if(!relative)return json(res,{error:'Unsupported file'},403);
   return await sendFile(req,res,path.join(root,app.root,relative),path.join(root,app.root));
  }
  if(production&&app.kind==='vite'){
   const base=path.join(root,'.server-dist',app.id),relative=decodeURIComponent(url.pathname.slice(app.id.length+2));
   const target=path.resolve(base,relative||'index.html');
   try{return await sendFile(req,res,target,base);}catch(error){
    if(error.code!=='ENOENT'&&error.code!=='EISDIR')throw error;
    if(path.extname(relative))return notFound(res);
    return await sendFile(req,res,path.join(base,'index.html'),base);
   }
  }
  return await apps.handle(app,req,res,()=>notFound(res));
 }catch(error){if(!res.headersSent)json(res,{error:error.code==='ENOENT'?'Not found':error.message},error.code==='ENOENT'?404:500);else res.end();}
});
const apps=createAppMiddleware({root,server,port,production});
server.on('upgrade',(req,socket,head)=>{
 if(privatePath(new URL(req.url,'http://localhost').pathname)){socket.destroy();return;}
 if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){socket.destroy();return;}
 if(req.url.startsWith('/trading/backend/'))return trading.upgrade(req,socket,head);
 apps.upgrade(req,socket,head).catch(()=>socket.destroy());
});
await apps.warmPark();
let last='';
const updates=setInterval(async()=>{try{const data=await catalog(),encoded=JSON.stringify(data);if(encoded!==last){last=encoded;for(const client of clients)client.write(`data: ${encoded}\n\n`);}else for(const client of clients)client.write(': heartbeat\n\n');}catch{}},5000);
server.listen(port,'127.0.0.1',async()=>{
 await mkdir(path.dirname(serverStateFile),{recursive:true});await writeFile(serverStateFile,JSON.stringify({pid:process.pid,port,router:true}));
 console.log(`TBD shared server: http://localhost:${port}/projects/`);
});
server.on('error',error=>{console.error(error.message);process.exit(1);});
async function stop(){clearInterval(updates);for(const client of clients)client.end();await apps.close();server.close(()=>process.exit(0));server.closeIdleConnections();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
