import { chromium } from '../../webpage/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

await mkdir('assets/demo', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
await page.goto(process.env.VITALIS_URL || 'http://localhost:5174/health/');
try { await page.locator('.body-canvas[data-ready=true]').waitFor({ timeout: 120000 }); }
catch(e) { await page.screenshot({path:'tmp/capture-failure.png'}); console.error((await page.locator('body').innerText()).slice(0,2500)); await browser.close(); throw e; }
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: 'html {scroll-behavior:auto!important} body {zoom:.87} * {caret-color:transparent!important}' });
await page.waitForTimeout(500);
let cursor = { x: 1420, y: 150 };
await page.evaluate(() => {
  const c = document.createElement('div'); c.id = 'film-pointer';
  c.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;width:20px;height:20px;border:2px solid #d5fc64;border-radius:50%;box-shadow:0 0 0 6px #d5fc6420;left:1420px;top:150px';
  document.body.append(c);
});
async function pointTo(locator) {
  const box = await locator.boundingBox();
  cursor = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.evaluate(({x,y}) => { const p=document.querySelector('#film-pointer');p.style.left=`${x/.87}px`;p.style.top=`${y/.87}px`; }, cursor);
}
const labels = [];
for (let i = 0; i < 135; i++) {
  if (i === 30) {
    const b = page.getByRole('button', { name: '나의 3D 바디', exact: true });
    await pointTo(b); await b.click();
    await page.locator('.body-canvas[data-ready=true]').waitFor();
    await page.waitForTimeout(250);
  }
  if (i === 35) {
    const b=page.getByRole('button',{name:'자동 회전 시작'}); await pointTo(b);await b.click();
  }
  if (i === 62) {
    const b=page.getByRole('button',{name:'장기 단계',exact:true}); await pointTo(b);await b.click();
  }
  if (i === 75) {
    const b=page.locator('button.scene-reading');await pointTo(b);await b.click();
    await page.getByRole('dialog').waitFor();
  }
  if (i === 98) {
    await page.keyboard.press('Escape');
    const b=page.getByRole('button',{name:'변화 리포트',exact:true});await pointTo(b);await b.click();
    await page.getByRole('button',{name:'30일',exact:true}).click();
  }
  if (i === 117) {
    const b=page.getByRole('button',{name:'혈당',exact:true});await pointTo(b);await b.click();
  }
  await page.screenshot({ path: `assets/demo/${String(i).padStart(3,'0')}.jpg`, type:'jpeg', quality:90 });
  labels.push(i < 30 ? '건강을 한눈에' : i < 75 ? '돌려 보고, 들여다보고' : i < 98 ? '부위를 눌러 기록 확인' : '30일의 변화를 확인');
  if (i % 30 === 0) console.log(`Captured ${i}/135`);
}
await writeFile('assets/demo/manifest.json', JSON.stringify({fps:15,frames:135,labels,errors}, null, 2));
const source = await readFile('../webpage/src/AnatomyScene.tsx','utf8');
await writeFile('assets/source-excerpt.json', JSON.stringify(source.split('\n').slice(0,24)));
await browser.close();
if(errors.length) throw new Error(errors.join('\n'));
console.log('Captured actual VITALIS interactions: 135 frames, no browser errors.');
