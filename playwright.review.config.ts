import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// Review the production build on a separate port from the live development demo.
export default defineConfig({...base,
  outputDir:'.cache/evision-review',
  timeout:180000,
  use:{...base.use,baseURL:'http://127.0.0.1:3101',contextOptions:{reducedMotion:'reduce'}},
  webServer:{command:'npm run demo -- --hostname 127.0.0.1 --port 3101',url:'http://127.0.0.1:3101',reuseExistingServer:false,timeout:60000},
});
