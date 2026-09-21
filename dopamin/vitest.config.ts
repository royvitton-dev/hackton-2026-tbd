import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default', 'json'],
    outputFile: { json: 'reports/unit/results.json' },
    coverage: {
      provider: 'v8', include: ['src/core/**/*.ts','src/audio/music.ts','src/audio/synth.ts','src/audio/effects.ts','src/audio/raceSound.ts'],
      reporter: ['text', 'html', 'json-summary'], reportsDirectory: 'reports/coverage',
      thresholds: { statements: 88, branches: 78, functions: 90, lines: 88 },
    },
  },
});
