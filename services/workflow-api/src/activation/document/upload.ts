/** POST handoff-documents: Chris's PDF, sent as the raw request body (Content-Type: application/pdf). The file is
 * read in memory, its text extracted and structured into customer information, and the analysis started. The PDF
 * itself is never written anywhere. */
import type {IncomingMessage} from 'node:http';
import {ActivationError,type Principal} from '../store.ts';
import type {HandoffService} from '../handoff/service.ts';
import {PDF_LIMITS,extractPdf} from './pdf.ts';
import {structureDocument} from './structure.ts';

async function readPdf(request:IncomingMessage){
 const type=request.headers['content-type']?.split(';')[0].trim().toLowerCase();
 if(type!=='application/pdf')throw new ActivationError('PDF_REQUIRED');
 const declared=Number(request.headers['content-length']??0);
 if(declared>PDF_LIMITS.maxBytes)throw new ActivationError('PDF_TOO_LARGE');
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of request){size+=chunk.length;if(size>PDF_LIMITS.maxBytes)throw new ActivationError('PDF_TOO_LARGE');chunks.push(chunk as Buffer);}
 return Buffer.concat(chunks);
}
/** The file name is only shown back to Chris; it never decides anything. */
function fileName(request:IncomingMessage){
 const raw=request.headers['x-file-name'];
 try{return typeof raw==='string'?decodeURIComponent(raw).replace(/[\u0000-\u001f\\/]/g,'').slice(0,120):'customer.pdf';}catch{return 'customer.pdf';}
}
export async function uploadDocument(h:HandoffService,p:Principal,request:IncomingMessage){
 // Refuse early (under review, published, analysis running) before spending time on the file.
 h.documentAllowed(p);
 const bytes=await readPdf(request);
 const structured=structureDocument(await extractPdf(bytes),fileName(request));
 return {...h.saveDocument(p,structured),report:structured.report};
}
