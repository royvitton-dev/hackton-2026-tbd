import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Compare the production build without development HMR, in a separate report.
export default defineConfig({
  ...config,
  use: {...config.use,baseURL:process.env.TEST_URL||'http://127.0.0.1:5175'},
  projects: config.projects?.filter(project=>project.name==='golden'),
  reporter: [['list'],['html',{outputFolder:'reports/golden/comparison',open:'never'}],['json',{outputFile:'reports/golden/comparison/results.json'}]],
});
