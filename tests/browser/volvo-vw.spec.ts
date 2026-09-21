import { test, expect } from '@playwright/test';

for (const car of [
  { user: 'U0006', id: 'volvo_ex30_2026', triangles: '59354', label: 'Volvo EX30' },
  { user: 'U0076', id: 'vw_id4_pro_2026', triangles: '224854', label: 'Volkswagen ID.4' },
]) {
  test(`${car.label}: actual model, bounded drag, internal battery and material restoration`, async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?user=${car.user}`);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-vehicle-id', car.id, { timeout: 90000 });
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl-3d-mesh');
    await expect(canvas).toHaveAttribute('data-model-triangles', car.triangles);
    await expect(canvas).toHaveAttribute('data-charger-visible', 'false');
    expect(Math.abs(Number(await canvas.getAttribute('data-model-min-y')))).toBeLessThan(.01);
    expect(Number(await canvas.getAttribute('data-model-height'))).toBeLessThan(2);
    await page.screenshot({ path: `test-results/${car.id}-3d.png`, fullPage: true });

    await canvas.scrollIntoViewIfNeeded();
    const area = (await canvas.boundingBox())!;
    const before = await canvas.getAttribute('data-camera-quaternion');
    await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
    await page.mouse.down();
    await page.mouse.move(area.x + area.width / 2 + 190, area.y + area.height / 2 - 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => canvas.getAttribute('data-camera-quaternion')).not.toBe(before);
    expect(Number(await canvas.getAttribute('data-azimuth'))).toBeGreaterThanOrEqual(-65.1);
    expect(Number(await canvas.getAttribute('data-azimuth'))).toBeLessThanOrEqual(-14.9);
    await page.screenshot({ path: `test-results/${car.id}-drag.png`, fullPage: true });

    await page.getByRole('button', { name: '배터리 위치 보기' }).click();
    await expect(page.locator('#battery-info-panel')).toBeVisible();
    await expect.poll(async () => Number(await canvas.getAttribute('data-faded-vehicle-materials'))).toBeGreaterThan(0);
    await expect(canvas).toHaveAttribute('data-pack-inside-vehicle', 'true');
    await expect(canvas).toHaveAttribute('data-pack-depth-tested', 'true');
    await page.screenshot({ path: `test-results/${car.id}-battery.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(canvas).toHaveAttribute('data-faded-vehicle-materials', '0');
    await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0059');
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl-3d-mesh');
    await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption(car.user);
    await expect(canvas).toHaveAttribute('data-model-triangles', car.triangles, { timeout: 90000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/${car.id}-mobile.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
