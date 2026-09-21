import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const prefix=process.env.EVIDENCE_PREFIX||'28',base=process.env.BASE_URL||'http://127.0.0.1:4189/dist/index.html';
const report={at:new Date().toISOString(),base,status:'RUNNING',tests:[]},browser=await chromium.launch({channel:'chrome'});
try{for(const mobile of [false,true]){
 const device=mobile?'mobile-emulation':'desktop',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>window.pinball);await page.evaluate(()=>{window.__resultTransitions=[];new MutationObserver(()=>{if(!document.getElementById('winner-splash').hidden)window.__resultTransitions.push({state:window.pinball.snapshot().state,bodyState:document.body.dataset.state,startDisabled:document.getElementById('start').disabled});}).observe(document.getElementById('winner-splash'),{attributes:true,attributeFilter:['hidden']});});await page.locator('[data-speed="3"]').click();
 for(const mode of ['player','lotto']){
  if(mode==='player')await page.locator('#participants').fill('병우,종호,동길,태성,순수');else await page.locator('#tab-lotto').click();
  await page.locator('#start').focus();await page.keyboard.press('Enter');await page.locator('#half-view').click();
  await page.waitForFunction(()=>['complete','invalid'].includes(window.pinball.snapshot().state),null,{timeout:65000});
  const round=await page.evaluate(()=>window.pinball.exportRound());assert.equal(round.result.state,'complete');
  const focus=await page.evaluate(()=>document.activeElement.id);report.lastObservedFocus={device,mode,id:focus};
  assert.equal(focus,'splash-name','The result heading must receive focus when the winner is shown');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'splash-replay');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'splash-close');
  await page.keyboard.press(mode==='player'?'Escape':'Enter');assert.equal(await page.locator('#winner-splash').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'winner-name');assert.equal((await page.evaluate(()=>window.pinball.settings())).focusMode,false);assert.deepEqual((await page.evaluate(()=>window.pinball.exportRound())).result,round.result);
  await page.locator('#start').focus();await page.keyboard.press('Enter');const next=await page.evaluate(()=>window.pinball.snapshot());assert.equal(next.state,'mixing');assert.notEqual(next.roundId,round.result.roundId);await page.waitForFunction(()=>['complete','invalid'].includes(window.pinball.snapshot().state),null,{timeout:65000});assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'complete');assert.equal(await page.evaluate(()=>document.activeElement.id),'splash-name');
  await page.screenshot({path:`evidence/park-20260921/${prefix}-keyboard-${device}-${mode}.png`,fullPage:true});
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');assert.equal(await page.locator('#winner-splash').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'pause');
  await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'paused');await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');
  await page.locator('#reset').click();assert.equal(await page.locator('#winner-splash').isVisible(),false);report.tests.push({device,mode,status:'PASS',focusOnResult:true,keyboardActionsReachable:true,closeMethod:mode==='player'?'Escape':'Enter on close button',closePreservesResult:true,replayAndPause:true});console.log('PASS result keyboard',device,mode);
 }
 const transitions=await page.evaluate(()=>window.__resultTransitions);assert.ok(transitions.length>=4);assert.ok(transitions.every(t=>t.state==='complete'&&t.bodyState==='complete'&&!t.startDisabled),JSON.stringify(transitions));report.tests.push({device,status:'PASS',immediateStateTransitions:transitions});assert.deepEqual(errors,[]);await context.close();
}report.status='PASS';}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error);}finally{await writeFile(`evidence/park-20260921/${prefix}-keyboard-results.json`,JSON.stringify(report,null,2));await browser.close();}
