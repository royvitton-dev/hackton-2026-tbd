import {test,expect} from '@playwright/test';
import {mockStreetTiles} from './nearby-fixture.mjs';
test.beforeEach(async({page})=>{await mockStreetTiles(page);});
const models=page=>page.evaluate(()=>window.__atlasMap.state.nearby.models);

test('uses the six original facade models and saved meshes, including photo textures and an explicit empty state',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/map_new/?view=markers&site=10002042');
  await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-models-ready','true');
  const all=await models(page);expect(all).toHaveLength(45);expect(all.filter(m=>m.status==='ready')).toHaveLength(40);
  expect(all.filter(m=>m.kind==='exterior')).toHaveLength(6);expect(all.filter(m=>m.kind==='drawing')).toHaveLength(34);
  expect(all.filter(m=>m.status==='unavailable')).toHaveLength(5);
  for(const id of ['10002042','20000441','20000555','20000474','20000536','10000901']){
    await expect.poll(async()=>(await models(page)).find(m=>m.siteId===id).textures.every(t=>t.state==='ready')).toBe(true);
    const m=(await models(page)).find(m=>m.siteId===id);expect(m.sourceMeshes).toBeGreaterThan(100);expect(m.renderMeshes).toBeLessThan(m.sourceMeshes);expect(m.displayScale).toBeLessThanOrEqual(.7);
  }
  expect(all.find(m=>m.siteId==='10002042').features.louver).toBeGreaterThan(50);
  const drawing=all.find(m=>m.siteId==='parking-159344');expect(drawing.files).toEqual(['generated/parking-159344-0.json']);expect(drawing.sourceMeshes).toBeGreaterThan(90);
  await page.locator('#atlas-search').fill('녹틸럭스');await page.locator('.atlas-place').click();await expect(page.locator('#atlas-model-note')).toContainText('도면 기반 3D 구조');
  await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.rendered)).toBeGreaterThan(0);
  await page.screenshot({path:'map_new/.runtime/address-expansion/nearby-building-drawing.png'});
  await page.locator('#atlas-search').fill('보라매공원');await page.locator('.atlas-place').click();await expect(page.locator('#atlas-model-note')).toContainText('3D 모델이 없어 위치만');
  expect((await models(page))[0]).toMatchObject({status:'unavailable',kind:null,sourceMeshes:0});expect(errors).toEqual([]);
});

test('clicks a neighbouring building mesh, rescales it without new downloads, and keeps its true address',async({page})=>{
  const requests=[];page.on('request',r=>{if(/generated\/.*\.json$/.test(r.url()))requests.push(r.url());});
  await page.goto('/map_new/?view=markers&site=parking-35314');await expect(page.locator('#atlas-nearby-canvas')).toHaveAttribute('data-models-ready','true');
  await expect.poll(async()=>(await models(page)).find(m=>m.siteId==='parking-146002').screenPoint?.x||0).toBeGreaterThan(0);
  const target=(await models(page)).find(m=>m.siteId==='parking-146002'),box=await page.locator('#atlas-nearby-canvas canvas').boundingBox();
  expect(target.screenPoint.x).toBeLessThan(box.width);expect(target.screenPoint.y).toBeGreaterThan(0);expect(target.screenPoint.y).toBeLessThan(box.height);
  await page.mouse.click(box.x+target.screenPoint.x,box.y+target.screenPoint.y);await expect(page.locator('#atlas-name')).toContainText('P스튜디오');
  const before=await page.evaluate(()=>window.__atlasMap.state),count=requests.length;
  await page.locator('#atlas-model-scale').fill('30');await expect(page.locator('#atlas-model-scale-value')).toHaveText('30%');
  const after=await page.evaluate(()=>window.__atlasMap.state),a=before.nearby.models.find(m=>m.siteId==='parking-146002'),b=after.nearby.models.find(m=>m.siteId==='parking-146002');
  expect(b.displayScale/a.displayScale).toBeCloseTo(3/7);expect(b.sourceSize).toEqual(a.sourceSize);expect(before.markers).toEqual(after.markers);expect(requests.length).toBe(count);
  await page.locator('#atlas-areas').uncheck();await expect(page.locator('#atlas-model-note')).toContainText('필터에서 제외');expect((await models(page)).some(m=>m.siteId==='parking-146002')).toBe(false);
});

test('a model download failure leaves address selection and the drawing link usable',async({page})=>{
  await page.route('**/generated/parking-159344-0.json',r=>r.fulfill({status:503,body:'test model unavailable'}));
  await page.goto('/map_new/?view=markers&site=parking-159344');await expect(page.locator('#atlas-model-note')).toContainText('모델을 불러오지 못해');
  await expect(page.locator('#atlas-status')).toContainText('모델을 불러오지 못했습니다');await expect(page.locator('#atlas-model-link')).toHaveAttribute('href',/site=parking-159344-0/);
  expect((await models(page)).find(m=>m.siteId==='parking-159344')).toMatchObject({status:'failed',kind:null});
  await page.locator('#atlas-search').fill('온음');await page.locator('.atlas-place').click();await expect(page.locator('#atlas-model-note')).toContainText('사진 기반 외관');
  await expect.poll(()=>page.evaluate(()=>window.__atlasMap.state.nearby.rendered)).toBeGreaterThan(0);
});
