import type {Source} from './extract';

export type Version={version:number;briefing:string;uncertainties:string;approvedBy:string;at:string};
export type Outcome={status:string;handoffVersion:number;at:string};
export type Progress=Record<string,Record<string,Outcome>>;
export type StepRecord={evidence:'acknowledged'|'simulated';handoffVersion:number;at:string};
export type Workflow={title:string;prerequisite:string;steps:string[];answer:string};
export type IgnitionState={person:string;role:'operator'|'champion'|'developer';revision:number;handoff:Version|null;sources?:Source[];versions?:Version[];commercial?:string;
 preferences:{priority:string;goal:string;invites:string[]};progress:Progress;workflows:Record<string,Workflow>;
 steps:Record<string,Record<string,StepRecord>>;catalogRegistered:boolean;docsEnabled:boolean};
export type Person='chris'|'maya'|'alex'|'jordan';

export const ACCOUNTS:Record<Person,{name:string;product:string}>={
 chris:{name:'Chris',product:'Customer Activation'},maya:{name:'Maya',product:'Team Activation'},
 alex:{name:'Alex',product:'Portal'},jordan:{name:'Jordan',product:'Portal'}};

/** Person and workspace base come from the URL only to pick the login and API scope; the server decides access. */
export function routePerson(path=window.location.pathname):Person|null{
 const a=path.split('/');
 return a[2]==='chris'?'chris':a[2]==='champion'?'maya':a[2]==='developer'?(a[3]==='jordan'?'jordan':'alex'):null;
}
export function routeBase(person:Person|null=routePerson()){
 return person==='chris'?'/ignition/chris':person==='maya'?'/ignition/champion':person==='jordan'?'/ignition/developer/jordan':person==='alex'?'/ignition/developer':'/ignition';
}
/** Path within the persona's workspace, e.g. "" or "/insights". */
export function subPath(path=window.location.pathname){const base=routeBase(routePerson(path));return path.startsWith(base)?path.slice(base.length).replace(/\/$/,''):'';}

export async function request(path:string,body?:unknown){
 const p=routePerson();
 const r=await fetch('/ignition-api/'+(p?p+'/':'')+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({error:'REQUEST_FAILED'}));
 if(!r.ok)throw Error(d.error??'REQUEST_FAILED');
 return d;
}

export function problem(code:string){
 return ({REVISION_CONFLICT:'Someone else changed this customer since you loaded it. Refresh to review the latest version, then try again — your draft is kept.',
  OUTCOME_NOT_VERIFIED:'That answer doesn’t match the catalog entry. Check the entry and try again.',
  PRIVATE_CONTEXT:'The handoff still contains commercial or secret terms. Remove them before approving.',
  REVIEW_REQUIRED:'Confirm you reviewed both fields before approving.',HANDOFF_REQUIRED:'This needs an approved handoff first.',
  FORBIDDEN:'Your account can’t do this here.',DEMO_DISABLED:'This workspace is currently unavailable.',ACCOUNT_MISMATCH:'Use the account invited to this workspace.',
  SOURCE_LIMIT:'This customer file has reached its source limit.',STEP_PREREQUISITE:'Finish the previous step first.'} as Record<string,string>)[code]??code;
}
/** True when an outcome was verified against an older handoff than the current one. */
export const needsRevalidation=(o:Outcome|undefined,state:IgnitionState)=>!!o&&!!state.handoff&&o.handoffVersion<state.handoff.version;
