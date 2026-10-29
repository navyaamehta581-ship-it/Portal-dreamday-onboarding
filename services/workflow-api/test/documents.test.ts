/** Chris's PDF upload: validation, sandboxed extraction, structuring into the customer-information model, the
 * analysis it starts, error handling and permissions. PDFs are generated here (test/support/pdf.mjs), including
 * scans (image-only pages), encrypted, damaged and compressed files. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {extractPdf,validatePdf,type PdfText} from '../src/activation/document/pdf.ts';
import {structureDocument} from '../src/activation/document/structure.ts';
import {makePdf} from './support/pdf.mjs';
import {aperturePdf} from './support/sample-pdf.mjs';
import {PRIVATE,harness} from './support/work-harness.ts';

const code=async(p:Promise<unknown>|(()=>unknown))=>{try{await (typeof p==='function'?p():p);return null;}catch(e){return (e as {code?:string}).code??(e as Error).message;}};
const text=(lines:[number,string,number?][],extra:Partial<PdfText>={}):PdfText=>({pages:Math.max(1,...lines.map(l=>l[0])),read:Math.max(1,...lines.map(l=>l[0])),title:null,empty:[],failed:[],truncated:false,
 lines:lines.map(([page,t,size=11])=>({page,text:t,size})),...extra});

test('validation: size, real PDF bytes and a complete file, before any parsing',async()=>{
 assert.equal(await code(()=>validatePdf(Buffer.alloc(0))),'PDF_REQUIRED');
 assert.equal(await code(()=>validatePdf(Buffer.from('Just some text pretending to be a PDF'))),'NOT_A_PDF');
 assert.equal(await code(()=>validatePdf(Buffer.from('PK\x03\x04 a zip or docx file'))),'NOT_A_PDF');
 assert.equal(await code(()=>validatePdf(Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(8*1024*1024)]))),'PDF_TOO_LARGE');
 const good=makePdf(['Hello']);
 assert.equal(await code(()=>validatePdf(good.subarray(0,good.length-200))),'PDF_INVALID','a cut-off upload');
 assert.equal(await code(()=>validatePdf(good)),null);
});

test('extraction: text in reading order, compressed streams, the title, and which pages had no text',async()=>{
 const r=await extractPdf(makePdf([{lines:[{text:'Report',size:20},{text:'First line of the body.'}]},{image:true},'Third page text, with “typographic” quotes – and dashes.'],{compress:true,title:'Quarterly notes'}));
 assert.equal(r.pages,3);assert.equal(r.read,3);assert.equal(r.title,'Quarterly notes');
 assert.deepEqual(r.empty,[2],'the scanned page is reported, not skipped silently');
 assert.deepEqual(r.lines.map(l=>[l.page,l.text,l.size]),[[1,'Report',20],[1,'First line of the body.',11],[3,'Third page text, with “typographic” quotes – and dashes.',11]]);
 // Two columns drawn column by column come out column by column.
 const cols=await extractPdf(makePdf([{lines:[{text:'Left column first line',x:50,y:700},{text:'Left column second line',x:50,y:684},{text:'Right column first line',x:320,y:700},{text:'Right column second line',x:320,y:684}]}]));
 assert.deepEqual(cols.lines.map(l=>l.text),['Left column first line','Left column second line','Right column first line','Right column second line']);
});

test('extraction failures are specific: encrypted, damaged, scans, time and page limits',async()=>{
 assert.equal(await code(extractPdf(makePdf(['secret'],{encrypt:true}))),'PDF_ENCRYPTED');
 const broken=Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 9 0 R >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
 assert.ok(['PDF_INVALID','PDF_UNREADABLE'].includes((await code(extractPdf(broken)))!),'a structurally broken file');
 const scan=await extractPdf(makePdf([{image:true},{image:true}]));
 assert.deepEqual(scan.empty,[1,2]);assert.equal(scan.lines.length,0);
 assert.equal(await code(()=>structureDocument(scan,'scan.pdf')),'PDF_NO_TEXT','a scan is refused with an explanation, not analyzed as empty');
 assert.equal(await code(extractPdf(aperturePdf(),{timeoutMs:1})),'PDF_TIMEOUT');
 const long=await extractPdf(makePdf(['Page one has text.','Page two has text.','Page three has text.']),{maxPages:2});
 assert.equal(long.pages,3);assert.equal(long.read,2);
 const cut=await extractPdf(makePdf(['A'.repeat(50)+' first','B'.repeat(50)+' second']),{maxChars:70});
 assert.equal(cut.truncated,true);assert.equal(cut.lines.length,1);
});

test('one extraction at a time with a short queue; the server keeps working when a file is refused',async()=>{
 const results=await Promise.all(Array.from({length:6},()=>code(extractPdf(aperturePdf()))));
 assert.ok(results.filter(r=>r===null).length>=4,'the first and three queued run');
 assert.ok(results.every(r=>r===null||r==='PDF_BUSY'),JSON.stringify(results));
 assert.equal(await code(extractPdf(aperturePdf())),null,'free again afterwards');
});

test('structure: the sample discovery PDF becomes typed customer information, private sections stay private',async()=>{
 const {sources,report}=structureDocument(await extractPdf(aperturePdf()),'Aperture discovery.pdf',()=>Date.parse('2026-10-29T10:00:00Z'));
 assert.deepEqual(sources.map(s=>[s.type,s.label]),[
  ['account_prep','Opening (p. 1)'],['crm','Account overview (p. 1)'],['conversation','Discovery call (p. 1)'],
  ['technical_requirements','Technical requirements (p. 2)'],['chris_notes','Internal notes (p. 2)'],['integration_tools','Tools and integrations (p. 3)']]);
 assert.deepEqual(report.sections.map(s=>s.basis),['default','content','heading','heading','heading','heading'],'the commercial overview is private because of its content');
 assert.match(sources[2].text,/^\[00:03\] Maya Chen: Our biggest pain/);
 assert.ok(!sources.some(s=>/Page \d of 3|Discovery notes$/.test(s.text)),'running footer and page numbers removed');
 assert.equal(report.removedLines,3);
 assert.deepEqual(report.customer,{name:'Aperture Commerce',basis:'stated'});
 assert.equal(report.complete,true);assert.deepEqual(report.missing,[]);assert.equal(report.pages,3);
 assert.equal(report.uploadedAt,'2026-10-29T10:00:00.000Z');
 assert.ok(sources.every(s=>s.type!=='repository'),'a document never counts as a backend repository observation');
});

test('the sample PDF offered in the demo is the generated fictional document, byte for byte',()=>{
 const committed=readFileSync(new URL('../../../prototypes/v1/public/samples/aperture-commerce-discovery-notes-fictional.pdf',import.meta.url));
 assert.ok(committed.equals(aperturePdf()),'regenerate it from test/support/sample-pdf.mjs');
});

test('structure: different layouts, uncertain categories, missing topics and the 12-entry limit',()=>{
 // No headings at all: one section, category from the content (a transcript), the title as its label.
 let r=structureDocument(text([[1,'Priya Nair: Every team builds its own pipeline.'],[1,'Sam Okoro: We could try one template first.'],[1,'Priya Nair: Releases fail differently everywhere.']],{title:'Call with Lumenfield'}),'call.pdf');
 assert.deepEqual(r.sources.map(s=>[s.type,s.label]),[['conversation','Call with Lumenfield (p. 1)']]);assert.equal(r.report.sections[0].basis,'content');
 // Same-size headings recognized by name; numbered and capitalised headings; hyphenated line breaks joined.
 r=structureDocument(text([[1,'1. Background'],[1,'The team runs 40 services on Kuber-'],[1,'netes. Platform lead: Lena Fischer.'],[1,'REPOSITORY NOTES'],[1,'Code lives in quarry/env-api on GitLab.'],[1,'Internal notes from the call:'],[1,'They want a quick win.']]),'notes.pdf');
 assert.deepEqual(r.sources.map(s=>[s.type,s.label.replace(/ \(p\. 1\)$/,'')]),[['account_prep','1. Background'],['technical_requirements','REPOSITORY NOTES'],['chris_notes','Internal notes from the call']]);
 assert.match(r.sources[0].text,/Kubernetes\./);
 // Nothing names a customer, a person, a system or a goal: listed as missing, not guessed.
 r=structureDocument(text([[1,'Some general remarks about the weather and the office move.']]),'misc.pdf');
 assert.deepEqual(r.report.missing,['customer','people','systems','goals']);assert.equal(r.report.customer.basis,'not_found');
 assert.equal(r.report.sections[0].basis,'default');
 // Customer from the title when the body doesn't say.
 assert.deepEqual(structureDocument(text([[1,'Globex — Kickoff notes',18],[1,'We want faster onboarding.']]),'k.pdf').report.customer,{name:'Globex',basis:'title'});
 // Many sections: merged to the 12 entries the analysis accepts, nothing dropped.
 const many:[number,string,number?][]=[];for(let i=0;i<30;i++)many.push([1,`Topic ${i}`,14],[1,`Detail ${i} about payments-api ownership.`]);
 r=structureDocument(text(many),'many.pdf');
 assert.ok(r.sources.length<=12);assert.equal(r.report.truncated,false);
 for(let i=0;i<30;i++)assert.ok(r.sources.some(s=>s.text.includes(`Detail ${i} about`)),`detail ${i} kept`);
});

test('structure: an incomplete extraction is never reported as complete',()=>{
 const base:[number,string,number?][]=[[1,'Customer: Initech'],[1,'Maya Chen, platform lead, wants payments-api in the Catalog.']];
 assert.equal(structureDocument(text(base),'a.pdf').report.complete,true);
 for(const extra of [{empty:[2],pages:2},{failed:[2],pages:2},{pages:80,read:60},{truncated:true}] as Partial<PdfText>[]){
  const r=structureDocument(text(base,extra),'a.pdf').report;
  assert.equal(r.complete,false,JSON.stringify(extra));
 }
 const r=structureDocument(text(base,{pages:80,read:60}),'a.pdf').report;assert.deepEqual(r.notRead,{from:61,to:80});
});

test('upload: Chris’s PDF is read, saved as customer information and analyzed with no other request; the PDF is not kept',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'docs-')),file=join(dir,'a.sqlite');
 const h=await harness({file});
 try{
  const r=await h.upload('aperture','op',aperturePdf(),{name:'Aperture discovery.pdf'});
  assert.equal(r.status,202,r.raw);
  assert.equal(r.json.workspace.revision,1);assert.equal(r.json.workspace.sources.length,6);assert.equal(r.json.job.workspaceRevision,1);
  assert.equal(r.json.report.fileName,'Aperture discovery.pdf');assert.equal(r.json.report.complete,true);
  for(let i=0;i<100&&(await h.call('aperture','handoff-analyses','op')).json.job.status==='running';i++)await new Promise(x=>setTimeout(x,10));
  const o=(await h.call('aperture','handoff','op')).json;
  assert.equal(o.analysis.status,'succeeded');assert.equal(o.drafts.length,1);assert.equal(o.workspace.document.fileName,'Aperture discovery.pdf');
  // The existing analysis ran on the PDF's information.
  const d=o.drafts[0];assert.ok(d.understanding.entities.services.includes('payments-api'),JSON.stringify(d.understanding.entities));
  assert.equal(d.basedOnWorkspaceRevision,1);
  // Private sections (CRM figures, internal notes) never reach the draft's shareable parts.
  const shareable=JSON.stringify([d.review.problem,d.review.goals,d.review.milestones,d.review.facts.filter((f:{status?:string})=>f.status!=='unconfirmed')]);
  for(const x of ['300K','ARR','nice-to-have',"Don't share pricing"])assert.ok(!shareable.includes(x),`no ${x}`);
  // A document's repository claims are reported, never verified.
  assert.ok(!d.understanding.findings.some((f:{status:string;sources:{type:string}[]})=>f.status==='verified'),'nothing verified from a document');
  // The PDF bytes are not stored anywhere.
  const db=readFileSync(file);assert.ok(!db.includes('%PDF-'),'no PDF in the database');assert.ok(!db.includes('FlateDecode'));
  // Uploading again replaces the information and runs again.
  const again=await h.upload('aperture','op',makePdf(['Customer: Aperture Commerce. Maya Chen wants payments-api ownership in the Catalog.']),{name:'update.pdf'});
  assert.equal(again.status,202,again.raw);assert.equal(again.json.workspace.revision,2);
 }finally{await h.close();rmSync(dir,{recursive:true,force:true});}
});

test('upload errors: specific codes, nothing saved, and the workflow state is respected',async()=>{
 const h=await harness();
 try{
  const up=(bytes:Uint8Array,o?:{type?:string;name?:string})=>h.upload('aperture','op',bytes,o);
  assert.deepEqual([(await up(aperturePdf(),{type:'application/octet-stream'})).json.error.code],['PDF_REQUIRED']);
  assert.equal((await up(aperturePdf(),{type:'application/octet-stream'})).status,415);
  assert.equal((await up(Buffer.from('not a pdf at all'))).json.error.code,'NOT_A_PDF');
  assert.equal((await up(makePdf(['x'],{encrypt:true}))).json.error.code,'PDF_ENCRYPTED');
  const scan=await up(makePdf([{image:true},{image:true},{image:true}]));
  assert.equal(scan.status,422);assert.equal(scan.json.error.code,'PDF_NO_TEXT');assert.deepEqual(scan.json.error.details,{pages:3,emptyPages:3});
  const big=await up(Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(8*1024*1024+10)]));
  assert.equal(big.status,413);assert.equal(big.json.error.code,'PDF_TOO_LARGE');
  assert.equal((await h.call('aperture','handoff','op')).json.workspace.revision,0,'nothing was saved by a refused upload');
  const first=await up(aperturePdf());assert.equal(first.status,202);
  for(let i=0;i<100&&(await h.call('aperture','handoff-analyses','op')).json.job.status==='running';i++)await new Promise(x=>setTimeout(x,10));
  // Finalized (and so published): the information can no longer change.
  const o=(await h.call('aperture','handoff','op')).json,d=o.drafts.at(-1);
  const review={...d.review,stakeholders:[{id:'p1',name:'Maya Chen',role:'Champion',responsibilities:'Coordinate',basis:'stated',sources:[],technical:true},{id:'p2',name:'Alex Rivera',role:'Developer',responsibilities:'',basis:'stated',sources:[],technical:true}],
   milestones:d.review.milestones.map((m:object)=>({...m,assignee:'Alex Rivera'}))};
  await h.call('aperture','handoff-reviews','op',{draft:d.draft,expectedRevision:d.reviewRevision??0,review});
  const s=await h.call('aperture','handoff-submissions','op',{draft:d.draft,reviewRevision:(d.reviewRevision??0)+1,action:'submit',confirmed:true},'Chris');
  assert.equal(s.status,200,s.raw);
  const blocked=await up(aperturePdf());assert.equal(blocked.status,409);assert.equal(blocked.json.error.code,'ALREADY_PUBLISHED');
 }finally{await h.close();}
});

test('upload while an analysis is running is refused without replacing the information being analyzed',async()=>{
 const h=await harness({analysisDelayMs:400});
 try{
  assert.equal((await h.upload('aperture','op',aperturePdf())).status,202);
  const during=await h.upload('aperture','op',makePdf(['Customer: Other. Something else entirely.']));
  assert.equal(during.status,409);assert.equal(during.json.error.code,'ANALYSIS_RUNNING');
  assert.equal((await h.call('aperture','handoff','op')).json.workspace.revision,1,'the running analysis keeps its information');
 }finally{await h.close();}
});

test('upload permissions: only Chris, only his customer; the developer and Champion views stay screened',async()=>{
 const h=await harness();
 try{
  for(const t of ['alex','jordan','dev','champ'])assert.deepEqual([(await h.upload('aperture',t,aperturePdf())).status,(await h.upload('aperture',t,aperturePdf())).json.error.code],[403,'OPERATOR_REQUIRED'],t);
  assert.equal((await h.upload('lumen','op',aperturePdf())).status,403,'another customer');
  assert.equal((await h.upload('aperture','nobody',aperturePdf())).status,403);
  assert.equal((await h.call('aperture','handoff','op')).json.workspace.revision,0);
  // After Chris's upload the Champion and developers see nothing of the document before a plan is approved.
  assert.equal((await h.upload('aperture','op',aperturePdf())).status,202);
  for(let i=0;i<100&&(await h.call('aperture','handoff-analyses','op')).json.job.status==='running';i++)await new Promise(x=>setTimeout(x,10));
  const champion=await h.call('aperture','champion-review','champ');
  assert.equal(champion.json.plan,null,'nothing shown to Maya until Chris submits');
  const all=JSON.stringify([champion.json,(await h.call('aperture','milestone-work','alex')).json]);
  for(const x of [...PRIVATE,'Aperture discovery','Internal notes'])assert.ok(!all.includes(x),`no ${x}`);
 }finally{await h.close();}
});
