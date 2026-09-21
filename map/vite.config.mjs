import { defineConfig } from 'vite';
export default defineConfig({ optimizeDeps:{include:['pdfjs-dist']},server: { host: '127.0.0.1', port: 5185, fs: { deny: ['.env', '.env.*', '**/.git/**', '**/*.{pem,key}'] } }, build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } } });
