// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {OnboardingPage,type Tab} from './OnboardingPage';
import {useActivation,type ActivationSession} from '../../activation/useActivation';
import {byLabel,click,fixtureState,mockApi,mount,type} from '../../activation/testing';
import type {ActivationState} from '../../../../../contracts/activation/v1/state';

let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>,session:ActivationSession;
const account={id:'a',label:'Orbit',user:'Alex',customerId:'orbit'};
function Harness({tab}:{tab:Tab}){session=useActivation(api,'scope');return <OnboardingPage session={session} tab={tab} account={account}/>;}
async function load(state:ActivationState,tab:Tab='overview'){api.read.mockResolvedValue(state);await m.render(<Harness tab={tab}/>);await act(async()=>{await session.refresh();});}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api=mockApi();m=mount();});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();sessionStorage.clear();});

it('shows the customer-specific milestone, context and unknowns with no credential or operator fields',async()=>{
 const s=fixtureState('orbit');await load(s);
 expect(m.host.textContent).toContain(s.plan.selectedMilestone.outcome);
 expect(m.host.textContent).toContain(s.context.agreedGoal.text);
 expect(m.host.textContent).toContain(s.context.constraints[0]);
 expect(m.host.querySelector('input[type=password]')).toBeNull();
 expect(m.host.textContent).not.toMatch(/Raw account|Activation at a glance|access token/);
 expect(m.host.querySelector('[role=tab]#tab-team')).toBeNull();
 await click(m.host,'Accept this onboarding direction');
 expect(m.host.querySelector('[role=tab]#tab-team')).not.toBeNull();
 expect(m.host.textContent).toContain('It does not complete a milestone');
});

it('sends a guide question as an attributed report and a blocker through the blocker route',async()=>{
 await load(fixtureState('orbit'),'guide');
 expect(m.host.textContent).toContain('Not AiKA');
 api.reportProgress.mockResolvedValue(fixtureState('orbit',{revision:1}));
 await type(byLabel<HTMLTextAreaElement>(m.host,'Question or update')!,'Who owns the catalog metadata?');
 await click(m.host,'Send');
 expect(api.reportProgress).toHaveBeenCalledWith(expect.objectContaining({message:'Who owns the catalog metadata?',needsChris:false,expectedRevision:0}));
 await type(byLabel<HTMLSelectElement>(m.host,'Message type')!,'blocker');
 api.reportBlocker.mockResolvedValue(fixtureState('orbit',{revision:2}));
 await type(byLabel<HTMLTextAreaElement>(m.host,'Blocker note')!,'No staging deploy permission');
 await click(m.host,'Submit blocker');
 expect(api.reportBlocker).toHaveBeenCalledWith(expect.objectContaining({message:'No staging deploy permission',expectedRevision:1}));
});

it('labels prepared packets as not approved, executed or verified and gates proposal acceptance on review',async()=>{
 const base=fixtureState('orbit');
 const packet={id:'prepare:1',commandDigest:'c',scopeDigest:'s',actionId:base.plan.suggestedNextAction.id,actionRevision:0,planRevision:0,startedRevision:1,status:'prepared' as const,repository:'acme/app',commit:'a'.repeat(40),templatePath:'t.yaml',templateBlob:null,observedAt:'2026-01-01T00:00:00Z',completedAt:'2026-01-01T00:00:01Z',evidenceIds:[],artifact:'file',artifactDigest:'d'.repeat(64),blockers:['Deploy permission missing'],errorCode:null,
  setupProposal:{version:1 as const,sourceTree:'x',kind:'fictional_recommendation_service_setup' as const,targetPath:'p',proposedFile:'f',diff:'+x',templateReview:'reviewed_known_template' as const,dependencies:[],missingPrerequisites:['Owner unknown'],semantics:[],readyToRun:false as const},
  authorization:'inspect_prepare_only' as const,approved:false as const,executed:false as const,verified:false as const,prUrl:null};
 await load(fixtureState('orbit',{githubPreparations:{[packet.id]:packet}}),'repository');
 expect(m.host.querySelector('[aria-label="Packet state"]')!.textContent).toContain('YesNoNoNoNone');
 const accept=()=>Array.from(m.host.querySelectorAll('button')).find(b=>b.textContent==='Accept proposal only')!;
 expect(accept().disabled).toBe(true);
 await act(async()=>{byLabel(m.host,'Reviewed proposal prepare:1')!.click();});
 expect(accept().disabled).toBe(false);
 api.acceptSetupProposal.mockResolvedValue(fixtureState('orbit'));
 await click(m.host,'Accept proposal only');
 expect(api.acceptSetupProposal).toHaveBeenCalledWith(expect.objectContaining({preparationId:'prepare:1',artifactDigest:'d'.repeat(64),decision:'accept_proposal_only'}));
});

it('edits and copies the kickoff message, and handles unavailable clipboard',async()=>{
 await load(fixtureState('orbit'),'team');await act(async()=>{session.direction.accept();});
 await m.render(<Harness tab="team"/>);
 const box=byLabel<HTMLTextAreaElement>(m.host,'Champion kickoff message')!;
 expect(box.value).toContain('not independently verified');
 await type(box,'Edited kickoff');
 const write=vi.fn().mockRejectedValue(new Error('denied'));vi.stubGlobal('navigator',{clipboard:{writeText:write}});
 await click(m.host,'Copy kickoff message');
 expect(write).toHaveBeenCalledWith('Edited kickoff');
 expect(m.host.textContent).toContain('Copy unavailable');
});
