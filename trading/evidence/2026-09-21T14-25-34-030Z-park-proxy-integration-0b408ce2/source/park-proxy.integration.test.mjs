import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createTradingProxy } from '../../park/server/trading-proxy.mjs';
import { engineReadyLog, waitForOwnedReady } from './demo-lifecycle.mjs';
import { monitorBenchmarkChild, settleBenchmarkChild, verifyExpectedBinary, sha256File } from './network-bench-lifecycle.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expectedBinary='65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512';
const expectedProxy='eddc83f250b23d6214df19ddb55064ee81dd0c5a70fd6d850c1e33075a2410f4';
const runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-park-proxy-integration-${crypto.randomUUID().slice(0,8)}`;
const runDir=path.join(root,'evidence',runId);
fs.mkdirSync(runDir);
const save=(name,value)=>fs.writeFileSync(path.join(runDir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const log=event=>fs.appendFileSync(path.join(runDir,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n');
const protectedExtras=[18184,15744,16840,19312];
const live=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
function protectedState() {
  const file=path.join(root,'data','demo-current.json'),bytes=fs.readFileSync(file),manifest=JSON.parse(bytes);
  assert.equal(manifest.processes.length,14);
  const pids=[...manifest.processes.map(x=>x.pid),...protectedExtras];assert.equal(new Set(pids).size,18);
  const processes=pids.map(pid=>({pid,alive:live(pid)}));assert.ok(processes.every(x=>x.alive),'Protected process absent; refuse isolated test');
  return {manifest_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),processes,scope:'PID existence and unchanged manifest only; no start-time/PID-reuse assertion'};
}
async function listen(server) {await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return server.address().port;}
async function freePort(){const server=net.createServer();const port=await listen(server);await new Promise(resolve=>server.close(resolve));return port;}
function track(server,sockets){server.on('connection',socket=>{sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));});}
async function closeServer(server,sockets){for(const socket of sockets)socket.destroy();if(!server?.listening)return;await Promise.race([new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())),sleep(3000).then(()=>{throw new Error('Fixture server close timeout');})]);}
async function call(base,route,{method='GET',headers={},body}={}) {
  const url=new URL(route,base),payload=body===undefined?null:JSON.stringify(body),startedAt=new Date().toISOString();
  const result=await new Promise((resolve,reject)=>{
    const req=http.request(url,{method,agent:false,headers:{'content-type':'application/json','x-session-token':'demo-user-01',...(payload?{'content-length':Buffer.byteLength(payload)}:{}),...headers}},res=>{
      const chunks=[];let length=0;res.on('data',chunk=>{length+=chunk.length;if(length>1024*1024)res.destroy(new Error('Body too large'));else chunks.push(chunk);});res.on('error',reject);
      res.on('end',()=>{try{const text=Buffer.concat(chunks).toString('utf8');resolve({status:res.statusCode,headers:res.headers,body:text?JSON.parse(text):null});}catch(error){reject(error);}});
    });
    req.setTimeout(5000,()=>req.destroy(new Error('HTTP timeout')));req.once('error',reject);req.end(payload);
  });
  log({event:'http_result',base,route,method,request_headers:headers,request_body:body??null,started_at:startedAt,result});return result;
}
function clientFrame(opcode,payload=Buffer.alloc(0)) {
  assert.ok(payload.length<126);const mask=crypto.randomBytes(4),frame=Buffer.alloc(6+payload.length);frame[0]=0x80|opcode;frame[1]=0x80|payload.length;mask.copy(frame,2);for(let i=0;i<payload.length;i++)frame[i+6]=payload[i]^mask[i%4];return frame;
}
async function wsOpen(base,headers,sockets) {
  const key=crypto.randomBytes(16).toString('base64'),url=new URL('/trading/backend/ws',base);
  return await new Promise((resolve,reject)=>{
    const req=http.request(url,{agent:false,headers:{Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':key,'x-session-token':'demo-user-01',...headers}});
    let timer=setTimeout(()=>req.destroy(new Error('WS handshake timeout')),5000);
    req.once('error',error=>{clearTimeout(timer);reject(error);});
    req.once('response',res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>65536)res.destroy(new Error('WS rejection too large'));});res.once('error',reject);res.once('end',()=>{clearTimeout(timer);const result={status:res.statusCode,body:text,headers:res.headers};log({event:'ws_handshake_response',request_headers:headers,result});resolve(result);});});
    req.once('upgrade',(res,socket,head)=>{
      clearTimeout(timer);sockets.add(socket);socket.on('error',()=>{});socket.once('close',()=>sockets.delete(socket));
      log({event:'ws_handshake_upgrade',request_headers:headers,status:res.statusCode,headers:res.headers});
      const expectedAccept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      let pending=Buffer.from(head),parseError=null,closed=false;const frames=[],states=[];
      const parse=()=>{try{while(pending.length>=2){const first=pending[0],second=pending[1];let length=second&127,header=2;if(length===126){if(pending.length<4)return;length=pending.readUInt16BE(2);header=4;}else if(length===127){if(pending.length<10)return;length=Number(pending.readBigUInt64BE(2));header=10;}assert.equal(second&128,0,'Server frames must be unmasked');assert.ok(length<=1024*1024);if(pending.length<header+length)return;const payload=pending.subarray(header,header+length),opcode=first&15;pending=pending.subarray(header+length);assert.equal(first&128,128,'Expected complete state frames');const entry={opcode,bytes:length,at:new Date().toISOString()};if(opcode===1){const value=JSON.parse(payload.toString('utf8'));states.push(value);entry.value=value;}else if(opcode===8){entry.close_code=payload.length>=2?payload.readUInt16BE(0):null;}else if(opcode===9)socket.write(clientFrame(10,payload));frames.push(entry);log({event:'ws_frame',...entry});}}catch(error){parseError=error;socket.destroy();}};
      socket.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);parse();});socket.once('close',()=>{closed=true;});parse();
      resolve({status:res.statusCode,headers:res.headers,socket,frames,states,expectedAccept,get error(){return parseError;},get closed(){return closed;},async waitState(sequence){const deadline=Date.now()+5000;while(Date.now()<deadline){if(parseError)throw parseError;const state=states.find(value=>value.type==='state'&&value.state?.event_seq===sequence);if(state)return state.state;if(closed)throw new Error('WS closed before expected state');await sleep(10);}throw new Error(`WS state timeout ${sequence}`);},async close(){if(!closed){socket.write(clientFrame(8,Buffer.from([3,232])));const deadline=Date.now()+3000;while(!closed&&Date.now()<deadline)await sleep(10);}assert.equal(closed,true,'Peer close must complete');assert.ok(frames.some(x=>x.opcode===8&&x.close_code===1000),'Expected close1000 acknowledgement');}});
    });req.end();
  });
}

test('Park proxy exact local origin reaches real engine, while invalid origins/hosts never forward',{timeout:120000},async()=>{
  let engine,proxyServer,relayServer,engineBase,websocket,primaryError;
  const proxySockets=new Set(),relaySockets=new Set(),outgoingSockets=new Set(),clientSockets=new Set(),forwarded=[],checks=[];
  const report={run_id:runId,started_at:new Date().toISOString(),expected_binary_sha256:expectedBinary,classification:'Isolated correctness fixture; no Park server launched; no performance measurement',allowed_engine_origins:'http://127.0.0.1:5175'};
  const forward=req=>{const entry={ordinal:forwarded.length+1,at:new Date().toISOString(),method:req.method,url:req.url,headers:req.headers};forwarded.push(entry);log({event:'backend_forward',...entry});};
  try {
    report.protected_before=protectedState();
    const source=path.join(root,'engine','target','release','leave-engine.exe');verifyExpectedBinary(source,expectedBinary);
    fs.mkdirSync(path.join(runDir,'bin'));const binary=path.join(runDir,'bin','leave-engine.exe');fs.copyFileSync(source,binary,fs.constants.COPYFILE_EXCL);verifyExpectedBinary(binary,expectedBinary);
    report.source_hashes={test:sha256File(fileURLToPath(import.meta.url)),proxy:sha256File(path.join(root,'..','park','server','trading-proxy.mjs')),engine:sha256File(binary)};
    assert.equal(report.source_hashes.proxy,expectedProxy,'Proxy source changed after coordinated ready signal');
    const enginePort=await freePort();assert.notEqual(enginePort,8787);engineBase=`http://127.0.0.1:${enginePort}`;
    const data=path.join(runDir,'data'),stdoutPath=path.join(runDir,'engine.stdout.log'),stderrPath=path.join(runDir,'engine.stderr.log');
    const stdout=fs.openSync(stdoutPath,'wx'),stderr=fs.openSync(stderrPath,'wx');
    const child=spawn(binary,[],{cwd:path.join(root,'engine'),windowsHide:true,env:{...process.env,ENGINE_BIND:`127.0.0.1:${enginePort}`,ENGINE_DATA_DIR:data,ALLOWED_ORIGINS:report.allowed_engine_origins},stdio:['ignore',stdout,stderr]});
    engine=monitorBenchmarkChild(child,'isolated-proxy-engine',log);fs.closeSync(stdout);fs.closeSync(stderr);report.owned_engine_pid=child.pid;report.engine_port=enginePort;
    await waitForOwnedReady({monitor:engine,url:engineBase+'/health',hasReadyLog:()=>engineReadyLog(stderrPath,`127.0.0.1:${enginePort}`,data),timeout:15000});
    relayServer=http.createServer((req,res)=>{forward(req);const upstream=http.request(new URL(req.url,engineBase),{method:req.method,headers:req.headers,agent:false},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.setTimeout(5000,()=>upstream.destroy(new Error('Relay timeout')));upstream.on('error',()=>res.destroy());req.on('aborted',()=>upstream.destroy());req.pipe(upstream);});
    track(relayServer,relaySockets);
    relayServer.on('upgrade',(req,socket,head)=>{forward(req);const upstream=net.connect(enginePort,'127.0.0.1');outgoingSockets.add(upstream);upstream.on('error',()=>socket.destroy());upstream.once('close',()=>{outgoingSockets.delete(upstream);socket.destroy();});socket.once('close',()=>upstream.destroy());upstream.once('connect',()=>{upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${Object.entries(req.headers).map(([key,value])=>`${key}: ${value}`).join('\r\n')}\r\n\r\n`);if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});});
    const relayPort=await listen(relayServer),proxy=createTradingProxy(`http://127.0.0.1:${relayPort}`,{timeout:5000});
    proxyServer=http.createServer(proxy.request);proxyServer.on('upgrade',proxy.upgrade);track(proxyServer,proxySockets);
    const proxyPort=await listen(proxyServer),base=`http://127.0.0.1:${proxyPort}`,origin=base;
    report.relay_port=relayPort;report.proxy_port=proxyPort;assert.notEqual(proxyPort,5175);assert.notEqual(proxyPort,5190);
    const request=(account,id,action,overrides={})=>call(base,'/trading/backend/api/commands',{method:'POST',headers:{origin,'x-session-token':`demo-${account}`,...overrides},body:{request_id:id,action}});
    const place=(side,price,quantity)=>({type:'place',side,price,quantity});
    assert.equal((await call(engineBase,'/api/commands',{method:'POST',headers:{origin},body:{request_id:'direct-origin-denied',action:place('buy',900,1)}})).status,403);
    const initial=(await call(engineBase,'/api/state')).body;assert.equal(initial.command_seq,0);save('initial-state.json',initial);checks.push('fixture Origin differs from allowed5175 and direct engine POST is403');
    websocket=await wsOpen(base,{Origin:origin},clientSockets);assert.equal(websocket.status,101);assert.equal(websocket.headers['sec-websocket-accept'],websocket.expectedAccept);assert.deepEqual(await websocket.waitState(0),initial);
    const maker=await request('user-02','proxy-maker',place('sell',1000,5));assert.equal(maker.status,200);assert.equal(maker.body.durable,true);assert.equal(maker.body.status,'accepted');
    const taker=await request('user-01','proxy-taker',place('buy',1100,2));assert.equal(taker.status,200);assert.equal(taker.body.durable,true);assert.equal(taker.body.trades.length,1);assert.equal(taker.body.trades[0].price,1000);assert.equal(taker.body.trades[0].quantity,2);
    const filled=(await call(base,'/trading/backend/api/state',{headers:{origin}})).body;assert.deepEqual(await websocket.waitState(2),filled);
    const seller=filled.accounts.find(x=>x.id==='user-02'),buyer=filled.accounts.find(x=>x.id==='user-01');
    assert.deepEqual([seller.points_available,seller.points_reserved,seller.hours_available,seller.hours_reserved],[1002000,0,995,3]);assert.deepEqual([buyer.points_available,buyer.points_reserved,buyer.hours_available,buyer.hours_reserved],[998000,0,1002,0]);assert.equal(filled.total_points,15000000);assert.equal(filled.total_hours,15000);
    const retry=await request('user-01','proxy-taker',place('buy',1100,2));assert.deepEqual(retry.body,{...taker.body,duplicate:true});assert.deepEqual((await call(base,'/trading/backend/api/state',{headers:{origin}})).body,filled);
    const lookup=await call(base,'/trading/backend/api/requests/proxy-taker',{headers:{origin}});assert.deepEqual(lookup.body,taker.body);checks.push('real makerprice settlement reserves balances and sameID retry oneeffect');
    const cancelled=await request('user-02','proxy-cancel',{type:'cancel',order_id:maker.body.order_id});assert.equal(cancelled.body.status,'accepted');assert.equal(cancelled.body.durable,true);
    const final=(await call(base,'/trading/backend/api/state',{headers:{origin}})).body;assert.equal(final.command_seq,3);assert.equal(final.volume,2);assert.deepEqual(final.bids,[]);assert.deepEqual(final.asks,[]);assert.ok(final.accounts.every(x=>x.points_reserved===0&&x.hours_reserved===0));assert.deepEqual(await websocket.waitState(3),final);save('final-state.json',final);
    for(const hostname of ['localhost','[::1]']) {const alias=`${hostname}:${proxyPort}`;assert.equal((await call(base,'/trading/backend/api/state',{headers:{Host:alias,Origin:`http://${alias}`}})).status,200);}
    const invalidToken=await request('user-01','bad-token',place('buy',900,1),{'x-session-token':'not-a-demo-token'});assert.equal(invalidToken.status,401);checks.push('local aliases accepted and authentication still enforced');
    assert.ok(forwarded.every(x=>x.headers.origin===undefined),'Allowed Origin must be removed upstream');assert.ok(forwarded.some(x=>x.url==='/api/commands'&&x.headers['x-session-token']==='demo-user-02'),'Seller session token preserved');assert.ok(forwarded.some(x=>x.url==='/ws'&&x.headers['x-session-token']==='demo-user-01'),'WS session header preserved');
    const denied=[
      ['cross-origin',{Origin:'https://unapproved.invalid'}],['wrong-loopback-port',{Origin:'http://127.0.0.1:5175'}],['wrong-scheme',{Origin:`https://127.0.0.1:${proxyPort}`}],['alias-origin-mismatch',{Origin:`http://localhost:${proxyPort}`}],['opaque-null',{Origin:'null'}],['malformed-origin',{Origin:'http://['}],['path-origin',{Origin:`${origin}/path`}],['credential-origin',{Origin:`http://evil@127.0.0.1:${proxyPort}`}],['evil-host',{Host:`evil.invalid:${proxyPort}`,Origin:`http://evil.invalid:${proxyPort}`}],['wrong-host-port',{Host:'127.0.0.1:5175',Origin:'http://127.0.0.1:5175'}],['evil-host-no-origin',{Host:`evil.invalid:${proxyPort}`}],
    ];
    const deniedResults=[];
    for(const [name,headers] of denied) {
      const before=forwarded.length;
      const httpResult=await call(base,'/trading/backend/api/commands',{method:'POST',headers,body:{request_id:`denied-${name}`,action:place('buy',900,1)}});assert.equal(httpResult.status,403,name);
      const wsResult=await wsOpen(base,headers,clientSockets);assert.equal(wsResult.status,403,`WS ${name}`);
      assert.equal(forwarded.length,before,`${name} must not reach backend`);deniedResults.push({name,headers,http_status:httpResult.status,ws_status:wsResult.status,backend_forward_delta:forwarded.length-before});
    }
    assert.deepEqual((await call(engineBase,'/api/state')).body,final);checks.push('11invalid origin/host cases rejected for POSTandWS before backend with0forwarding');
    await websocket.close();checks.push('WS101 initial+eventstate exact and close1000');
    save('denied-cases.json',deniedResults);save('forwarded-requests.json',forwarded);save('valid-results.json',{maker,taker,retry,lookup,cancelled,invalidToken});report.workload_complete=true;
  } catch(error){primaryError=error;report.failure={message:error.message,stack:error.stack};}
  finally {
    const cleanupErrors=[];
    for(const socket of [...clientSockets,...outgoingSockets])socket.destroy();
    try{await closeServer(proxyServer,proxySockets);}catch(error){cleanupErrors.push(error.message);}
    try{await closeServer(relayServer,relaySockets);}catch(error){cleanupErrors.push(error.message);}
    if(engine){
      try{if(!engine.state.exited&&engine.state.spawned)report.shutdown_response=await call(engineBase,'/api/admin/shutdown',{method:'POST'});}catch(error){cleanupErrors.push(`shutdown: ${error.message}`);}
      try{report.engine_exit=await settleBenchmarkChild(engine,{graceMs:15000,forceMs:5000});report.engine_pid_absent=!live(engine.state.pid);if(!report.engine_exit.success||!report.engine_pid_absent)cleanupErrors.push('Owned engine did not gracefully close with exit0 and absentPID');}catch(error){cleanupErrors.push(`engine exit: ${error.message}`);}
    }
    try{report.protected_after=protectedState();if(report.protected_before)assert.deepEqual(report.protected_after,report.protected_before);}catch(error){cleanupErrors.push(`protected state: ${error.message}`);}
    try{report.proxy_sha256_after=sha256File(path.join(root,'..','park','server','trading-proxy.mjs'));if(report.source_hashes)assert.equal(report.proxy_sha256_after,report.source_hashes.proxy);}catch(error){cleanupErrors.push(`proxy source: ${error.message}`);}
    report.cleanup_errors=cleanupErrors;report.checks=checks;report.forwarded_count=forwarded.length;report.remaining_fixture_sockets={proxy:proxySockets.size,relay:relaySockets.size,outgoing:outgoingSockets.size,client:clientSockets.size};
    if(Object.values(report.remaining_fixture_sockets).some(x=>x!==0))cleanupErrors.push('Fixture socket close events not fully observed');
    report.ended_at=new Date().toISOString();report.complete=report.workload_complete===true&&!primaryError&&cleanupErrors.length===0;save('report.json',report);console.log(`Evidence: ${runDir}`);
    if(!primaryError&&cleanupErrors.length)primaryError=new Error(cleanupErrors.join('; '));
  }
  if(primaryError)throw primaryError;assert.equal(report.complete,true);
});
