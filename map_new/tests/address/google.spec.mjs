import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {mockStreetTiles} from './nearby-fixture.mjs';
test.beforeEach(async({page})=>{await mockStreetTiles(page);});
const catalog=JSON.parse(await readFile(new URL('../../public/address/drawings/catalog.json',import.meta.url),'utf8'));
const sdkFixture=`// Deliberately fake SDK: exercises our API contract, never a live Google map.
class TestMap extends HTMLElement {constructor(options){super();this.options=options;this.dataset.testSdk='true';}flyCameraTo(options){this.camera=options;}stopCameraAnimation(){}}
class TestMarker extends HTMLElement {constructor(options){super();Object.assign(this,options);this.dataset.altitude=options.position.altitude;}}
class TestPin extends HTMLElement {constructor(options){super();this.options=options;}}
customElements.define('gmp-map-3d',TestMap);customElements.define('gmp-marker-3d-interactive',TestMarker);customElements.define('gmp-pin',TestPin);
class Geocoder {async geocode({address}){return {results:[{formatted_address:address,geometry:{location:{lat:()=>37.555,lng:()=>126.911},location_type:'ROOFTOP'}}]};}}
window.google={maps:{importLibrary:async name=>name==='maps3d'?{Map3DElement:TestMap,Marker3DInteractiveElement:TestMarker}:name==='marker'?{PinElement:TestPin}:{Geocoder}}};
window.__atlasGoogleMapsReady();`;
test('additional drawings preserve their originals, types and building links',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/map_new/?view=google&site=10002042&tab=drawings');
  await expect(page.locator('#atlas-gallery .atlas-drawing')).toHaveCount(7);
  await expect(page.locator('.atlas-drawing-kind').first()).toHaveText('입체 평면도');
  await page.locator('.atlas-drawing').first().click();await expect(page.locator('#atlas-drawing-dialog')).toBeVisible();
  await expect.poll(()=>page.locator('#atlas-dialog-image').evaluate(i=>i.naturalWidth)).toBeGreaterThan(400);
  await expect(page.locator('#atlas-dialog-source')).toHaveAttribute('href',/soco.seoul.go.kr/);
  await page.getByRole('button',{name:'도면 닫기'}).click();await expect(page.locator('#atlas-drawing-dialog')).not.toBeVisible();
  await page.locator('#atlas-all-drawings').click();await expect(page.locator('.atlas-drawing')).toHaveCount(catalog.drawings.length);
  await page.locator('#atlas-kind').selectOption('section');await expect(page.locator('.atlas-drawing')).toHaveCount(catalog.drawings.filter(d=>d.kind==='section').length);
  await page.locator('#atlas-search').fill('녹틸럭스');await expect(page.locator('.atlas-place')).toHaveCount(1);await page.locator('.atlas-place').click();
  await expect(page.locator('#atlas-model-link')).toHaveAttribute('href',/view=address&site=parking-159344-0/);expect(errors).toEqual([]);
});
test('key-free export respects area filter and 3D marker height',async({page})=>{
  await page.goto('/map_new/?view=google');await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-map-ready','true');
  await expect.poll(()=>page.evaluate(()=>window.__atlasMap?.state.markers.length)).toBeGreaterThan(40);
  await page.locator('#atlas-areas').uncheck();const count=await page.evaluate(()=>window.__atlasMap.state.markers.length);
  expect(count).toBeGreaterThan(10);expect(count).toBeLessThan(30);
  await page.locator('#atlas-altitude').fill('100');const downloadPromise=page.waitForEvent('download');await page.locator('#atlas-kml').click();const download=await downloadPromise;
  const text=await readFile(await download.path(),'utf8');expect(text.match(/<Placemark /g)).toHaveLength(count);expect(text).toContain(',100</coordinates>');expect(text).not.toContain('지역 위치</name>');
  const parsed=await page.evaluate(text=>{const doc=new DOMParser().parseFromString(text,'application/xml');return {errors:doc.querySelectorAll('parsererror').length,coordinates:[...doc.querySelectorAll('coordinates')].map(e=>e.textContent)};},text);expect(parsed.errors).toBe(0);expect(parsed.coordinates).toHaveLength(count);
});
test('Google SDK contract: all markers, click selection, height, geocoding and authentication failure',async({page})=>{
  await page.route('https://maps.googleapis.com/maps/api/js?**',route=>{const url=new URL(route.request().url());expect(url.searchParams.get('v')).toBe('weekly');expect(url.searchParams.get('language')).toBe('ko');return route.fulfill({contentType:'application/javascript',body:sdkFixture});});
  await page.goto('/map_new/?view=google');await page.locator('.atlas-detail details summary').click();await page.locator('#atlas-google-key').fill('test-only-not-a-real-key');await page.locator('#atlas-connect-button').click();
  await expect(page.locator('gmp-map-3d')).toBeAttached();await expect(page.locator('#atlas-map-empty')).toBeHidden();
  const state=await page.evaluate(()=>window.__atlasMap.state);expect(state.google.markers).toHaveLength(state.markers.length);
  await page.locator('gmp-marker-3d-interactive[data-site-id="20000441"]').dispatchEvent('gmp-click');await expect(page.locator('#atlas-name')).toContainText('온음');
  await page.locator('#atlas-altitude').fill('120');await expect(page.locator('gmp-marker-3d-interactive').first()).toHaveAttribute('data-altitude','120');
  await page.locator('#atlas-search').fill('온음');await page.locator('#atlas-geocode').click();await expect(page.locator('#atlas-status')).toContainText('주소 검색 완료');
  expect(await page.evaluate(()=>window.__atlasMap.state.markers[0])).toMatchObject({siteId:'20000441',quality:'address',position:{lat:37.555,lng:126.911,altitude:120}});
  await page.evaluate(()=>window.gm_authFailure());await expect(page.locator('#atlas-status')).toContainText('인증에 실패');
});
test('failed Google connection keeps the drawing library and key-free export available',async({page})=>{
  await page.route('https://maps.googleapis.com/maps/api/js?**',route=>route.abort('failed'));
  await page.goto('/map_new/?view=google&site=20000441');await page.locator('.atlas-detail details summary').click();await page.locator('#atlas-google-key').fill('test-failure');await page.locator('#atlas-connect-button').click();
  await expect(page.locator('#atlas-status')).toContainText('스크립트를 읽지 못했습니다');await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-map-ready','true');await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-models-ready','true');await expect(page.locator('#atlas-status')).toContainText('스크립트를 읽지 못했습니다');
  await page.locator('[data-atlas-tab="drawings"]').click();await expect(page.locator('.atlas-drawing')).toHaveCount(3);
});
test('mobile library fits the viewport and retains direct building navigation',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/map_new/?view=google&site=20000441&tab=drawings');
  await expect(page.locator('.atlas-drawing')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.locator('.atlas-drawing').first().click();await expect(page.locator('#atlas-drawing-dialog')).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('#atlas-model-link').click();await expect(page.locator('#address-title')).toContainText('온음');await expect(page.locator('#address-extra-drawings')).toHaveAttribute('href',/view=google&tab=drawings&site=20000441/);
});
