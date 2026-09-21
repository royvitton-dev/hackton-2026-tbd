import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const prefix=process.env.EVIDENCE_PREFIX||'05';
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),tests:[]};
try{
 for(const mobile of [false,true]){
  const device=mobile?'mobile':'desktop',c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await c.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.drawElements;WebGL2RenderingContext.prototype.drawElements=function(...args){if(window.__failNextDraw){window.__failNextDraw=false;throw new Error('Injected render failure');}return original.apply(this,args);};});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.BASE_URL||'http://127.0.0.1:4188');await p.waitForFunction(()=>window.pinball);
  for(const map of ['neon','orbit','zigzag','split','parade']){
   await p.locator(`[data-map=${map}]`).click();await p.locator('#view').click();await p.locator('#board').screenshot({path:`evidence/park-20260921/${prefix}-${device}-${map}-neon.png`});await p.locator('#view').click();
  }
  await p.locator('[data-map=neon]').click();await p.locator('#participants').fill('첫 번째 친구,두 번째 친구,세 번째 친구,우리의 오늘 주인공');await p.locator('input[name=rule][value=last]').check();await p.locator('[data-speed="3"]').click();await p.locator('#start').click();
  await p.waitForFunction(()=>document.body.dataset.state==='racing');await p.evaluate(()=>window.__failNextDraw=true);await p.waitForFunction(()=>window.pinball.settings().renderFault);
  assert.equal(await p.locator('#render-error').isVisible(),true);const frozen=await p.evaluate(()=>window.pinball.snapshot());assert.equal(frozen.state,'paused');await p.waitForTimeout(200);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),frozen);
  await p.locator('#recover-renderer').click();await p.waitForFunction(()=>!window.pinball.settings().renderFault&&document.querySelector('#render-error').hidden);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),frozen);await p.locator('#pause').click();
  await p.waitForFunction(()=>document.body.dataset.state==='complete',null,{timeout:60000});const round=await p.evaluate(()=>window.pinball.exportRound());
  assert.equal(await p.locator('#winner-splash').isVisible(),true);assert.equal(await p.locator('#splash-name').textContent(),round.result.winner.label);assert.equal(await p.locator('#winner-name').textContent(),round.result.winner.label);assert.match(await p.locator('#splash-status').textContent(),/최종 확정/);
  const font=await p.locator('#splash-name').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert.ok(font>=32);
  const replay=await p.evaluate(async r=>{const {Race}=await import(window.pinball.settings().physicsModule||'/src/physics.js');const race=new Race(r.config,r.seed);race.start();while(!['complete','invalid'].includes(race.state))race.step();return race.finishOrder;},round);assert.deepEqual(replay,round.result.finishOrder);
  await p.locator('.board-wrap').screenshot({path:`evidence/park-20260921/${prefix}-${device}-large-winner.png`});
  await p.locator('#splash-replay').click();assert.equal((await p.evaluate(()=>window.pinball.snapshot())).state,'mixing');assert.equal(await p.locator('#winner-splash').isVisible(),false);await p.locator('#reset').click();
  assert.deepEqual(errors,[]);report.tests.push({device,renderFailure:'caught and paused',recovery:'same positions and exact replay',winnerFontPx:font,largeWinner:'PASS',replay:'PASS',errors});console.log('PASS recovery and large winner',report.tests.at(-1));await c.close();
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(`evidence/park-20260921/${prefix}-winner-recovery-results.json`,JSON.stringify(report,null,2));await browser.close();}
