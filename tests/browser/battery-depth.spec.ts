import { test, expect } from '@playwright/test';

test('Battery focus reveals the internal pack through the body and restores its materials on exit',async({page})=>{
  test.setTimeout(180000);
  await page.goto('/?user=U0002');
  const canvas=page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-renderer','webgl-3d-mesh',{timeout:90000});
  await expect(canvas).toHaveAttribute('data-charger-visible','false');
  await page.getByRole('button',{name:'배터리 위치 보기'}).click();
  await expect(page.locator('#battery-info-panel')).toBeVisible();
  await expect.poll(async()=>Number(await canvas.getAttribute('data-faded-vehicle-materials'))).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-pack-inside-vehicle','true');
  await expect(canvas).toHaveAttribute('data-pack-depth-tested','true');
  await canvas.scrollIntoViewIfNeeded();
  const area=(await canvas.boundingBox())!;
  for(const direction of [-1,1]){
    const before=await canvas.getAttribute('data-camera-quaternion');
    await page.mouse.move(area.x+area.width/2,area.y+area.height/2);
    await page.mouse.down();
    await page.mouse.move(area.x+area.width/2+direction*1000,area.y+area.height/2+direction*800,{steps:8});
    await page.mouse.up();
    await expect.poll(()=>canvas.getAttribute('data-camera-quaternion')).not.toBe(before);
    await expect(canvas).toHaveAttribute('data-charger-visible','false');
    await expect.poll(async()=>Number(await canvas.getAttribute('data-polar'))).toBeGreaterThanOrEqual(64.9);
    expect(Number(await canvas.getAttribute('data-polar'))).toBeLessThanOrEqual(78.1);
    await page.screenshot({path:`test-results/battery-depth-${direction<0?'upper':'side'}.png`,fullPage:true});
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#battery-info-panel')).toHaveCount(0);
  await expect(canvas).toHaveAttribute('data-faded-vehicle-materials','0');
});
