import { test, expect } from '@playwright/test';
import images from '../../src/data/vehicleImageSources.json' with { type: 'json' };
import models from '../../src/data/vehicleModelSources.json' with { type: 'json' };
import workbook from '../../src/data/battery/workbook.json' with { type: 'json' };

test('Authored vehicles retain selectable source photos and return to 3D for battery focus', async ({ page }) => {
  test.setTimeout(300000); // Remaining photo profiles plus mobile on software WebGL.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const photos = models.filter(model => 'sourceType' in model && model.sourceType === 'project-authored');
  expect(photos).toHaveLength(4);
  await page.goto('/?user=U0059');
  for (const model of photos) {
    const user = workbook.users.find(user => user.vehicleId === model.vehicleId)!;
    const source = images.find(image => image.vehicleId === model.vehicleId)!;
    await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption(user.userId);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-vehicle-id', model.vehicleId,{timeout:90000});
    await page.getByRole('button', { name: '실차 사진', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl-cutout');
    await expect(canvas).toHaveAttribute('data-cutout-path', `${source.publicCutoutPath}?v=${(source.cutoutSha256??source.cutoutSourceSha256).slice(0,12)}`);
    await expect(canvas).toHaveAttribute('data-camera-controls', 'locked');
    await expect(page.getByTestId('vehicle-model')).toHaveText(model.model);
    await expect(page.locator('img')).toHaveCount(0);
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute('data-camera-quaternion', /,/);
    const camera = await canvas.getAttribute('data-camera-quaternion');
    const area = (await canvas.boundingBox())!;
    await page.mouse.move(area.x + 30, area.y + 30);
    await page.mouse.down();
    await page.mouse.move(area.x + area.width - 30, area.y + area.height - 30, { steps: 6 });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-camera-quaternion', camera!);
    await page.screenshot({ path: `test-results/png-${model.vehicleId}.png`, fullPage: true });
    const x = Number(await canvas.getAttribute('data-hotspot-x'));
    const y = Number(await canvas.getAttribute('data-hotspot-y'));
    expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(1);
    expect(y).toBeGreaterThan(0);expect(y).toBeLessThan(1);
    await page.mouse.click(area.x + area.width * x, area.y + area.height * y);
    await expect(page.locator('#battery-info-panel')).toHaveCount(0);
    await page.getByRole('button',{name:'배터리 위치 보기'}).click();
    await expect(page.locator('#battery-info-panel')).toBeVisible();
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl-3d-mesh');
    await expect(canvas).toHaveAttribute('data-pack-inside-vehicle', 'true');
    await page.screenshot({path:`test-results/png-focus-${model.vehicleId}.png`,fullPage:true});
    await page.keyboard.press('Escape');
    await expect(page.locator('#battery-info-panel')).toHaveCount(0);
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer','webgl-cutout');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/png-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});
