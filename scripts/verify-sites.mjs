import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.argv[2] || 'http://127.0.0.1:15398';
const out = path.resolve(process.argv[3] || 'test-results/sites');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const selected = new Set((process.env.SITES_CHECK_IDS || '').split(',').filter(Boolean));
async function check(id, route, inspect, options = {}) {
  if (selected.size && !selected.has(id)) return;
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errors = [], failedResponses = [], localRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(baseURL).origin) failedResponses.push({ url: response.url(), status: response.status() }); });
  page.on('request', request => { const url = new URL(request.url()); if (['localhost', '127.0.0.1'].includes(url.hostname) && url.origin !== new URL(baseURL).origin) localRequests.push(url.href); });
  const startedAt = new Date().toISOString();
  let result;
  try {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 });
    expect(response.status()).toBeLessThan(400);
    const details = await inspect(page, context.request);
    await page.screenshot({ path: path.join(out, `${id}.png`), timeout: 15000 });
    expect(errors).toEqual([]);
    expect(localRequests).toEqual([]);
    const critical = failedResponses.filter(r => !options.allowedFailures?.some(prefix => new URL(r.url).pathname.startsWith(prefix)));
    expect(critical).toEqual([]);
    result = { id, route, status: 'passed', details, startedAt, errors, failedResponses };
  } catch (error) {
    await page.screenshot({ path: path.join(out, `${id}-failed.png`), timeout: 10000 }).catch(() => {});
    result = { id, route, status: 'failed', message: error.message, startedAt, errors, failedResponses };
  } finally { await context.close(); }
  results.push(result);
  console.log(JSON.stringify(result));
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ baseURL, checkedAt: new Date().toISOString(), results }, null, 2));
}

try {
  await check('directory', '/projects/', async (page, request) => {
    await expect(page.locator('nav a')).toHaveCount(11);
    for (const link of await page.locator('nav a').evaluateAll(elements => elements.map(e => e.getAttribute('href')))) expect((await request.get(link)).status()).toBe(200);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    return '11 project links and mobile layout';
  });
  await check('park', '/park/?capture=1', async (page, request) => {
    await page.locator('#world[data-ready=true]').waitFor({ timeout: 90000 });
    await expect(page.locator('.attraction-card')).toHaveCount(8);
    const catalog = await (await request.get('/api/park')).json();
    for (const item of catalog.attractions) {
      const launch = await request.post('/api/launch?id=' + item.id);
      expect(launch.status()).toBe(200);
      expect(new URL((await launch.json()).url).origin).toBe(new URL(baseURL).origin);
    }
    await page.locator('.attraction-card[data-id=map]').click();
    await page.locator('[data-enter=map]').click();
    await expect(page.locator('.launch-link')).toHaveAttribute('href', baseURL + '/map/');
    return 'WebGL park, 8 attractions, launch API and entry button';
  });
  await check('map', '/map/?workspace=source-drive', async page => {
    await page.waitForFunction(() => window.__atlas?.state.plan?.id === 'changdong-b2', { timeout: 90000 });
    await expect(page.locator('canvas').first()).toBeVisible();
    return '3D B2 parking drawing';
  });
  await check('mobility', '/map/mobility.html', async page => {
    await page.locator('body[data-ready=true]').waitFor();
    await expect(page.locator('#route-map image')).toHaveAttribute('href', '/map/plans/changdong-parking-b2.png');
    return 'Mobility routes and source drawing';
  });
  await check('parking', '/map_new/', async page => {
    await page.waitForFunction(() => Boolean(window.__parking?.state.selected));
    await expect(page.locator('canvas').first()).toBeVisible();
    return await page.evaluate(() => ({ selected: window.__parking.state.selected.id }));
  }, { allowedFailures: ['/reports/map_new/latest.json'] });
  await check('address', '/map_new/?view=address&site=20000441-0', async page => {
    await page.waitForFunction(() => Boolean(window.__addressStudio));
    await expect(page.locator('canvas').first()).toBeVisible();
    return 'Address building model and photo textures';
  });
  await check('racing', '/dopamin/', async page => {
    await expect(page.locator('.race-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 90000 });
    await page.getByRole('button', { name: '레이서 추가', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    return 'WebGL race lobby and player registration';
  });
  await check('pinball', '/pinball/', async page => {
    await page.waitForFunction(() => Boolean(window.pinball));
    await page.locator('#start').click();
    await page.locator('#pause:not([disabled])').waitFor();
    await page.locator('#pause').click();
    await expect(page.locator('#pause-overlay')).toBeVisible();
    return 'Game start and pause';
  });
  await check('board', '/webpage/', async page => {
    await expect(page.locator('.board-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 90000 });
    await expect.poll(() => page.locator('img').evaluateAll(elements => elements.length > 0 && elements.every(e => e.complete && e.naturalWidth > 0))).toBe(true);
    return '3D board and character images';
  });
  await check('health', '/webpage/health/', async page => {
    await expect(page.locator('body')).toContainText('VITALIS');
    await page.reload();
    await expect(page.locator('body')).toContainText('VITALIS');
    return 'Health dashboard and direct reload';
  });
  await check('battery', '/battery_health/?user=U0037', async (page, request) => {
    await expect(page.getByRole('combobox', { name: '사용자 및 차량' })).toHaveValue('U0037');
    await expect(page.locator('canvas')).toHaveAttribute('data-renderer', 'webgl-3d-mesh', { timeout: 150000 });
    await expect(page.locator('canvas')).toHaveAttribute('data-vehicle-id', 'kia_niro_ev_2026');
    await page.getByRole('tab', { name: '충전 이력', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(5);
    const response = await request.get('/battery_health/api/users/U0037/sessions');
    expect(response.status()).toBe(200);
    expect((await response.json()).sessions).toHaveLength(11);
    await page.reload();
    await expect(page.getByRole('combobox', { name: '사용자 및 차량' })).toHaveValue('U0037');
    return 'Real 3D vehicle, charging history, 11 API sessions, reload';
  });
  for (const [id, route] of [['film', '/movie/'], ['tour-film', '/movie/?film=attractions'], ['trailer', '/movie/assets/odyssey/']]) {
    await check(id, route, async (page, request) => {
      const video = page.locator('video').first();
      await video.evaluate(async element => { element.muted = true; await element.play(); });
      await page.waitForFunction(() => document.querySelector('video').currentTime > .5);
      await video.evaluate(element => { element.currentTime = Math.min(20, element.duration / 2); });
      await page.waitForFunction(() => document.querySelector('video').currentTime > 10);
      await video.evaluate(element => element.pause());
      const response = await request.get('/api/project-asset/movie/output/wonder-park-tour.mp4', { headers: { Range: 'bytes=8388500-8388700' } });
      expect(response.status()).toBe(206);
      expect((await response.body()).length).toBe(201);
      return 'Actual playback, seeking, and cross-segment Range';
    });
  }
  await check('voice', '/voice/', async page => {
    await expect(page.getByRole('heading', { name: '목소리로 시작하는 작업.' })).toBeVisible();
    return 'macOS native CLI usage guide (browser microphone execution is not part of this attraction)';
  });
  await check('trading', '/trading/', async (page, request) => {
    await expect(page.locator('body')).toContainText('LEAVE');
    const response = await request.get('/trading/backend/health');
    expect(response.status()).toBe(200);
    return 'Trading page and live backend health';
  }, { allowedFailures: ['/trading/backend/'] });
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').map(r => r.id), report: path.join(out, 'results.json') }));
if (results.some(r => r.status === 'failed')) process.exitCode = 1;
