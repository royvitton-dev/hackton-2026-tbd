import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Start the repository's real park/server.mjs on a separate test port first.
const base = process.env.ROUTER_TEST_URL || 'http://127.0.0.1:4191';
const out = process.env.EVIDENCE_PREFIX || 'evidence/park-20260921/30-shared-route';
const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const manifest = JSON.parse(await readFile('dist/build-info.json', 'utf8'));
const browser = await chromium.launch({channel: 'chrome'});
const report = {at:new Date().toISOString(), server:base, status:'RUNNING', tests:[]};
await mkdir(out, {recursive:true});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}, isMobile:mobile, hasTouch:mobile, deviceScaleFactor:mobile?2:1, reducedMotion:'reduce'});
    const page = await context.newPage(), errors = [], unexpectedRequests = [], failedResponses = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', req => {const u=new URL(req.url());if(u.origin!==base || !u.pathname.startsWith('/pinball/'))unexpectedRequests.push(u.href);});
    page.on('response', res => {if(res.status()>=400)failedResponses.push([res.status(),res.url()]);});
    await page.goto(base+'/pinball/');
    await page.waitForFunction(()=>window.pinball);
    assert.deepEqual((await page.locator('#participants').inputValue()).split(',').map(s=>s.trim()).sort(), ['병우','종호','동길','태성','순수'].sort());
    assert.equal((await page.evaluate(()=>window.pinball.settings())).renderer, 'webgl');
    assert.equal(await page.locator('.map-choice').count(), 5);
    const servedAssets = [];
    for(const [file,hash] of Object.entries(manifest.files)) {
      // The router intentionally serves public runtime files, not samples/docs.
      if(!/^(index\.html|src\/|vendor\/.*\.js$)/.test(file)) continue;
      const response = await context.request.get(base+'/pinball/'+file);
      assert.equal(response.status(),200,file);
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'),hash,file);
      servedAssets.push(file);
    }
    await page.reload();await page.waitForFunction(()=>window.pinball);
    assert.equal((await page.evaluate(()=>window.pinball.snapshot())).total,5);
    await page.locator('[data-map=parade]').click();await page.locator('[data-speed="3"]').click();
    if(mobile)await page.locator('#tab-lotto').click();
    else await page.locator('#participants').fill('경로 A,경로 B*2,경로 C');
    await page.locator('#start').click();
    await page.waitForFunction(()=>window.pinball.snapshot().state==='racing');
    await page.locator('#pause').click();
    const paused=await page.evaluate(()=>window.pinball.snapshot());
    await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>window.pinball.snapshot()),paused);
    await page.locator('#pause').click();
    await page.waitForFunction(()=>['complete','invalid'].includes(window.pinball.snapshot().state),null,{timeout:90000});
    const round=await page.evaluate(()=>window.pinball.exportRound());
    assert.equal(round.result.state,'complete');
    assert.equal(round.result.finishOrder.length,mobile?7:1);
    assert.equal(new Set(round.result.finishOrder.map(x=>x.id)).size,round.result.finishOrder.length);
    if(!mobile)assert.equal(round.result.winner.id,round.result.finishOrder[0].id);
    assert.equal(await page.locator('#winner-name').textContent(),mobile?'행운의 번호':round.result.winner.label);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const name=mobile?'mobile-lotto':'desktop-player';
    await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
    await writeFile(`${out}/${name}-round.json`,JSON.stringify(round,null,2));
    await page.locator('#splash-replay').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'mixing');
    await page.locator('#reset').click();assert.equal((await page.evaluate(()=>window.pinball.snapshot())).state,'ready');
    assert.deepEqual(errors,[]);assert.deepEqual(unexpectedRequests,[]);assert.deepEqual(failedResponses,[]);
    report.tests.push({name,status:'PASS',servedAssets,errors,unexpectedRequests,failedResponses,arrivals:round.result.finishOrder.length});
    await context.close();console.log('PASS shared server',name);
  }
  report.status='PASS';
} catch(e) {report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}
finally {await browser.close();report.browserClosed=true;await writeFile(`${out}/results.json`,JSON.stringify(report,null,2));}
