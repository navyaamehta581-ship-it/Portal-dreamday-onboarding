// Shared test helpers (imported only by *.test.tsx files).
import {act,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {vi} from 'vitest';
import fixtures from '../../../../contracts/activation/v1/fixtures.json';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {ActivationApi} from './useActivation';

export function fixtureState(scenario:'orbit'|'ledger',patch:Partial<ActivationState>={}):ActivationState{
 const f=fixtures[scenario];
 return {contractVersion:'1.0.0',customerId:scenario,developerSessionId:`session-${scenario}`,revision:0,contextRevision:0,planRevision:0,context:f.context,plan:f.plan,actions:{},evidence:f.plan.evidence,milestone:{id:'first-value',status:'pending',requiredActions:[],evidenceIds:[]},replan:{status:'none',blockerId:null,replacementPlanRevision:null,errorCode:null},chrisHelp:{status:'none',blockerIds:[],owner:null,reason:null,evidenceIds:[]},outcome:{agreedGoalContextRevision:0,status:'unassessed',summary:'',evidenceIds:[],scope:'goal'},...patch} as ActivationState;
}
export function mockApi(){
 return {handoffOverview:vi.fn().mockResolvedValue({drafts:[]}),draftHandoff:vi.fn(),publishHandoff:vi.fn(),acceptSetupProposal:vi.fn(),prepareGitHub:vi.fn(),intake:vi.fn(),read:vi.fn(),initialize:vi.fn(),blocker:vi.fn(),progress:vi.fn(),reportBlocker:vi.fn(),reportProgress:vi.fn()} satisfies Record<keyof ActivationApi,unknown>;
}
export function mount(){
 const host=document.createElement('div');document.body.append(host);
 const root:Root=createRoot(host);
 return {host,render:(node:ReactNode)=>act(async()=>root.render(node)),unmount:async()=>{await act(async()=>root.unmount());host.remove();}};
}
export async function type(el:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string){
 await act(async()=>{const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});
}
export async function click(host:HTMLElement,label:string|RegExp){
 const el=Array.from(host.querySelectorAll<HTMLElement>('button,a,[role=tab]')).find(b=>typeof label==='string'?(b.textContent?.includes(label)||b.getAttribute('aria-label')===label):label.test(b.textContent??''));
 if(!el)throw Error('No control: '+label);
 await act(async()=>{el.click();});
}
export const byLabel=<T extends HTMLElement=HTMLInputElement>(host:HTMLElement,label:string)=>host.querySelector<T>(`[aria-label="${label}"]`);
export const flush=()=>act(async()=>{await Promise.resolve();});
