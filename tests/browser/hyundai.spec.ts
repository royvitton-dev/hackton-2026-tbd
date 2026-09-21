import { test, expect } from '@playwright/test';

test('Hyundai defaults, real IONIQ 5 and Kona meshes, model-year notice and battery focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(page.getByRole('combobox', { name: '사용자 및 차량' })).toHaveValue('U0001');
  await expect(canvas).toHaveAttribute('data-model-triangles', '105109', { timeout: 60000 });
  expect(Math.abs(Number(await canvas.getAttribute('data-model-min-y')))).toBeLessThan(.01);
  await page.screenshot({ path: 'test-results/demo-ioniq5.png', fullPage: true });

  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0010');
  await expect(page.getByTestId('vehicle-model')).toHaveText('Kona Electric');
  await expect(canvas).toHaveAttribute('data-vehicle-id', 'hyundai_kona_ev_lr_2026');
  await expect(canvas).toHaveAttribute('data-model-triangles', '248120', { timeout: 60000 });
  await expect(page.locator('.scene-caption')).toContainText('2019 코나 EV 대표 외형 · 2026년형과 다름');
  await expect(page.getByTestId('odometer')).toContainText('83,805');
  expect(Math.abs(Number(await canvas.getAttribute('data-model-min-y')))).toBeLessThan(.01);
  await page.screenshot({ path: 'test-results/demo-kona.png', fullPage: true });
  await page.getByRole('button', { name: '배터리 정보 보기', exact: true }).click();
  await expect(page.locator('#battery-info-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#battery-info-panel')).toHaveCount(0);

  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0017');
  await expect(canvas).toHaveAttribute('data-vehicle-id','hyundai_ioniq6_lr_2wd_2026');
  await expect(canvas).toHaveAttribute('data-renderer','webgl-cutout');
  expect(errors).toEqual([]);
});
