import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

export function createTradingProxy(endpoint='http://127.0.0.1:8787',{timeout=10000}={}){
 const target=new URL(endpoint);
 if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw new Error('Invalid trading backend URL');
 const transport=target.protocol==='https:'?https:http;
 function route(raw){return raw.replace(/^\/trading\/backend(?=\/|\?|$)/,'')||'/';}
 return {
  request(req,res){
   const upstream=transport.request({hostname:target.hostname,port:target.port||undefined,path:route(req.url),method:req.method,headers:{...req.headers,host:target.host}},response=>{
    res.writeHead(response.statusCode,response.headers);response.pipe(res);
   });
   upstream.setTimeout(timeout,()=>upstream.destroy(new Error('Backend timeout')));
   upstream.on('error',()=>{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:{code:'ENGINE_UNAVAILABLE',message:'거래소 엔진이 연결되지 않았습니다. 서버의 TRADING_ENGINE_URL과 엔진 실행 상태를 확인해 주세요.'}}));}else res.end();});
   req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
  },
  upgrade(req,socket,head){
   const connect=target.protocol==='https:'?tls.connect:net.connect;
   const upstream=connect({host:target.hostname,port:Number(target.port)||(target.protocol==='https:'?443:80)},()=>{
    const headers={...req.headers,host:target.host};
    upstream.write(`${req.method} ${route(req.url)} HTTP/${req.httpVersion}\r\n${Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
   });
   upstream.on('error',()=>{if(!socket.destroyed)socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');});
   socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());
  },
 };
}
