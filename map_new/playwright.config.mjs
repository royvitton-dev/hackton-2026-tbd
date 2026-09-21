import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export default defineConfig({
  testDir:'./tests/e2e',outputDir:'./test-results',timeout:60000,workers:1,retries:0,updateSnapshots:'none',
  expect:{timeout:20000,toHaveScreenshot:{maxDiffPixelRatio:.006,threshold:.18,animations:'disabled'}},
  reporter:[['list'],['json',{outputFile:'reports/e2e.json'}]],
  use:{baseURL:process.env.MAP_NEW_TEST_URL||'http://127.0.0.1:5196',viewport:{width:1440,height:980},locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce',deviceScaleFactor:1,channel:'chrome',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']},trace:'retain-on-failure',screenshot:'only-on-failure'},
  snapshotPathTemplate:'{testDir}/golden/{arg}{ext}',
  webServer:process.env.MAP_NEW_TEST_URL?undefined:{command:'node park/server.mjs',cwd:root,url:'http://127.0.0.1:5196/api/apps',reuseExistingServer:false,timeout:60000,env:{PARK_PORT:'5196',PARK_SERVER_STATE_FILE:root+'map_new/.runtime/review-server.json',ATLAS_VERIFY_WORKER:'1'}},
});
