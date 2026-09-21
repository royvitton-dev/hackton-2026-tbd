import { defineConfig,loadEnv } from 'vite';
import {infrastructurePlugin} from './src/server/infrastructure.js';
export default defineConfig(({mode})=>({plugins:[infrastructurePlugin(loadEnv(mode,process.cwd(),'').OPENCELLID_API_KEY)],optimizeDeps:{include:['pdfjs-dist']},server: { host: '127.0.0.1', port: 5185, fs: { deny: ['.env', '.env.*', '**/.git/**', '**/*.{pem,key}'] } }, build: { rollupOptions: { input: { main: 'index.html', mobility: 'mobility.html' }, output: { manualChunks: { three: ['three'], buildings:['./src/graphics/buildings.js'],maplibre:['maplibre-gl'] } } } } }));
