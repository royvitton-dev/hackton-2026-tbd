import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-health',
    rollupOptions: {
      input: 'health/index.html',
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
