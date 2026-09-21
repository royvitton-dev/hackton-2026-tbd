import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),tests:[]};
try{
 for(const mobile of [false,true]){
  const device=mobile?'mobile':'desktop',c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.BASE_URL||'http://127.0.0.1:4188');await p.waitForFunction(()=>window.pinball);
  await p.locator('#participants').fill('별빛,구름,우주선,솜사탕,회전목마,범퍼카');await p.locator('input[name=rule][value=last]').check();await p.locator('[data-speed="3"]').click();
  const ready=await p.evaluate(()=>window.pinball.snapshot());await p.locator('#focus-mode').click();assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),ready);await p.waitForTimeout(150);
  assert.equal(await p.locator('.setup').isVisible(),false);assert.equal(await p.locator('#arena-start').isVisible(),true);
  const bounds=await p.locator('.arena-controls').evaluate(e=>({bottom:e.getBoundingClientRect().bottom,height:innerHeight}));assert.ok(bounds.bottom<=bounds.height+2,JSON.stringify(bounds));
  await p.locator('#arena-start').click();await p.waitForFunction(()=>document.body.dataset.state==='racing');await p.waitForTimeout(600);await p.locator('#pause').click();const frozen=await p.evaluate(()=>window.pinball.snapshot());
  await p.screenshot({path:`evidence/park-20260921/07-focus-${device}-paused.png`});await p.keyboard.press('Escape');assert.equal((await p.evaluate(()=>window.pinball.settings())).focusMode,false);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),frozen);
  await p.locator('#focus-mode').click();await p.locator('#pause').click();await p.waitForTimeout(700);await p.screenshot({path:`evidence/park-20260921/07-focus-${device}-live.png`});
  await p.waitForFunction(()=>document.body.dataset.state==='complete',null,{timeout:65000});assert.equal(await p.locator('#winner-splash').isVisible(),true);await p.locator('#splash-close').click();assert.equal((await p.evaluate(()=>window.pinball.settings())).focusMode,false);assert.equal(await p.locator('#winner-card').isVisible(),true);
  await p.locator('#edit').click();await p.locator('#participants').fill('');await p.locator('#focus-mode').click();await p.locator('#arena-start').click();assert.equal((await p.evaluate(()=>window.pinball.settings())).focusMode,false);assert.match(await p.locator('#input-error').textContent(),/한 명 이상/);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);report.tests.push({device,controlsInsideViewport:'PASS',pauseAndCameraLayout:'PASS',largeResultAndReturn:'PASS',invalidInputReturnsToSettings:'PASS',errors});console.log('PASS focus view',device);await c.close();
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile('evidence/park-20260921/07-focus-results.json',JSON.stringify(report,null,2));await browser.close();}
