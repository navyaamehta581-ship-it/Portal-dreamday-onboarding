/** Turns the text of Chris's PDF into the existing customer-information model: up to 12 typed entries (SourceInput),
 * the same shape Chris used to type by hand, so the existing analysis, privacy screening and fallbacks apply
 * unchanged. Headings split the document into sections and decide each section's category; when no heading
 * says, the content does; when neither does, the section is marked uncertain. Nothing is invented: the report
 * says what was read, what wasn't, and what the document doesn't seem to contain. */
import type {DocumentReport,DocumentSection,SourceInput,SourceType} from '../../../../../contracts/activation/v1/handoff.ts';
import {ActivationError} from '../store.ts';
import type {PdfLine,PdfText} from './pdf.ts';

const MAX_SOURCES=12,MAX_SOURCE_CHARS=60_000;
const fail=(code:string,details?:unknown):never=>{throw new ActivationError(code,details);};

// Category from a heading. Order matters: private material (CRM, internal notes) is checked first, so a heading
// like "Internal notes from the call" stays private.
const HEADING:[SourceType,RegExp][]=[
 ['crm',/\b(crm|salesforce|hubspot|opportunit(y|ies)|deal|pricing|commercial|account (record|details))\b/i],
 ['chris_notes',/\b(internal|private|confidential|my notes|account team notes|personal notes)\b/i],
 ['conversation',/\b(transcript|discovery|call|meeting|interview|conversation|workshop|q ?& ?a)\b/i],
 ['technical_requirements',/\b(requirements?|technical|architecture|constraints?|security|compliance|non-functional)\b/i],
 // Never 'repository': that category means the Portal backend observed it (and counts as verified evidence). What a
 // document says about repositories is reported information, so it is read as technical requirements.
 ['technical_requirements',/\b(repositor(y|ies)|codebase|repo|source code)\b/i],
 ['integration_tools',/\b(tools?|tooling|integrations?|tech stack|stack|ci ?\/ ?cd|platforms?)\b/i],
 ['account_prep',/\b(prep|preparation|background|overview|summary|context|agenda|account plan|objectives?|goals?|notes)\b/i],
];
const SPEAKER=/^(?:\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?[A-Z][\w'’.-]+(?: [A-Z][\w'’.-]+){0,3}(?: \([^)]{1,60}\))?:\s+\S/;
const MONEY=/[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m)\b(?!\w)|\b(arr|acv|tcv|discount|pricing|renewal|opportunity|deal size|procurement)\b|\b(deal |sales )?stage:/i;
const REQUIREMENT=/\b(must|shall|should|required?|requirement|needs? to)\b/i;
const PAGE_NUMBER=/^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i;

/** Lines repeated at the top or bottom of most pages (running headers and footers) and bare page numbers. */
function boilerplate(lines:PdfLine[],pages:number){
 const drop=new Set<PdfLine>();
 for(const l of lines)if(PAGE_NUMBER.test(l.text))drop.add(l);
 if(pages>=3){
  // Digits are ignored, so "Page 3 of 9" and dated footers count as the same line on every page.
  const key=(l:PdfLine)=>l.text.replace(/\d+/g,'#'),edges=new Map<string,Set<number>>();
  const grouped=new Map<number,PdfLine[]>();for(const l of lines)grouped.set(l.page,[...(grouped.get(l.page)??[]),l]);
  const byPage=[...grouped.values()].map(ls=>[...ls.slice(0,2),...ls.slice(-2)]);
  for(const ls of byPage)for(const l of ls){if(!edges.has(key(l)))edges.set(key(l),new Set());edges.get(key(l))!.add(l.page);}
  for(const ls of byPage)for(const l of ls)if(edges.get(key(l))!.size>=Math.max(3,Math.ceil(byPage.length*.6)))drop.add(l);
 }
 return drop;
}

