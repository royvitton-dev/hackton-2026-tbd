import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createVite } from 'vite';
import { discoverAttractions, gitState, resolveAsset, safeName } from './lib/registry.mjs';
import { readState } from './lib/sync.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const port = Number(process.env.PARK_PORT || 5190);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.vtt': 'text/vtt; charset=utf-8', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
const clients = new Set(), childApps = new Map();
const app = production ? null : await createVite({ configFile: path.join(root, 'park/vite.config.mjs'), server: { middlewareMode: true, hmr: { port: port + 1 } } });
const json = (res, data, status=200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(data)); };
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
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')) {
      const origin=req.headers.origin;
      if(origin && new URL(origin).host!==req.headers.host) return json(res,{error:'Origin denied'},403);
      if(url.pathname==='/api/park') return json(res,await catalog());
      if(url.pathname==='/api/events') {
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});res.write('retry: 3000\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
      }
      if(url.pathname==='/api/refresh' && req.method==='POST') {
        await mkdir(path.join(root,'.park-runtime'),{recursive:true});await writeFile(path.join(root,'.park-runtime/refresh.json'),JSON.stringify({event:'manual',at:new Date().toISOString()}));return json(res,await catalog());
      }
      if(url.pathname.startsWith('/api/project-asset/')) {
        const [, , , id, ...parts] = decodeURIComponent(url.pathname).split('/');
        const relative=parts.join('/');
        if(!/\.(mp4|webm|png|jpe?g|webp|glb|vtt|wav)$/i.test(relative)) return json(res,{error:'Unsupported asset'},403);
        const file=resolveAsset(root,id,relative);if(!file)return json(res,{error:'Invalid asset path'},403);
        return await sendFile(req,res,file,path.join(root,id));
      }
      if(url.pathname==='/api/launch' && req.method==='POST') {
        const id=url.searchParams.get('id');const attraction=(await discoverAttractions(root)).find(a=>a.id===id);
        if(!attraction || !safeName(id))return json(res,{error:'Unknown attraction'},404);
        if(attraction.url)return json(res,{url:attraction.url});
        if(!attraction.hasWebApp && attraction.hasStaticApp)return json(res,{url:`http://localhost:${port}/apps/${encodeURIComponent(id)}/`});
        if(!attraction.hasWebApp)return json(res,{error:'This attraction has no web app'},400);
        if(!childApps.has(id)) {
          const child=await createVite({root:path.join(root,id),server:{host:'127.0.0.1',port:5290+childApps.size,strictPort:false,open:false}});
          await child.listen();childApps.set(id,child);
        }
        return json(res,{url:childApps.get(id).resolvedUrls.local[0]});
      }
      return json(res,{error:'Not found'},404);
    }
    if(url.pathname.startsWith('/apps/')) {
      const [, , id, ...segments]=decodeURIComponent(url.pathname).split('/');
      let relative=segments.join('/');if(!relative||relative.endsWith('/'))relative+='index.html';
      const attraction=(await discoverAttractions(root)).find(a=>a.id===id);
      if(!attraction || !attraction.hasStaticApp)return json(res,{error:'Unknown app'},404);
      if(!/\.(html|js|mjs|css|json|png|jpe?g|webp|svg|woff2?|mp4|webm|wav|glb)$/i.test(relative))return json(res,{error:'Unsupported file'},403);
      const file=resolveAsset(root,id,relative);if(!file)return json(res,{error:'Invalid path'},403);
      return await sendFile(req,res,file,path.join(root,id));
    }
    if(url.pathname.startsWith('/reports/')) {
      const rel=decodeURIComponent(url.pathname.slice(9)) || 'index.html';
      const file=path.resolve(root,'park/reports',rel.endsWith('/')?rel+'index.html':rel);
      return await sendFile(req,res,file,path.join(root,'park/reports'));
    }
    if(production) {
      const rel=decodeURIComponent(url.pathname);const target=path.resolve(root,'dist','.'+rel);
      try { return await sendFile(req,res,target,path.join(root,'dist')); } catch { return await sendFile(req,res,path.join(root,'dist/index.html'),path.join(root,'dist')); }
    }
    app.middlewares(req,res,()=>{res.writeHead(404);res.end('Not found');});
  } catch (error) { if(!res.headersSent)json(res,{error:error.code==='ENOENT'?'Not found':error.message},error.code==='ENOENT'?404:500); else res.end(); }
});
let last='';
const updates=setInterval(async()=>{try { const data=await catalog();const encoded=JSON.stringify(data);if(encoded!==last){last=encoded;for(const client of clients)client.write(`data: ${encoded}\n\n`);}else for(const client of clients)client.write(': heartbeat\n\n');}catch{}},5000);
server.listen(port,'127.0.0.1',async()=>{await mkdir(path.join(root,'.park-runtime'),{recursive:true});await writeFile(path.join(root,'.park-runtime/server.json'),JSON.stringify({pid:process.pid,port}));console.log(`TBD Wonder Park: http://localhost:${port}`);});
server.on('error',error=>{console.error(error.message);process.exit(1);});
async function stop(){clearInterval(updates);for(const client of clients)client.end();await app?.close();await Promise.all([...childApps.values()].map(a=>a.close()));server.close(()=>process.exit(0));}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
