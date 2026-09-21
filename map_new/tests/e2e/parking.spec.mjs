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
  await page.locator('[data-tab=map]').click();expect(await page.evaluate(()=>window.__parking.scene.markers.length)).toBeGreaterThanOrEqual(30);await expect(page.locator('#map-note')).toContainText('Google');await screenshot(page,'coordinate-map.png');
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
test('real place inventory includes parks and public parking without counting floors as buildings',async({page})=>{
  await open(page);await expect(page.locator('#count')).toHaveText('45곳');await expect(page.locator('#inventory-note')).toContainText('도면 63장');
  await page.locator('#type-filter').selectOption('park');await expect(page.locator('[data-site]')).toHaveCount(2);await page.locator('[data-site=park-boramae]').click();await expect(page.locator('#scene-title')).toHaveText('보라매공원');
  expect(await page.evaluate(()=>window.__parking.state.plan.sourceCrop.width)).toBe(.5);expect(await page.evaluate(()=>window.__parking.state.plan.walls.length)).toBe(0);await expect(page.locator('#play')).toBeDisabled();
  await page.locator('[data-tab=charging]').click();await expect(page.locator('#charge-candidates')).toContainText('주차면 의미 레이어가 없는 도면');await screenshot(page,'park-guide.png');
  await page.locator('#type-filter').selectOption('parking');await expect(page.locator('[data-site]')).toHaveCount(3);await page.locator('[data-site=parking-168780-0]').click();await page.waitForFunction(()=>window.__parking.state.plan.id==='parking-168780-0');
  expect(await page.evaluate(()=>window.__parking.state.plan.spaces.filter(s=>s.accessible).length)).toBe(12);
});
test('actual station data drives disclosed green and red screening, filters and export',async({page})=>{
  await open(page,'10000901-0');await page.locator('[data-tab=charging]').click();await expect(page.locator('#charging-panel')).toHaveAttribute('data-ready','true');
  const initial=await page.evaluate(()=>({scores:window.__parking.state.charging.selected.map(c=>c.score),signal:window.__parking.state.charging.ranked[0].signal.best.dbm,source:window.__parking.state.radio.source,count:window.__parking.state.radio.stations.length}));
  expect(initial.count).toBeGreaterThan(10);expect(initial.source).toContain('spectrummap.kr');expect(initial.scores).toHaveLength(3);expect(initial.scores.every(s=>s>=65)).toBe(true);await expect(page.locator('#charge-detail')).toContainText('추정 수신전력');
  await screenshot(page,'charging-screening.png');
  await page.locator('.charging-assumptions summary').click();await page.locator('#charge-basement').fill('8');await page.locator('#charge-basement').blur();
  expect(await page.evaluate(()=>window.__parking.state.charging.ranked[0].signal.best.dbm)).toBeLessThan(initial.signal-100);expect(await page.evaluate(()=>window.__parking.state.charging.selected)).toEqual([]);await expect(page.locator('.charge-rf')).toHaveCSS('color','rgb(208, 68, 68)');
  await page.locator('#charge-operator').selectOption('주식회사 케이티');await page.locator('#charge-radio').selectOption('5G');expect(await page.evaluate(()=>window.__parking.state.charging.ranked.every(c=>c.signal.alternatives.every(a=>a.station.operator==='주식회사 케이티'&&a.station.radio==='5G')))).toBe(true);
  const download=page.waitForEvent('download');await page.locator('#charge-export').click();expect((await download).suggestedFilename()).toBe('10000901-0-charging-screening.json');
  await page.evaluate(()=>window.__parking.select('changdong-b2'));await page.locator('[data-tab=charging]').click();expect(await page.evaluate(()=>window.__parking.state.charging.selected)).toEqual([]);await expect(page.locator('#charge-detail')).toContainText('부족');
});
test('accessible bays stay visible, realistic objects accept multiple textures and drawing details preserve OCR',async({page})=>{
  await open(page);const scene=await page.evaluate(()=>{const w=window.__parking.scene.world;return {marks:w.children.filter(o=>o.userData.kind==='accessible-mark').length,cars:w.children.filter(o=>o.userData.kind==='parked-car').length,stairs:w.children.filter(o=>o.userData.kind==='stairs').length,objects:w.userData.objectCount};});
  expect(scene).toEqual({marks:4,cars:101,stairs:3,objects:87});
  await page.locator('.visual-controls summary').click();await page.locator('[data-finish=wall]').selectOption('brick');await page.locator('[data-finish=floor]').selectOption('epoxy');await page.locator('[data-finish=column]').selectOption('tile');await page.locator('[data-finish=stairs]').selectOption('concrete');await page.locator('#parked-cars').uncheck();
  expect(await page.evaluate(()=>window.__parking.scene.world.children.filter(o=>o.userData.kind==='parked-car').every(o=>!o.visible))).toBe(true);expect(await page.evaluate(()=>window.__parking.scene.finishes)).toMatchObject({wall:'brick',floor:'epoxy',column:'tile'});await screenshot(page,'drawing-materials.png');
  await page.locator('#ocr-labels').check();expect(await page.evaluate(()=>window.__parking.scene.textGroup.children.length)).toBeGreaterThan(5);
  await page.locator('#drawing-info').click();await expect(page.locator('#dialog-content')).toContainText('전기실');await expect(page.locator('#dialog-content')).toContainText('현재 구획 105면');await expect(page.locator('#dialog-content')).toContainText('가정 높이');
  await page.getByText(/자동 추출한 원본 글자 전체/).click();await expect(page.locator('.drawing-text')).toContainText('전기실');
});
test('mobile charging settings and all drawing information remain reachable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page,'parking-168780-0');await page.locator('[data-tab=charging]').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await expect(page.locator('#charge-count')).toBeVisible();await page.locator('#charge-count').selectOption('1');expect(await page.evaluate(()=>window.__parking.state.charging.selected.length)).toBe(1);
  await screenshot(page,'charging-mobile.png',{fullPage:true});await page.locator('.visual-controls summary').click();await page.locator('#drawing-info').click();await expect(page.locator('.drawing-table').first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
