import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('keeps battery essentials in Korean and reveals the score explanation on request', async ({ page }) => {
  await page.goto('/?user=U0002');
  await expect(page.getByRole('heading', { name: '충전 습관 점수' })).toBeVisible();
  await expect(page.getByText('마지막 충전 잔량', { exact: true })).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/SOC 데이터 품질|Estimated SOH|미제공|MOCK DATA/);
  await expect(page.getByTestId('health-score')).toHaveText('94');
  await expect(page.getByTestId('score-coverage')).toContainText('표준셀 가정');

  await page.getByRole('button', { name: '배터리 정보 보기', exact: true }).click();
  const basis = page.locator('#score-attribution');
  await expect(basis).toHaveCount(0);
  await expect(page.locator('.battery-key-metrics > div')).toHaveCount(3);
  await expect(page.getByText('다음 충전은 이렇게', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '점수는 어떻게 계산하나요?' }).click();
  await expect(page.getByRole('link', { name: /Schmalstieg 외/ })).toHaveAttribute('href', 'https://doi.org/10.1016/j.jpowsour.2014.02.012');
  await expect(basis).toContainText('차량 배터리 종류를 확정하지 않고');
  await expect(basis).toContainText('정책 자체가 논문으로 검증된 것은 아닙니다');
  await expect(basis).toContainText('25°C');

  await page.getByRole('button', { name: '배터리 상세 닫기' }).click();
  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0004');
  await expect(page.getByTestId('vehicle-model')).toHaveText('Ioniq 5');
  await expect(page.getByTestId('health-score')).toHaveText('55');
  await page.getByRole('tab', { name: '배터리 정보', exact: true }).click();
  await expect(basis).toHaveCount(0);
  await expect(page.getByTestId('score-walkthrough')).not.toContainText(/모델 ID|스트레스|Schmalstieg|미제공/);
  await page.screenshot({path:'test-results/battery-simple-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/battery-simple-mobile.png',fullPage:true});
});

test('explains a real seven-point score in plain Korean with arithmetic and research notes below', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?user=U0056');
  await expect(page.getByTestId('health-score')).toHaveText('7');
  await page.getByRole('button', { name: '왜 7점인지 보기' }).click();
  const explanation = page.getByTestId('score-walkthrough');
  await expect(explanation.getByRole('heading', { name: '왜 7점인가요?' })).toBeVisible();
  await expect(explanation).toContainText('배터리 성능이 7% 남았다는 뜻이 아닙니다');
  await expect(explanation).toContainText('충전 8건');
  await expect(explanation).toContainText('73.0%에서 시작해 98.4%에서 종료');
  await expect(explanation).toContainText('41시간 5분');
  await expect(page.getByTestId('cycle-points')).toHaveText('−66.86점');
  await expect(page.getByTestId('idle-points')).toHaveText('−25.89점');
  await expect(page.getByTestId('score-arithmetic')).toHaveText('100 − 66.86 − 25.89 = 7.25점');
  await expect(explanation).toContainText('급속 충전이라는 이유만으로 별도 감점하지 않습니다');
  const notes = page.getByRole('heading', { name: '논문 근거 · 어디까지 적용했나요?' });
  await expect(notes).toBeVisible();
  await expect(page.getByRole('link', { name: /BLAST-Lite/ })).toHaveAttribute('href', /nmc111_gr_Sanyo2Ah_2014.py$/);
  await expect(page.locator('.score-research')).toContainText('실제 차량에서 검증된 것은 아닙니다');
  await explanation.screenshot({ path: 'test-results/score-explanation-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await explanation.screenshot({ path: 'test-results/score-explanation-mobile.png' });
  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0002');
  await expect(explanation.getByRole('heading', { name: '왜 94점인가요?' })).toBeVisible();
  await expect(page.getByTestId('score-arithmetic')).toHaveText('100 − 3.61 − 2.16 = 94.23점');
  await expect(explanation).not.toContainText('41시간 5분');
  await page.getByRole('combobox', { name: '사용자 및 차량' }).selectOption('U0051');
  await expect(explanation).toContainText('아직 점수를 내리지 않은 이유');
  await expect(page.getByTestId('score-arithmetic')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reference scoring updates immediately across high-rate, insufficient and unknown-chemistry users', async ({ page }) => {
  await page.goto('/?user=U0001');
  const score=page.getByTestId('health-score'),coverage=page.getByTestId('score-coverage');
  await expect(score).toHaveText('9');
  await expect(coverage).toContainText('충전 9건 반영');
  await expect(page.locator('.vehicle-identity')).toHaveText('참고 평가');
  await page.getByRole('button',{name:'배터리 정보 보기',exact:true}).click();
  await page.getByRole('button',{name:'점수는 어떻게 계산하나요?'}).click();
  await expect(page.locator('#score-attribution')).toContainText('1C 초과 충전 2건');
  await page.getByRole('combobox',{name:'사용자 및 차량'}).selectOption('U0051');
  await expect(score).toHaveText('—');
  await expect(coverage).toHaveCount(0);
  await expect(page.locator('.score-pending')).toContainText('7일');
  await page.getByRole('combobox',{name:'사용자 및 차량'}).selectOption('U0002');
  await expect(score).toHaveText('94');
  await expect(coverage).toContainText('충전 6건 반영');
  await page.reload();
  await expect(score).toHaveText('94');
});
