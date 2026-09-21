import { createServer } from 'vite';
// Vite atomically binds the requested port and tries the next one on EADDRINUSE.
const requested = Number(process.env.PORT || 5173);
if (!Number.isInteger(requested) || requested < 1024 || requested > 65535) throw new Error('PORT must be between 1024 and 65535.');
const server = await createServer({ server: { host: '127.0.0.1', port: requested, strictPort: false } });
await server.listen();
server.printUrls();
const stop = async () => { await server.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
