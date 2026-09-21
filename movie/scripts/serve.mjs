import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export function serve(port=5180) {
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.wav':'audio/wav','.css':'text/css; charset=utf-8','.vtt':'text/vtt; charset=utf-8','.md':'text/plain; charset=utf-8'};
  const server=http.createServer(async(req,res)=>{
    try {
      const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      const info=await stat(file);
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
      res.setHeader('Accept-Ranges','bytes');
      const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const data=await readFile(file);
      if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):info.size-1,info.size-1);res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));}
      else {res.setHeader('Content-Length',info.size);res.end(data);}
    }catch{res.writeHead(404);res.end('Not found');}
  });
  return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const p=process.argv.indexOf('--port');const port=p>=0?Number(process.argv[p+1]):5180;
  await serve(port);console.log(`Film preview: http://localhost:${port}`);
}
