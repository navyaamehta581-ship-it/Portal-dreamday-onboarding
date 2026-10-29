// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {OnboardingPage,type Tab} from './OnboardingPage';
import {useActivation,type ActivationSession} from '../../activation/useActivation';
import {useMilestoneWork} from '../work/useMilestoneWork';
import {useOpportunities} from '../adoption/useOpportunities';
import {click,fixtureState,flush,mockApi,mount} from '../../activation/testing';
import type {Opportunities,TeamProgress} from '../../../../../contracts/activation/v1/handoff';

let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>,session:ActivationSession;
const account={id:'a',label:'Orbit',user:'Alex',customerId:'orbit'};
function Harness({tab}:{tab:Tab}){session=useActivation(api,'scope');const work=useMilestoneWork(api),opps=useOpportunities(api);return <OnboardingPage session={session} tab={tab} account={account} work={work} opps={opps}/>;}
async function load(tab:Tab='overview'){api.read.mockResolvedValue(fixtureState('orbit'));await m.render(<Harness tab={tab}/>);await act(async()=>{await session.refresh();});await flush();await flush();}
const text=()=>m.host.textContent??'';

// An approved plan: Alex is the suggested owner of one milestone; nobody has picked up the other.
const outline=(t:string)=>({description:`${t} for the pilot`,system:'payments-api',actions:[`Start: ${t}`,'Record findings'],completionCriteria:['Each item is marked verified, missing or inaccessible']});
const progress=(patch:Partial<TeamProgress['milestones'][number]>={}):TeamProgress=>({viewer:{role:'developer',name:'Alex Rivera'},approval:{by:'Maya Chen',at:'2026-10-29T10:00:00Z'},objective:{problem:'Nobody can tell who owns a service.',goals:['Make ownership discoverable'],questions:[]},
 milestones:[{id:'m-1',title:'Assess payments-api readiness',assignee:'Alex Rivera',status:'not_started',openBlockers:0,mine:true,suggestedForMe:true,workingOn:[],revision:0,dependsOn:[],outline:outline('Assess payments-api readiness'),actionsCompleted:0,actionsTotal:2,
   detail:{description:'',system:'payments-api',actions:[{index:0,text:'Start',status:'not_started',at:null,by:null},{index:1,text:'Record findings',status:'not_started',at:null,by:null}],completionCriteria:[],updates:[],revision:0,updatedAt:null,updatedBy:null}},
  {id:'m-2',title:'Register payments-api in the Catalog',assignee:null,status:'not_started',openBlockers:0,mine:false,suggestedForMe:false,workingOn:[],revision:2,dependsOn:[],outline:outline('Register payments-api in the Catalog'),detail:null,...patch}]});
const opportunities=(mine=false):Opportunities=>({viewer:{role:'developer',name:'Alex Rivera'},observedAt:'2026-10-29T12:30:00Z',
 goals:[{id:'g1',text:'Make ownership discoverable',priority:'high',milestones:[{id:'m-1',title:'Assess payments-api readiness',status:'not_started'}],completed:0,total:1}],
 opportunities:[{id:'o-owners',kind:'improvement',title:'Record who owns payments-api’s code',why:'Supports your goal: Make ownership discoverable',basis:'verified',evidence:['No CODEOWNERS file found (live, read-only).'],steps:['Add a CODEOWNERS file listing the owning team.','Ask AiKA to check the owner shown in Portal.'],service:'payments-api',goal:'g1',priority:'high',highlighted:true,pursuers:mine?1:0,mine},
  {id:'o-techdocs',kind:'integration',title:'Publish payments-api docs in TechDocs',why:'Your plan mentions scattered docs.',basis:'hypothesis',evidence:['From the onboarding plan'],steps:['Add mkdocs.yml next to the docs.'],service:'payments-api',goal:null,priority:null,highlighted:false,pursuers:0,mine:false}]});
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api=mockApi();m=mount();window.history.replaceState(null,'','/activation');});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();sessionStorage.clear();});

