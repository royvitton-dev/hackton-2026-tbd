import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  timeout: 90000, expect: { timeout: 12000, toHaveScreenshot: { maxDiffPixelRatio: .006 } },
  reporter: [['list'], ['html', { outputFolder: 'reports/e2e', open: 'never' }], ['json', { outputFile: 'reports/e2e/results.json' }]],
  use: {
    baseURL: process.env.TEST_URL || 'http://127.0.0.1:5173',
    ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 },
    launchOptions: { channel: 'chrome', args: ['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] },
    reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'e2e', testMatch: /(app|audio|characters|podium|coffee)\.spec\.ts/ },
    { name: 'golden', testMatch: /golden\.spec\.ts/ },
  ],
});
