import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {createStore} from './phase-a/store.mjs';
import {createRequestHandler} from './http-handler.mjs';
const store=createStore(fileURLToPath(new URL('./phase-a/.data/',import.meta.url)));
const server=createServer(createRequestHandler(store));
server.requestTimeout=15000;
server.listen(8787,'127.0.0.1',()=>console.log('Read-only GitHub inspector and Phase A chat: http://127.0.0.1:8787'));
