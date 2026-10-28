// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {OperatorWorkspace} from './OperatorWorkspace';
import {activationClient,ActivationRequestError} from '../activation/client';
import {byLabel,click,fixtureState,flush,mockApi,mount,type} from '../activation/testing';
import type {HandoffRecord} from '../../../../contracts/activation/v1/handoff';
import {interpretRuleBased} from '../../../../services/workflow-api/src/activation/handoff/interpret';
import {proposeMilestones} from '../../../../services/workflow-api/src/activation/handoff/milestones';

vi.mock('../activation/client',async orig=>({...(await orig<typeof import('../activation/client')>()),activationClient:vi.fn()}));
let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>;
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);window.history.replaceState(null,'','/operator');
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({accounts:[{id:'north',label:'Northstar',user:'Dev',customerId:'fictional-north'}]}))));
 api=mockApi();vi.mocked(activationClient).mockReturnValue(api);
 m=mount();await m.render(<OperatorWorkspace/>);await flush();
});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});

async function open(){await type(byLabel(m.host,'Operator access token')!,'o'.repeat(40));await click(m.host,'Open workspace');await flush();}

it('routes a configured account through the operator proxy with the typed token only',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await open();
 expect(activationClient).toHaveBeenLastCalledWith('fictional-north','o'.repeat(40),'','/operator-api/north');
 await click(m.host,'Developer Progress');
 expect(window.location.pathname).toBe('/operator/progress');
 expect(m.host.textContent).toContain('Activation at a glance');
 expect(m.host.textContent).not.toContain('Bring your team along');
});

it('analyzes sources on the server, keeps private findings internal and publishes the reviewed milestone',async()=>{
 const sources=[{type:'conversation' as const,label:'Discovery call',text:'PRIVATE pricing: 20% discount.\nWe keep walking teams through the same setup. Start with checkout-api in repo northstar/checkout-api on GitHub. Nobody knows who owns it.'}];
 const understanding=interpretRuleBased(sources.map((x,i)=>({...x,id:`s${i+1}`})));
 const record:HandoffRecord={draft:1,status:'draft',createdAt:'2026-10-28T00:00:00Z',publishedVersion:null,publishedAt:null,sources:sources.map((x,i)=>({...x,id:`s${i+1}`})),understanding,proposal:proposeMilestones(understanding),developer:null};
 api.read.mockRejectedValue(new ActivationRequestError('NOT_FOUND',404));api.draftHandoff.mockResolvedValue(record);await open();
 await type(byLabel<HTMLTextAreaElement>(m.host,'Raw account and call notes')!,sources[0].text);
 await type(byLabel(m.host,'Source 1 name')!,'Discovery call');
 await click(m.host,'Analyze sources');
 expect(api.draftHandoff).toHaveBeenCalledWith([{type:'conversation',label:'Discovery call',text:sources[0].text}]);
 const review=m.host.querySelector('[aria-label="Review before publishing"]')!.textContent!;
 expect(review).toContain('Review checkout-api repository readiness');
 expect(review).toContain('Kept internal');expect(review).toContain('PRIVATE pricing');
 expect(m.host.textContent).toContain('Draft 1 · not published');
 await click(m.host,'Activation Goal');
 expect(byLabel<HTMLInputElement>(m.host,'Milestone objective')!.value).toBe('Review checkout-api repository readiness and prepare it for Catalog registration');
 await type(byLabel(m.host,'Agreement attribution')!,'Platform lead, trial call');
 const publish=()=>Array.from(m.host.querySelectorAll('button')).find(b=>b.textContent==='Publish to developers')!;
 expect(publish().disabled).toBe(true);
 const check=m.host.querySelector<HTMLInputElement>('.pt-check input')!;await (await import('react')).act(async()=>{check.click();});
 api.publishHandoff.mockRejectedValue(new ActivationRequestError('REVISION_CONFLICT',409));
 await click(m.host,'Publish to developers');
 expect(api.publishHandoff).toHaveBeenCalledWith(expect.objectContaining({draft:1,outcome:'Review checkout-api repository readiness and prepare it for Catalog registration',agreedBy:'Platform lead, trial call',agreementConfirmed:true}));
 expect(m.host.textContent).toContain('already published');
 // The reviewed draft survives switching tabs.
 await click(m.host,'Customer Context');
 expect(byLabel<HTMLTextAreaElement>(m.host,'Raw account and call notes')!.value).toContain('checkout-api');
});

it('shows follow-up and reported outcome text without claiming verification',async()=>{
 const s=fixtureState('orbit',{chrisHelp:{status:'requested',blockerIds:['developer:a'],owner:'Chris',reason:'Review the developer report',evidenceIds:[]},outcome:{agreedGoalContextRevision:0,status:'reported',summary:'Which repo?',evidenceIds:[],scope:'goal'}});
 api.read.mockResolvedValue(s);await open();await click(m.host,'Developer Progress');
 expect(m.host.textContent).toContain('Chris intervention requested');
 expect(m.host.textContent).toContain('Latest reported outcome text: “Which repo?”');
 expect(m.host.querySelector('[aria-label="Chris team handoff summary"]')!.textContent).toContain('not');
});

it('renders inside the shared Portal shell with operator navigation and no developer session',async()=>{
 const nav=m.host.querySelector('nav.pt-side')!;
 expect(m.host.querySelector('.pt-shell .pt-top .pt-search')).not.toBeNull();
 expect(Array.from(nav.querySelectorAll('a')).map(a=>a.getAttribute('href'))).toContain('/operator');
 expect(nav.textContent).toContain('Customer Onboarding');
 expect(Array.from(nav.querySelectorAll('a')).some(a=>a.getAttribute('href')?.startsWith('/portal')||a.getAttribute('href')==='/activation')).toBe(false);
 expect(vi.mocked(fetch).mock.calls.map(c=>String(c[0]))).toEqual(['/portal-auth/accounts']);
 expect(m.host.querySelector('[aria-label="Account: Chris"]')).not.toBeNull();
});
