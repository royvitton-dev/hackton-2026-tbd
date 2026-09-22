import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const out=process.env.LAYOUT_EVIDENCE||'evidence/park-20260921/33-layout';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={at:new Date().toISOString(),tests:[],scope:'Chrome desktop and mobile viewport emulation. No native Android/iOS execution.'};
async function reachable(page,id){
 const box=await page.locator('#'+id).boundingBox();assert.ok(box,id+' hidden');
 const view=page.viewportSize();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=view.width+1&&box.y+box.height<=view.height+1,id+' outside viewport '+JSON.stringify(box));
 const hit=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {ok:e.contains(hit),hitId:hit?.id,hitClass:hit?.className};});if(!hit.ok)await page.screenshot({path:out+'/obstructed-'+id+'.png'});assert.ok(hit.ok,id+' obstructed '+JSON.stringify(hit));
}
try{
 for(const [width,height]of (process.env.RESULT_ONLY?[]:[[1920,1080],[1440,900],[1024,768],[768,1024],[514,711],[390,844],[320,568],[844,390],[667,320]])){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<=760,hasTouch:width<=760,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4189/');await page.waitForFunction(()=>window.pinball);await page.locator('[data-map=parade]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const mode of ['half','full']){
   await page.locator(mode==='half'?'#half-view':'#view').click();
   // Start remains reachable after changing view from a scrolled settings page.
   for(const id of ['arena-start','arena-sound','half-view','view','reset'])await reachable(page,id);
   const frame=await page.evaluate(()=>window.pinball.performance().graphics.framing);
   assert.ok(frame.boardWidthPixels>0);assert.equal(frame.horizontal,frame.canvasWidth/frame.canvasHeight>1.2);
   await page.locator('#arena-start').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');
   await reachable(page,'pause');await page.locator('#pause').click();const paused=await page.evaluate(()=>window.pinball.snapshot());assert.equal(paused.state,'paused');
   await page.waitForTimeout(70);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),paused);
   await page.locator('#pause').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');await page.locator('#reset').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'ready');
   await reachable(page,'arena-start');report.tests.push({size:[width,height],mode,status:'PASS',framing:frame});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const mobile of (process.env.RESULT_ONLY?[true]:[false,true])){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4189/');await page.waitForFunction(()=>window.pinball);
  if(mobile)await page.locator('#tab-lotto').click();
  await page.locator('[data-map=parade]').click();await page.locator('[data-speed="3"]').click();await page.locator('#half-view').click();await page.locator('#arena-sound').click();await page.locator('#arena-start').click();
  await page.waitForFunction(()=>window.pinball.snapshot().state==='racing');await page.locator('#pause').click();const paused=await page.evaluate(()=>window.pinball.snapshot());
  // Rotate/resize during a paused race; camera changes but the actual race must not.
  await page.setViewportSize(mobile?{width:844,height:390}:{width:900,height:1000});await page.waitForTimeout(160);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),paused);await reachable(page,'pause');await page.locator('#pause').click();
  await page.waitForFunction(()=>['complete','invalid'].includes(window.pinball.snapshot().state),null,{timeout:70000});const round=await page.evaluate(()=>window.pinball.exportRound());
  assert.equal(round.result.state,'complete');assert.equal(round.result.finishOrder.length,mobile?7:1);assert.equal(new Set(round.result.finishOrder.map(r=>r.id)).size,round.result.finishOrder.length);
  if(mobile){const numbers=await page.locator('#splash-lotto .lotto-number').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {number:e.textContent,onScreen:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));assert.equal(numbers.length,7);assert.ok(numbers.every(n=>n.onScreen&&n.hit),'lotto number/bonus obstructed '+JSON.stringify(numbers));}
  // The result's scrollable card must allow a real replay click even in landscape.
  await page.locator('#splash-replay').scrollIntoViewIfNeeded();await reachable(page,'splash-replay');await page.screenshot({path:out+'/'+(mobile?'mobile-lotto':'desktop-player')+'-result.png'});
  await page.locator('#splash-replay').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');assert.deepEqual(errors,[]);
  await writeFile(out+'/'+(mobile?'mobile-lotto':'desktop-player')+'-round.json',JSON.stringify(round,null,2));report.tests.push({flow:mobile?'mobile lotto / landscape replay':'desktop player / portrait replay',status:'PASS',arrivals:round.result.finishOrder.length});await page.close();
 }
 report.status='PASS';console.log('PASS',report.tests.length,'responsive view and full-round checks');
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error.stack);}
finally{await browser.close();await writeFile(out+(process.env.RESULT_ONLY?'/result-recovery.json':'/results.json'),JSON.stringify(report,null,2));}
