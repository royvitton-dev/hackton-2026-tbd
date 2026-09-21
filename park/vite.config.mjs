import { defineConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const workspace=fileURLToPath(new URL('../',import.meta.url));
export default defineConfig({
  build: { outDir: 'dist', rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
  server: { host: '127.0.0.1', watch: { ignored: ['**/.park-runtime/**','**/park/reports/**','**/park/test-results/**','**/map/**','**/dopamin/**','**/voice/**','**/movie/**','**/pinball/**','**/webpage/**'] }, fs: { allow: [workspace,realpathSync(new URL('../node_modules',import.meta.url))], deny: ['.env', '.env.*', '**/.git/**', '**/.park-runtime/**', '**/*.{pem,key}'] } },
});
