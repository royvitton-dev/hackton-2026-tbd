import {test,expect} from '@playwright/test';
import {mockStreetTiles} from './nearby-fixture.mjs';
test.beforeEach(async({page})=>{await mockStreetTiles(page);});
test('opens the actual miniature building immediately without a key and links address selection',async({page})=>{
  const errors=[],google=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('maps.googleapis.com'))google.push(r.url());});
  await page.addInitScript(()=>sessionStorage.setItem('atlas-google-key','test-stale-key'));
  await page.goto('/map_new/?view=markers&site=10002042');
  await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-map-ready','true');await expect(page.locator('#atlas-map-empty')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.rendered)).toBeGreaterThan(0);
  const state=await page.evaluate(()=>window.__atlasMap.state);expect(state.nearby.markers).toHaveLength(state.markers.length);expect(state.nearby.models.find(m=>m.siteId==='10002042')).toMatchObject({kind:'exterior',status:'ready'});expect(state.nearby.pitch).toBeCloseTo(58);expect(google).toEqual([]);
  const canvas=await page.locator('#atlas-nearby-canvas canvas').boundingBox();expect(canvas.height).toBeGreaterThan(400);expect(canvas.width).toBeGreaterThan(600);
  await page.locator('#atlas-search').fill('온음');await page.locator('.atlas-place').click();await expect(page.locator('#atlas-name')).toContainText('온음');await expect(page.locator('#atlas-status')).toContainText('3D 모형 1개');
  await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.selected)).toBe('20000441');await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.center[0])).toBeCloseTo(126.9103709,5);
  await page.locator('#atlas-model-scale').fill('100');expect(await page.evaluate(()=>window.__atlasMap.state.nearby.scale)).toBe(100);
  await page.locator('#atlas-search').fill('');await page.locator('#atlas-overview').click();await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.zoom)).toBeLessThan(10);
  await page.locator('#atlas-search').fill('코이노니아');await page.locator('[data-nearby-site="10002042"]').click();await expect(page.locator('#atlas-name')).toContainText('코이노니아');
  await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.zoom)).toBeCloseTo(19.1);await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.rendered)).toBeGreaterThan(0);
  await page.screenshot({path:'map_new/.runtime/address-expansion/nearby-buildings-desktop.png'});expect(errors).toEqual([]);
});
test('tile failure retains markers and reports the missing background',async({page})=>{
  await page.unroute('https://tile.openstreetmap.org/**');await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
  await page.goto('/map_new/?view=markers&site=20000441');await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-map-ready','true');
  await expect(page.locator('#atlas-status')).toContainText('배경 지도를 불러오지 못했습니다');await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.rendered)).toBeGreaterThan(0);
});
test('mobile map and attribution fit, and switching drawings preserves the map',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/map_new/?view=markers&site=20000441');await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-map-ready','true');
  await page.locator('#atlas-map-pane').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('OpenStreetMap');
  await page.locator('[data-atlas-tab="drawings"]').click();await expect(page.locator('.atlas-drawing')).toHaveCount(3);await page.locator('[data-atlas-tab="map"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.rendered)).toBeGreaterThan(0);await page.screenshot({path:'map_new/.runtime/address-expansion/nearby-buildings-mobile.png'});
});
