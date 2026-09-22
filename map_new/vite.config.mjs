import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
const local=path=>fileURLToPath(new URL(path,import.meta.url));
export default defineConfig({
  server:{host:'127.0.0.1',port:5188,fs:{allow:[local('./'),local('../node_modules'),local('../map/src/graphics'),local('../map/node_modules')],deny:['.env','.env.*','**/.git/**','**/*.{pem,key}']},watch:{ignored:['**/reports/**','**/.runtime/**','**/test-results/**']}},
  build:{rollupOptions:{output:{manualChunks:{three:['three']}}}},
});
