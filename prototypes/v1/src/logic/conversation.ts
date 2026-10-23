import {teams} from '../data/catalog';
import type {Stack} from '../domain/models';
/** Explicit team names can change context; mentioning a language cannot change organization policy. */
export function resolveConversationContext(text:string,currentTeamId:string,currentStack:Stack):{teamId:string;stack:Stack}{
 let teamId=currentTeamId;
 if(/ledger|payments|\bjava team\b/i.test(text))teamId='ledger';
 else if(/signal intelligence|\bsignal team\b/i.test(text))teamId='signal';
 else if(/orbit experience|\borbit team\b/i.test(text))teamId='orbit';
 const explicit:Stack|undefined=/\bnode(?:\.js)?\b/i.test(text)?'node':/\bjava\b/i.test(text)?'java':/\bpython\b/i.test(text)?'python':undefined;
 return{teamId,stack:explicit||(teamId===currentTeamId?currentStack:teams.find(t=>t.id===teamId)!.stack)};
}
