import { createServer } from "file:///C:/project/hackton-2026-tbd/trading/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/project/hackton-2026-tbd/trading/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
const server = await createServer({configFile:false,root:"C:\\project\\hackton-2026-tbd\\trading\\frontend",cacheDir:"C:\\project\\hackton-2026-tbd\\trading\\evidence\\2026-09-21T13-15-32-792Z-browser-gap-91b002af\\bin\\node_modules\\vite-cache",plugins:[react()],server:{host:'127.0.0.1',port:5181,strictPort:true,fs:{allow:["C:\\project\\hackton-2026-tbd\\trading\\frontend","C:\\project\\hackton-2026-tbd\\trading\\evidence\\2026-09-21T13-15-32-792Z-browser-gap-91b002af"]}}});
await server.listen();
server.printUrls();
