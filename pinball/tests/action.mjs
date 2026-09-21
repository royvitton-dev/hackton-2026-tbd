import {assertGameResult} from './assert-result.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const browser=await chromium.launch({channel:'chrome'});
const report={at:new Date().toISOString(),tests:[],status:'RUNNING'};
const prefix=process.env.EVIDENCE_PREFIX||'03-action';
try{
 for(const mobile of [false,true]){
  const device=mobile?'mobile':'desktop',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'no-preference'});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto((process.env.BASE_URL||'http://127.0.0.1:4188'));await p.waitForFunction(()=>window.pinball);
  assert.equal(await p.locator('#board-motion').isChecked(),true);if(process.env.MAP_ID)await p.locator('[data-map='+process.env.MAP_ID+']').click();
  await p.locator('#participants').fill(Array.from({length:60},(_,i)=>`친구 ${i+1}`).join(','));
  await p.locator('input[name=rule][value=last]').check();await p.locator('[data-speed="3"]').click();
  if(process.env.VIEW_MODE==='half')await p.locator('#half-view').click();
  await p.locator(process.env.VIEW_MODE==='half'?'#arena-start':'#start').click();assert.equal(await p.locator('#board-motion').isDisabled(),true);
  await p.waitForFunction(()=>{const s=window.pinball.snapshot();return s.state==='racing'&&s.motion.active&&s.motion.phase>.3&&s.motion.phase<.75;},null,{timeout:25000});
  await p.locator('#board').screenshot({path:`evidence/park-20260921/${prefix}-${device}-live.png`});
  await p.locator('#pause').click();const paused=await p.evaluate(()=>window.pinball.snapshot());
  await p.waitForTimeout(220);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),paused);
  if(await p.locator('.label-toggle').count()){
   const smart=await p.locator('.ball-label:visible').count();
   const boxes=await p.locator('.ball-label:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.equal(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y,false,'smart name labels overlap');}
   const counters=await p.locator('.device-label:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
   for(const a of boxes)for(const b of counters)assert.equal(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y,false,'smart name label overlaps ride counter');
   await p.locator('.label-toggle').click();await p.waitForTimeout(80);assert.ok(await p.locator('.ball-label:visible').count()>=smart);
   assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),paused);await p.locator('.label-toggle').click();
  }
  if(process.env.VIEW_MODE==='half')await p.keyboard.press('Escape');
  await p.locator('#motion').click();assert.equal((await p.evaluate(()=>window.pinball.settings())).reduced,true);
  assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),paused);
  await p.locator('#motion').click();if(process.env.VIEW_MODE==='half')await p.locator('#focus-mode').click();await p.locator('#pause').click();
  await p.waitForTimeout(1000);const perf=await p.evaluate(()=>window.pinball.performance());
  const frames=perf.samples.filter(s=>s.state==='racing'&&s.delta>0),sorted=frames.map(s=>s.delta).sort((a,b)=>a-b);
  await p.waitForFunction(()=>['complete','invalid'].includes(document.body.dataset.state),null,{timeout:65000});
  const round=await p.evaluate(()=>window.pinball.exportRound());assertGameResult(round.result);
  const replay=await p.evaluate(async r=>{const {Race}=await import(window.pinball.settings().physicsModule||'/src/physics.js');const race=new Race(r.config,r.seed);race.start();while(!['complete','invalid'].includes(race.state))race.step();return race.finishOrder;},round);assert.deepEqual(replay,round.result.finishOrder);
  assert.deepEqual(await p.locator('#ranking li').evaluateAll(es=>es.map(e=>e.dataset.ballId)),replay.map(r=>r.id));
  await writeFile(`evidence/park-20260921/${prefix}-${device}-round.json`,JSON.stringify(round,null,2));
  if((await p.evaluate(()=>window.pinball.settings())).focusMode)await p.locator('#splash-close').click();
  await p.locator('#edit').click();await p.locator('#board-motion').uncheck();assert.equal((await p.evaluate(()=>window.pinball.snapshot())).motion.enabled,false);
  await p.locator('#participants').fill('작은 별,구름,햇살');await p.locator('#start').click();
  await p.waitForFunction(()=>window.pinball.snapshot().time>8,null,{timeout:20000});assert.equal((await p.evaluate(()=>window.pinball.snapshot())).motion.active,false);
  await p.waitForFunction(()=>document.body.dataset.state==='complete',null,{timeout:60000});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  report.tests.push({device,mapId:process.env.MAP_ID||'neon',viewMode:process.env.VIEW_MODE||'follow',balls:60,speed:3,boardMotion:true,pauseAndReducedMotion:'PASS',exactBrowserReplay:'PASS',switchOff:'PASS',frames:frames.length,fps:1000/(frames.reduce((a,b)=>a+b.delta,0)/frames.length),p95IntervalMs:sorted[Math.floor(sorted.length*.95)],meanJsMs:frames.reduce((a,b)=>a+b.cost,0)/frames.length,graphics:perf.graphics,errors});
  console.log('PASS physical board motion and impact effects',report.tests.at(-1));await context.close();
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(`evidence/park-20260921/${prefix}-browser-results.json`,JSON.stringify(report,null,2));await browser.close();}
