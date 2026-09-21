import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import images from '../../src/data/vehicleImageSources.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';

test('supplied MINI, Q4 and blue BMW images reach the WebGL texture and survive vehicle switching', async ({ page }) => {
  test.setTimeout(180000);
  const route = process.env.VEHICLE_REVIEW_BASE_PATH ?? '';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${route}/?user=U0059`);
  for (const [user, id] of [
    ['U0059', 'audi_q4_45_etron_2026'], ['U0040', 'mini_electric_cooper_2026'],
    ['U0007', 'bmw_i5_edrive40_2026'], ['U0018', 'audi_q6_etron_quattro_2025'],
    ['U0059', 'audi_q4_45_etron_2026'],
  ]) {
    const source = images.find(image => image.vehicleId === id)!;
    await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption(user);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-vehicle-id', id, { timeout: 90000 });
    await page.getByRole('button', { name: '실차 사진', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-renderer', 'webgl-cutout');
    const texturePath = `${route}${source.publicCutoutPath}?v=${(source.cutoutSha256??source.cutoutSourceSha256).slice(0,12)}`;
    await expect(canvas).toHaveAttribute('data-cutout-path', texturePath);
    const response = await page.request.get(texturePath);
    expect(response.status()).toBe(200);
    expect(createHash('sha256').update(await response.body()).digest('hex'))
      .toBe(createHash('sha256').update(await readFile(source.resourceCutoutPath)).digest('hex'));
    await expect(canvas).toHaveAttribute('data-charger-visible', 'false');
    await expect(page.getByText('실차 사진 · 고정 시점', { exact: true })).toBeVisible();
    await expect(page.locator('img')).toHaveCount(0);
    await page.screenshot({ path: `test-results/user-image-${id}.png`, fullPage: true });
    await page.getByRole('button', { name: '배터리 위치 보기' }).click();
    await expect(page.locator('#battery-info-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    if ('sourceKind' in source && source.sourceKind === 'user-upload') {
      await page.locator('.source-details summary').click();
      await expect(page.locator('.source-details')).toContainText(source.representativeNote);
      await expect(page.getByRole('link', { name: /사용자 제공 이미지/ })).toHaveAttribute('href', `${route}${source.publicOriginalPath}`);
      await expect(page.locator('a[href^="user-upload:"]')).toHaveCount(0);
      await page.locator('.source-details summary').click();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/user-images-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
