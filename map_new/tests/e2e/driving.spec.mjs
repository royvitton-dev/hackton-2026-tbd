import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{page.__errors=[];page.on('pageerror',e=>page.__errors.push(e.message));});
test.afterEach(async({page})=>expect(page.__errors).toEqual([]));
async function open(page,id){await page.goto('/map_new/?site='+id);await page.waitForFunction(id=>window.__parking?.state.plan.id===id&&!window.__parking.state.initializing,id);await page.evaluate(()=>document.fonts.ready);}
test('automatically drives the longest feasible route on all parking plans and limits the route library to parking drawings',async({page})=>{
 for(const [id,count] of [['changdong-b2',101],['parking-131601-0',52],['parking-168780-0',31],['10000901-0',3]]){
  await open(page,id);const s=await page.evaluate(()=>{const s=window.__parking.state;return {coverage:s.coverage,playing:s.playing,distance:s.route.distance,start:document.querySelector('#start-node').value,goal:document.querySelector('#destination').value};});
  expect(s.coverage.reachable).toBe(count);expect(s.playing).toBe(true);expect(s.distance).toBeCloseTo(s.coverage.longest.distance);expect(s.start).toBe(s.coverage.longest.startId);expect(s.goal).toBe(s.coverage.longest.goal);
  await expect.poll(()=>page.evaluate(()=>window.__parking.state.travel)).toBeGreaterThan(.3);await page.locator('#play').click();
 }
 await page.locator('#type-filter').selectOption('routable');await expect(page.locator('[data-site]')).toHaveCount(4);
 await page.evaluate(()=>window.__parking.select('parking-168780-1'));await expect(page.locator('#play')).toBeDisabled();await expect(page.locator('#route-message')).toContainText('주차 정보가 없는');await expect(page.locator('#route-coverage')).toBeHidden();expect(await page.evaluate(()=>window.__parking.state.route)).toBeNull();
});
test('keeps first person aligned with the nose and incline, renders the dashboard, and preserves heading after manual steering',async({page})=>{
 await open(page,'changdong-b2');await page.locator('#reset').click();await page.locator('[data-camera=first]').click();await expect(page.locator('#cockpit')).toBeVisible();
 const view=await page.evaluate(()=>{const s=window.__parking,pose=s.state.pose,c=s.scene.camera,v=c.getWorldDirection(c.position.clone());return {dot:v.x*Math.sin(pose.heading)*Math.cos(pose.pitch)+v.y*Math.sin(pose.pitch)+v.z*Math.cos(pose.heading)*Math.cos(pose.pitch),offset:c.view?.offsetX||0,hidden:s.scene.actor.children.every(o=>!o.visible)};});
 expect(view.dot).toBeCloseTo(1,5);expect(view.offset).toBe(0);expect(view.hidden).toBe(true);
 await expect(page).toHaveScreenshot('driver-dashboard.png',{mask:[page.locator('#quality-status')],maskColor:'#f6f6ee'});
 await open(page,'parking-131601-0');await page.locator('#reset').click();await page.locator('[data-camera=first]').click();
 const start=await page.evaluate(()=>window.__parking.state.pose);await page.keyboard.down('w');await page.keyboard.down('a');await page.waitForTimeout(220);
 await expect(page.locator('#cockpit')).toHaveAttribute('data-signal','left');await expect(page.locator('#indicator-left')).toHaveAttribute('aria-label','좌측 방향지시등 켜짐');
 await page.keyboard.up('a');await page.keyboard.up('w');const end=await page.evaluate(()=>window.__parking.state.pose);expect(end.heading).toBeGreaterThan(start.heading);await page.waitForTimeout(180);expect(await page.evaluate(()=>window.__parking.state.pose.heading)).toBe(end.heading);await expect(page.locator('#cockpit')).toHaveAttribute('data-signal','off');
 await page.keyboard.down('d');await expect(page.locator('#cockpit')).toHaveAttribute('data-signal','right');
 await expect(page.locator('#cockpit')).toHaveAttribute('data-lit','false');await expect(page.locator('#cockpit')).toHaveAttribute('data-lit','true');
 await page.keyboard.up('d');await page.keyboard.down('s');await expect(page.locator('#dash-gear')).toHaveText('R');await page.keyboard.up('s');
 await page.locator('[data-camera=third]').click();await expect(page.locator('#cockpit')).toBeHidden();await page.keyboard.down('a');await expect.poll(()=>page.evaluate(()=>window.__parking.scene.actor.userData.signal)).toBe('left');await page.keyboard.up('a');
 await page.locator('[data-camera=first]').click();await page.setViewportSize({width:390,height:844});await expect(page.locator('#cockpit')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.locator('#reset').click();await expect(page).toHaveScreenshot('driver-dashboard-mobile.png',{mask:[page.locator('#quality-status')],maskColor:'#f6f6ee',fullPage:true});
});
test('lists every bay approach, switches source-supported origins and updates coverage for changed vehicle dimensions',async({page})=>{
 await open(page,'parking-168780-0');await page.locator('#reset').click();await page.locator('#coverage-summary').click();await expect(page.locator('[data-coverage]')).toHaveCount(31);
 const i=await page.evaluate(()=>window.__parking.state.coverage.rows.findIndex(r=>r.spaceId==='east-outer-0-1'));await page.locator(`[data-coverage="${i}"]`).click();await expect(page.locator('#start-node')).toHaveValue('east-deck-start');await expect(page.locator('#destination')).toHaveValue('approach:east-outer-0-1');await expect(page.locator('#play')).toBeEnabled();
 await page.locator('#car-width').fill('9');await page.locator('#car-width').blur();await expect(page.locator('#coverage-summary')).toContainText('0/31');await expect(page.locator('#play')).toBeDisabled();
 await page.locator('#car-width').fill('1.9');await page.locator('#car-width').blur();await expect(page.locator('#coverage-summary')).toContainText('31/31');await expect(page.locator('#play')).toBeEnabled();
 await page.locator('#parking-mode').selectOption('reverse');expect(await page.locator('#destination option').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('장애인')]));
});
