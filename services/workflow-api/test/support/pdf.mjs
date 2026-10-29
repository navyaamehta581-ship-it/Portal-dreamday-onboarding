/** Builds small, valid PDF files for tests and the demo sample: text pages (optionally in columns, optionally
 * compressed), image-only pages (scans), and an encrypted shell. Standard 14 fonts only, so no font files. */
import {deflateSync} from 'node:zlib';

const esc=s=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
// WinAnsi covers the Latin text in our fixtures; typographic quotes and dashes map to their WinAnsi bytes.
const WIN={'‘':0x91,'’':0x92,'“':0x93,'”':0x94,'–':0x96,'—':0x97,'…':0x85,' ':0x20};
const latin=s=>Buffer.from([...s].map(c=>WIN[c]??(c.charCodeAt(0)<256?c.charCodeAt(0):0x3f)));

/** Wraps text to roughly `width` characters per line. */
export function wrap(text,width=90){
 const out=[];
 for(const para of text.split('\n')){
  if(!para.trim()){out.push('');continue;}
  let line='';
  for(const w of para.split(/\s+/)){if(line&&(line+' '+w).length>width){out.push(line);line=w;}else line=line?line+' '+w:w;}
  if(line)out.push(line);
 }
 return out;
}

/**
 * pages: each page is {lines:[{text,size?,bold?,x?,y?}]} | {image:true} | string (wrapped automatically).
 * options: {compress?:boolean, encrypt?:boolean, title?:string}
 */
export function makePdf(pages,{compress=false,encrypt=false,title}={}){
 const objects=[];const add=body=>{objects.push(body);return objects.length;};
 const catalog=add(null),tree=add(null),regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const kids=[];
 for(const page of pages){
  let content;const resources=[`/Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >>`];
  if(page&&page.image){
   // A grey 8x8 image drawn over the page: what a scanned page looks like to a text extractor.
   const pixels=Buffer.alloc(64,0x80);
   const img=add({dict:'/Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8',data:pixels});
   resources.push(`/XObject << /Im1 ${img} 0 R >>`);
   content=Buffer.from('q 500 0 0 700 50 50 cm /Im1 Do Q');
  }else{
   // Long lines wrap to the page width, as a word processor would (text beyond the page edge isn't page text).
   const lines=(typeof page==='string'?wrap(page).map(text=>({text})):page.lines).flatMap(l=>l.y!==undefined||!l.text?[l]:wrap(l.text,Math.floor(1000/(l.size??11))).map(text=>({...l,text})));
   let y=760;const parts=[];
   for(const l of lines){
    const size=l.size??11;
    if(l.y===undefined){y-=size+6;if(!l.text){continue;}}
    parts.push(Buffer.from(`BT /${l.bold?'F2':'F1'} ${size} Tf ${l.x??50} ${l.y??y} Td (`),Buffer.from(esc(latin(l.text).toString('latin1')),'latin1'),Buffer.from(') Tj ET\n'));
   }
   content=Buffer.concat(parts);
  }
  const stream=add({dict:compress?'/Filter /FlateDecode':'',data:compress?deflateSync(content):content});
  kids.push(add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 612 792] /Resources << ${resources.join(' ')} >> /Contents ${stream} 0 R >>`));
 }
 objects[catalog-1]=`<< /Type /Catalog /Pages ${tree} 0 R >>`;
 objects[tree-1]=`<< /Type /Pages /Kids [${kids.map(k=>`${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
 const info=title?add(`<< /Title (${esc(title)}) /Producer (Spotify Portal test fixture) >>`):null;
 // A Standard security handler with an unknown user password: readers can't open it without the password.
 const encryptRef=encrypt?add(`<< /Filter /Standard /V 2 /R 3 /Length 128 /P -1340 /O <${'a1'.repeat(32)}> /U <${'b2'.repeat(32)}> >>`):null;
 const chunks=[Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n','latin1')];const offsets=[];let size=chunks[0].length;
 objects.forEach((o,i)=>{
  offsets.push(size);
  const head=Buffer.from(`${i+1} 0 obj\n`);
  const body=typeof o==='string'?Buffer.from(o+'\n'):Buffer.concat([Buffer.from(`<< ${o.dict} /Length ${o.data.length} >>\nstream\n`),o.data,Buffer.from('\nendstream\n')]);
  const tail=Buffer.from('endobj\n');
  chunks.push(head,body,tail);size+=head.length+body.length+tail.length;
 });
 const xref=[`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`,...offsets.map(o=>`${String(o).padStart(10,'0')} 00000 n \n`)].join('');
 const trailer=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R${info?` /Info ${info} 0 R`:''}${encryptRef?` /Encrypt ${encryptRef} 0 R /ID [<${'c3'.repeat(16)}> <${'c3'.repeat(16)}>]`:''} >>\nstartxref\n${size}\n%%EOF\n`;
 chunks.push(Buffer.from(xref+trailer));
 return Buffer.concat(chunks);
}
