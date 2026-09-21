import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 globalSetup:'./tests/e2e/coverage-setup.mjs',
 testDir:'./tests/e2e',outputDir:'./test-results',timeout:120000,expect:{timeout:20000,toHaveScreenshot:{maxDiffPixelRatio:.006,threshold:.16,animations:'disabled'}},
 fullyParallel:false,workers:1,retries:0,
 reporter:[['list'],['html',{outputFolder:fileURLToPath(new URL('./reports/golden',import.meta.url)),open:'never'}],['json',{outputFile:fileURLToPath(new URL('./reports/golden/results.json',import.meta.url))}]],
 use:{baseURL:process.env.PARK_TEST_URL||'http://localhost:5190',viewport:{width:1600,height:1000},deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',reducedMotion:'reduce',channel:'chrome',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']},trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
 snapshotPathTemplate:'{testDir}/golden/{arg}{ext}',
});