it('before the plan is published: says so, with no tabs, credentials, setup or operator fields',async()=>{
 api.opportunities.mockRejectedValue(new Error('NO_APPROVED_PLAN'));
 await load();
 expect(text()).toContain('Your team’s onboarding plan isn’t published yet');expect(text()).not.toMatch(/approv/i);
 expect(m.host.querySelector('[role=tab]')).toBeNull();
 expect(m.host.querySelector('input[type=password],input[type=file]')).toBeNull();
 expect(text()).not.toMatch(/Chris|access token|Raw account/);
});

it('overview: goals, engineering opportunities labelled verified or hypothesis, and milestones to choose; nothing assigned, no Chris',async()=>{
 api.milestoneWork.mockResolvedValue(progress());api.opportunities.mockResolvedValue(opportunities());
 await load();
 expect(Array.from(m.host.querySelectorAll('[role=tab]')).map(t=>t.textContent)).toEqual(['Overview','My milestones','Guide']);
 expect(m.host.querySelector('[aria-label="Goal: Make ownership discoverable"]')!.textContent).toContain('0 of 1 related milestone completed');
 const card=(t:string)=>m.host.querySelector(`[aria-label="Opportunity: ${t}"]`) as HTMLElement;
 expect(card('Record who owns payments-api’s code').querySelector('[data-basis]')!.textContent).toBe('Verified');
 expect(card('Record who owns payments-api’s code').textContent).toContain('Recommended by your Champion');
 expect(card('Publish payments-api docs in TechDocs').querySelector('[data-basis]')!.textContent).toBe('Hypothesis');
 // What backs it is one click away.
 await click(card('Record who owns payments-api’s code'),'Show details: Record who owns payments-api’s code');
 expect(card('Record who owns payments-api’s code').textContent).toContain('No CODEOWNERS file found (live, read-only).');
 const choices=m.host.querySelector('[aria-label="Milestones to choose from"]')!.textContent!;
 expect(choices).toContain('Suggested for you');expect(choices).toContain('Nobody has picked it up yet');
 expect(text()).not.toMatch(/Chris|Share your progress|Team & Evidence|Upload|Repository|kickoff|assigned to you/i);
 // Choosing a milestone that isn't theirs uses its outline's revision.
 api.updateMilestone.mockResolvedValue(progress({mine:true,workingOn:['Alex Rivera'],revision:3}));
 await click(m.host.querySelector('[aria-label="Milestones to choose from"] [aria-label="Milestone: Register payments-api in the Catalog"]') as HTMLElement,'Choose this milestone');await flush();
 expect(api.updateMilestone).toHaveBeenCalledWith('m-2',2,{pursue:true});
 // Pursuing an opportunity is the developer's choice.
 api.pursueOpportunity.mockResolvedValue(opportunities(true));
 await click(card('Record who owns payments-api’s code'),'Pursue this');await flush();
 expect(api.pursueOpportunity).toHaveBeenCalledWith('o-owners',true);
 expect(card('Record who owns payments-api’s code').textContent).toContain('1 developer pursuing (including you)');
});

it('guide: step-by-step help for each opportunity, the pursued ones first, with AiKA for anything specific',async()=>{
 api.milestoneWork.mockResolvedValue(progress());api.opportunities.mockResolvedValue({...opportunities(),opportunities:[...opportunities().opportunities].reverse().map(o=>o.id==='o-owners'?{...o,mine:true,pursuers:1}:o)});
 await load('guide');
 const guides=Array.from(m.host.querySelectorAll('[aria-label^="Guide: "]'));
 expect(guides.map(g=>g.getAttribute('aria-label'))).toEqual(['Guide: Record who owns payments-api’s code','Guide: Publish payments-api docs in TechDocs']);
 expect(guides[0].textContent).toContain('Add a CODEOWNERS file listing the owning team.');
 await click(guides[0] as HTMLElement,'Ask AiKA about this');
 expect(window.location.pathname+window.location.search).toBe('/aika?opportunity=o-owners');
 expect(text()).not.toMatch(/Chris|Not AiKA|Submit blocker/);
});
