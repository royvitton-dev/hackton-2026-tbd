import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({...base,testDir:'./tests/maps',outputDir:'./test-results/maps',timeout:120000,reporter:[['list'],['html',{outputFolder:'reports/maps/e2e',open:'never'}],['json',{outputFile:'reports/maps/e2e/results.json'}]],snapshotPathTemplate:'{testDir}/golden/{arg}{ext}'});
