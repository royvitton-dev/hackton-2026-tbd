import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../../public/plans/catalog.json',import.meta.url),'utf8'));
const catalogCount=catalog.length,parkingCount=catalog.filter(s=>s.parkingStatus==='verified-in-published-plan').length;

const errors=[];
test.beforeEach(async({page})=>{errors.length=0;page.on('pageerror',e=>errors.push(e.message));await page.goto('/?capture=1');await page.waitForFunction(count=>window.__atlas?.state.catalog.length===count,catalogCount);await page.evaluate(()=>document.fonts.ready);});
test.afterEach(()=>expect(errors).toEqual([]));
const lab=async page=>{await page.locator('[data-nav="lab"]').click();await expect(page.locator('#route-panel')).toBeVisible();await page.waitForFunction(()=>__atlas.state.screen==='lab'&&__atlas.state.route);};

test('Google entry, original sources, search, and all catalog plans render',async({page})=>{
 test.setTimeout(240000);await expect(page.locator('.address-marker')).toHaveCount(catalogCount);await expect(page.locator('.site-card')).toHaveCount(catalogCount);
 await page.locator('#search').fill('없는장소');await expect(page.locator('.empty')).toBeVisible();await page.locator('#search').fill('');
 for(const site of await page.evaluate(()=>__atlas.state.catalog.map(s=>({id:s.id,name:s.name})))){await page.locator(`[data-site="${site.id}"]`).first().click();await page.waitForFunction(id=>__atlas.state.plan?.sourceType==='raster'&&__atlas.state.plan.name===__atlas.state.catalog.find(s=>s.id===id).name,site.id);await expect(page.locator('#plan-info h2')).toHaveText(site.name);expect(await page.evaluate(()=>__atlas.state.plan.walls.length)).toBeGreaterThan(0);}
 await page.locator('[data-model="2d"]').click();await expect(page.locator('#flat-image')).toBeVisible();expect(await page.locator('#flat-image').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.locator('#scale').fill('22');await page.locator('#calibrate').click();expect(await page.evaluate(()=>__atlas.state.plan.width)).toBe(22);await page.locator('[data-model="exterior"]').click();expect(await page.evaluate(()=>__atlas.scene.mode)).toBe('exterior');
});
test('car animation reaches every building and supports first/third person and pause',async({page})=>{
 test.setTimeout(240000);await lab(page);await page.locator('[data-camera="first"]').click();expect(await page.evaluate(()=>__atlas.state.camera)).toBe('first');await page.locator('[data-camera="third"]').click();
 for(const id of ['A','B','C','D']){await page.locator('#restart').click();await page.waitForFunction(()=>__atlas.state.route);await page.locator('#destination').selectOption(id);await page.locator('#speed').selectOption('4');const start=await page.evaluate(()=>({...__atlas.state.pose}));await page.locator('#start').click();await expect.poll(async()=>page.evaluate(()=>__atlas.state.travel)).toBeGreaterThan(2);expect(await page.evaluate(()=>__atlas.state.pose.z)).not.toBe(start.z);await page.locator('#start').click();const frozen=await page.evaluate(()=>__atlas.state.travel);await page.waitForTimeout(180);expect(await page.evaluate(()=>__atlas.state.travel)).toBe(frozen);await page.locator('#start').click();await expect(page.locator('#start')).toContainText('도착', {timeout:60000});expect(await page.evaluate(()=>__atlas.state.pose.arrived)).toBe(true);expect(await page.evaluate(()=>__atlas.state.route.destination.id)).toBe(id);}
});
test('fire reroutes from current position, animates a person, and stops when exits are blocked',async({page})=>{
 await lab(page);await page.locator('#speed').selectOption('4');await page.locator('#start').click();await expect.poll(async()=>page.evaluate(()=>__atlas.state.travel)).toBeGreaterThan(5);await page.locator('#start').click();const p=await page.evaluate(()=>({...__atlas.state.pose}));await page.locator('#fire-toggle').click();expect(await page.evaluate(()=>__atlas.state.mode)).toBe('person');const start=await page.evaluate(()=>__atlas.state.route.points[0]);expect(start.x).toBeCloseTo(p.x);expect(start.z).toBeCloseTo(p.z);
 await page.locator('#fire-location').selectOption('west');expect(await page.evaluate(()=>__atlas.state.route.destination.id)).toBe('exit-east');await page.locator('#speed').selectOption('4');await page.locator('#start').click();await expect.poll(async()=>page.evaluate(()=>__atlas.state.travel)).toBeGreaterThan(2);expect(await page.evaluate(()=>__atlas.scene.person.visible)).toBe(true);await page.locator('#fire-location').selectOption('all');await expect(page.locator('.no-route')).toBeVisible();await expect(page.locator('#start')).toBeDisabled();expect(await page.evaluate(()=>__atlas.state.playing)).toBe(false);
});
test('keyboard motion stays on a lane and audio is opt-in',async({page})=>{
 await lab(page);await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');await page.locator('#sound').click();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');expect(await page.evaluate(()=>__atlas.state.pose.z)).toBeLessThan(27);expect(await page.evaluate(()=>__atlas.state.playing)).toBe(false);await page.locator('#sound').click();
});
test('golden parking overview, first person, evacuation, library and source analysis',async({page})=>{
 await lab(page);await page.waitForTimeout(800);await expect(page).toHaveScreenshot('parking-overview.png');
 await page.locator('[data-camera="first"]').click();await page.waitForTimeout(400);await expect(page).toHaveScreenshot('parking-first-person.png');
 await page.locator('[data-camera="orbit"]').click();await page.locator('#fire-toggle').click();await page.locator('#notification').evaluate(el=>el.classList.remove('visible'));await page.waitForTimeout(400);await expect(page).toHaveScreenshot('evacuation-overview.png');
 await page.locator('[data-nav="plans"]').click();await expect(page).toHaveScreenshot('plan-library.png');await page.locator('.library-grid button').first().click();await page.waitForFunction(()=>__atlas.state.plan.sourceType==='raster');await page.waitForTimeout(500);await expect(page).toHaveScreenshot('plan-analysis.png');
});
test('mobile layout keeps controls and animation usable; golden mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await lab(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.locator('#destination').selectOption('D');await page.locator('#start').click();await expect.poll(async()=>page.evaluate(()=>__atlas.state.travel)).toBeGreaterThan(1);await page.locator('#start').click();await page.locator('#restart').click();await page.waitForFunction(()=>__atlas.state.route);await page.waitForTimeout(500);await expect(page).toHaveScreenshot('parking-mobile.png',{fullPage:true});
});

