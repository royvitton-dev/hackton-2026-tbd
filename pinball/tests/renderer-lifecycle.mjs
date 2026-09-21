import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base=process.env.BASE_URL||'http://127.0.0.1:4189/dist/index.html';
const prefix=process.env.EVIDENCE_PREFIX||'27';
const report={at:new Date().toISOString(),base,status:'RUNNING',tests:[]};
const maps=['neon','orbit','zigzag','split','parade'];
const browser=await chromium.launch({channel:'chrome'});
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function sample(page){
 await settle(page);
 return page.evaluate(()=>({graphics:window.pinball.performance().graphics,labels:document.querySelectorAll('.ball-label').length,devices:document.querySelectorAll('.device-label').length,overlays:document.querySelectorAll('.ball-labels').length,angles:document.querySelectorAll('.camera-angle').length,progress:document.querySelectorAll('.course-progress i').length,state:window.pinball.snapshot().state,renderer:window.pinball.settings().renderer}));
}
async function heap(cdp){await cdp.send('HeapProfiler.collectGarbage');const {metrics}=await cdp.send('Performance.getMetrics');return Object.fromEntries(metrics.filter(m=>['JSHeapUsedSize','Nodes','Documents','JSEventListeners'].includes(m.name)).map(m=>[m.name,m.value]));}
try{
 for(const mobile of [false,true]){
  const device=mobile?'mobile-emulation':'desktop';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.pinball);
  await page.locator('#participants').fill('병우*10, 종호*10, 동길*10, 태성*10, 순수*10, 하늘*10');
  const baseline={},cycles=[],cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  for(const map of maps){await page.locator(`[data-map=${map}]`).click();baseline[map]=await sample(page);assert.equal(baseline[map].renderer,'webgl');assert.equal(baseline[map].labels,60);assert.equal(baseline[map].progress,60);}
  const before=await heap(cdp);
  for(let cycle=1;cycle<=5;cycle++){
   for(const map of maps){
    await page.locator(`[data-map=${map}]`).click();
    // Rebuild the same course once for start and once for reset, without running
    // another exit-geometry trial on the known Garden issue.
    await page.locator('#start').click();await settle(page);
    await page.locator('#pause').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'paused');
    await page.locator('#reset').click();const current=await sample(page),expected=baseline[map];
    for(const key of ['geometries','textures','programs'])assert.equal(current.graphics[key],expected.graphics[key],`${device} ${map} cycle ${cycle}: ${key} grew`);
    for(const key of ['labels','devices','overlays','angles','progress','state','renderer'])assert.equal(current[key],expected[key],`${device} ${map} cycle ${cycle}: ${key}`);
    cycles.push({cycle,map,...current});
   }
   console.log('PASS stable render resources',device,cycle,'/ 5');
  }
  const after=await heap(cdp);assert.ok(after.JSHeapUsedSize<=before.JSHeapUsedSize*1.1+5*1024*1024,JSON.stringify({before,after}));assert.deepEqual(errors,[]);
  await page.screenshot({path:`evidence/park-20260921/${prefix}-resources-${device}.png`,fullPage:true});
  report.tests.push({device,status:'PASS',mapSelections:30,startPauseResetCycles:25,balls:60,baseline,cycles,before,after,errors,limits:'Chrome counters and forced-GC heap sample; not OS/GPU allocation or an Android WebView measurement.'});
  await context.close();
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error);}
finally{await writeFile(`evidence/park-20260921/${prefix}-resources-results.json`,JSON.stringify(report,null,2));await browser.close();}
