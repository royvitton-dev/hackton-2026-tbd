import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const index=JSON.parse(readFileSync(new URL('../../public/mobility/maps/index.json',import.meta.url),'utf8'));
const errors=[];
test.beforeEach(async({page})=>{errors.length=0;page.on('pageerror',e=>errors.push(e.message));await page.goto('/mobility.html');await page.locator('body[data-ready=true]').waitFor();await page.evaluate(()=>document.fonts.ready);await page.locator('#working-maps').scrollIntoViewIfNeeded();});
test.afterEach(()=>expect(errors).toEqual([]));
test('all 20 real maps render distinct road networks, charging markers and calculated routes',async({page})=>{
 test.setTimeout(240000);await expect(page.locator('[data-road-map]')).toHaveCount(20);
 for(const item of index.maps){
  await page.locator(`[data-road-map="${item.id}"]`).click();await expect(page.locator('#working-maps')).toHaveAttribute('data-map-id',item.id);await expect(page.locator('#working-maps')).toHaveAttribute('data-loading','false');
  await expect(page.locator('.road-charger-marker')).toHaveCount(item.counts.chargers);await expect(page.locator('#road-play')).toBeEnabled();
  const state=await page.evaluate(()=>({id:__roadMaps.state.selected.id,distance:__roadMaps.state.path.distance,points:__roadMaps.state.path.coordinates.length,roadCount:__roadMaps.state.graph.ways.length}));expect(state.id).toBe(item.id);expect(state.distance).toBeCloseTo(item.defaultRoute.distance,5);expect(state.points).toBeGreaterThan(2);expect(state.roadCount).toBe(item.counts.roads);
  await page.waitForFunction(()=>__roadMaps.map.isStyleLoaded()&&__roadMaps.map.areTilesLoaded()&&__roadMaps.map.queryRenderedFeatures({layers:['roads']}).length>0,{},{timeout:20000});
 }
});
test('road motion, pause, arrival, charger selection, search and local download work',async({page})=>{
 await page.locator('#road-speed').selectOption('16');await page.locator('#road-play').click();await expect.poll(()=>page.evaluate(()=>__roadMaps.state.travel)).toBeGreaterThan(10);await page.locator('#road-play').click();const paused=await page.evaluate(()=>__roadMaps.state.travel);await page.waitForTimeout(200);expect(await page.evaluate(()=>__roadMaps.state.travel)).toBe(paused);
 await page.locator('#road-play').click();await expect(page.locator('#road-play')).toContainText('도착',{timeout:40000});expect(await page.evaluate(()=>__roadMaps.state.travel)).toBeCloseTo(await page.evaluate(()=>__roadMaps.state.path.distance));
 await page.locator('#road-search').fill('제주');await expect(page.locator('[data-road-map]')).toHaveCount(1);await page.locator('[data-road-map=jeju]').click();await expect(page.locator('#working-maps')).toHaveAttribute('data-map-id','jeju');await expect(page.locator('#road-charger-detail')).toContainText('실시간 가동 상태 미연결');
 await page.locator('#road-tilt').click();await expect(page.locator('#road-tilt')).toHaveAttribute('aria-pressed','false');
 await page.locator('#road-search').fill('없는 지역');await expect(page.locator('#road-map-list')).toContainText('일치하는 지도가 없습니다.');await page.locator('#road-search').fill('');
 const first=await page.locator('#road-destination option').first().getAttribute('value');await page.locator('#road-destination').selectOption(first);expect(await page.evaluate(()=>__roadMaps.state.charger.id)).toBe(first);
 const downloaded=page.waitForEvent('download');await page.locator('#road-download').click();const file=await downloaded;expect(file.suggestedFilename()).toBe('jeju.json');expect(JSON.parse(readFileSync(await file.path(),'utf8')).elements.length).toBeGreaterThan(20);
});
test('locally acquired maps work while external network access is unavailable; golden map',async({page})=>{
 await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/,route=>route.abort());
 await page.reload();await page.locator('body[data-ready=true]').waitFor();await page.locator('#working-maps').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__roadMaps.map.isStyleLoaded()&&__roadMaps.map.areTilesLoaded()&&__roadMaps.map.queryRenderedFeatures({layers:['roads']}).length>0,{},{timeout:20000});
 await expect(page.locator('#working-maps')).toHaveScreenshot('maps-desktop.png');await expect(page.locator('.road-charger-marker')).not.toHaveCount(0);await expect(page.locator('#road-play')).toBeEnabled();
});
test('mobile real maps keep controls, provenance and route playback accessible; golden mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.locator('#working-maps').scrollIntoViewIfNeeded();await page.waitForFunction(()=>__roadMaps.map.isStyleLoaded()&&__roadMaps.map.areTilesLoaded()&&__roadMaps.map.queryRenderedFeatures({layers:['roads']}).length>0,{},{timeout:20000});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await expect(page.locator('#working-maps')).toHaveScreenshot('maps-mobile.png');await page.locator('#road-start').selectOption({index:1});await page.locator('.road-evidence summary').click();await expect(page.locator('#road-evidence')).toContainText('지도 기준 시각');await expect(page.locator('#road-evidence a')).toHaveAttribute('href',/\.source\.json$/);
 await page.locator('#road-fit').click();await expect(page.locator('#road-load-error')).toBeHidden();
});
