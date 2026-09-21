import { test, expect } from '@playwright/test';
test.use({contextOptions:{reducedMotion:'reduce'}});
test('The WebGL hotspot itself responds to a raycast click',async({page})=>{
  await page.goto('/?user=U0002');
  const canvas=page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-renderer','webgl-3d-mesh');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-model-triangles'))).toBeGreaterThan(100000);
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const bounds=(await canvas.boundingBox())!;
  const normalized=await canvas.evaluate(c=>({x:Number(c.dataset.hotspotX),y:Number(c.dataset.hotspotY)}));
  expect(normalized.x).toBeGreaterThan(0);expect(normalized.x).toBeLessThan(1);
  expect(normalized.y).toBeGreaterThan(0);expect(normalized.y).toBeLessThan(1);
  await page.mouse.click(bounds.x+normalized.x*bounds.width,bounds.y+normalized.y*bounds.height);
  await expect(page.locator('#battery-info-panel')).toBeVisible();
  await expect(page.getByRole('tab',{name:'배터리 정보',exact:true})).toHaveAttribute('aria-selected','true');
});
