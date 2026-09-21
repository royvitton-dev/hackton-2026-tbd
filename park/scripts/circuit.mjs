import {chromium} from '@playwright/test';
import {mkdir,writeFile,rename,readFile,unlink,open} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url));
const base=process.env.PARK_TEST_URL||'http://localhost:5190';
const once=process.argv.includes('--once');
const delay=Math.max(1000,Number(process.env.PARK_CIRCUIT_DELAY_MS)||10000);
const runtime=path.join(root,'.park-runtime'),report=path.join(root,'park/reports/circuit');
await mkdir(runtime,{recursive:true});await mkdir(path.join(report,'screenshots'),{recursive:true});
const lock=path.join(runtime,'circuit.lock');
try{const f=await open(lock,'wx');await f.writeFile(String(process.pid));await f.close();}catch{
 const pid=Number(await readFile(lock,'utf8'));try{process.kill(pid,0);console.log(`Circuit already running: ${pid}`);process.exit(0);}catch(error){if(error.code!=='ESRCH')throw error;await unlink(lock);const f=await open(lock,'wx');await f.writeFile(String(process.pid));await f.close();}
}
const state={pid:process.pid,startedAt:new Date().toISOString(),heartbeat:null,round:0,phase:'starting',current:null,results:[],rounds:[],order:[],continuous:!once};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let browser,park,stopping=false,sequence=0;
async function atomic(file,text){const tmp=file+`.${process.pid}.${sequence++}.tmp`;await writeFile(tmp,text);await rename(tmp,file);}
async function persist(){
 state.heartbeat=new Date().toISOString();await atomic(path.join(runtime,'circuit.json'),JSON.stringify(state,null,2));await atomic(path.join(report,'results.json'),JSON.stringify(state,null,2));
 const recent=state.results.slice(0,25);
 await atomic(path.join(report,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="15"><title>Wonder Park · 무한 순회 검증</title><style>*{box-sizing:border-box}body{background:#f3f2e9;color:#304537;margin:0;padding:50px 7%;font:14px -apple-system,sans-serif}small{letter-spacing:.12em;color:#8d9c80;font-size:10px}h1{font:40px Georgia}p{color:#829177;line-height:1.8}.stats{display:flex;gap:20px;margin:30px 0}.stats>div{background:#fffdf5;border:1px solid #dde3d0;border-radius:9px;padding:22px;flex:1}.stats strong{display:block;margin-top:10px;font-size:25px;font-weight:400}table{width:100%;border-collapse:collapse;background:#fffdf5;font-size:12px}td,th{padding:16px;text-align:left;border-bottom:1px solid #e5e9dc}th{font-size:10px;color:#8e9e7c}.pass{color:#65834c}.fail{color:#b35f48}a{color:#62804c}.error{font-size:10px;max-width:400px;overflow-wrap:anywhere;color:#af7960}.note{padding:20px;background:#e9ecdf;border-radius:8px;font-size:12px;margin:25px 0}code{font-size:11px}footer{font-size:10px;color:#a0ae8d;margin-top:30px}@media(max-width:700px){body{padding:25px 15px}.stats{display:block}.stats>div{margin-bottom:10px}td,th{padding:10px 6px;font-size:10px}}</style><small>TBD WONDER PARK / CONTINUOUS ATTRACTION CHECK</small><h1>끝없이 돌아보는 작은 세계.</h1><p>어트랙션에 실제 입장해 순서대로 확인하고, 마지막 검증이 끝나면 첫 번째 어트랙션으로 돌아갑니다.</p><div class="stats"><div><small>현재 순회</small><strong>${state.round}회차</strong></div><div><small>검증 중인 어트랙션</small><strong>${esc(state.current?.name||state.phase)}</strong></div><div><small>누적 결과</small><strong><span class="pass">${state.results.filter(r=>r.status==='pass').length} 통과</span> / <span class="fail">${state.results.filter(r=>r.status==='fail').length} 실패</span></strong></div></div><p>순서: ${state.order.map(esc).join(' → ')} → 처음부터 다시</p><div class="note">상태: ${esc(state.phase)} · 최근 heartbeat: ${new Date(state.heartbeat).toLocaleString('ko-KR')}<br>이 페이지는 15초마다 갱신됩니다. heartbeat가 45초 이상 갱신되지 않으면 운영실의 프로세스 상태를 확인하세요. 실패한 어트랙션도 기록하고 다음 어트랙션으로 진행합니다. 음성 스테이지는 브라우저 입장 안내만 검증하며 사람의 마이크 발화는 실행하지 않습니다.</div><table><thead><tr><th>회차 / 시간</th><th>어트랙션</th><th>결과</th><th>확인 내용</th><th>화면</th></tr></thead><tbody>${recent.map(r=>`<tr><td>${r.round}회차<br>${new Date(r.at).toLocaleTimeString('ko-KR')}</td><td>${esc(r.name)}</td><td class="${r.status}">${r.status==='pass'?'통과':'실패'}<br>${r.duration}s</td><td>${r.checks.map(esc).join(' · ')}${r.error?`<div class="error">${esc(r.error)}</div>`:''}</td><td>${r.screenshot?`<a href="screenshots/${encodeURIComponent(r.id)}.png">최근 화면 ↗</a>`:'—'}</td></tr>`).join('')}</tbody></table><footer><a href="../">전체 품질 보고서</a> · <a href="/">파크로 돌아가기</a> · PID ${process.pid}</footer></html>`);
}
let persisting=false;
const heartbeat=setInterval(async()=>{if(persisting)return;persisting=true;try{await persist();}catch{}finally{persisting=false;}},15000);
async function launch(){browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});park=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});}
async function loadPark(){await park.goto(base,{waitUntil:'domcontentloaded',timeout:45000});await park.locator('#world[data-ready=true]').waitFor({timeout:90000});await park.waitForFunction(()=>window.__park?.getState().attractions.length>0);await park.evaluate(()=>{document.querySelector('#film').muted=true;});}
async function verifyAttraction(a){
 const began=Date.now(),result={id:a.id,name:a.name,round:state.round,at:new Date().toISOString(),status:'pass',checks:[],duration:0,screenshot:false,error:null};let child;
 const errors=[];const onError=e=>errors.push(e.message);park.on('pageerror',onError);
 try{
  if(park.isClosed())throw new Error('Park page closed');
  await park.locator(`.attraction-card[data-id=${JSON.stringify(a.id)}]`).click({timeout:20000});
  await park.locator('#detail').waitFor();assert.equal((await park.locator('#detail h2').textContent()).trim(),a.name);result.checks.push('3D 어트랙션 선택');
  await park.locator('#detail [data-enter]').click();
  if(a.id==='movie'){
   await park.locator('#cinema-ui').waitFor();await park.waitForFunction(()=>document.querySelector('#film').currentTime>.5,undefined,{timeout:25000});
   const video=await park.evaluate(()=>({duration:document.querySelector('#film').duration,texture:window.__park.view.cinema.screen.material.map.isVideoTexture}));assert(video.duration>0&&video.texture);result.checks.push('극장 입장','실제 영상 재생','3D VideoTexture');
   await park.locator('#film-play').click();await park.waitForFunction(()=>document.querySelector('#film').paused);result.checks.push('일시정지');
   await park.screenshot({path:path.join(report,'screenshots',a.id+'.png')});result.screenshot=true;await park.locator('#leave-cinema').click();
  }else if(a.hasWebApp||a.hasStaticApp||a.url){
   const link=park.locator('.launch-link');await link.waitFor({timeout:45000});const url=await link.getAttribute('href');assert(/^https?:\/\//.test(url));
   // A hidden park need not compete with the attraction for the software GPU.
   await park.evaluate(()=>window.__park.view.renderer.setAnimationLoop(null));
   child=await browser.newPage({viewport:{width:1440,height:960}});child.on('pageerror',e=>errors.push(e.message));
   const response=await child.goto(url,{waitUntil:'domcontentloaded',timeout:45000});assert(response?.ok(),`HTTP ${response?.status()}`);
   await child.waitForFunction(()=>document.body.innerText.trim().length>40,undefined,{timeout:20000});
   await child.waitForTimeout(2500);assert(!(await child.locator('vite-error-overlay').count()),'프로젝트 컴파일 오류');result.checks.push('실제 프로젝트 입장','화면 로딩');
   if(a.id==='pinball'){
    await child.locator('#start').click();await child.locator('#pause:not([disabled])').waitFor({timeout:15000});await child.locator('#pause').click();await child.locator('#pause-overlay').waitFor();result.checks.push('핀볼 시작','일시정지');
   }else if(a.id==='dopamin'){
    assert(await child.locator('canvas').count()>0,'레이싱 WebGL 캔버스 누락');result.checks.push('레이싱 WebGL 화면');
   }else if(a.id==='map'){
    result.checks.push(a.status==='construction'?'공사 중 미리보기':'지도 프로젝트 화면');
   }
   await child.screenshot({path:path.join(report,'screenshots',a.id+'.png')});result.screenshot=true;
   await child.close();child=null;await park.bringToFront();
   await park.locator('#modal .modal-close').click();
  }else if(a.id==='voice'){
   assert((await park.locator('.command-box').textContent()).includes('npm start'));assert(await park.locator('.voice-steps>span').count()===3);result.checks.push('음성 스테이지 입장','호출·명령·실행 안내','네이티브 음성 실행 제외');
   await park.screenshot({path:path.join(report,'screenshots',a.id+'.png')});result.screenshot=true;await park.locator('#modal .modal-close').click();
  }else{throw new Error('프로젝트 입장 경로가 아직 준비되지 않았습니다.');}
  assert.equal(errors.length,0,errors.join('\n'));result.checks.push('브라우저 예외 없음');
  if(await park.locator('#detail').isVisible())await park.locator('.detail-close').click();
 }catch(error){result.status='fail';result.error=[String(error.message),...errors].join('\n').slice(0,1500);try{await (child||park).screenshot({path:path.join(report,'screenshots',a.id+'.png'),timeout:10000});result.screenshot=true;}catch{}try{await loadPark();}catch{}}
 finally{park.off('pageerror',onError);await child?.close().catch(()=>{});await park.evaluate(()=>window.__park.view.renderer.setAnimationLoop(window.__park.view.frame)).catch(()=>{});result.duration=+((Date.now()-began)/1000).toFixed(1);}
 return result;
}
async function stop(){if(stopping)return;stopping=true;state.phase='stopped';state.current=null;clearInterval(heartbeat);await persist().catch(()=>{});await browser?.close().catch(()=>{});await unlink(lock).catch(()=>{});process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
await launch();
do{
 state.round++;state.phase='loading';state.current=null;await persist();
 try{
  await loadPark();const attractions=await park.evaluate(()=>window.__park.getState().attractions);state.order=attractions.map(a=>a.name);await persist();const roundStart=Date.now();let passed=0,failed=0;
  for(const attraction of attractions){if(stopping)break;state.phase='checking';state.current={id:attraction.id,name:attraction.name};await persist();const result=await verifyAttraction(attraction);result.status==='pass'?passed++:failed++;state.results.unshift(result);state.results=state.results.slice(0,500);console.log(`[round ${state.round}] ${result.status.toUpperCase()} ${attraction.id}: ${result.checks.join(', ')}${result.error?' · '+result.error.split('\n')[0]:''}`);await persist();}
  state.rounds.unshift({round:state.round,at:new Date().toISOString(),passed,failed,duration:Date.now()-roundStart});state.rounds=state.rounds.slice(0,50);state.phase=once?'complete':'next-round';state.current=null;await persist();
 }catch(error){console.error(error.message);state.phase='retrying';state.error=error.message;await persist();if(!browser.isConnected()){await launch();}}
 if(!once)await new Promise(r=>setTimeout(r,delay));
}while(!once&&!stopping);
const failed=state.rounds[0]?.failed||0;clearInterval(heartbeat);await browser.close();await unlink(lock).catch(()=>{});process.exitCode=failed?1:0;
