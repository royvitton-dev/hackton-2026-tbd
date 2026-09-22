import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const local=path=>fileURLToPath(new URL(path,import.meta.url));
export default defineConfig({
  testDir:'./tests/address',testMatch:'*.spec.mjs',outputDir:local('./.runtime/address-test-results'),timeout:60000,workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:local('./.runtime/address-reference/browser-results.json')}]],
  expect:{timeout:15000},
  use:{baseURL:process.env.ADDRESS_TEST_URL||'http://127.0.0.1:5190',viewport:{width:1500,height:1000},locale:'ko-KR',deviceScaleFactor:1,reducedMotion:'reduce',channel:'chrome',launchOptions:{timeout:20000,args:['--enable-webgl','--enable-unsafe-swiftshader']},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