function headingType(text:string){return HEADING.find(([,rx])=>rx.test(text))?.[0]??null;}
function isHeading(l:PdfLine,body:number,next:PdfLine|undefined){
 const t=l.text;
 if(t.length>80||t.length<3||/[.,;]$/.test(t)||SPEAKER.test(t))return false;
 if(!next)return false;
 if(l.size>=body*1.15)return true;
 if(/^(\d+(\.\d+)*[.)]?|[IVX]+\.)\s+[A-Z]/.test(t)&&t.length<=60)return true;
 const letters=t.replace(/[^A-Za-z]/g,'');
 if(letters.length>=4&&letters===letters.toUpperCase()&&t.length<=60)return true;
 // Same size as the body: only a short line that names a known section and doesn't read as a sentence.
 return t.length<=50&&t.split(/\s+/).length<=6&&(/:$/.test(t)||headingType(t)!==null)&&!/\b(is|are|was|were|we|our|i)\b/i.test(t.replace(/:$/,''));
}
function contentType(text:string):{type:SourceType;basis:'content'|'default'}{
 const lines=text.split('\n');
 // Commercial content first: it must stay private even inside a transcript-like section. Counted per sentence, so
 // line wrapping doesn't change the answer.
 const sentences=text.split(/(?<=[.!?])\s+|\n/).filter(x=>x.trim());
 if(sentences.filter(x=>MONEY.test(x)).length>=Math.max(1,sentences.length*.2))return {type:'crm',basis:'content'};
 // A transcript: timestamps, or the same speaker more than once ("Label: value" lists rarely repeat a label).
 const speakers=lines.map(l=>SPEAKER.test(l)?l.replace(/^\[[^\]]*\]\s*/,'').split(':')[0]:null).filter((x):x is string=>!!x);
 const repeated=speakers.length>=3&&new Set(speakers).size<speakers.length;
 if(lines.filter(l=>/^\[\d{1,2}:\d{2}/.test(l)).length>=2||repeated&&speakers.length>=lines.length*.3)return {type:'conversation',basis:'content'};
 if(lines.filter(l=>REQUIREMENT.test(l)).length>=Math.max(2,lines.length*.5))return {type:'technical_requirements',basis:'content'};
 return {type:'account_prep',basis:'default'};
}
const pageRange=(pages:number[])=>{const a=Math.min(...pages),b=Math.max(...pages);return a===b?`p. ${a}`:`pp. ${a}–${b}`;};
const clip=(s:string,n:number)=>s.length>n?s.slice(0,n-1).trimEnd()+'…':s;

/** Customer name as the document states it ("Customer: …", "Company: …"), else from the title, else not found. */
function customerName(lines:PdfLine[],title:string|null):DocumentReport['customer']{
 for(const l of lines.slice(0,60)){const m=/^(?:customer|company|account|client|organi[sz]ation)(?:\s+name)?\s*[:–—-]\s*(.{2,80})$/i.exec(l.text);if(m)return {name:m[1].replace(/\s*\((?:fictional)\)\s*/i,' ').replace(/[.;]\s*.*$/,'').trim(),basis:'stated'};}
 const t=title??lines[0]?.text??'';const m=/^(.{2,60}?)\s+(?:[—–:|-]|–)\s+/.exec(t);
 if(m&&/[A-Z]/.test(m[1][0]))return {name:m[1].trim(),basis:'title'};
 return {name:null,basis:'not_found'};
}
/** What the analysis will need and the document doesn't seem to mention. Heuristic, so it is shown as a check, not a fact. */
function missingTopics(text:string,customer:DocumentReport['customer']):DocumentReport['missing']{
 const out:DocumentReport['missing']=[];
 if(customer.basis==='not_found')out.push('customer');
 if(!/\b[A-Z][a-z]+ [A-Z][a-z]+\b.{0,40}\b(engineer|developer|lead|manager|director|champion|architect|sre|owner|cto|vp|head)\b|\b(champion|engineer|developer|platform lead|team lead)\b/i.test(text))out.push('people');
 if(!/\b[\w-]+-(api|service|svc|app|web)\b|\b(github|gitlab|bitbucket|jenkins|kubernetes|terraform|aws|gcp|azure|backstage|ci|repository|repo|service)\b/i.test(text))out.push('systems');
 if(!/\b(goal|want|need|pain|problem|challenge|struggl|issue|objective|outcome|priority|pilot)\w*/i.test(text))out.push('goals');
 return out;
}

