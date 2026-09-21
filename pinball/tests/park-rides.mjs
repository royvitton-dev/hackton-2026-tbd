import {assertGameResult} from './assert-result.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const prefix=process.env.EVIDENCE_PREFIX||'02';
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),tests:[],memory:[]};
try{
 const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.BASE_URL||'http://127.0.0.1:4188'));await p.waitForFunction(()=>window.pinball);assert.match(await p.locator('.camera-angle').textContent(),/상단/);
 await p.locator('#participants').fill(Array.from({length:12},(_,i)=>`탑승객 ${i+1}`).join(','));await p.locator('input[name=rule][value=nth]').check();await p.locator('#nth').fill('12');await p.locator('[data-speed="3"]').click();
 for(const map of ['neon','orbit','zigzag','split']){
  await p.locator(`[data-map="${map}"]`).click();assert.equal(await p.locator('body').getAttribute('data-land'),map);
  await p.locator('#view').click();await p.locator('#board').screenshot({path:`evidence/park-20260921/${prefix}-${map}-overview.png`});await p.locator('#view').click();
  await p.locator('#start').click();await p.waitForFunction(()=>document.body.dataset.state==='racing');await p.waitForTimeout(2200);await p.locator('#board').screenshot({path:`evidence/park-20260921/${prefix}-${map}-live.png`});
  const graphics=await p.evaluate(()=>window.pinball.performance().graphics);
  await p.waitForFunction(()=>['complete','invalid'].includes(document.body.dataset.state),null,{timeout:70000});const round=await p.evaluate(()=>window.pinball.exportRound());assertGameResult(round.result);
  const replay=await p.evaluate(async round=>{const {Race}=await import(window.pinball.settings().physicsModule||'/src/physics.js');const r=new Race(round.config,round.seed);r.start();while(!['complete','invalid'].includes(r.state))r.step();return r.finishOrder;},round);assert.deepEqual(replay,round.result.finishOrder);
  report.tests.push({map,status:'PASS',graphics});console.log('PASS ride models',map,graphics);await p.locator('#edit').click();
 }
 await p.locator('[data-map=neon]').click();await p.waitForTimeout(150);const before=await p.evaluate(()=>window.pinball.performance().graphics);
 for(let i=0;i<40;i++){await p.locator(`[data-map="${['orbit','zigzag','split','neon'][i%4]}"]`).click();await p.waitForTimeout(40);}
 const after=await p.evaluate(()=>window.pinball.performance().graphics);assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);assert.ok(after.programs<=before.programs+1);report.memory={switches:40,before,after,status:'PASS'};console.log('PASS graphics resource stability after 40 map switches',report.memory);
 assert.deepEqual(errors,[]);report.errors=errors;report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(`evidence/park-20260921/${prefix}-rides-results.json`,JSON.stringify(report,null,2));await browser.close();}
