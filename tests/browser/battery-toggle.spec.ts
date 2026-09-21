import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

for (const [userId, renderer] of [['U0004', 'webgl-3d-mesh'], ['U0059', 'webgl-cutout']]) {
  test(`battery view toggles and restores the vehicle for ${renderer}`, async ({ page }) => {
    await page.goto(`/?user=${userId}`);
    const canvas = page.locator('canvas');
    const toggle = page.getByRole('button', { name: '배터리 위치 보기' });
    const panel = page.locator('#battery-info-panel');
    // Cold GLB decoding on software WebGL can take longer than the usual UI wait.
    await expect(canvas).toHaveAttribute('data-renderer', renderer, { timeout: 90000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await canvas.scrollIntoViewIfNeeded();
    const area = (await canvas.boundingBox())!;
    const point = await canvas.evaluate((element, isPack) => ({
      x: Number(isPack ? element.dataset.packX : element.dataset.hotspotX),
      y: Number(isPack ? element.dataset.packY : element.dataset.hotspotY),
    }), renderer === 'webgl-3d-mesh');
    expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(1);
    expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(1);
    await page.mouse.click(area.x + area.width * point.x, area.y + area.height * point.y);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('tab', { name: '배터리 정보', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: `test-results/battery-toggle-${renderer}.png`, fullPage: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('vehicle-viewer')).not.toHaveClass(/is-focused/);
    await expect(page.getByRole('tab', { name: '주요 정보', exact: true })).toHaveAttribute('aria-selected', 'true');
    await toggle.press('Enter');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).toHaveCount(0);
  });
}

test('top-left logo navigates to the project portal rather than reloading the battery app', async ({ page }) => {
  await page.route('http://localhost:5190/', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>통합 프로젝트 메인</h1>' }));
  await page.goto('/?user=U0004');
  const home = page.getByRole('link', { name: '전체 프로젝트 메인으로 이동' });
  await expect(home).toHaveAttribute('href', 'http://localhost:5190/');
  await home.click();
  await expect(page).toHaveURL('http://localhost:5190/');
  await expect(page.getByRole('heading', { name: '통합 프로젝트 메인' })).toBeVisible();
});
