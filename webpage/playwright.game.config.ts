import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/game-e2e', fullyParallel: false, workers: 1, timeout: 90000,
  expect: { timeout: 15000 }, outputDir: 'test-results/game-e2e',
  use: { baseURL: process.env.GAME_TEST_URL || 'http://localhost:5175', channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 1080 },
    launchOptions: { args: ['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
});
