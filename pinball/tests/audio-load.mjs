import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={at:new Date().toISOString(),scope:'8-second live racing sample, 60 balls, parade, 3x, audio enabled; mobile is Chrome viewport emulation',tests:[]};
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.TEST_URL||'http://127.0.0.1:4189');await page.waitForFunction(()=>window.pinball);
  await page.locator('#participants').fill('A*10, B*10, C*10, D*10, E*10, F*10');await page.locator('input[name=rule][value=last]').check();await page.locator('[data-map=parade]').click();await page.locator('[data-speed="3"]').click();await page.locator('#half-view').click();await page.locator('#arena-sound').click();await page.locator('#arena-start').click();await page.waitForFunction(()=>window.pinball.snapshot().state==='racing');await page.waitForTimeout(8000);
  const state=await page.evaluate(()=>window.pinball.snapshot()),audio=await page.evaluate(()=>window.pinball.audio()),stats=await page.evaluate(()=>window.pinball.performance());
  const samples=stats.samples.filter(s=>s.state==='racing'),cost=samples.reduce((s,f)=>s+f.cost,0)/samples.length,fps=1000/(samples.reduce((s,f)=>s+f.delta,0)/samples.length);
  assert.equal(state.total,60);assert.ok(samples.length>100);assert.ok(audio.peakVoices<=40);assert.ok(audio.played.launch>0);assert.deepEqual(errors,[]);
  await page.locator('#arena-sound').click();assert.equal((await page.evaluate(()=>window.pinball.audio())).activeVoices,0);
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');await page.locator('#view').click();assert.equal(await page.locator('#arena-sound').isVisible(),true);if(mobile)await page.setViewportSize({width:320,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'evidence/park-20260921/32-audio/'+(mobile?'mobile':'desktop')+'-expanded.png'});
  report.tests.push({device:mobile?'mobile':'desktop',status:'PASS',samples:samples.length,averageJsMs:cost,averageFps:fps,audio,errors});await context.close();console.log('PASS',mobile?'mobile':'desktop','60-ball audio sample',fps.toFixed(1),'FPS',cost.toFixed(2),'ms');
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error.message);}
finally{await browser.close();await writeFile('evidence/park-20260921/32-audio/load.json',JSON.stringify(report,null,2));}
