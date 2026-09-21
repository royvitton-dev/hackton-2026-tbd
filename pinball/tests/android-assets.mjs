import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.env.APK_ASSETS),out='evidence/park-20260921/25-android-assets';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),status:'RUNNING',scope:'APK-extracted assets on emulated mobile Chrome; NOT Android device or WebView execution',tests:[]};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'}),errors=[],external=[];
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!=='https://appassets.androidplatform.net'||!u.pathname.startsWith('/assets/')){external.push(u.href);await route.abort();return;}
  const file=path.resolve(root,u.pathname.slice(8));assert.ok(file.startsWith(root+path.sep));
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain'}[path.extname(file)]||'application/octet-stream';
  await route.fulfill({status:200,contentType:mime,body:await readFile(file)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://appassets.androidplatform.net/assets/index.html');await page.waitForFunction(()=>window.pinball);
 assert.equal(await page.evaluate(()=>isSecureContext),true);assert.deepEqual((await page.locator('#participants').inputValue()).split(',').map(s=>s.trim()).sort(),['병우','종호','동길','태성','순수'].sort());
 await page.locator('[data-map=parade]').click();await page.locator('[data-speed="3"]').click();
 for(const mode of ['player','lotto']){
  if(mode==='lotto')await page.locator('#tab-lotto').click();await page.locator('#start').click();await page.waitForFunction(()=>window.pinball.snapshot().state==='racing');
  await page.locator('#pause').click();const paused=await page.evaluate(()=>window.pinball.snapshot());await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),paused);await page.locator('#pause').click();
  await page.waitForFunction(()=>['complete','invalid'].includes(window.pinball.snapshot().state),null,{timeout:70000});const r=await page.evaluate(()=>window.pinball.exportRound());assert.equal(r.result.state,'complete');assert.equal(r.result.finishOrder.length,mode==='lotto'?7:1);assert.equal(await page.locator('#winner-name').textContent(),mode==='lotto'?'행운의 번호':r.result.winner.label);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${out}-${mode}.png`,fullPage:true});await writeFile(`${out}-${mode}-round.json`,JSON.stringify(r,null,2));
  await page.locator('#splash-replay').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');await page.locator('#reset').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'ready');report.tests.push({mode,status:'PASS',arrivals:r.result.finishOrder.length});console.log('PASS APK assets',mode);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.errors=errors;report.external=external;report.status='PASS';await context.close();
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}
finally{await writeFile(`${out}-results.json`,JSON.stringify(report,null,2));await browser.close();}
