import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const browser=await chromium.launch({channel:'chrome'});
const report={at:new Date().toISOString(),status:'PASS',tests:[]};
for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4188');await p.waitForFunction(()=>window.pinball);
 assert.equal((await p.evaluate(()=>window.pinball.settings())).camera,'PerspectiveCamera');
 await p.locator('#view').click();await p.locator('#board').screenshot({path:`evidence/3d-${mobile?'mobile':'desktop'}-overview.png`});await p.locator('#view').click();
 await p.locator('#participants').fill(Array.from({length:60},(_,i)=>`공 ${i+1}`).join('\n'));await p.locator('[data-speed="3"]').click();await p.locator('input[value=last]').check();await p.locator('#start').click();await p.waitForFunction(()=>document.body.dataset.state==='racing');
 await p.waitForTimeout(1000);await p.locator('#pause').click();const paused=await p.evaluate(()=>window.pinball.snapshot());
 for(const label of ['입체','측면','상단']){await p.locator('.camera-angle').click();assert.match(await p.locator('.camera-angle').textContent(),new RegExp(label));await p.waitForTimeout(80);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),paused);await p.locator('#board').screenshot({path:`evidence/3d-${mobile?'mobile':'desktop'}-${label}.png`});}
 await p.screenshot({path:`evidence/3d-${mobile?'mobile':'desktop'}-racing.png`,fullPage:true});await p.locator('#pause').click();
 await p.waitForTimeout(1000);await p.screenshot({path:`evidence/3d-${mobile?'mobile':'desktop'}-live.png`,fullPage:true});await p.waitForTimeout(2000);const perf=await p.evaluate(()=>window.pinball.performance());const frames=perf.samples.filter(s=>s.state==='racing'&&s.total===60&&s.delta>0);const sorted=frames.map(s=>s.delta).sort((a,b)=>a-b);
 await p.waitForFunction(()=>['complete','invalid'].includes(document.body.dataset.state),null,{timeout:70000});const round=await p.evaluate(()=>window.pinball.exportRound());assert.equal(round.result.state,'complete');assert.equal(round.result.finishOrder.length,60);assert.equal(new Set(round.result.finishOrder.map(x=>x.id)).size,60);assert.equal(round.result.winner.id,round.result.finishOrder[59].id);assert.ok(round.result.finishOrder.every(x=>[1,2,3,4].includes(x.exitId)));
 assert.deepEqual(await p.locator('#ranking li').evaluateAll(es=>es.map(e=>e.dataset.ballId)),round.result.finishOrder.map(x=>x.id));
 const replay=await p.evaluate(async round=>{const {Race}=await import('/src/physics.js');const race=new Race(round.config,round.seed);race.start();while(!['complete','invalid'].includes(race.state))race.step();return race.finishOrder;},round);assert.deepEqual(replay,round.result.finishOrder);
 await p.locator('#board').screenshot({path:`evidence/3d-${mobile?'mobile':'desktop'}-finish.png`});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 report.tests.push({device:mobile?'mobile emulation 390x844 DPR2':'desktop 1440x1000',balls:60,speed:3,camera:'PerspectiveCamera',cameraSwitchWhilePaused:'PASS',sameBrowserReplay:'PASS',finishOrder:'PASS',frames:frames.length,fps:1000/(frames.reduce((a,b)=>a+b.delta,0)/frames.length),p95IntervalMs:sorted[Math.floor(sorted.length*.95)],meanJsMs:frames.reduce((a,b)=>a+b.cost,0)/frames.length,errors});
 console.log('PASS perspective cameras, 60 balls at 3x, exact replay',report.tests.at(-1));await context.close();
}
await browser.close();await writeFile('evidence/perspective-results.json',JSON.stringify(report,null,2));
