import {defineConfig} from '@playwright/test';
import config from './playwright.config.mjs';
export default defineConfig({...config,use:{...config.use,baseURL:'http://127.0.0.1:5186'}});
