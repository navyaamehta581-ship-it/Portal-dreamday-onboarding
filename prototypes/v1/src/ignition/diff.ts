export type DiffLine={kind:'same'|'add'|'del';text:string};
/** Line diff (LCS) for comparing handoff versions. */
export function lineDiff(before:string,after:string):DiffLine[]{
 const a=before.split('\n'),b=after.split('\n'),n=a.length,m=b.length;
 const t=Array.from({length:n+1},()=>new Array<number>(m+1).fill(0));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)t[i][j]=a[i]===b[j]?t[i+1][j+1]+1:Math.max(t[i+1][j],t[i][j+1]);
 const out:DiffLine[]=[];let i=0,j=0;
 while(i<n&&j<m){if(a[i]===b[j]){out.push({kind:'same',text:a[i]});i++;j++;}else if(t[i+1][j]>=t[i][j+1])out.push({kind:'del',text:a[i++]});else out.push({kind:'add',text:b[j++]});}
 while(i<n)out.push({kind:'del',text:a[i++]});while(j<m)out.push({kind:'add',text:b[j++]});
 return out;
}
/** Split "[Source kind · id] text" provenance prefixes produced by extraction. */
export function provenance(line:string){const m=/^\[([^\]]+)\]\s*(.*)$/.exec(line);return m?{source:m[1],text:m[2]}:{source:null,text:line};}
