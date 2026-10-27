export type Source={id:string;kind:string;text:string};
/** Conservative local extraction; source text is data, never executable instructions. */
export function extract(sources:Source[]){
 const held: string[]=[],safe:string[]=[],uncertain:string[]=[];
 for(const source of sources){for(const line of source.text.split(/\n|(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean)){
  const cited=`[${source.kind} · ${source.id}] ${line}`;
  if(/\$|\b(contract|discount|budget|potential|renewal|secret|password|token|employees)\b/i.test(line))held.push(cited);
  else if(/unverified|not verified|not confirmed|might|conflict|earlier note/i.test(line))uncertain.push(cited);
  else safe.push(cited);
 }}
 return {briefing:safe.join('\n'),held,uncertainties:[...uncertain,'Okta readiness is unverified; conflicting notes require confirmation by the identity owner.','GitHub access is reported only. The catalog and docs below are simulated fixtures.'].join('\n')};
}
