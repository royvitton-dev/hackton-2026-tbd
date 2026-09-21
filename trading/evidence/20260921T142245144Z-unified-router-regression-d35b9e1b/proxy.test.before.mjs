import {it,expect} from 'vitest';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {createTradingProxy} from '../../server/trading-proxy.mjs';

async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;}
async function close(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
it('rejects unsupported protocols and embedded credentials',()=>{for(const u of ['file:///tmp/a','http://user:pass@localhost'])expect(()=>createTradingProxy(u)).toThrow();expect(()=>createTradingProxy()).not.toThrow();});
it('forwards method, body, status and query to the engine through one public path',async()=>{
 let input;const backend=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;input={url:req.url,method:req.method,body};res.writeHead(201,{'Content-Type':'application/json'});res.end('{"ok":true}');});
 const endpoint=await listen(backend),proxy=createTradingProxy(endpoint),gateway=http.createServer(proxy.request),url=await listen(gateway);
 try{const r=await fetch(url+'/trading/backend/api/orders?user=test',{method:'POST',body:'demo'});expect(r.status).toBe(201);expect(await r.json()).toEqual({ok:true});expect(input).toEqual({url:'/api/orders?user=test',method:'POST',body:'demo'});await fetch(url+'/trading/backend');expect(input.url).toBe('/');}finally{await close(gateway);await close(backend);}
});
it('reports an unavailable engine without fabricating market data',async()=>{const proxy=createTradingProxy('http://127.0.0.1:1'),gateway=http.createServer(proxy.request),url=await listen(gateway);try{const r=await fetch(url+'/trading/backend/health');expect(r.status).toBe(503);expect((await r.json()).error.code).toBe('ENGINE_UNAVAILABLE');}finally{await close(gateway);}});
it('times out an unresponsive engine',async()=>{const backend=http.createServer(()=>{}),endpoint=await listen(backend),proxy=createTradingProxy(endpoint,{timeout:30}),gateway=http.createServer(proxy.request),url=await listen(gateway);try{expect((await fetch(url+'/trading/backend/health')).status).toBe(503);}finally{await close(gateway);await close(backend);}});
it('returns a failed WebSocket upgrade when the engine is unavailable',async()=>{const proxy=createTradingProxy('http://127.0.0.1:1'),gateway=http.createServer();gateway.on('upgrade',proxy.upgrade);await listen(gateway);const socket=net.connect(gateway.address().port,'127.0.0.1');try{await once(socket,'connect');socket.write('GET /trading/backend/ws HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');expect((await once(socket,'data'))[0].toString()).toContain('503 Service Unavailable');}finally{socket.destroy();await close(gateway);}});
it('forwards WebSocket upgrade and bytes on the same routed path',async()=>{
 const backend=http.createServer();let backendSocket;
 backend.on('upgrade',(req,socket,head)=>{backendSocket=socket;expect(req.url).toBe('/ws?token=test');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');if(head.length)socket.write(head);socket.on('data',data=>socket.write(data));});
 const endpoint=await listen(backend),proxy=createTradingProxy(endpoint),gateway=http.createServer();gateway.on('upgrade',proxy.upgrade);await listen(gateway);
 const socket=net.connect(gateway.address().port,'127.0.0.1');
 try{await once(socket,'connect');socket.write('GET /trading/backend/ws?token=test HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\nHELLO');const first=(await once(socket,'data'))[0].toString();expect(first).toContain('101 Switching');if(!first.includes('HELLO'))expect((await once(socket,'data'))[0].toString()).toBe('HELLO');socket.write(Buffer.from([0x81,2,79,75]));expect((await once(socket,'data'))[0]).toEqual(Buffer.from([0x81,2,79,75]));}finally{socket.destroy();backendSocket?.destroy();await close(gateway);await close(backend);}
});
