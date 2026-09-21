import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{page.__errors=[];page.on('pageerror',e=>page.__errors.push(e.message));});
test.afterEach(async({page})=>expect(page.__errors).toEqual([]));
async function open(page,site){await page.goto(`/map_new/?site=${site}`);await page.waitForFunction(id=>window.__parking?.state.plan?.id===id,site);await expect(page.locator('#world')).toHaveAttribute('data-ready','true');await page.waitForFunction(()=>!window.__parking.state.initializing);await page.locator('#reset').click();await page.evaluate(()=>document.fonts.ready);}
test('reverses into an actual Daecheon bay, pauses for shifts and finishes with the nose facing the aisle',async({page})=>{
 await open(page,'parking-131601-0');await page.locator('#destination').selectOption('approach:north-8');await page.locator('#parking-mode').selectOption('reverse');await expect(page.locator('#play')).toBeEnabled();await expect(page.locator('#destination')).toHaveValue('parking:north-8');await expect(page.locator('#route-message')).toContainText('후진 입차');
 const route=await page.evaluate(()=>window.__parking.state.route);expect(route.parking.method).toBe('bounded-kinematic-search');expect(route.gearChanges.length).toBeGreaterThan(1);
 await expect(page).toHaveScreenshot('reverse-parking.png',{mask:[page.locator('#quality-status')],maskColor:'#f6f6ee'});
 await page.evaluate(()=>{window.maneuverSamples=[];const sample=()=>{const s=window.__parking.state;if(s.playing)window.maneuverSamples.push({gear:s.pose.gear,pause:s.playback.pause,heading:s.pose.heading});window.maneuverFrame=requestAnimationFrame(sample);};sample();});
 await page.locator('#speed').selectOption('4');await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('✓ 도착했습니다',{timeout:30000});
 const end=await page.evaluate(()=>{cancelAnimationFrame(window.maneuverFrame);const s=window.__parking.state;return {pose:s.pose,bay:s.plan.spaces.find(b=>b.id===s.route.parking.spaceId),samples:window.maneuverSamples};});
 expect(end.pose.arrived).toBe(true);expect(end.pose.gear).toBe(-1);expect(Math.cos(end.pose.heading)).toBeCloseTo(1);expect(Math.abs(end.pose.x-end.bay.x)).toBeLessThan(.15);expect(Math.abs(end.pose.z-end.bay.z)).toBeLessThan(.12);
 expect(end.samples.some(s=>s.gear===-1)).toBe(true);expect(end.samples.some(s=>s.pause>0)).toBe(true);await expect(page.locator('#drive-status')).toContainText('주차 완료');
});
test('drives the source ramp with pitch, reports the height assumption and rejects insufficient grade allowance',async({page})=>{
 await open(page,'changdong-b2');await expect(page.locator('#start-node')).toHaveValue('ramp-start');await expect(page.locator('#play')).toBeEnabled();
 const before=await page.evaluate(()=>({pose:window.__parking.state.pose,rotation:window.__parking.scene.actor.rotation.x}));expect(before.pose.y).toBeGreaterThan(2.7);expect(before.rotation).toBeGreaterThan(.1);
 await page.locator('#speed').selectOption('4');await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('✓ 도착했습니다',{timeout:20000});expect(await page.evaluate(()=>window.__parking.state.pose.y)).toBe(0);
 await page.locator('#car-grade').fill('10');await page.locator('#car-grade').blur();await expect(page.locator('#play')).toBeDisabled();
 await page.locator('.visual-controls summary').click();await page.locator('#drawing-info').click();await expect(page.locator('#dialog-content')).toContainText('3.3m');await expect(page.locator('#dialog-content')).toContainText('상층 평면은 복원하지 않았습니다');
});
test('connects two synthetic floors to an elevated bay, isolates floors and keeps all controls reachable on mobile',async({page})=>{
 await open(page,'multilevel-lab');await expect(page.locator('#play')).toBeEnabled();await page.locator('#parking-mode').selectOption('reverse');await expect(page.locator('#route-message')).toContainText('후진 입차');
 const r=await page.evaluate(()=>window.__parking.state.route);expect(r.points.some(p=>p.y>0&&p.y<3.3)).toBe(true);expect(r.points.at(-1).y).toBe(3.3);
 await expect(page).toHaveScreenshot('multilevel-route.png',{mask:[page.locator('#quality-status')],maskColor:'#f6f6ee'});
 await page.locator('.visual-controls summary').click();await page.locator('#floor-select').selectOption('3.3');
 const floors=await page.evaluate(()=>window.__parking.scene.world.children.filter(o=>o.userData.surface==='floor').map(o=>({y:o.userData.floorY,visible:o.visible})));expect(floors).toEqual([{y:0,visible:false},{y:3.3,visible:true}]);
 await page.locator('#floor-select').selectOption('all');await page.locator('[data-finish=stairs]').selectOption('brick');
 await page.setViewportSize({width:390,height:844});await page.locator('.visual-controls summary').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await expect(page.locator('#parking-mode')).toBeVisible();await expect(page.locator('#car-grade')).toBeVisible();
 await page.locator('#speed').selectOption('4');await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('✓ 도착했습니다',{timeout:30000});await expect(page.locator('#drive-status')).toContainText('B1');
});
test('cancels stale parking calculations when the user changes drawings and shows source doors and colored signs',async({page})=>{
 await open(page,'parking-131601-0');await page.locator('#parking-mode').selectOption('reverse');await page.evaluate(()=>window.__parking.select('parking-168780-0'));await expect(page.locator('#play')).toBeEnabled();
 const initial=await page.evaluate(()=>{const s=window.__parking.scene;return {route:window.__parking.state.route.approach.spaceId,doors:s.world.children.filter(o=>o.userData.kind==='door').length,stairs:s.world.children.filter(o=>o.userData.kind==='stairs-sign').length,exits:s.world.children.filter(o=>o.userData.kind==='route-label'&&o.material?.map?.image).length};});expect(initial.route).toBe('west-compact-5-1');expect(initial.doors).toBe(4);expect(initial.stairs).toBe(4);expect(initial.exits).toBeGreaterThan(0);
 await expect(page.locator('#structure-legend')).toContainText('문');await expect(page.locator('#structure-legend')).toContainText('출구');await page.locator('.visual-controls summary').click();await page.locator('[data-finish=stairs]').selectOption('tile');await page.locator('#drawing-info').click();await expect(page.locator('#dialog-content')).toContainText('문 4개');
});
