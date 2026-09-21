import {fileURLToPath} from 'node:url';
const local = path => fileURLToPath(new URL(path, import.meta.url));
import { defineConfig,loadEnv } from 'vite';
import {infrastructurePlugin} from './src/server/infrastructure.js';
export default defineConfig(({mode})=>({plugins:[infrastructurePlugin(loadEnv(mode,local('./'),'').OPENCELLID_API_KEY)],optimizeDeps:{include:['pdfjs-dist'],exclude:['maplibre-gl']},server: { host: '127.0.0.1', port: 5185, fs: { deny: ['.env', '.env.*', '**/.git/**', '**/*.{pem,key}'] } }, build: { rollupOptions: { input: { main: local('./index.html'), mobility: local('./mobility.html') }, output: { manualChunks: { three: ['three'], buildings:[local('./src/graphics/buildings.js')],maplibre:['maplibre-gl'] } } } } }));
