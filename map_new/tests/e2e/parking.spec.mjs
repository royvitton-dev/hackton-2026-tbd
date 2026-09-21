import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/reports/'))errors.push(r.status()+' '+r.url());});page.__errors=errors;});
test.afterEach(async({page})=>expect(page.__errors).toEqual([]));
async function screenshot(page,name,options={}){return expect(page).toHaveScreenshot(name,{...options,style:'#quality-status {visibility:hidden !important}'});}
async function open(page,site='changdong-b2'){
  await page.goto(`/map_new/?site=${site}`);await page.waitForFunction(id=>window.__parking?.state.plan?.id===id,site);await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.evaluate(()=>document.fonts.ready);
}
test('public B2 source converts to actual WebGL meshes, with original and data export',async({page})=>{
  await open(page);const state=await page.evaluate(()=>({walls:window.__parking.state.model.meshes.length,triangles:window.__parking.scene.renderer.info.render.triangles,provenance:window.__parking.state.plan.provenance}));expect(state.walls).toBe(24);expect(state.triangles).toBeGreaterThan(288);expect(state.provenance.kind).toBe('source-traced');
  await expect(page.locator('#evidence')).toContainText('수동 동선 주석');await screenshot(page,'public-b2.png');
  await page.locator('#source-thumb').click();await expect(page.locator('dialog img')).toBeVisible();await page.getByRole('button',{name:'닫기',exact:true}).click();
  const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toBe('changdong-b2-model.json');
  await page.locator('#fire').click();await expect(page.locator('#route-message')).toContainText('확인된 집결지가 없습니다');await expect(page.locator('#play')).toBeDisabled();
});
test('drives through exterior road and entrance to EV, supports cameras and pauses',async({page})=>{
  await open(page,'integration-lab');await expect(page.locator('#route-message')).toContainText('외부 도로 → 건물 진입');
  expect(await page.evaluate(()=>window.__parking.state.route.ids)).toEqual(['road-west','road-gate','entrance','south','north','ev']);
  await screenshot(page,'integrated-route.png');
  await page.locator('#speed').selectOption('4');await page.locator('#play').click();await expect.poll(()=>page.evaluate(()=>window.__parking.state.travel)).toBeGreaterThan(4);
  await page.locator('[data-camera=third]').click();expect(await page.evaluate(()=>window.__parking.scene.controls.enabled)).toBe(false);
  await page.locator('[data-camera=first]').click();expect(await page.evaluate(()=>window.__parking.state.camera)).toBe('first');
  await page.locator('#play').click();const pose=await page.evaluate(()=>window.__parking.state.pose);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__parking.state.pose)).toEqual(pose);
  await page.locator('[data-camera=orbit]').click();expect(await page.evaluate(()=>window.__parking.scene.actor.children.every(x=>x.visible))).toBe(true);
  await page.locator('#reset').click();await page.locator('#car-radius').fill('30');await page.locator('#car-radius').blur();await expect(page.locator('#play')).toBeDisabled();
});
test('fire starts at current position, switches to human and fails closed when exits are blocked',async({page})=>{
  await open(page,'integration-lab');await page.locator('#start-node').selectOption('south');await page.locator('#play').click();await expect.poll(()=>page.evaluate(()=>window.__parking.state.travel)).toBeGreaterThan(1);
  await page.locator('#play').click();const before=await page.evaluate(()=>window.__parking.state.pose);await page.locator('#fire').click();
  expect(await page.evaluate(()=>window.__parking.state.mode)).toBe('person');const after=await page.evaluate(()=>window.__parking.state.route.points[0]);expect(after.x).toBeCloseTo(before.x);expect(after.z).toBeCloseTo(before.z);
  await page.locator('#fire-location').selectOption('west');await expect(page.locator('#route-message')).toContainText('동측 옥외 집결지');await screenshot(page,'evacuation.png');
  await page.locator('#fire-location').selectOption('all');await expect(page.locator('#play')).toBeDisabled();await expect(page.locator('#route-message')).toContainText('집결지가 없습니다');
});
test('photo-derived facade and mapped buildings preserve geographic source attribution',async({page})=>{
  await open(page);await page.locator('[data-tab=photo]').click();await expect(page.locator('#photo')).toBeVisible();await expect.poll(()=>page.locator('#photo').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
  expect(await page.evaluate(()=>window.__parking.scene.world.userData.photoSha)).toMatch(/^[a-f0-9]{64}$/);await screenshot(page,'photo-facade.png');
  await page.locator('#roadview').click();await expect(page.locator('#roadview-status')).toContainText('키가 설정되지 않았습니다');await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.locator('[data-tab=map]').click();expect(await page.evaluate(()=>window.__parking.scene.markers.length)).toBe(5);await expect(page.locator('#map-note')).toContainText('Google');await screenshot(page,'coordinate-map.png');
});
test('imports semantic SVG and rejects executable and corrupt input without losing current scene',async({page})=>{
  await open(page,'integration-lab');await page.locator('#file').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg><script>alert(1)</script></svg>')});await expect(page.locator('#toast')).toContainText('지원하지 않는 SVG');expect(await page.evaluate(()=>window.__parking.state.plan.id)).toBe('integration-lab');
  await page.locator('#file').setInputFiles(new URL('../../public/sources/integration-lab.svg',import.meta.url).pathname.replace('/tests/public/','/public/'));
  await expect(page.locator('#scene-title')).toHaveText('integration-lab.svg');expect(await page.evaluate(()=>window.__parking.state.plan.nodes.length)).toBe(15);
});
test('actual Naver-located building routes from acquired OSM road through the drawn entrance',async({page})=>{
  await open(page,'10000901-0');expect(await page.evaluate(()=>window.__parking.state.route.ids)).toEqual(['road-start','road-portal','entrance','P2']);await expect(page.locator('#route-message')).toContainText('외부 도로 → 건물 진입');await expect(page.locator('#evidence')).toContainText('자동 그래프');await screenshot(page,'neonadeuli-route.png');
  await page.locator('#speed').selectOption('4');await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('✓ 도착했습니다',{timeout:15000});expect(await page.evaluate(()=>window.__parking.state.pose.arrived)).toBe(true);
});
test('mobile source selection and 3D controls remain usable without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page,'integration-lab');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await screenshot(page,'parking-mobile.png',{fullPage:true});
  await page.locator('#fire').click();await page.locator('#fire-location').selectOption('all');await expect(page.locator('#play')).toBeDisabled();await expect(page.locator('#fire-location')).toBeVisible();
  await page.locator('#search').fill('B4');await expect(page.locator('[data-site]')).toHaveCount(1);await page.locator('[data-site]').click();await expect(page.locator('#scene-title')).toContainText('B4');await expect(page.locator('#play')).toBeDisabled();
});
test('existing park exposes the new attraction, shared launch route and root quality dashboard',async({page,request})=>{
  const apps=await (await request.get('/api/apps')).json();expect(apps.apps.find(a=>a.id==='map_new').path).toBe('/map_new/');const launch=await request.post('/api/launch?id=map_new');expect(launch.status()).toBe(200);expect((await launch.json()).path).toBe('/map_new/');
  await page.goto('/park/?capture=1');await expect(page.locator('.attraction-card[data-id=map_new]')).toBeVisible();await expect(page.locator('#parking-quality')).toBeVisible();await page.locator('#parking-quality summary').click();await expect(page.locator('#parking-quality a[href="/map_new/"]')).toBeVisible();await page.locator('#parking-quality a[href="/map_new/"]').click();await page.waitForFunction(()=>window.__parking?.state.plan);
});