test('actual parking PDF pages are analyzed from local source bytes',async({page})=>{await page.locator('[data-nav="plans"]').click();await page.locator('#public-parking').click();await expect(page.locator('#pdf-page')).toHaveValue('16');expect(await page.evaluate(()=>__atlas.state.plan.walls.length)).toBeGreaterThan(0);await page.locator('[data-model="2d"]').click();await expect(page.locator('#flat-image')).toHaveAttribute('src',/^data:image\/png/);await page.locator('#pdf-page').selectOption('17');await expect(page.locator('#crumb-title')).toContainText('17쪽');});
test('actual parking annotations drive to all core approaches without fabricating an evacuation exit',async({page})=>{await page.locator('[data-nav="plans"]').click();await page.locator('#source-drive').click();await page.waitForFunction(()=>__atlas.state.plan?.layoutType==='source-traced'&&__atlas.state.route);await expect(page.locator('#destination option')).toHaveCount(3);for(const id of ['A','B','C']){await page.locator('#destination').selectOption(id);expect(await page.evaluate(()=>__atlas.state.route.destination.id)).toBe(id);}await page.locator('#speed').selectOption('4');await page.locator('#start').click();await expect.poll(async()=>page.evaluate(()=>__atlas.state.travel)).toBeGreaterThan(3);await page.locator('#start').click();await page.locator('#fire-toggle').click();await expect(page.locator('#notification')).toContainText('지상 대피 연결이 미확인');expect(await page.evaluate(()=>__atlas.state.mode)).toBe('car');});


