import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const artifacts=fileURLToPath(new URL('../../.runtime/address-reference/',import.meta.url));
test.beforeEach(async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.__webErrors=errors;
  await page.routeWebSocket('**',socket=>{const server=socket.connectToServer();server.onMessage(message=>{if(typeof message==='string'){try{if(['full-reload','update'].includes(JSON.parse(message).type))return;}catch{}}socket.send(message);});});
  await page.goto('/map_new/?view=address&site=20000441-0');await page.waitForFunction(()=>window.__addressStudio);
});
test.afterEach(async({page})=>expect(page.__webErrors).toEqual([]));

test('maps and internet image searches remain usable with no API key',async({page})=>{
  const sdk=[];page.on('request',r=>{if(/oapi.map.naver|dapi.kakao/.test(r.url()))sdk.push(r.url());});
  await page.locator('[data-reference=naver-map]').click();await expect(page.locator('#address-reference-status')).toContainText('API 키 없이');
  const naver=page.locator('[data-web-source=naver]');expect(decodeURIComponent(await naver.getAttribute('href'))).toContain('성미산로5안길 15');await expect(naver).toHaveAttribute('target','_blank');
  await page.locator('[data-reference=kakao-map]').click();await expect(page.locator('[data-web-source=kakao]')).toHaveAttribute('href',/^https:\/\/map.kakao.com\/link\/search\//);
  await page.locator('[data-reference=web]').click();const images=new URL(await page.locator('[data-web-source=naver-images]').getAttribute('href'));expect(images.searchParams.get('query')).toContain('온음공동체주택');
  expect(sdk).toEqual([]);await page.screenshot({path:artifacts+'address-web-sources.png'});
});

test('a provider search without a key links the collected drawing and offers the real map website',async({page})=>{
  await page.locator('#address-provider').selectOption('naver');await page.locator('#address-query').fill('서울 중랑구 신내역로1길 145');await page.getByRole('button',{name:'위치 찾기',exact:true}).click();
  await expect(page.locator('#address-world')).toHaveAttribute('data-site','10000901-0');await expect(page.locator('#address-status')).toContainText('API 키 없이 네이버');await expect(page.locator('[data-web-source=naver]')).toBeVisible();
});

test('an unmatched internet search does not attach a photo to the previously selected building',async({page})=>{
  await page.locator('#address-query').fill('서울 새로운주소 987654');await page.locator('#address-find-web').click();
  await expect(page.locator('.address-web-address')).toHaveText('서울 새로운주소 987654');await expect(page.locator('.address-add-reference')).toHaveCount(0);
  await expect(page.locator('#address-world')).toHaveAttribute('data-site','20000441-0');
});

test('a downloaded reference photo stays with its address across floor and building changes',async({page})=>{
  await page.locator('[data-reference=web]').click();await page.getByLabel('참고 사진 출처 페이지').fill('https://soco.seoul.go.kr/coHouse/');
  await page.getByLabel('참고 사진 파일').setInputFiles(fileURLToPath(new URL('../../public/address/photos/20000441-0.jpg',import.meta.url)));
  await page.getByRole('button',{name:'이 건물에 사진 연결',exact:true}).click();await expect(page.locator('#address-photo')).toHaveAttribute('src',/^blob:/);
  expect(await page.evaluate(()=>__addressStudio.state.photos)).toBe(3);
  await page.locator('#address-floor').selectOption('20000441-1');await expect(page.locator('#address-world')).toHaveAttribute('data-site','20000441-1');expect(await page.evaluate(()=>__addressStudio.state.photos)).toBe(3);
  await page.locator('[data-address-site="10000901-0"]').click();await expect(page.locator('#address-world')).toHaveAttribute('data-site','10000901-0');expect(await page.evaluate(()=>__addressStudio.state.photos)).toBe(1);
  await page.locator('[data-address-site="20000441-0"]').click();await expect(page.locator('#address-world')).toHaveAttribute('data-site','20000441-0');expect(await page.evaluate(()=>__addressStudio.state.photos)).toBe(3);
});
