import {test,expect} from '@playwright/test';
import {providerFixture} from './provider-fixture.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const artifacts=fileURLToPath(new URL('../../.runtime/address-reference/',import.meta.url));

test.beforeEach(async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.__addressErrors=errors;
  // Keep another contributor's hot reload from interrupting this browser check.
  await page.routeWebSocket('**',socket=>{const server=socket.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}}socket.send(message);});});
});
test.afterEach(async({page})=>expect(page.__addressErrors).toEqual([]));
async function open(page,site='10000901-0') {
  await page.goto('/map_new/?view=address&site='+site);await page.waitForFunction(()=>window.__addressStudio);await expect(page.locator('#address-world')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);
}
async function fixtures(page) {
  await page.addInitScript(providerFixture);
  await page.route('https://oapi.map.naver.com/openapi/v3/maps.js?**',route=>route.fulfill({contentType:'application/javascript',body:'/* mocked SDK contract */'}));
  await page.route('https://dapi.kakao.com/v2/maps/sdk.js?**',route=>route.fulfill({contentType:'application/javascript',body:'/* mocked SDK contract */'}));
}

test('address-linked source geometry, actual photo, editable height and color',async({page})=>{
  await open(page);await expect(page.locator('#address-title')).toContainText('너나들이');
  await expect.poll(()=>page.evaluate(()=>__addressStudio.state.model.triangles)).toBeGreaterThan(1000);
  await expect(page.locator('#address-world')).toHaveAttribute('data-model-kind','published-footprint');
  await expect(page.locator('#address-material-note')).toContainText('원본 사진의 벽면 질감 적용됨');
  await expect.poll(()=>page.locator('#address-photo').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.screenshot({path:path.join(artifacts,'address-desktop.png')});
  const before=await page.evaluate(()=>__addressStudio.state.model.profile.height);
  await page.locator('#address-floors').fill('7');await page.locator('#address-floors').blur();expect(await page.evaluate(()=>__addressStudio.state.model.profile.height)).toBeGreaterThan(before);
  await page.locator('#address-photo').click();await expect(page.locator('#address-status')).toContainText('사진에서 고른 색');
  expect(await page.locator('#address-color').inputValue()).toBe(await page.evaluate(()=>__addressStudio.state.model.profile.color));
  await page.locator('[data-model-view=drawing]').click();await expect(page.locator('#address-world')).toHaveAttribute('data-model-kind','drawing');
  await page.screenshot({path:path.join(artifacts,'address-drawing.png')});
  const download=page.waitForEvent('download');await page.locator('#address-export').click();expect((await download).suggestedFilename()).toBe('10000901-0-address-model.json');
});

test('search joins another collected address to its own photos and floor drawings',async({page})=>{
  await open(page);await page.locator('#address-query').fill('서울 마포구 성미산로5안길 15');await page.getByRole('button',{name:'위치 찾기',exact:true}).click();
  await expect(page.locator('#address-world')).toHaveAttribute('data-site','20000441-0');await expect(page.locator('#address-photo')).toHaveAttribute('src',/address\/photos\/20000441-/);
  await expect(page.locator('#address-floor option')).toHaveCount(3);await page.locator('#address-floor').selectOption('20000441-1');await expect(page.locator('#address-world')).toHaveAttribute('data-site','20000441-1');
  await page.locator('[data-model-view=exterior]').click();await expect(page.locator('#address-model-note')).toContainText('실제 외곽선 미확인');
  await page.screenshot({path:path.join(artifacts,'address-second-place.png')});
  await page.locator('#address-query').fill('존재하지않는수집주소987654');await page.getByRole('button',{name:'위치 찾기',exact:true}).click();await expect(page.locator('#address-status')).toContainText('일치하는 수집 자료가 없습니다');
});

test('missing keys and imprecise district coordinates never masquerade as a live roadview',async({page})=>{
  const calls=[];page.on('request',r=>{if(/oapi.map.naver|dapi.kakao/.test(r.url()))calls.push(r.url());});
  await open(page);await page.locator('[data-reference=kakao-road]').click();await expect(page.locator('#address-reference-status')).toContainText('API 키 없이');await expect(page.locator('[data-web-source=roadview]')).toBeVisible();expect(calls).toEqual([]);
  await page.goto('/map_new/?view=address&site=parking-131601-0');await page.waitForFunction(()=>window.__addressStudio);
  await page.locator('[data-reference=naver-road]').click();await expect(page.locator('#address-reference-status')).toContainText('건물 단위 위치');await expect(page.locator('#address-photo')).toBeHidden();await expect(page.locator('#address-road-link')).toBeHidden();expect(calls).toEqual([]);
});

test('coordinate links preserve ambiguity and do not attach a neighboring building automatically',async({page})=>{
  await open(page);await page.locator('#address-query').fill('https://map.kakao.com/link/map/너나들이,37.6180982,127.1102204');await page.getByRole('button',{name:'위치 찾기',exact:true}).click();
  await expect(page.locator('#address-world')).toHaveAttribute('data-site','map-link');await expect(page.locator('#address-model-note')).toContainText('실제 건물 형상이 아닙니다');
  await expect(page.locator('[data-address-site="10000901-0"]')).toBeVisible();await expect(page.locator('[data-address-site="10000921-0"]')).toBeVisible();
  await page.locator('[data-address-site="10000901-0"]').click();await expect(page.locator('#address-world')).toHaveAttribute('data-model-kind','published-footprint');
});

for(const provider of ['naver','kakao'])test(`${provider} SDK contract: geocoding, map, roadview and camera bearing`,async({page})=>{
  await fixtures(page);await open(page);await page.locator('.address-connection summary').click();await page.locator('#address-'+provider+'-key').fill('test-public-client-id');
  await page.locator('#address-provider').selectOption(provider);await page.locator('#address-query').fill('서울 중랑구 신내역로1길 145');await page.getByRole('button',{name:'위치 찾기',exact:true}).click();
  await page.locator('.address-result').click();await expect.poll(()=>page.evaluate(()=>__addressStudio.state.site.location.precision)).toBe('provider-address');
  expect(await page.evaluate(()=>__providerFixture.queries)).toEqual([{provider,query:'서울 중랑구 신내역로1길 145'}]);
  await page.locator(`[data-reference="${provider}-map"]`).click();await expect(page.locator('#address-reference-status')).toContainText('지도 연결됨');
  const before=await page.evaluate(()=>__addressStudio.state.model.camera);
  await page.locator(`[data-reference="${provider}-road"]`).click();await expect(page.locator('#address-reference-status')).toContainText('거리뷰 연결됨');
  await page.evaluate(p=>{const f=__providerFixture;f.emit(f.views.at(-1),p==='naver'?'pov_changed':'viewpoint_changed');},provider);
  expect(await page.evaluate(()=>__addressStudio.state.model.camera)).not.toEqual(before);
  await page.evaluate(()=>__providerFixture.noImagery=true);await page.locator('[data-reference=photo]').click();await page.locator(`[data-reference="${provider}-road"]`).click();await expect(page.locator('#address-reference-status')).toContainText(provider==='naver'?'거리뷰가 없습니다':'로드뷰를 찾지 못했습니다');
});

test('late roadview callbacks cannot replace the next photo view',async({page})=>{
  await fixtures(page);await open(page);await page.locator('.address-connection summary').click();await page.locator('#address-kakao-key').fill('test-public-client-id');
  await page.evaluate(()=>__providerFixture.delay=400);await page.locator('[data-reference=kakao-road]').click();await page.locator('[data-reference=photo]').click();await page.waitForTimeout(600);
  await expect(page.locator('#address-photo')).toBeVisible();await expect(page.locator('#address-reference')).toBeHidden();await expect(page.locator('#address-reference-status')).toHaveText('');
});

test('a resolved building address stays bound when changing its floor drawing',async({page})=>{
  await fixtures(page);await open(page);await page.locator('.address-connection summary').click();await page.locator('#address-kakao-key').fill('test-public-client-id');
  await page.evaluate(()=>__providerFixture.address='서울특별시 마포구 성미산로5안길 15');await page.locator('#address-provider').selectOption('kakao');await page.locator('#address-query').fill('서울 마포구 성미산로5안길 15');await page.getByRole('button',{name:'위치 찾기',exact:true}).click();await page.locator('.address-result').click();
  await expect(page.locator('#address-world')).toHaveAttribute('data-site','20000441-0');await page.locator('#address-floor').selectOption('20000441-1');await expect(page.locator('#address-world')).toHaveAttribute('data-site','20000441-1');
  expect(await page.evaluate(()=>__addressStudio.state.site.location.precision)).toBe('provider-address');
});

test('mobile entry preserves the selected parking drawing and stays within the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/map_new/?site=10000901-0');await page.waitForFunction(()=>window.__parking?.state.plan?.id==='10000901-0');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('link',{name:'주소로 3D ↗',exact:true}).click();await page.waitForFunction(()=>window.__addressStudio);await expect(page.locator('#address-world')).toHaveAttribute('data-site','10000901-0');
  await page.locator('#address-world').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(artifacts,'address-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#address-plan-link').click();await page.waitForFunction(()=>window.__parking?.state.plan?.id==='10000901-0');await expect(page.locator('#play')).toBeEnabled();
});
