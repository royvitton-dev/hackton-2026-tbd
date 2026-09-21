import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/unit/**/*.test.js'],reporters:['default','json'],outputFile:{json:'reports/unit/results.json'},coverage:{provider:'v8',include:['src/core/**/*.js'],reporter:['text','html','json-summary'],reportsDirectory:'reports/coverage',thresholds:{lines:90,functions:90,statements:90,branches:80}}}});
