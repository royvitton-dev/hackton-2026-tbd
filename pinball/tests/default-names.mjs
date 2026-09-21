import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const expected=['병우','종호','동길','태성','순수'].sort(),prefix=process.env.EVIDENCE_PREFIX||'23';
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),status:'RUNNING',tests:[]};
try{for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop',context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],orders=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<4;i++){
  if(i)await page.reload();else await page.goto(process.env.BASE_URL||'http://127.0.0.1:4189/dist/index.html');
  await page.waitForFunction(()=>window.pinball);const input=await page.locator('#participants').inputValue();orders.push(input);
  assert.deepEqual(input.split(',').map(s=>s.trim()).sort(),expected);
  const round=await page.evaluate(()=>window.pinball.exportRound());assert.equal(round.result.total,5);assert.deepEqual(round.config.people.map(p=>p.name).sort(),expected);assert.ok(round.config.people.every(p=>p.count===1));
 }
 assert.ok(new Set(orders).size>1,'Observed random page-load orders should vary in this sample.');
 await page.screenshot({path:`evidence/park-20260921/${prefix}-defaults-${device}.png`,fullPage:true});
 const edited='병우*3, 종호';await page.locator('#participants').fill(edited);assert.equal((await page.evaluate(()=>window.pinball.snapshot())).total,4);
 await page.locator('#tab-lotto').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).total,45);await page.locator('#tab-player').click();
 await page.locator('[data-map=parade]').click();await page.locator('input[name=rule][value=last]').check();assert.equal(await page.locator('#participants').inputValue(),edited);
 await page.locator('#start').click();assert.equal(await page.locator('#participants').isDisabled(),true);await page.locator('#pause').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'paused');
 await page.locator('#reset').click();assert.equal(await page.locator('#participants').inputValue(),edited);assert.equal((await page.evaluate(()=>window.pinball.snapshot())).total,4);assert.equal(await page.locator('#participants').isDisabled(),false);
 assert.deepEqual(errors,[]);report.tests.push({device,status:'PASS',orders,editedInputPreserved:true,editedBalls:4,builtAssets:true,errors});await context.close();console.log('PASS default names, shuffle and editable input',device);
}report.status='PASS';}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}
finally{await writeFile(`evidence/park-20260921/${prefix}-defaults-results.json`,JSON.stringify(report,null,2));await browser.close();}
