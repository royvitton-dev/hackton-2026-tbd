import {defineConfig} from 'vite';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const local=path=>fileURLToPath(new URL(path,import.meta.url));
const dependency=path=>{try{return realpathSync(local(path));}catch{return local(path);}};
export default defineConfig({
  server:{host:'127.0.0.1',port:5188,fs:{allow:[local('./'),dependency('../node_modules'),local('../map/src/graphics'),dependency('../map/node_modules')],deny:['.env','.env.*','**/.git/**','**/*.{pem,key}']},watch:{ignored:['**/reports/**','**/.runtime/**','**/test-results/**']}},
  build:{rollupOptions:{output:{manualChunks:{three:['three']}}}},
});
