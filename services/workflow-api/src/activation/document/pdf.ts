/** PDF text extraction for Chris's customer documents. Validates the bytes first, then reads the text in a worker
 * thread with a time and memory limit (pdf-worker.ts). One extraction runs at a time, with a short queue, so a
 * free 512 MB instance is never asked for more than one worker's memory. The PDF itself is never stored. */
import {Worker} from 'node:worker_threads';
import {ActivationError} from '../store.ts';

export const PDF_LIMITS={maxBytes:8*1024*1024,maxPages:60,maxChars:110_000,timeoutMs:20_000,memoryMb:192,queue:3};
export type PdfLine={page:number;text:string;size:number};
export type PdfText={pages:number;read:number;title:string|null;lines:PdfLine[];empty:number[];failed:number[];truncated:boolean};

const fail=(code:string,details?:unknown):never=>{throw new ActivationError(code,details);};

/** Checks the upload before any parsing: size, and that it really is a PDF (not just named .pdf). */
export function validatePdf(bytes:Buffer){
 if(!bytes.length)fail('PDF_REQUIRED');
 if(bytes.length>PDF_LIMITS.maxBytes)fail('PDF_TOO_LARGE');
 // The header must appear near the start (the format allows a little leading junk) and the file must end like one.
 const head=bytes.subarray(0,1024).toString('latin1');
 if(!/%PDF-\d\.\d/.test(head))fail('NOT_A_PDF');
 if(!bytes.subarray(Math.max(0,bytes.length-2048)).toString('latin1').includes('%%EOF'))fail('PDF_INVALID');
}

let active=0;const waiting:(()=>void)[]=[];
async function slot(){
 if(active<1){active++;return;}
 if(waiting.length>=PDF_LIMITS.queue)fail('PDF_BUSY');
 await new Promise<void>(r=>waiting.push(r));active++;
}
function release(){active--;waiting.shift()?.();}

export async function extractPdf(bytes:Buffer,limits:Partial<typeof PDF_LIMITS>={}):Promise<PdfText>{
 const l={...PDF_LIMITS,...limits};
 validatePdf(bytes);
 await slot();
 try{
  return await new Promise<PdfText>((resolve,reject)=>{
   const worker=new Worker(new URL('./pdf-worker.ts',import.meta.url),{workerData:{data:new Uint8Array(bytes),maxPages:l.maxPages,maxChars:l.maxChars},
    resourceLimits:{maxOldGenerationSizeMb:l.memoryMb,maxYoungGenerationSizeMb:32},stdout:true,stderr:true});
   let settled=false;
   const done=(f:()=>void)=>{if(settled)return;settled=true;clearTimeout(timer);f();void worker.terminate();};
   const timer=setTimeout(()=>done(()=>reject(new ActivationError('PDF_TIMEOUT'))),l.timeoutMs);
   worker.on('message',(m:{ok:true}&PdfText|{ok:false;code:string})=>done(()=>m.ok?resolve(m):reject(new ActivationError(m.code))));
   // Out of memory or a crash inside pdf.js: the file can't be read, the server carries on.
   worker.on('error',()=>done(()=>reject(new ActivationError('PDF_UNREADABLE'))));
   worker.on('exit',()=>done(()=>reject(new ActivationError('PDF_UNREADABLE'))));
  });
 }finally{release();}
}
