import { createServer } from "file:///C:/project/hackton-2026-tbd/trading/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/project/hackton-2026-tbd/trading/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
const server = await createServer({configFile:false,root:"C:\\project\\hackton-2026-tbd\\trading\\frontend",cacheDir:"C:\\project\\hackton-2026-tbd\\trading\\evidence\\2026-09-21T13-14-03-911Z-browser-gap-8b2c0b02\\vite-cache",plugins:[react()],server:{host:'127.0.0.1',port:5181,strictPort:true}});
await server.listen();
server.printUrls();
