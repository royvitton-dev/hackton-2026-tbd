import {test,expect} from '@playwright/test';
async function open(page,id){await page.goto('/map_new/?site='+id);await page.waitForFunction(id=>window.__parking?.state.plan.id===id&&!window.__parking.state.initializing,id);await page.locator('#reset').click();await page.locator('#coverage-summary').click();}
test('offers all outbound routes, identifies a drawing boundary and keeps restricted or undersized bays out of internal departure',async({page})=>{
 await open(page,'parking-168780-0');await expect(page.locator('[data-outbound]')).toHaveCount(31);await expect(page.locator('[data-outbound]:disabled')).toHaveCount(0);
 const index=await page.evaluate(()=>window.__parking.state.coverage.rows.findIndex(r=>r.spaceId==='east-outer-0-1'));await page.locator(`[data-outbound="${index}"]`).click();await expect(page.locator('#route-message')).toContainText('외부 출구 아님');await expect(page.locator('#play')).toBeEnabled();await expect(page.locator(`[data-departure="${index}"]`)).toBeDisabled();
 const c=await page.evaluate(()=>window.__parking.state.coverage.rows.findIndex(r=>r.spaceId==='west-compact-0-1'));await expect(page.locator(`[data-departure="${c}"]`)).toBeDisabled();
 await page.locator('[data-camera=first]').click();await expect(page.locator('#cockpit')).toBeVisible();expect(await page.evaluate(()=>window.__parking.state.route.departure.arrival)).toBe('drawing-boundary');
});
test('starts inside the selected bay and animates departure through gear changes to the external aisle',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'parking-131601-0');await page.locator('#start-node').selectOption('entry-east');await page.locator('#destination').selectOption('depart:north-8');await expect(page.locator('#play')).toBeEnabled();await expect(page.locator('#route-message')).toContainText('구획 안 →');
 const initial=await page.evaluate(()=>{const s=window.__parking.state;return {pose:s.pose,departure:s.route.departure,bay:s.plan.spaces.find(b=>b.id==='north-8')};});expect(initial.departure.from).toBe('inside-bay');expect(Math.abs(initial.pose.z-initial.bay.z)).toBeLessThan(.2);
 await page.locator('#speed').selectOption('4');await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('✓ 도착했습니다',{timeout:30000});await expect(page.locator('#drive-status')).toContainText('출차 경로 도착');expect(await page.evaluate(()=>window.__parking.state.pose.arrived)).toBe(true);expect(errors).toEqual([]);
});
