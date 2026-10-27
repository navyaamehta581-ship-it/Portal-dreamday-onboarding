import type {IgnitionState} from './api';

/** Scripted AiKA answers built only from what this person is allowed to see. No model is called. */
export const BLOCKED=/support|blocked|stuck|access|denied|permission/i;
export function aikaAnswer(state:IgnitionState,q:string,context:string|null):string[]{
 const s=q.toLowerCase(),first=state.workflows[state.preferences.priority];
 if(BLOCKED.test(s))return ['If something outside these steps is blocking you, I can prepare a technical support request for you to send. It includes the service and step, but no customer notes or secrets.'];
 if(/okta|sso|identity/.test(s))return ['Okta readiness for Northstar is still unverified — the notes conflict. It isn’t needed for registering payments-api or reading its documentation.'];
 if(/owner|ownership|spec/.test(s)||context==='owner'&&/how|explain|step|summar/.test(s))return ['Open payments-api in the Catalog. The owner is in the About panel and in `spec.owner` of its catalog-info.yaml. Follow that team reference to the owning team.'];
 if(/runbook|doc|incident|recover/.test(s)||context==='docs'&&/how|explain|step|summar/.test(s))return ['Open Docs for payments-api and find the incident runbook. Its heading tells you where to start during a payments incident.'];
 if(/register|catalog|component|pull request/.test(s)||context==='setup'&&/how|explain|step|summar/.test(s))return ['Registering payments-api adds a catalog-info.yaml with its owner and lifecycle. Choose your team, set the component type to service, and review the pull request before it’s merged.'];
 if(/goal|first|start|summar|what should/.test(s))return [`Northstar’s goal is service ownership and documentation for payments-api.`,`Your team’s first workflow: ${first.title}.`,...(state.preferences.goal?[`Team goal: ${state.preferences.goal}`]:[])];
 return ['I can help with Northstar’s onboarding: registering payments-api, finding its owner, its documentation, and what is still unverified.'];
}
export function supportDraft(state:IgnitionState,step:string,issue:string){
 return `Technical support request (draft)\nRequester: ${state.person}@northstar.example\nService: payments-api\nStep: ${step}\nHandoff: v${state.handoff?.version??'—'}\nIssue: ${issue.trim()}`;
}