test('30 additional parking sites have original plans and open a survey workspace without fabricated infrastructure',async({page})=>{
 await page.locator('[data-nav="plans"]').click();await page.locator('[data-filter="parking"]').click();await expect(page.locator('.library-grid button:visible')).toHaveCount(parkingCount);
 await page.locator('.library-grid [data-site="parking-168780"]').click();await expect(page.locator('.parking-evidence')).toContainText('주차장 도면 확인');await expect(page.locator('#asset-select option')).toHaveCount(3);
 await page.locator('[data-model="2d"]').click();await expect(page.locator('#flat-image')).toBeVisible();await page.locator('#plan-charging').click();await expect(page.locator('.ev-empty')).toBeVisible();
 expect(await page.evaluate(()=>__atlas.state.charging.survey.planId)).toBe('parking-168780:0');expect(await page.evaluate(()=>__atlas.state.charging.result.selected)).toEqual([]);await expect(page.locator('#ev-demo')).toBeHidden();
});
test('EV capacity, heatmap layers, survey import and unavailable public cell data remain explicit',async({page})=>{
 await page.locator('[data-nav="charging"]').click();await expect(page.locator('.ev-candidate')).toHaveCount(8);expect(await page.evaluate(()=>__atlas.scene.car.userData.detailed)).toBe(true);
 await expect(page.locator('#ev-data-badge')).toContainText('실측 아님');await page.locator('#ev-count').selectOption('8');expect(await page.evaluate(()=>__atlas.state.charging.result.capacityUsedKw)).toBe(42);
 await page.locator('#ev-power').selectOption('50');await expect(page.locator('.ev-subtitle')).toContainText('0곳 선정');await page.locator('#ev-power').selectOption('7');
 await page.locator('#ev-signal').uncheck();expect(await page.evaluate(()=>__atlas.scene.scene.getObjectByName('signal-heatmap'))).toBeUndefined();await page.locator('#ev-signal').check();await page.locator('#ev-wiring').uncheck();expect(await page.evaluate(()=>__atlas.state.charging.wiring)).toBe(false);
 const survey=await page.evaluate(()=>structuredClone(__atlas.state.charging.survey));survey.source='survey';survey.sourceName='브라우저 검증 현장';survey.signals=[];
 await page.locator('#ev-file').setInputFiles({name:'survey.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(survey))});await expect(page.locator('#ev-data-badge')).toContainText('브라우저 검증 현장');expect(await page.evaluate(()=>__atlas.state.charging.result.selected)).toEqual([]);
 survey.planId='wrong-floor';await page.locator('#ev-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(survey))});await expect(page.locator('#notification')).toContainText('현재 도면과 일치');
 await page.locator('#ev-empty').click();await expect(page.locator('.ev-empty')).toBeVisible();await page.locator('.ev-sources summary').click();await page.locator('#ev-lat').fill('37.56');await page.locator('#ev-lng').fill('126.99');
 await page.route('**/api/infrastructure/cells?*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'OpenCellID API 키 미설정 — 공개 셀 자료를 조회할 수 없습니다.'})}));await page.locator('#ev-towers').click();await expect(page.locator('#ev-tower-result')).toContainText('API 키 미설정');
 await page.locator('[data-nav="lab"]').click();await expect(page.locator('.ev-sidebar')).toHaveCount(0);
});
test('golden charging map and mobile controls',async({page})=>{
 await page.locator('[data-nav="charging"]').click();await expect(page.locator('.ev-candidate')).toHaveCount(8);await page.waitForTimeout(600);await expect(page).toHaveScreenshot('charging-overview.png');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.locator('#ev-power').selectOption('22');await expect(page.locator('.ev-subtitle')).toContainText('1곳 선정');await page.locator('#ev-power').selectOption('7');await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(400);await expect(page).toHaveScreenshot('charging-mobile.png',{fullPage:true});
});

test('address markers show saved addresses and distinct WebGL building types, including area precision',async({page})=>{
 await expect(page.locator('#google-map')).toHaveAttribute('data-models',String(catalogCount));expect((await page.locator('#google-map').boundingBox()).height).toBeGreaterThan(500);await expect(page.locator('#world')).toBeHidden();await expect(page.locator('.address-marker')).toHaveCount(catalogCount);
 for(const type of ['apartment','office','large','house'])expect(await page.locator(`[data-building-type="${type}"]`).count()).toBeGreaterThan(0);
 await page.evaluate(()=>__atlas.addressMap.focus(__atlas.state.catalog.find(s=>s.id==='parking-168780')));await expect(page.locator('.map-selection')).toContainText('동탄호수공원 주차장');await expect(page.locator('.map-selection')).toContainText('경기도 화성시');await expect(page.locator('.map-selection')).toContainText('대형건물');
 await page.waitForTimeout(1100);await page.screenshot({path:'reports/visual/address-map.png'});await page.locator('.map-selection button').click();await expect(page.locator('#plan-info h2')).toHaveText('동탄호수공원 주차장');await page.locator('#plan-map').click();await expect(page.locator('.map-selection')).toBeVisible();
});

test('first person camera eases left and right yaw through a turn instead of snapping',async({page})=>{
 await lab(page);await page.locator('[data-camera="first"]').click();
 const frames=await page.evaluate(async()=>{const scene=__atlas.scene,base={...__atlas.state.pose};const samples=[];for(const turn of [Math.PI/2,-Math.PI/2]){scene.cameraYaw=base.heading;scene.setPose({...base,heading:base.heading+turn},'car');await new Promise(resolve=>{let count=0;function sample(){samples.push({yaw:scene.cameraYaw,target:base.heading+turn,turn});if(++count===6)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});}return samples;});
 expect(frames.length).toBeGreaterThan(2);for(const turn of [Math.PI/2,-Math.PI/2]){const f=frames.filter(x=>x.turn===turn);expect(f.some(x=>Math.abs(x.yaw-x.target)>.05)).toBe(true);expect(Math.abs(f.at(-1).yaw-f.at(-1).target)).toBeLessThan(Math.PI/2);}
});


test('floor collection isolates B1–B4 originals, EV inputs, and apartment data; golden basement',async({page})=>{
 test.setTimeout(150000);await page.locator('[data-nav="plans"]').click();await page.locator('[data-filter="multilevel"]').click();await expect(page.locator('.library-grid button:visible')).toHaveCount(1);await page.locator('.library-grid [data-site="multilevel-dogok"]').click();
 const images=[];for(const floor of ['B1','B2','B3','B4']){await page.locator(`[data-floor="${floor}"]`).click();await expect(page.locator('#floor-status')).toContainText(floor);await page.waitForFunction(f=>__atlas.state.plan.floor===f,floor);expect(await page.evaluate(()=>__atlas.state.plan.walls.length)).toBeGreaterThan(0);await expect(page.locator('#flat-image')).toBeVisible();images.push(await page.locator('#flat-image').getAttribute('src'));}
 expect(new Set(images).size).toBe(4);await expect(page).toHaveScreenshot('basement-b4.png');await page.locator('#plan-charging').click();await expect(page.locator('.ev-empty')).toBeVisible();expect(await page.evaluate(()=>__atlas.state.charging.survey.planId)).toBe('multilevel-dogok:3');
 const survey=await page.evaluate(()=>structuredClone(__atlas.state.charging.survey));survey.planId='multilevel-dogok:0';await page.locator('#ev-file').setInputFiles({name:'another-floor.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(survey))});await expect(page.locator('#notification')).toContainText('현재 도면과 일치');
 await page.locator('[data-nav="plans"]').click();await page.locator('[data-filter="complex"]').click();await expect(page.locator('.library-grid button:visible')).toHaveCount(1);await expect(page.locator('.complex-references')).toContainText('1,509');await expect(page.locator('.reference-levels a')).toHaveCount(4);
 await page.locator('.library-grid [data-site="complex-onepentas"]').click();await expect(page.locator('.complex-stats')).toContainText('641');await expect(page.locator('#floor-status')).toContainText('주차 평면도 미확보');for(const floor of ['B1','B2','B3','B4'])await expect(page.locator(`[data-floor="${floor}"]`)).toBeDisabled();await expect(page.locator('#flat-image')).toHaveAttribute('src',/onepentas-site/);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await expect(page.locator('[data-floor="B4"]')).toBeVisible();
});
