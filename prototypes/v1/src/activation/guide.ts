import type {ActivationState} from '../../../../contracts/activation/v1/state';

/** Rule-based guide: everything shown is derived from canonical saved state, so it survives refresh.
 * No language model is involved and nothing here is presented as AiKA. */
export type ContextMatch={label:string;text:string};
export type GuideTurn={id:string;at:string;kind:'question'|'blocker';message:string;
 reply:{status:'recorded'|'pending'|'replanned'|'failed'|'superseded';title:string;lines:string[];matches:ContextMatch[]}};

const STOP=new Set(['about','after','again','also','because','been','before','being','cannot','could','does','doing','don\'t','from','have','having','into','just','know','like','make','more','need','should','that','their','them','then','there','they','this','what','when','where','which','while','with','would','your','will','want','how','who','why','can']);
// Three-letter terms count too (SSO, API, CLI); common short words are ignored.
const SHORT=new Set(['all','and','any','are','but','can','did','for','get','got','had','has','her','him','his','how','its','let','may','not','now','our','out','own','see','she','the','too','use','was','way','who','why','yet','you']);
const words=(text:string)=>new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]{2,}/g)?.filter(w=>!STOP.has(w)&&!SHORT.has(w))??[]);

export function contextMatches(state:ActivationState,question:string,limit=3):ContextMatch[]{
 const asked=words(question);if(!asked.size)return [];
 const sentences=state.context.briefing.split(/\n|(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
 const candidates:ContextMatch[]=[
  ...sentences.map(text=>({label:'Published context',text})),
  ...state.context.constraints.map(text=>({label:'Reported constraint',text})),
  ...state.plan.prerequisites.map(p=>({label:`Prerequisite · ${p.state}`,text:p.description})),
  ...state.context.unknowns.map(text=>({label:'Still unknown',text})),
  {label:'Next action',text:state.plan.suggestedNextAction.description},
 ];
 return candidates.map(c=>({c,score:[...words(c.text)].filter(w=>asked.has(w)).length})).filter(x=>x.score>0)
  .sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.c);
}

export function guideTranscript(state:ActivationState):GuideTurn[]{
 return state.evidence.filter(e=>e.kind==='developer_report'&&e.id.startsWith('report:')).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)).map(record=>{
  const eventId=record.id.slice('report:'.length),message=record.claim;
  if(record.source==='Authenticated activation blocker report'){
   const kind='blocker' as const;
   if(state.replan.blockerId===eventId&&state.replan.status==='pending')return {id:record.id,at:record.observedAt,kind,message,reply:{status:'pending',title:'Blocker recorded. Working out a revised next step…',lines:['Your goal and the original constraints are kept. This page refreshes automatically.'],matches:[]}};
   if(state.replan.blockerId===eventId&&state.replan.status==='failed')return {id:record.id,at:record.observedAt,kind,message,reply:{status:'failed',title:'Blocker recorded, but a revised plan could not be prepared yet.',lines:[`Reason: ${state.replan.errorCode??'unknown'}. Chris has been asked to help.`],matches:[]}};
   if(state.plan.blockerIds.includes(eventId))return {id:record.id,at:record.observedAt,kind,message,reply:{status:'replanned',title:`Updated direction · plan revision ${state.planRevision}`,lines:[state.plan.suggestedNextAction.description,`Kept: your goal (“${state.context.agreedGoal.text}”) and ${state.context.constraints.length} reported constraint(s).`,...(state.chrisHelp.status==='requested'&&state.chrisHelp.blockerIds.includes(eventId)?[`Chris has been asked to: ${state.chrisHelp.reason??'review this blocker'}.`]:[])],matches:[]}};
   return {id:record.id,at:record.observedAt,kind,message,reply:{status:'superseded',title:'Blocker recorded. The plan has changed since this report.',lines:[],matches:[]}};
  }
  const help=state.chrisHelp.evidenceIds.includes(record.id);
  return {id:record.id,at:record.observedAt,kind:'question',message,reply:{status:'recorded',title:help?'Saved and sent to Chris as a help request.':'Saved as your report. Chris can see it.',lines:[],matches:contextMatches(state,message)}};
 });
}
