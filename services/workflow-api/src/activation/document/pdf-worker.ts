/** Runs pdf.js on one PDF inside a worker thread (see pdf.ts), so a hostile or broken file can't block or crash
 * the server: the parent enforces a time and memory limit and terminates this thread. Text only: nothing is
 * rendered, no fonts are loaded, XFA forms are off, and nothing is fetched. pdf.js 6 has no eval-based font path
 * (the source of CVE-2024-4367), so there is no isEvalSupported switch to turn off. */
import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';

type Line={page:number;text:string;size:number};
type Input={data:Uint8Array;maxPages:number;maxChars:number};
const {data,maxPages,maxChars}=workerData as Input;

// pdf.js warns at import about canvas polyfills it only needs for rendering; keep those out of the server log.
const quiet=console.warn,quietLog=console.log;console.warn=()=>{};console.log=()=>{};
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
console.warn=quiet;console.log=quietLog;
const root=dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));

type Item={str:string;transform:number[];height:number;hasEOL?:boolean};
function post(v:unknown){parentPort!.postMessage(v);}
try{
 const task=pdfjs.getDocument({data,disableFontFace:true,useSystemFonts:false,enableXfa:false,stopAtErrors:false,verbosity:0,
  // Character maps let text in CJK and other non-Latin encodings come out as text rather than gaps.
  cMapUrl:join(root,'cmaps')+'/',cMapPacked:true,standardFontDataUrl:join(root,'standard_fonts')+'/',useWorkerFetch:false,isOffscreenCanvasSupported:false,isImageDecoderSupported:false});
 const doc=await task.promise;
 const meta=await doc.getMetadata().catch(()=>null);
 const title=typeof (meta?.info as {Title?:unknown}|undefined)?.Title==='string'?((meta!.info as {Title:string}).Title).trim().slice(0,200)||null:null;
 const pages=doc.numPages,read=Math.min(pages,maxPages);
 const lines:Line[]=[],empty:number[]=[],failed:number[]=[];let chars=0,truncated=false;
 for(let n=1;n<=read&&!truncated;n++){
  let items:Item[];
  try{const page=await doc.getPage(n);items=(await page.getTextContent()).items.filter(i=>'str' in i) as Item[];page.cleanup();}
  catch{failed.push(n);continue;}
  // Lines in the order the PDF draws text (the reading order for most producers, including columns), split where
  // pdf.js marks an end of line or the baseline moves.
  const pageLines:Line[]=[];let text='',size=0,lastY:number|null=null;
  const flush=()=>{const t=text.replace(/\s+/g,' ').trim();if(t)pageLines.push({page:n,text:t,size:Math.round(size*10)/10});text='';size=0;};
  for(const it of items){
   const y=it.transform[5],h=Math.abs(it.height||it.transform[3]||0);
   if(lastY!==null&&it.str&&Math.abs(y-lastY)>Math.max(2,h*.5))flush();
   if(it.str){text+=it.str;size=Math.max(size,h);lastY=y;}
   if(it.hasEOL)flush();
  }
  flush();
  const pageChars=pageLines.reduce((a,l)=>a+l.text.length,0);
  if(!pageChars){empty.push(n);continue;}
  for(const l of pageLines){if(chars+l.text.length>maxChars){truncated=true;break;}lines.push(l);chars+=l.text.length+1;}
 }
 await task.destroy();
 post({ok:true,pages,read,title,lines,empty,failed,truncated});
}catch(e){
 const name=(e as {name?:string})?.name??'';
 post({ok:false,code:name==='PasswordException'?'PDF_ENCRYPTED':name==='InvalidPDFException'?'PDF_INVALID':'PDF_UNREADABLE'});
}
