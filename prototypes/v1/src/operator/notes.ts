import {customerSignals} from '../../../../services/workflow-api/src/activation/customer-signals';

/** Local organization of pasted notes. Nothing here leaves the browser until Chris publishes. */
export const PUBLISH_LIMIT=6000;
const PRIVATE=/\b(private|confidential|internal[- ]only|do not share|contract|pricing|price|discount|budget|renewal|legal|arr|acv|procurement|quota|commission)\b|[$€£]\s?\d/i;
const OUTCOME=/\b(agreed|agree|goal|outcome|success (?:means|criteria)|first milestone|objective)\b/i;

export type OrganizedNotes={publishable:string;heldBack:string[];outcomeCandidates:string[];truncated:boolean;signals:ReturnType<typeof customerSignals>};

export function organizeNotes(raw:string):OrganizedNotes{
 const lines=raw.split('\n').map(l=>l.trimEnd());
 const heldBack=lines.filter(l=>l.trim()&&PRIVATE.test(l));
 const kept=lines.filter(l=>!(l.trim()&&PRIVATE.test(l))).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 const sentences=kept.split(/\n|(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
 return {publishable:kept.slice(0,PUBLISH_LIMIT),heldBack,truncated:kept.length>PUBLISH_LIMIT,outcomeCandidates:sentences.filter(s=>OUTCOME.test(s)).slice(0,4).map(s=>s.slice(0,1000)),signals:customerSignals(kept.slice(0,PUBLISH_LIMIT))};
}
export const signalsFor=(text:string)=>customerSignals(text);
