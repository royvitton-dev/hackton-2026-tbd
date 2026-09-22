import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const out=process.env.EVIDENCE_PREFIX||'evidence/park-20260921/34-fold';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const report={at:new Date().toISOString(),scope:'Chrome CSS viewport and density emulation, not native Android or a Fold 7 device',tests:[]};
async function reachable(page,id){const result=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return {inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});assert.ok(result.inside&&result.hit,id+' unreachable '+JSON.stringify(result));}
try{
 const page=await browser.newPage({viewport:{width:412,height:890},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:4189/');await page.waitForFunction(()=>window.pinball);
 await page.locator('#start').click();await page.locator('#pause').click();const paused=await page.evaluate(()=>window.pinball.snapshot());
 const session=await page.context().newCDPSession(page);
 // Includes a tall cover, two inner display orientations, short landscape and split window.
 for(const [width,height,dpr]of [[412,890,2.625],[840,720,2],[720,840,1.25],[890,360,2.625],[360,640,3]]){
  await page.setViewportSize({width,height});
  for(const mode of ['follow','half','full']){
   // Clear the previous CDP session override before applying changed screen metrics.
   await session.send('Emulation.clearDeviceMetricsOverride');
   await session.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:true});
   if(mode==='half')await page.locator('#half-view').click();if(mode==='full')await page.locator('#view').click();
   await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),paused,'resize changes race');
   for(const id of ['pause','half-view','view','reset','arena-sound'])await reachable(page,id);
   const graphics=await page.evaluate(()=>window.pinball.performance().graphics);assert.equal(graphics.framing.horizontal,false,'course must stay vertical');assert.equal(graphics.pixelRatio,Math.min(dpr,1.5));assert.ok(graphics.framing.canvasHeight>160);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(mode==='follow'&&height>width*1.8){assert.ok(graphics.framing.courseStartPixels/graphics.framing.canvasHeight<.15,'blank space above starting board');assert.ok(graphics.framing.courseStartPixels>=-1);}
   await writeFile(`${out}/${width}x${height}-${mode}.png`,Buffer.from((await session.send('Page.captureScreenshot',{format:'png'})).data,'base64'));report.tests.push({width,height,dpr,mode,status:'PASS',framing:graphics.framing});
  }
  await page.locator('#view').click();await page.locator('#focus-mode').click(); // keep the next follow view expanded
 }
 await page.locator('#focus-mode').click();await page.locator('#ranking-reset').click();const reset=await page.evaluate(()=>window.pinball.snapshot());assert.equal(reset.state,'ready');assert.equal(reset.finishOrder.length,0);assert.equal(reset.total,paused.total);assert.notEqual(reset.roundId,paused.roundId);await reachable(page,'start');
 await page.locator('#start').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');assert.deepEqual(errors,[]);report.tests.push({flow:'arrival-story restart clears paused round and starts a fresh race',status:'PASS'});report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e.stack);}finally{await browser.close();await writeFile(out+'/results.json',JSON.stringify(report,null,2));console.log(report.status,report.tests.length);}
