import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Isolated port for scientific-score review while other demo sessions are live.
const port=Number(process.env.EVISION_TEST_PORT||3103);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid EVISION_TEST_PORT');
const reviewUrl=`http://127.0.0.1:${port}`;
export default defineConfig({
  ...base,
  outputDir: `.cache/evision-science-review-${port}`,
  timeout: 300000,
  use: {
    ...base.use,
    baseURL: reviewUrl,
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command: `npm run demo -- --hostname 127.0.0.1 --port ${port}`,
    url: reviewUrl,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
