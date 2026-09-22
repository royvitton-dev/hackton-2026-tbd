import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const repo=process.env.PREVIEW_REPO,commit=process.env.EXPECTED_COMMIT;
assert.ok(repo&&/^[a-f0-9]{40}$/.test(commit),'Set PREVIEW_REPO and EXPECTED_COMMIT.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({channel:'chrome'}),report={at:new Date().toISOString(),commit,status:'RUNNING',checks:[]};
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(let attempt=0;attempt<2;attempt++){
  const response=attempt?await page.reload():await page.goto('http://127.0.0.1:4188/');
  assert.equal(response.headers()['cache-control'],'no-store');await page.waitForFunction(()=>window.pinball);
  const module=await page.evaluate(()=>window.pinball.settings().physicsModule);
  const root=new URL('../',module),receipt=await (await page.request.get(new URL('release.json',root).href)).json();
  assert.equal(receipt.commit,commit);assert.equal(await page.locator('.map-choice').count(),5);
  assert.equal((await page.evaluate(()=>window.pinball.snapshot())).total,5);
  assert.deepEqual((await page.locator('#participants').inputValue()).split(',').map(n=>n.trim()).sort(),['병우','종호','동길','태성','순수'].sort());
  for(const [file,hash]of Object.entries(receipt.files)){
   const response=await page.request.get(new URL(file,root).href);assert.equal(response.status(),200);
   const bytes=await response.body(),source=execFileSync('git',['-C',repo,'show',commit+':pinball/'+file],{maxBuffer:16*1024*1024});
   assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);assert.ok(bytes.equals(source),file+' differs from selected commit');
  }
  report.checks.push({attempt:attempt?'refresh':'open',version:receipt.version,publication:receipt.publication||'legacy-remote-verified',assets:Object.keys(receipt.files).length,exactCommittedBytes:true});
 }
 assert.deepEqual(errors,[]);report.status='PASS';console.log('PASS open and refresh load exact committed main assets',commit);
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e.message);}
finally{await writeFile(`evidence/park-20260921/${process.env.EVIDENCE_PREFIX||'22'}-pushed-preview.json`,JSON.stringify(report,null,2));await browser.close();}
