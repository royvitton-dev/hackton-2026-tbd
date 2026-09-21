import { test, expect } from '@playwright/test';

test('Official Casper Electric: complete body, aligned floor, user data and focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?user=U0023');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-vehicle-id', 'hyundai_casper_ev_lr_2026', { timeout: 90000 });
  await expect(canvas).toHaveAttribute('data-model-triangles', '2653012');
  await expect(page.getByTestId('odometer')).toContainText('71,598');
  expect(Math.abs(Number(await canvas.getAttribute('data-model-min-y')))).toBeLessThan(.01);
  // The original showroom shadow plane must not shrink the body in the viewer.
  const height = Number(await canvas.getAttribute('data-model-height'));
  expect(height).toBeGreaterThan(1.8);
  expect(height).toBeLessThan(2.1);
  await page.screenshot({ path: 'test-results/demo-casper.png', fullPage: true });
  await page.getByRole('button', { name: '배터리 정보 보기', exact: true }).click();
  await expect(page.locator('#battery-info-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#battery-info-panel')).toHaveCount(0);
  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0003');
  await expect(canvas).toHaveAttribute('data-vehicle-id', 'kia_niro_ev_2026', { timeout: 60000 });
  await expect(page.getByTestId('odometer')).toContainText('10,102');
  expect(errors).toEqual([]);
});
