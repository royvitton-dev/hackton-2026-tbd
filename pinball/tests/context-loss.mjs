import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href),prefix=process.env.EVIDENCE_PREFIX||'29',base=process.env.BASE_URL||'http://127.0.0.1:4189/dist/index.html';
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),base,status:'RUNNING',scope:'Chrome WebGL context loss induced by WEBGL_lose_context; not a real device GPU failure',tests:[]};
try{for(const mobile of [false,true]){
 const device=mobile?'mobile-emulation':'desktop',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>window.pinball);await page.locator('#participants').fill('병우*10,종호*10,동길*10,태성*10,순수*10,하늘*10');await page.locator('input[name=rule][value=last]').check();await page.locator('[data-speed="3"]').click();await page.locator('#start').click();
 await page.waitForFunction(()=>{const r=window.pinball.snapshot();return r.state==='racing'&&r.finishOrder.length>=3;},null,{timeout:60000});
 for(const phase of ['racing','complete','ready']){
  if(phase==='complete')await page.waitForFunction(()=>['complete','invalid'].includes(window.pinball.snapshot().state),null,{timeout:60000});
  if(phase==='ready')await page.locator('#reset').click();
  assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,phase);
  await page.evaluate(()=>{const canvas=document.getElementById('board');window.__lossExtension=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!window.__lossExtension)throw new Error('WEBGL_lose_context unavailable');window.__lossExtension.loseContext();});
  await page.waitForFunction(()=>document.getElementById('board').getContext('webgl2').isContextLost());await page.waitForTimeout(100);
  const frozen=await page.evaluate(()=>window.pinball.snapshot()),hud=await page.locator('.camera-hud').textContent();
  report.lastObserved={device,phase,settings:await page.evaluate(()=>window.pinball.settings()),state:frozen.state,errorVisible:await page.locator('#render-error').isVisible(),startDisabled:await page.locator('#start').isDisabled(),pauseDisabled:await page.locator('#pause').isDisabled(),hud};
  // Retain direct evidence if the original bug still allows blind play.
  if(phase==='racing'&&await page.locator('#pause').isEnabled()){await page.locator('#pause').click();await page.waitForTimeout(150);report.lastObserved.blindResume=await page.evaluate(()=>({state:window.pinball.snapshot().state,time:window.pinball.snapshot().time,contextLost:document.getElementById('board').getContext('webgl2').isContextLost()}));}
  assert.equal(report.lastObserved.settings.renderFault,true,'Lost graphics must block gameplay');assert.equal(report.lastObserved.errorVisible,true);assert.equal(report.lastObserved.startDisabled,true);assert.equal(report.lastObserved.pauseDisabled,true);assert.equal(await page.locator('#recover-renderer').isDisabled(),true);assert.equal(frozen.state,phase==='racing'?'paused':phase);
  await page.evaluate(()=>{document.getElementById('recover-renderer').click();document.getElementById('start').click();document.getElementById('arena-start').click();document.activeElement.blur();});await page.keyboard.press('Space');await page.waitForTimeout(180);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),frozen);
  await page.screenshot({path:`evidence/park-20260921/${prefix}-${device}-${phase}-lost.png`,fullPage:true});
  await page.evaluate(()=>window.__lossExtension.restoreContext());await page.waitForFunction(()=>!document.getElementById('board').getContext('webgl2').isContextLost()&&!document.getElementById('recover-renderer').disabled);
  assert.equal((await page.evaluate(()=>window.pinball.settings())).renderFault,true);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),frozen);
  await page.locator('#recover-renderer').click();await page.waitForFunction(()=>!window.pinball.settings().renderFault&&window.pinball.performance().graphics.drawCalls>0);await page.waitForTimeout(150);
  assert.equal(await page.locator('#render-error').isVisible(),false);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),frozen);assert.equal(await page.locator('.camera-hud').textContent(),hud,'Recovery must keep the paused course sector');assert.equal(await page.locator('.ball-label').count(),60);
  await page.screenshot({path:`evidence/park-20260921/${prefix}-${device}-${phase}-restored.png`,fullPage:true});
  if(phase==='racing'){assert.equal(await page.locator('#pause').isEnabled(),true);await page.locator('#pause').click();}
  if(phase==='complete'){
   assert.equal(await page.locator('#winner-splash').isVisible(),true);const round=await page.evaluate(()=>window.pinball.exportRound());assert.equal(round.result.finishOrder.length,59);assert.ok(!round.result.finishOrder.some(r=>r.id===round.result.winner.id));
   const replay=await page.evaluate(async round=>{const {Race}=await import(window.pinball.settings().physicsModule);const r=new Race(round.config,round.seed);r.start();while(!['complete','invalid'].includes(r.state))r.step();const {roundId,...rest}=r.snapshot();return rest;},round);const {roundId,...actual}=round.result;assert.deepEqual(actual,replay);
  }
  report.tests.push({device,phase,status:'PASS',preservedState:frozen.state,rankCount:frozen.finishOrder.length,cameraHUD:hud,explicitRecovery:true,automaticResume:false});console.log('PASS context recovery',device,phase);
 }
 assert.deepEqual(errors,[]);await context.close();
}report.status='PASS';}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error);}finally{await writeFile(`evidence/park-20260921/${prefix}-context-loss-results.json`,JSON.stringify(report,null,2));await browser.close();}
