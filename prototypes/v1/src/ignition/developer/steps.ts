import {needsRevalidation,type IgnitionState} from '../api';

export type StepStatus={done:boolean;stale:boolean;evidence:string|null};
export type StepAction={kind:'record';label:string;sim?:boolean}|{kind:'route';label:string;to:string}|{kind:'enable';label:string};
export type Step={id:string;title:string;body:string[];prerequisites?:string[];action:StepAction;doneAction?:{label:string;to:string};status:(s:IgnitionState)=>StepStatus;teamPriority?:(s:IgnitionState)=>boolean};

const recorded=(person:string,id:string)=>(s:IgnitionState):StepStatus=>{const r=s.steps?.[person]?.[id];return {done:!!r,stale:false,evidence:r?`${r.evidence==='simulated'?'Simulated':'Confirmed by you'} · handoff v${r.handoffVersion}`:null};};
const verified=(person:string,workflow:string)=>(s:IgnitionState):StepStatus=>{const o=s.progress?.[person]?.[workflow];return {done:!!o&&!needsRevalidation(o,s),stale:needsRevalidation(o,s),evidence:o?`Verified in simulation · handoff v${o.handoffVersion}`:null};};

/** Personalized onboarding from the approved Northstar handoff. Completion always comes from recorded evidence. */
export function stepsFor(person:string,base:string):Step[]{
 const goal:Step={id:'goal',title:'Review Northstar’s onboarding goal',body:['Northstar wants every service to have a clear owner and discoverable documentation, starting with payments-api.'],action:{kind:'record',label:'Mark as reviewed'},status:recorded(person,'goal')};
 if(person==='jordan')return [goal,
  {id:'discover',title:'Find payments-api in the Catalog',body:['Your team is registering payments-api. Open it in the Catalog and confirm it’s the service you’ll work on.'],action:{kind:'route',label:'Go to Catalog',to:base+'/catalog'},doneAction:{label:'Go to Catalog',to:base+'/catalog'},status:recorded(person,'discover')},
  {id:'owner',title:'Identify the service owner',body:['Check who owns payments-api so you know who to ask about changes and incidents.'],action:{kind:'route',label:'Open payments-api',to:base+'/catalog/payments-api'},doneAction:{label:'Go to Catalog',to:base+'/catalog/payments-api'},status:verified(person,'ownership'),teamPriority:s=>s.preferences.priority==='ownership'},
  {id:'docs',title:'Read the service documentation',body:['Find the payments-api incident runbook in Docs.'],action:{kind:'route',label:'Go to Docs',to:base+'/docs'},doneAction:{label:'Go to Docs',to:base+'/docs'},status:verified(person,'docs'),teamPriority:s=>s.preferences.priority==='docs'}];
 return [goal,
  {id:'access',title:'Confirm the GitHub repository and access prerequisites',body:['payments-api lives in Northstar’s GitHub organization.'],prerequisites:['GitHub repository payments-api — reported by Northstar, not yet verified','Read access to the repository for your account','Okta SSO — unverified, not needed for these steps'],action:{kind:'record',label:'Run access check',sim:true},status:recorded(person,'access')},
  {id:'prepare',title:'Prepare payments-api for Catalog registration',body:['Choose your team and review the components found in the repository.'],action:{kind:'route',label:'Start',to:base+'/setup/team'},status:recorded(person,'prepare')},
  {id:'register',title:'Register the service',body:['Create a pull request that adds catalog-info.yaml with the owner and lifecycle of payments-api.'],prerequisites:['Prepared for registration'],action:{kind:'route',label:'Create pull request',to:base+'/setup/register'},doneAction:{label:'Go to Catalog',to:base+'/catalog'},status:recorded(person,'register')},
  {id:'owner',title:'Verify the service owner',body:['Confirm the owner shown for payments-api in the Catalog.'],action:{kind:'route',label:'Open payments-api',to:base+'/catalog/payments-api'},doneAction:{label:'Go to Catalog',to:base+'/catalog/payments-api'},status:verified(person,'ownership'),teamPriority:s=>s.preferences.priority==='ownership'},
  {id:'docs-enable',title:'Make the service documentation discoverable',body:['TechDocs publishes the documentation that lives with payments-api so your team can find it in Portal.'],action:{kind:'enable',label:'Enable TechDocs'},doneAction:{label:'Go to Docs',to:base+'/docs'},status:recorded(person,'docs-enable')},
  {id:'workflow',title:'Verify your first workflow',body:['Use the payments-api runbook to find where to start during a payments incident.'],action:{kind:'route',label:'Go to Docs',to:base+'/docs'},doneAction:{label:'Go to Docs',to:base+'/docs'},status:verified(person,'docs'),teamPriority:s=>s.preferences.priority==='docs'}];
}