export function structureDocument(pdf:PdfText,fileName:string,now=()=>Date.now()):{sources:SourceInput[];report:DocumentReport}{
 const drop=boilerplate(pdf.lines,pdf.read);
 const lines=pdf.lines.filter(l=>!drop.has(l));
 const chars=lines.reduce((a,l)=>a+l.text.length,0);
 if(chars<20)fail('PDF_NO_TEXT',{pages:pdf.pages,emptyPages:pdf.empty.length});
 // Body size: the size carrying the most text.
 const weight=new Map<number,number>();for(const l of lines)weight.set(l.size,(weight.get(l.size)??0)+l.text.length);
 const body=[...weight].sort((a,b)=>b[1]-a[1])[0][0]||11;
 // Sections: text under each heading; text before the first heading is the document's opening.
 type Section={heading:string|null;lines:PdfLine[]};
 const sections:Section[]=[{heading:null,lines:[]}];
 // A first line set larger than every other line is the document's title, not a section heading.
 const titled=lines.length>1&&lines[0].page===1&&lines[0].size>Math.max(...lines.slice(1).map(l=>l.size))&&lines[0].text.length<=120;
 const title=titled?lines[0].text:pdf.title;
 (titled?lines.slice(1):lines).forEach((l,i,ls)=>{if(isHeading(l,body,ls[i+1]))sections.push({heading:l.text.replace(/:$/,'').trim(),lines:[]});else sections.at(-1)!.lines.push(l);});
 // Join hyphenated line breaks; keep other line breaks (speakers, lists).
 const textOf=(ls:PdfLine[])=>ls.map(l=>l.text).join('\n').replace(/(\w)-\n([a-z])/g,'$1$2');
 let parts=sections.filter(s=>s.lines.length).map(s=>{
  const text=textOf(s.lines),byHeading=s.heading?headingType(s.heading):null,byContent=contentType(text);
  // A section of commercial content stays private whatever its heading suggests.
  const commercial=byHeading!=='crm'&&byHeading!=='chris_notes'&&byContent.type==='crm';
  const type:SourceType=commercial?'crm':byHeading??byContent.type;
  const basis:DocumentSection['basis']=commercial?'content':byHeading?'heading':byContent.basis;
  return {label:s.heading??(title&&sections.length===1?title:'Opening'),type,basis,pages:[...new Set(s.lines.map(l=>l.page))],text};
 });
 // Long sections are split; then neighbours of the same category merge until the model's 12-entry limit is met.
 parts=parts.flatMap(p=>{if(p.text.length<=MAX_SOURCE_CHARS)return [p];const out=[];for(let i=0;i*MAX_SOURCE_CHARS<p.text.length;i++)out.push({...p,label:`${p.label} (part ${i+1})`,text:p.text.slice(i*MAX_SOURCE_CHARS,(i+1)*MAX_SOURCE_CHARS)});return out;});
 const merge=(a:typeof parts[0],b:typeof parts[0])=>({...a,label:a.label===b.label?a.label:`${a.label} + ${b.label}`,basis:a.basis==='default'||b.basis==='default'?'default' as const:a.basis,pages:[...a.pages,...b.pages],text:a.text+'\n\n'+(b.label!==a.label?b.label+'\n':'')+b.text});
 for(let i=1;i<parts.length&&parts.length>MAX_SOURCES;){if(parts[i].type===parts[i-1].type&&parts[i].text.length+parts[i-1].text.length<=MAX_SOURCE_CHARS){parts[i-1]=merge(parts[i-1],parts[i]);parts.splice(i,1);}else i++;}
 while(parts.length>MAX_SOURCES){
  // Still too many: merge the two smallest neighbours that fit.
  let best=-1;for(let i=1;i<parts.length;i++)if(parts[i].text.length+parts[i-1].text.length<=MAX_SOURCE_CHARS&&(best<0||parts[i].text.length+parts[i-1].text.length<parts[best].text.length+parts[best-1].text.length))best=i;
  if(best<0)break;
  const a=parts[best-1],b=parts[best];parts[best-1]={...merge(a,b),type:a.type===b.type?a.type:a.type==='crm'||b.type==='crm'?'crm':a.type==='chris_notes'||b.type==='chris_notes'?'chris_notes':a.type,basis:a.type===b.type?a.basis:'default'};parts.splice(best,1);
 }
 const kept=parts.slice(0,MAX_SOURCES);
 const sources:SourceInput[]=kept.map((p,i)=>({id:`pdf${i+1}`,type:p.type,label:clip(`${p.label} (${pageRange(p.pages)})`,80),text:p.text}));
 const all=kept.map(p=>p.text).join('\n');
 const customer=customerName(lines,title);
 const unreadable=[...pdf.failed];
 const notRead=pdf.pages>pdf.read?{from:pdf.read+1,to:pdf.pages}:null;
 const report:DocumentReport={fileName:clip(fileName.replace(/[\u0000-\u001f]/g,'').trim()||'customer.pdf',120),uploadedAt:new Date(now()).toISOString(),
  pages:pdf.pages,pagesRead:pdf.read,emptyPages:pdf.empty,unreadablePages:unreadable,notRead,truncated:pdf.truncated||parts.length>MAX_SOURCES,
  removedLines:drop.size,characters:all.length,customer,
  sections:kept.map((p,i)=>({label:sources[i].label,type:p.type,basis:p.basis,pages:pageRange(p.pages),chars:p.text.length})),
  missing:missingTopics(all,customer),
  complete:!pdf.empty.length&&!unreadable.length&&!notRead&&!pdf.truncated&&parts.length<=MAX_SOURCES};
 return {sources,report};
}
