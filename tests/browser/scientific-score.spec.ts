import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('shows the paper model, separates SOC data quality, and withholds extrapolation', async ({ page }) => {
  await page.goto('/?user=U0002');
  await expect(page.getByRole('heading', { name: '25°C Reference Stress Score' })).toBeVisible();
  await expect(page.getByText('SOC 데이터 품질', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('건강 점수 아님', { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId('health-score')).toHaveText('—');

  await page.getByRole('button', { name: /^Battery Info/ }).click();
  await page.getByRole('button', { name: /점수 산정 근거/ }).click();
  const basis = page.locator('#score-attribution');
  await expect(basis).toContainText('Schmalstieg–Ecker NMC111/Graphite');
  await expect(basis).toContainText('검증된 NMC 계열 화학 정보 없음');
  await expect(basis).toContainText('25°C');

  await page.getByRole('button', { name: '배터리 상세 닫기' }).click();
  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0004');
  await expect(page.getByTestId('vehicle-model')).toHaveText('Ioniq 5');
  await expect(page.getByTestId('health-score')).toHaveText('55');
});
