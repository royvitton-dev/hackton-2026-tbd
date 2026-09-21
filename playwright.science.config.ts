import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Isolated port for scientific-score review while other demo sessions are live.
export default defineConfig({
  ...base,
  outputDir: '.cache/evision-science-review',
  timeout: 300000,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:3103',
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: 'npm run demo -- --hostname 127.0.0.1 --port 3103',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
