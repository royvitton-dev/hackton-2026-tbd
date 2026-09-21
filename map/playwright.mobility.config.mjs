import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({...base,testDir:'./tests/mobility',outputDir:'./test-results/mobility',reporter:[['list'],['html',{outputFolder:'reports/mobility/e2e',open:'never'}],['json',{outputFile:'reports/mobility/e2e/results.json'}]],snapshotPathTemplate:'{testDir}/golden/{arg}{ext}'});
