import { test, expect } from '@playwright/test';

test('IONIQ 6 uses its detailed GLB, responds to drag and reveals the internal battery', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?user=U0017');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-vehicle-id', 'hyundai_ioniq6_lr_2wd_2026', { timeout: 90000 });
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl-3d-mesh');
  await expect(canvas).toHaveAttribute('data-model-triangles', '783652');
  await expect(canvas).toHaveAttribute('data-charger-visible', 'false');
  await expect(page.locator('.scene-caption')).toContainText('2025 캐나다형 IONIQ 6');
  expect(Math.abs(Number(await canvas.getAttribute('data-model-min-y')))).toBeLessThan(.01);
  expect(Number(await canvas.getAttribute('data-model-height'))).toBeLessThan(1.8);
  await page.screenshot({ path: 'test-results/ioniq6-3d-desktop.png', fullPage: true });

  await canvas.scrollIntoViewIfNeeded();
  const area = (await canvas.boundingBox())!;
  const before = await canvas.getAttribute('data-camera-quaternion');
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 + 180, area.y + area.height / 2 - 35, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => canvas.getAttribute('data-camera-quaternion')).not.toBe(before);
  expect(Number(await canvas.getAttribute('data-azimuth'))).toBeGreaterThanOrEqual(-65.1);
  expect(Number(await canvas.getAttribute('data-azimuth'))).toBeLessThanOrEqual(-14.9);
  await page.screenshot({ path: 'test-results/ioniq6-3d-drag.png', fullPage: true });

  await page.getByRole('button', { name: '배터리 위치 보기' }).click();
  await expect(page.locator('#battery-info-panel')).toBeVisible();
  await expect.poll(async () => Number(await canvas.getAttribute('data-faded-vehicle-materials'))).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-pack-inside-vehicle', 'true');
  await expect(canvas).toHaveAttribute('data-pack-depth-tested', 'true');
  await page.screenshot({ path: 'test-results/ioniq6-3d-battery.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(canvas).toHaveAttribute('data-faded-vehicle-materials', '0');

  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0059');
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl-cutout');
  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0017');
  await expect(canvas).toHaveAttribute('data-model-triangles', '783652', { timeout: 90000 });
  await expect(canvas).toHaveAttribute('data-renderer', 'webgl-3d-mesh');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/ioniq6-3d-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
