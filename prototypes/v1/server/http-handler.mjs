import {diagnose, validateInput} from './diagnose.mjs';
import {conversationRoute} from './phase-a/routes.mjs';
import {CONTRACT_VERSION} from '../src/phase-a/contract.ts';

/** Shared production/test handler. Inspector responses retain their existing contract. */
export function createRequestHandler(store, {allowedHosts=['127.0.0.1:8787','127.0.0.1:5173']}={}) {
 return async (req,res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  const conversation=req.url?.startsWith('/api/conversations');
  const reply=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body));};
  const fail=(status,code,message)=>reply(status,conversation?{contractVersion:CONTRACT_VERSION,error:{code,message}}:{error:{code,message,source:'local_inspector'}});
  if (!conversation && (req.method !== 'POST' || req.url !== '/api/diagnose')) {fail(404,'NOT_FOUND','Route not found.');return;}
  if (!allowedHosts.includes(req.headers.host)) {fail(403,'FORBIDDEN','Host is not allowed.');return;}
  if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:5173') {fail(403,'FORBIDDEN','Origin is not allowed.');return;}
  if (req.method !== 'GET' && req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {fail(415,'UNSUPPORTED_MEDIA_TYPE','Use application/json.');return;}
  try {
    const chunks=[];let size=0;
    for await (const chunk of req) {
      const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
      size+=bytes.length;
      if(size>8192){fail(413,'PAYLOAD_TOO_LARGE','Request body exceeds 8192 bytes.');return;}
      chunks.push(bytes);
    }
    const body=Buffer.concat(chunks).toString('utf8');
    if(conversation){
      let input;
      try {input=body?JSON.parse(body):undefined;} catch {fail(400,'INVALID_REQUEST','Invalid JSON.');return;}
      const result=await conversationRoute(store,req.method,req.url,input);reply(result.status,result.body);return;
    }
    let input;
    try {input=validateInput(JSON.parse(body));} catch {reply(400,{error:'Enter a goal and owner/name repository.'});return;}
    reply(200,await diagnose(input));
  } catch {
    if(conversation)fail(500,'INTERNAL_ERROR','Conversation request failed.');
    else reply(500,{error:'Inspection failed.'});
  }
 };
}
