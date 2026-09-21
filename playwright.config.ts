import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',timeout:120000,expect:{timeout:20000},workers:1,reporter:'list',
  use:{baseURL:process.env.EVISION_BASE_URL??'http://127.0.0.1:3000',viewport:{width:1440,height:1050},headless:true,
    launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},
    screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:process.env.EVISION_BASE_URL?undefined:{command:'npm run vehicle:dev -- --hostname 127.0.0.1 --port 3000',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:120000},
});
