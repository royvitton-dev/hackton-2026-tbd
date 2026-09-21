import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';import {assertGameResult} from './assert-result.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),tests:[]};
try{
 for(const mobile of [false,true]){
  const device=mobile?'mobile':'desktop',c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.BASE_URL||'http://127.0.0.1:4188');await p.waitForFunction(()=>window.pinball);
  await p.locator('#participants').fill('하늘\n하늘\n구름\n별\n솜사탕\n우주선');await p.locator('[data-speed="3"]').click();
  for(const rule of ['first','nth','last']){
   await p.locator(`input[value=${rule}]`).check();if(rule==='nth')await p.locator('#nth').fill('3');
   await p.locator('#start').click();await p.waitForFunction(()=>document.body.dataset.state==='complete',null,{timeout:50000});const s=await p.evaluate(()=>window.pinball.snapshot());assertGameResult(s);
   await p.waitForTimeout(250);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),s);assert.equal(await p.locator('#winner-splash').isVisible(),true);assert.equal(await p.locator('#splash-name').textContent(),s.winner.label);
   assert.match(await p.locator('#splash-detail').textContent(),rule==='last'?/마지막 남은 공/:new RegExp(`${s.target}번째 도착`));assert.match(await p.locator('#splash-status').textContent(),/최종 확정/);
   assert.equal(await p.locator('#ranking li').count(),rule==='last'?5:s.target);
   const round=await p.evaluate(()=>window.pinball.exportRound()),replay=await p.evaluate(async r=>{const {Race}=await import(window.pinball.settings().physicsModule);const a=new Race(r.config,r.seed);a.start();while(!['complete','invalid'].includes(a.state))a.step();return a.snapshot();},round);
   const {roundId:a,...expected}=s,{roundId:b,...actual}=replay;assert.deepEqual(actual,expected);
   await p.locator('.board-wrap').screenshot({path:`evidence/park-20260921/07-end-${device}-${rule}.png`});report.tests.push({device,rule,arrivals:s.finishOrder.length,total:s.total,winner:s.winner.label,criterion:s.winner.criterion,stopped:'PASS',replay:'PASS'});console.log('PASS immediate rule end',device,rule);
   await p.locator('#edit').click();
  }
  await p.locator('input[value=last]').check();await p.locator('#participants').fill('가나다라마바사아자차'.repeat(4));await p.locator('#start').click();await p.waitForFunction(()=>document.body.dataset.state==='complete',null,{timeout:8000});const single=await p.evaluate(()=>window.pinball.snapshot());assertGameResult(single);assert.equal(single.finishOrder.length,0);assert.equal(single.winner.label.length,40);
  const size=await p.locator('#splash-name').evaluate(e=>({font:parseFloat(getComputedStyle(e).fontSize),scroll:e.scrollWidth,width:e.clientWidth}));assert.ok(size.font>=32);assert.ok(size.scroll<=size.width+1);await p.locator('.board-wrap').screenshot({path:`evidence/park-20260921/07-end-${device}-long-name.png`});
  assert.deepEqual(errors,[]);await c.close();
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile('evidence/park-20260921/07-end-rules-results.json',JSON.stringify(report,null,2));await browser.close();}
