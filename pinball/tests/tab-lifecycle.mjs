import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const base=process.env.BASE_URL||'http://127.0.0.1:4189/dist/index.html',prefix=process.env.EVIDENCE_PREFIX||'27c';
const report={at:new Date().toISOString(),base,status:'RUNNING',tests:[],nativeAndroidTest:false,harness:'Raw CDP, headed isolated Chrome, no focus/visibility emulation'};
const profile=await mkdtemp(join(tmpdir(),'dropland-tabs-'));
// Playwright forces pages focused in its own CDP session. A separate session
// cannot release that session's capturer handle, so use normal Chrome + CDP.
const child=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-sync','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,seq=0;const pending=new Map();
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
async function evaluate(sessionId,expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
async function waitUntil(sessionId,expression){for(let i=0;i<70;i++){if(await evaluate(sessionId,expression))return;await sleep(100);}throw new Error('Timed out: '+expression+'; '+JSON.stringify(await evaluate(sessionId,"({visibility:document.visibilityState,state:window.pinball?.snapshot()?.state})")));}
try{
 let endpoint;
 for(let i=0;i<100;i++){try{const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');endpoint=`ws://127.0.0.1:${port}${path}`;break;}catch{await sleep(100);}}
 assert.ok(endpoint,'Chrome debugger did not start');socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const p=pending.get(message.id);pending.delete(message.id);clearTimeout(p.timer);if(message.error)p.reject(new Error(JSON.stringify(message.error)));else p.resolve(message.result);}});
 const {targetId}=await send('Target.createTarget',{url:base});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});await send('Page.enable',{},sessionId);
 const other=(await send('Target.createTarget',{url:'about:blank'})).targetId;await send('Target.activateTarget',{targetId});
 await waitUntil(sessionId,"!!window.pinball && document.visibilityState==='visible'");
 await evaluate(sessionId,"document.getElementById('participants').value='병우*10, 종호*10, 동길*10, 태성*10, 순수*10, 하늘*10';document.getElementById('participants').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('input[name=rule][value=last]').click();");
 for(const phase of ['mixing','countdown','racing']){
  await evaluate(sessionId,"document.getElementById('start').click()");await waitUntil(sessionId,`window.pinball.snapshot().state===${JSON.stringify(phase)}`);
  await waitUntil(sessionId,'window.pinball.screenAwake().held');
  const roundId=await evaluate(sessionId,'window.pinball.snapshot().roundId');await send('Target.activateTarget',{targetId:other});
  await waitUntil(sessionId,"document.visibilityState==='hidden'&&window.pinball.snapshot().state==='paused'");
  await waitUntil(sessionId,'!window.pinball.screenAwake().held');
  const frozen=await evaluate(sessionId,'window.pinball.snapshot()');assert.equal(frozen.roundId,roundId);
  await sleep(900);assert.deepEqual(await evaluate(sessionId,'window.pinball.snapshot()'),frozen,'Hidden tab advanced');
  await send('Target.activateTarget',{targetId});await waitUntil(sessionId,"document.visibilityState==='visible'");await sleep(250);
  assert.deepEqual(await evaluate(sessionId,'window.pinball.snapshot()'),frozen,'Returning automatically resumed');
  assert.equal(await evaluate(sessionId,"document.getElementById('pause-overlay').hidden"),false);await evaluate(sessionId,"document.getElementById('pause').click()");
  await waitUntil(sessionId,`window.pinball.snapshot().state===${JSON.stringify(phase)}`);await sleep(150);
  await waitUntil(sessionId,'window.pinball.screenAwake().held');
  const resumed=await evaluate(sessionId,'window.pinball.snapshot()');assert.equal(resumed.roundId,roundId);assert.notDeepEqual(resumed.balls,frozen.balls);assert.equal(resumed.finishOrder.length,frozen.finishOrder.length);
  report.tests.push({phase,status:'PASS',roundId,visibility:'actual hidden tab',hiddenSnapshot:frozen,resumedSnapshot:resumed});console.log('PASS actual hidden-tab pause and explicit resume',phase);
  await evaluate(sessionId,"document.getElementById('reset').click()");
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error);}
finally{
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
 if(child.exitCode===null&&!child.signalCode){await Promise.race([once(child,'exit'),sleep(3000)]);if(child.exitCode===null&&!child.signalCode)child.kill('SIGTERM');}
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser closed'));}pending.clear();
 report.chromeStopped=child.exitCode!==null||!!child.signalCode;
 await writeFile(`evidence/park-20260921/${prefix}-tab-lifecycle-results.json`,JSON.stringify(report,null,2));
 if(report.chromeStopped)await rm(profile,{recursive:true,force:true});
}
