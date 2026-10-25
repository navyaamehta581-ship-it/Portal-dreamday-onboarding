import {createServer} from 'node:http';
import {diagnose, validateInput} from './diagnose.mjs';
const server = createServer(async (req,res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST' || req.url !== '/api/diagnose') {res.writeHead(404);res.end('{}');return;}
  if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:5173') {res.writeHead(403);res.end('{}');return;}
  try {
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body)>8192) {res.writeHead(413);res.end('{}');return;} }
    let input;
    try {input=validateInput(JSON.parse(body));} catch {res.writeHead(400);res.end(JSON.stringify({error:'Enter a goal and owner/name repository.'}));return;}
    res.end(JSON.stringify(await diagnose(input)));
  } catch {res.writeHead(500);res.end(JSON.stringify({error:'Inspection failed.'}));}
});
server.requestTimeout=15000;
server.listen(8787,'127.0.0.1',()=>console.log('Read-only GitHub inspector: http://127.0.0.1:8787'));
