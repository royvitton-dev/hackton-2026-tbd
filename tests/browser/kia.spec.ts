import { test, expect } from '@playwright/test';

for (const [user, vehicle, model, triangles, odometer] of [
  ['U0032', 'kia_ev6_lr_2wd_2026', 'EV6', '389487', '70,303'],
  ['U0062', 'kia_ev9_lr_2wd_2026', 'EV9', '228611', '27,439'],
  ['U0008', 'kia_ev3_standard_2026', 'EV3', '472105', '9,156'],
  ['U0011', 'kia_ev3_lr_2wd_2026', 'EV3', '472105', '18,519'],
  ['U0003', 'kia_niro_ev_2026', 'Niro EV', '445929', '10,102'],
]) test(`official ${model} ${user}: geometry, ground alignment, user data and battery focus`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?user=U0032');
    await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption(user);
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-vehicle-id', vehicle, { timeout: 60000 });
    await expect(canvas).toHaveAttribute('data-model-triangles', triangles, { timeout: 60000 });
    await expect(page.getByTestId('vehicle-model')).toHaveText(model);
    await expect(page.getByTestId('odometer')).toContainText(odometer);
    expect(Math.abs(Number(await canvas.getAttribute('data-model-min-y')))).toBeLessThan(.01);
    const height = Number(await canvas.getAttribute('data-model-height'));
    expect(height).toBeGreaterThan(1.2);
    expect(height).toBeLessThan(2);
    await page.screenshot({ path: `test-results/demo-${model.toLowerCase().replaceAll(' ', '-')}.png`, fullPage: true });
    await page.getByRole('button', { name: /^Battery Info/ }).click();
    await expect(page.locator('#battery-info-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#battery-info-panel')).toHaveCount(0);
  expect(errors).toEqual([]);
});
