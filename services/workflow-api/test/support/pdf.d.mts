export type PdfLineSpec={text:string;size?:number;bold?:boolean;x?:number;y?:number};
export type PdfPageSpec=string|{lines:PdfLineSpec[]}|{image:true};
export function wrap(text:string,width?:number):string[];
export function makePdf(pages:PdfPageSpec[],options?:{compress?:boolean;encrypt?:boolean;title?:string}):Buffer;
