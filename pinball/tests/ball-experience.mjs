import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const out='evidence/park-20260921/36-experience';await mkdir(out,{recursive:true});
const report={at:new Date().toISOString(),tests:[],status:'RUNNING',scope:'Chrome desktop/mobile emulation, real Screen Wake Lock API; not physical display timeout or Android WebView'};
const browser=await chromium.launch({channel:'chrome',headless:false});
try{
 for(const [name,viewport,mobile] of [['desktop',{width:1440,height:960},false],['phone',{width:390,height:844},true],['fold',{width:840,height:900},true]]){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4189/dist/index.html');await page.waitForFunction(()=>window.pinball?.performance().graphics?.ballLooks?.length===5);
  assert.equal(await page.evaluate(()=>window.pinball.settings().renderer),'webgl');
  await page.locator('#participants').fill('병우, 종호, 동길, 태성, 순수, 하늘');
  await page.waitForFunction(()=>window.pinball.performance().graphics.ballLooks.length===6);
  assert.equal(new Set(await page.evaluate(()=>window.pinball.performance().graphics.ballLooks.map(b=>b.kind))).size,6);
  await page.locator('#half-view').click();await page.waitForTimeout(250);
  const before=await page.evaluate(()=>window.pinball.snapshot());
  let g=await page.evaluate(()=>window.pinball.performance().graphics);const b=g.ballLooks.find(b=>b.pick?.visible);assert.ok(b);
  const box=await page.locator('#board').boundingBox();const click=async(x,y)=>mobile?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  await click(box.x+b.pick.x,box.y+b.pick.y);await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.pinball.performance().graphics.zoom))?.kind,'ball');
  assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),before);
  await page.screenshot({path:`${out}/${name}-sports-follow.png`});
  await click(box.x+box.width*.5,box.y+box.height*.65);await page.waitForTimeout(70);assert.equal(await page.evaluate(()=>window.pinball.performance().graphics.zoom),null);
  await click(box.x+box.width*.5,box.y+box.height*.65);await page.waitForTimeout(70);assert.equal((await page.evaluate(()=>window.pinball.performance().graphics.zoom))?.kind,'area');
  await page.locator('.zoom-reset').click();assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),before);
  await page.locator('#arena-start').click();await page.waitForFunction(()=>window.pinball.screenAwake().held,{},{timeout:5000});
  assert.equal(await page.locator('#ball-look').isDisabled(),true);await page.locator('#pause').click();await page.waitForFunction(()=>!window.pinball.screenAwake().held);
  const paused=await page.evaluate(()=>window.pinball.snapshot());await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),paused);
  await page.locator('#pause').click();await page.waitForFunction(()=>window.pinball.screenAwake().held);
  await page.locator('#reset').click();await page.waitForFunction(()=>!window.pinball.screenAwake().held);
  await page.locator('#focus-mode').click();await page.locator('#ball-look').selectOption('animals');
  await page.locator('#participants').fill('병우*10, 종호*10, 동길*10, 태성*10, 순수*10, 하늘*10');await page.waitForFunction(()=>window.pinball.performance().graphics.ballLooks.length===60);
  await page.locator('#half-view').click();await page.waitForTimeout(250);
  const dense=await page.evaluate(()=>{const g=window.pinball.performance().graphics;return {visible:g.ballLooks.filter(b=>b.pick?.visible).length,labels:g.ballLooks.filter(b=>b.labelVisible).length,looks:[...new Set(g.ballLooks.map(b=>b.kind))]};});assert.equal(dense.visible,60);assert.equal(dense.labels,60);assert.equal(dense.looks.length,6);
  await page.screenshot({path:`${out}/${name}-animals-60.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  report.tests.push({name,status:'PASS',ballZoom:'PASS',areaZoom:'PASS',physicsUnchangedDuringInspection:'PASS',wakeLock:'acquire/pause-release/resume/reset-release PASS',dense,errors});console.log('PASS',name);
  await context.close();
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}
finally{await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
