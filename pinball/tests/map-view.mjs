import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const prefix=process.env.EVIDENCE_PREFIX||'15';
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),tests:[],status:'RUNNING'};
try{for(const [width,height,fallback] of [[1440,1000,false],[390,844,false],[320,700,false],[844,390,false],[390,844,true]]){
 const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',isMobile:width<900,hasTouch:width<900});
 if(fallback)await c.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.BASE_URL||'http://127.0.0.1:4189');await p.waitForFunction(()=>window.pinball);
 await p.locator('#participants').fill('별빛,구름,바이킹,솜사탕,우주선,찻잔');await p.locator('[data-speed="3"]').click();await p.locator('#start').click();await p.waitForFunction(()=>window.pinball.snapshot().state==='racing');await p.locator('#pause').click();const frozen=await p.evaluate(()=>window.pinball.snapshot());
 const views=[];for(const [id,mode]of [['view','full'],['half-view','half']]){
  await p.locator('#'+id).click();await p.waitForTimeout(120);assert.equal((await p.evaluate(()=>window.pinball.settings())).viewMode,mode);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),frozen);
  const dimensions=await p.evaluate(()=>{const r=document.querySelector('.arena').getBoundingClientRect(),b=document.querySelector('#board').getBoundingClientRect();return {width:r.width,height:r.height,vw:innerWidth,vh:innerHeight,canvasWidth:b.width,canvasHeight:b.height,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.arena-controls button')].filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})};});
  assert.equal(dimensions.width,width);assert.equal(dimensions.height,height);assert.ok(dimensions.canvasHeight>=height-151);assert.equal(dimensions.overflow,false);for(const b of dimensions.controls){assert.ok(b.left>=0&&b.right<=width+1&&b.top>=0&&b.bottom<=height+1,JSON.stringify(b));}views.push({mode,...dimensions});
  await p.screenshot({path:`evidence/park-20260921/${prefix}-${width}x${height}-${fallback?'fallback':mode}.png`});
 }
 await p.keyboard.press('Escape');assert.equal((await p.evaluate(()=>window.pinball.settings())).focusMode,false);assert.deepEqual(await p.evaluate(()=>window.pinball.snapshot()),frozen);
 await p.locator('#half-view').click();assert.equal((await p.evaluate(()=>window.pinball.settings())).viewMode,'follow');await p.locator('#half-view').click();await p.locator('#pause').click();await p.waitForFunction(()=>document.body.dataset.state==='complete',null,{timeout:65000});
 const round=await p.evaluate(()=>window.pinball.exportRound());const replay=await p.evaluate(async r=>{const {Race}=await import(window.pinball.settings().physicsModule);const x=new Race(r.config,r.seed);x.start();while(!['complete','invalid'].includes(x.state))x.step();return x.snapshot();},round);delete replay.roundId;delete round.result.roundId;assert.deepEqual(replay,round.result);assert.equal(await p.locator('#winner-splash').isVisible(),true);await p.locator('#splash-close').click();assert.equal((await p.evaluate(()=>window.pinball.settings())).focusMode,false);assert.equal(await p.locator('#winner-card').isVisible(),true);assert.deepEqual(errors,[]);
 report.tests.push({width,height,fallback,status:'PASS',views,pauseStatePreserved:true,exactReplay:true,errors});console.log('PASS map view',width,height,fallback);await c.close();
}report.status='PASS';}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(`evidence/park-20260921/${prefix}-map-view-results.json`,JSON.stringify(report,null,2));await browser.close();}
