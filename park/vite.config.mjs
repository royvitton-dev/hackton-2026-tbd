import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: 'dist', rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
  server: { host: '127.0.0.1', watch: { ignored: ['**/.park-runtime/**','**/park/reports/**','**/park/test-results/**','**/map/**','**/dopamin/**','**/voice/**','**/movie/**','**/pinball/**','**/webpage/**'] }, fs: { deny: ['.env', '.env.*', '**/.git/**', '**/.park-runtime/**', '**/*.{pem,key}'] } },
});
