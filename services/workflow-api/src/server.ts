import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGoalStore } from './store.ts';
import { createApp } from './app.ts';
import { developmentActivation } from './activation/dev.ts';

const port = Number(process.env.PORT || '7007');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const origin = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173';
const parsedOrigin = new URL(origin);
if (parsedOrigin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsedOrigin.hostname) || parsedOrigin.origin !== origin) {
  throw new Error('FRONTEND_ORIGIN must be an exact local HTTP origin, for example http://127.0.0.1:5173.');
}
const filename = process.env.DATABASE_PATH || fileURLToPath(new URL('../data/goals.sqlite', import.meta.url));
const store = openGoalStore(resolve(filename));
const activation = developmentActivation(filename);
const server = createApp(store, origin, activation?.options);
server.requestTimeout = 10_000;
server.headersTimeout = 10_000;
server.on('error', () => { store.close(); console.error('Could not start local API; check whether the port is in use.'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Local goal API ready at http://127.0.0.1:${port}`));
function shutdown() {
  server.close(async () => { await activation?.close(); store.close(); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
