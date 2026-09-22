import {chromium} from '../../node_modules/playwright/index.mjs';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startTradingDemo} from './tour-trading.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'assets/tour-demo'),scratch=path.join(root,'.movie-runtime/live-inspect');
const base=process.env.PARK_URL||'http://127.0.0.1:5190';
await mkdir(out,{recursive:true});await mkdir(scratch,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader']});
let context,page,encoder,proof,errors,cleanup;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function capture(seconds){
 const fps=20,start=performance.now(),frames=Math.round(seconds*fps);
 for(let i=0;i<frames;i++){
  const delay=start+i*1000/fps-performance.now();if(delay>0)await wait(delay);
  const frame=await page.screenshot({type:'jpeg',quality:94});
  if(!encoder.stdin.write(frame))await once(encoder.stdin,'drain');
 }
 proof.recordedSeconds=(proof.recordedSeconds||0)+seconds;
}
async function shot(name){await page.screenshot({path:path.join(scratch,`${proof.id}-${name}.png`)});}
async function drag(selector,dx,dy){const b=await page.locator(selector).boundingBox();assert(b);await page.mouse.move(b.x+b.width*.55,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.55+dx,b.y+b.height*.5+dy,{steps:25});await page.mouse.up();}
const demos={
 trading:async()=>{
  const demo=await startTradingDemo();cleanup=demo.close;
  await page.goto(demo.url);await page.waitForFunction(()=>document.querySelector('#session-select')?.options.length>0);
  const token=await page.locator('#session-select option').evaluateAll(opts=>opts.find(o=>o.value.includes('user-01'))?.value||opts[0].value);await page.locator('#session-select').selectOption(token);await page.waitForTimeout(1000);
  const state=async()=>{const r=await fetch(demo.api+'/api/state',{headers:{'x-session-token':'demo-user-01'}});assert(r.ok);return r.json();};
  const before=await state();proof.before=before.accounts.find(a=>a.id==='user-01');proof.engine='actual Rust leave-engine; isolated local demo';
  await capture(2);const quote=await state();await page.locator('#price').fill(String((quote.asks[0]?.price||quote.last_price)+20));await page.locator('#quantity').fill('3');await capture(1);
  await page.getByRole('button',{name:'휴가 매수하기',exact:true}).click();await page.waitForSelector('.request-status.accepted');await page.locator('.request-status.accepted').scrollIntoViewIfNeeded();await capture(3);
  const after=await state();proof.after=after.accounts.find(a=>a.id==='user-01');proof.result=await page.locator('.request-status.accepted').innerText();assert(proof.after.hours_available>proof.before.hours_available);assert(proof.result.includes('체결'));
  proof.features=['12개 실제 봇의 호가와 체결','지정가 매수 주문','체결 결과와 잔고 갱신'];await shot('order');
 },
 dopamin:async()=>{
  await page.goto(base+'/dopamin/');await page.getByRole('button',{name:'사운드 끄기'}).click();
  await page.locator('.start-race').click();await page.waitForTimeout(2700);
  await page.locator('.live-stage').scrollIntoViewIfNeeded();
  proof.before=await page.locator('.race-timer').innerText();
  await capture(3);await page.getByRole('button',{name:'전체 트랙 보기',exact:true}).click();await capture(3);
  proof.after=await page.locator('.race-timer').innerText();assert.notEqual(proof.before,proof.after);
  await shot('race');
  // Finish the same real race using the game's playback speed control.
  await page.getByRole('button',{name:'재생 속도 1배',exact:true}).click();await page.getByRole('button',{name:'재생 속도 2배',exact:true}).click();
  await page.waitForSelector('.podium-canvas[data-ready="true"]',{timeout:45000});await page.locator('.live-stage').scrollIntoViewIfNeeded();
  await capture(5);
  proof.podium=await page.locator('.podium-canvas').evaluate(el=>({...el.dataset}));
  proof.ranks=await page.locator('.podium-places li').evaluateAll(list=>list.map(el=>({rank:Number(el.dataset.rank),name:el.querySelector('strong').textContent})));
  assert.equal(proof.podium.trophy,'raised');assert.equal(proof.ranks.length,3);await shot('podium');
  await page.getByRole('button',{name:'커피차로 가기',exact:true}).click();await page.waitForSelector('.coffee-canvas[data-ready="true"]');await page.locator('.live-stage').scrollIntoViewIfNeeded();
  await capture(7);proof.coffee=await page.locator('.coffee-canvas').evaluate(el=>({...el.dataset}));
  assert(Number(proof.coffee.served)>=2,'The coffee truck must actually serve the racers');assert.notEqual(proof.coffee.barista,proof.podium.winner);await shot('coffee');
  proof.segments=[{id:'race',name:'레이싱',start:0,end:6},{id:'podium',name:'우승 시상식',start:6,end:11},{id:'coffee',name:'커피차',start:11,end:18}];
  proof.features=['자동 레이싱과 실시간 순위','우승 시상식과 트로피','커피차에서 커피 나누기'];
 },
 movie:async()=>{
  await page.goto(base+'/movie/');const v=page.locator('video');
  await v.evaluate(v=>{v.muted=true;v.currentTime=6;});await v.scrollIntoViewIfNeeded();
  await v.evaluate(v=>v.play());proof.before=await v.evaluate(v=>v.currentTime);await capture(3);
  await page.locator('.chapter[data-time="18.5"]').click();await v.scrollIntoViewIfNeeded();await capture(3);
  proof.after=await v.evaluate(v=>({time:v.currentTime,paused:v.paused,width:v.videoWidth}));assert(proof.after.time>20&&!proof.after.paused);
  proof.features=['실제 영화 재생','챕터를 눌러 장면 이동'];await shot('playback');
 },
 battery_health:async()=>{
  await page.goto(base+'/battery_health/?user=U0037');await page.waitForSelector('canvas[data-renderer="webgl-3d-mesh"]',{timeout:60000});await page.waitForTimeout(3000);
  const canvas='canvas[data-renderer="webgl-3d-mesh"]';proof.before=await page.locator(canvas).getAttribute('data-camera-quaternion');
  await drag(canvas,180,35);await page.getByRole('button',{name:'배터리 위치 보기',exact:true}).click();await capture(3);await shot('battery');
  proof.after=await page.locator(canvas).getAttribute('data-camera-quaternion');assert.notEqual(proof.before,proof.after);
  await page.getByRole('tab',{name:'충전 이력',exact:true}).click();await page.locator('[role="tabpanel"]').scrollIntoViewIfNeeded();await capture(3);
  proof.historyRows=await page.locator('tbody tr').count();assert(proof.historyRows>0);proof.features=['3D 차량 회전','배터리 위치 투시','충전 이력 확인 · 예시 데이터'];await shot('history');
 },
 map:async()=>{
  await page.goto(base+'/map/?capture=1');await page.waitForFunction(()=>window.__atlas?.state.catalog.length>0);
  const id=await page.evaluate(()=>window.__atlas.state.catalog.find(s=>!s.basementFloors).id);
  await page.locator(`[data-site="${id}"]`).first().click();await page.waitForFunction(()=>window.__atlas.state.plan?.walls.length>0);
  await page.locator('[data-model="2d"]').click();await capture(2);await shot('drawing');
  await page.locator('[data-model="3d"]').click();await drag('#world canvas',155,45);await capture(4);
  proof.plan=await page.evaluate(()=>({id:__atlas.state.plan.id,walls:__atlas.state.plan.walls.length,screen:__atlas.state.screen}));assert(proof.plan.walls>0);
  proof.features=['공개 원본 도면','추정 구조선 3D 변환','회전하며 공간 탐색 · 미리보기'];await shot('model');
 },
 map_new:async()=>{
  // Keep a recording on the loaded app version while the shared workspace changes.
  await page.routeWebSocket('**',socket=>{const server=socket.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['update','full-reload'].includes(JSON.parse(message).type))return;}catch{}}socket.send(message);});});
  const open=async id=>{await page.goto(base+'/map_new/?site='+id);await page.waitForFunction(id=>window.__parking?.state.plan?.id===id&&document.querySelector('#world')?.dataset.ready==='true',id);await page.evaluate(()=>document.fonts.ready);};
  await open('10000901-0');
  proof.drawing=await page.evaluate(()=>({id:__parking.state.plan.id,provenance:__parking.state.plan.provenance,walls:__parking.state.model.meshes.length}));assert(proof.drawing.walls>0);
  await page.locator('#source-thumb').click();await page.locator('dialog img').waitFor({state:'visible'});await capture(2);await shot('source');
  await page.getByRole('button',{name:'닫기',exact:true}).click();await drag('#world',100,20);await capture(3);await shot('drawing');

  await page.locator('#destination').selectOption('parking:bay-P2');await page.locator('#compact-vehicle').click();await page.locator('#speed').selectOption('2');
  proof.parking=await page.evaluate(()=>({route:__parking.state.route,before:__parking.state.pose}));assert.equal(proof.parking.route.parking.spaceId,'bay-P2');assert(proof.parking.route.ids.includes('road-start'));
  await page.locator('[data-camera="orbit"]').click();await page.mouse.move(770,520);await page.mouse.wheel(0,-180);await page.waitForTimeout(300);
  await page.locator('#play').click();await capture(4);await shot('drive');await capture(4);
  proof.parking.after=await page.evaluate(()=>({pose:__parking.state.pose,bay:__parking.state.plan.spaces.find(b=>b.id==='bay-P2')}));
  assert(proof.parking.after.pose.arrived);assert(Math.abs(proof.parking.after.pose.x-proof.parking.after.bay.x)<.3);assert(Math.abs(proof.parking.after.pose.z-proof.parking.after.bay.z)<.3);await shot('parked');

  await page.locator('[data-tab="charging"]').click();await page.waitForFunction(()=>document.querySelector('#charging-panel')?.dataset.ready==='true');
  proof.charging=await page.evaluate(()=>({source:__parking.state.radio.source,stationCount:__parking.state.radio.stations.length,selected:__parking.state.charging.selected.map(c=>({id:c.id,score:c.score})),installedChargers:__parking.state.plan.nodes.filter(n=>n.kind==='ev').length}));
  assert(proof.charging.stationCount>10);assert.equal(proof.charging.selected.length,3);assert.equal(proof.charging.installedChargers,0);await capture(2);
  await page.locator('#charge-count').selectOption('1');proof.charging.filteredCount=await page.evaluate(()=>__parking.state.charging.selected.length);assert.equal(proof.charging.filteredCount,1);await capture(2);
  await page.locator('#charge-count').selectOption('3');await page.locator('[data-candidate="bay-P3"]').click();await capture(2);await shot('charging');

  await open('integration-lab');await page.locator('#start-node').selectOption('south');await page.locator('#fire').click();await page.locator('#fire-location').selectOption('west');
  proof.evacuation=await page.evaluate(()=>({site:__parking.state.plan.id,mode:__parking.state.mode,route:__parking.state.route,before:__parking.state.travel}));assert.equal(proof.evacuation.mode,'person');assert((await page.locator('#route-message').innerText()).includes('동측 옥외 집결지'));
  await page.locator('#play').click();await capture(5);proof.evacuation.after=await page.evaluate(()=>__parking.state.travel);assert(proof.evacuation.after>proof.evacuation.before);await shot('evacuation');
  proof.segments=[{id:'drawing',name:'원본 도면 → 3D',start:0,end:5},{id:'parking',name:'주차면까지 주행',start:5,end:13},{id:'charging',name:'충전기 설치 후보',start:13,end:19},{id:'evacuation',name:'화재 우회',start:19,end:24}];
  proof.features=['공개 원본 도면과 3D 공간','외부 도로 → 주차면 진입 · 소형차 예시','공개 기지국 기반 충전기 설치 후보 비교','화재 우회 경로 · 합성 시험장'];
 },
 pinball:async()=>{
  await page.goto(base+'/pinball/');await page.waitForFunction(()=>window.pinball);
  await page.locator('#start').click();await page.locator('#focus-mode').click();await page.waitForFunction(()=>pinball.snapshot()?.state==='racing',{timeout:20000});
  proof.before=await page.evaluate(()=>pinball.snapshot());await capture(3);await page.getByRole('button',{name:'2배속',exact:true}).click();await capture(3);
  proof.after=await page.evaluate(()=>pinball.snapshot());proof.settings=await page.evaluate(()=>pinball.settings());assert.notDeepEqual(proof.before,proof.after);assert.equal(Boolean(proof.settings.renderFault),false);
  proof.features=['실제 공 물리 시뮬레이션','움직이는 놀이기구','재생 속도 전환'];await shot('balls');
 },
};
const selected=process.argv.slice(2).length?process.argv.slice(2):Object.keys(demos),failures=[];
try{for(const id of selected){
 context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(12000);errors=[];page.on('pageerror',e=>errors.push(e.message));
 proof={id,capturedAt:new Date().toISOString(),source:'actual running application',viewport:{width:1440,height:900}};
 const candidate=path.join(scratch,`${id}-candidate.mp4`);
 encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate','20','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',candidate],{stdio:['pipe','ignore','inherit']});
 encoder.stdin.on('error',()=>{});const finished=once(encoder,'close');
 try{console.log('Capturing',id);await demos[id]();encoder.stdin.end();assert.equal((await finished)[0],0);encoder=null;assert.equal(proof.recordedSeconds,{dopamin:18,map_new:24}[id]||6);proof.browserErrors=errors;assert.deepEqual(errors,[]);
  await rename(candidate,path.join(out,`${id}.mp4`));
  await writeFile(path.join(out,`${id}.json`),JSON.stringify(proof,null,2)+'\n');console.log('PASS',id,proof.features);
 }catch(e){failures.push(id);console.error('FAILED',id,e);await shot('failure').catch(()=>{});encoder?.kill('SIGTERM');encoder=null;}finally{await context.close();await cleanup?.();cleanup=null;}
}}finally{encoder?.kill('SIGTERM');await browser.close();}
assert.deepEqual(failures,[],'Every selected application must have working footage');
