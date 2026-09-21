import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

// This gateway listens on loopback. Validate its actual listener address before
// translating a browser request to a server-to-server backend request.
function allowedGatewayRequest(req){
 try{
  const protocol=req.socket.encrypted?'https:':'http:';
  if(typeof req.headers.host!=='string'||!req.socket.localPort)return false;
  const host=new URL(`${protocol}//${req.headers.host}`);
  if(!['localhost','127.0.0.1','[::1]'].includes(host.hostname)||host.username||host.password||host.pathname!=='/'||host.search||host.hash)return false;
  if(Number(host.port||(protocol==='https:'?443:80))!==req.socket.localPort)return false;
  return req.headers.origin===undefined||req.headers.origin===host.origin;
 }catch{return false;}
}

function rejectUpgrade(socket,status){
 if(socket.destroyed)return;
 const timer=setTimeout(()=>socket.destroy(),1000);timer.unref();
 socket.once('close',()=>clearTimeout(timer));
 socket.once('error',()=>socket.destroy());
 socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`,()=>socket.destroy());
}

export function createTradingProxy(endpoint='http://127.0.0.1:8787',{timeout=10000}={}){
 const target=new URL(endpoint);
 if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw new Error('Invalid trading backend URL');
 const transport=target.protocol==='https:'?https:http;
 function route(raw){return raw.replace(/^\/trading\/backend(?=\/|\?|$)/,'')||'/';}
 function backendHeaders(req){
  const headers={...req.headers,host:target.host};
  // The browser Origin was checked against this gateway, not the backend UI.
  // Keep the mock session header unchanged; the engine still authorizes it.
  delete headers.origin;
  return headers;
 }
 return {
  request(req,res){
   if(!allowedGatewayRequest(req)){res.writeHead(403,{'Content-Type':'application/json; charset=utf-8',Connection:'close'});res.end(JSON.stringify({error:{code:'ORIGIN_DENIED',message:'거래소는 현재 로컬 서버와 같은 출처에서만 연결할 수 있습니다.'}}));return;}
   const upstream=transport.request({hostname:target.hostname,port:target.port||undefined,path:route(req.url),method:req.method,headers:backendHeaders(req)},response=>{
    res.writeHead(response.statusCode,response.headers);response.pipe(res);
   });
   upstream.setTimeout(timeout,()=>upstream.destroy(new Error('Backend timeout')));
   upstream.on('error',()=>{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:{code:'ENGINE_UNAVAILABLE',message:'거래소 엔진이 연결되지 않았습니다. 서버의 TRADING_ENGINE_URL과 엔진 실행 상태를 확인해 주세요.'}}));}else res.end();});
   req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
  },
  upgrade(req,socket,head){
   if(!allowedGatewayRequest(req)){rejectUpgrade(socket,'403 Forbidden');return;}
   const connect=target.protocol==='https:'?tls.connect:net.connect;
   const upstream=connect({host:target.hostname,port:Number(target.port)||(target.protocol==='https:'?443:80)},()=>{
    const headers=backendHeaders(req);
    upstream.write(`${req.method} ${route(req.url)} HTTP/${req.httpVersion}\r\n${Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);
   });
   upstream.on('error',()=>rejectUpgrade(socket,'503 Service Unavailable'));
   socket.on('error',()=>upstream.destroy());socket.on('close',()=>upstream.destroy());
  },
 };
}
