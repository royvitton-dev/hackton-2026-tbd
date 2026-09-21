import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('keeps battery essentials in Korean and reveals the score explanation on request', async ({ page }) => {
  await page.goto('/?user=U0002');
  await expect(page.getByRole('heading', { name: '충전 습관 점수' })).toBeVisible();
  await expect(page.getByText('마지막 충전 잔량', { exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/SOC 데이터 품질|Estimated SOH|미제공|MOCK DATA/);
  await expect(page.getByTestId('health-score')).toHaveText('—');

  await page.getByRole('button', { name: '배터리 정보 보기', exact: true }).click();
  const basis = page.locator('#score-attribution');
  await expect(basis).toHaveCount(0);
  await expect(page.locator('.battery-key-metrics > div')).toHaveCount(3);
  await expect(page.getByText('다음 충전은 이렇게', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '점수는 어떻게 계산하나요?' }).click();
  await expect(basis.getByRole('link')).toHaveAttribute('href', 'https://doi.org/10.1016/j.jpowsour.2014.02.012');
  await expect(basis).toContainText('배터리 종류를 확인해야');
  await expect(basis).toContainText('25°C');

  await page.getByRole('button', { name: '배터리 상세 닫기' }).click();
  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0004');
  await expect(page.getByTestId('vehicle-model')).toHaveText('Ioniq 5');
  await expect(page.getByTestId('health-score')).toHaveText('55');
  await page.getByRole('tab', { name: '배터리 정보', exact: true }).click();
  await expect(basis).toHaveCount(0);
  await expect(page.locator('#battery-info-panel')).not.toContainText(/모델 ID|스트레스|Schmalstieg|미제공/);
  await page.screenshot({path:'test-results/battery-simple-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/battery-simple-mobile.png',fullPage:true});
});
