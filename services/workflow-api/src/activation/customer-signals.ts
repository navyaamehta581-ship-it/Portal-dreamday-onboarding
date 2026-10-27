/** Bounded extraction of reported context. It never establishes configuration or access. */
export function customerSignals(briefing:string){
 const lines=briefing.split(/\n|(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean);
 const categories:[string,RegExp][]=[
  ['Backstage familiarity or migration',/backstage|migration|migrat/i],
  ['Identity and SSO',/\bsso\b|okta|entra|identity provider/i],
  ['Repository structure and permissions',/repositor|monorepo|github|gitlab|bitbucket/i],
  ['Wiki and documentation structure',/\bwiki\b|confluence|techdocs|documentation/i],
  ['Trial and technical assistance',/trial|proof of concept|\bpoc\b|solutions engineer/i],
 ];
 const reported=categories.flatMap(([label,pattern])=>{const quote=lines.find(x=>pattern.test(x));return quote?[{label,quote:quote.slice(0,700)}]:[];});
 const unknowns=categories.filter(([label])=>!reported.some(x=>x.label===label)).map(([label])=>`${label}: not stated; clarify only if needed for the agreed goal`);
 return {reported,unknowns};
}
