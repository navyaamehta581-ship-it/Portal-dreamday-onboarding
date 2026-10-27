// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ActivationPage} from './ActivationPage';
import {activationClient} from './client';
import fixtures from '../../../../contracts/activation/v1/fixtures.json';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
const api={acceptSetupProposal:vi.fn(),prepareGitHub:vi.fn(),intake:vi.fn(),read:vi.fn(),initialize:vi.fn(),blocker:vi.fn(),progress:vi.fn(),reportBlocker:vi.fn(),reportProgress:vi.fn()};
vi.mock('./client',()=>({activationClient:vi.fn()}));
let host:HTMLDivElement,root:Root;
function state(scenario:'orbit'|'ledger'):ActivationState{
 const f=fixtures[scenario];
 return {contractVersion:'1.0.0',customerId:scenario,developerSessionId:`session-${scenario}`,revision:0,contextRevision:0,planRevision:0,context:f.context,plan:f.plan,actions:{},evidence:f.plan.evidence,milestone:{id:'first-value',status:'pending',requiredActions:[],evidenceIds:[]},replan:{status:'none',blockerId:null,replacementPlanRevision:null,errorCode:null},chrisHelp:{status:'none',blockerIds:[],owner:null,reason:null,evidenceIds:[]},outcome:{agreedGoalContextRevision:0,status:'unassessed',summary:'',evidenceIds:[],scope:'goal'}} as ActivationState;
}
async function input(selector:string,value:string){await act(async()=>{const f=host.querySelector<HTMLInputElement>(selector)!;const proto=f.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(f,value);f.dispatchEvent(new Event('input',{bubbles:true}));});}
async function click(label:string){await act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(label))!.click();});}
beforeEach(async()=>{vi.clearAllMocks();vi.mocked(activationClient).mockReturnValue(api);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<ActivationPage/>));await input('input','ledger');await input('input[type=password]','x'.repeat(32));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it('shows contrasting admitted contexts and clears previous customer state',async()=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');expect(host.textContent).toContain('Inspect existing service configuration');
 await input('input','orbit');expect(host.textContent).not.toContain('Inspect existing service configuration');api.read.mockResolvedValue(state('orbit'));await click('Load / refresh');expect(host.textContent).toContain('Prepare a reviewable backend onboarding artifact');expect(host.textContent).toContain('unassessed');
});
it('reloads canonical replan and evidence without claiming a verified outcome',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);await click('Load / refresh');
 api.read.mockResolvedValue({...s,revision:2,planRevision:1,plan:fixtures.blockerReplan.plan,replan:{...s.replan,status:'ready'}});await click('Load / refresh');
 expect(host.textContent).toContain('Prepare a checklist for developer-provided configuration');expect(host.textContent).toContain('Developer reported');expect(host.querySelector('[data-testid=outcome-status]')?.textContent).toBe('unassessed');
});
it('retains the exact blocker across uncertain failure and reload',async()=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');await input('textarea[aria-label="Blocker command"]',JSON.stringify(fixtures.blockerReplan.blocker));api.blocker.mockRejectedValue(new Error('REVISION_CONFLICT'));await click('Submit / retry reviewed blocker');await click('Load / refresh');await click('Submit / retry reviewed blocker');expect(api.blocker).toHaveBeenCalledTimes(2);expect(api.blocker.mock.calls[1][0]).toEqual(api.blocker.mock.calls[0][0]);expect(host.textContent).toContain('REVISION_CONFLICT');
});
it('acknowledges accepted blocker and allows a new draft only after explicit clear',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);api.blocker.mockResolvedValue({...s,revision:1});await click('Load / refresh');
 await input('textarea[aria-label="Blocker command"]',JSON.stringify(fixtures.blockerReplan.blocker));await click('Submit / retry reviewed blocker');
 expect(host.textContent).toContain('Blocker accepted.');expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Submit / retry reviewed blocker'))?.disabled).toBe(true);
 await click('Clear reviewed');expect((host.querySelector('textarea[aria-label="Blocker command"]') as HTMLTextAreaElement).disabled).toBe(false);
});

it('requires separately reported agreement and sends only reviewed published context to the operator client',async()=>{
 await act(async()=>root.render(<ActivationPage surface="operator" key="op"/>));await input('input','ledger');await input('input[type=password]','x'.repeat(32));
 await input('[aria-label="Raw account and call notes"]','PRIVATE commercial context. A new customer needs a reviewable documentation guide.');await click('Preview developer handoff');
 await input('textarea[aria-label="Existing customer briefing"]','A new customer needs a reviewable documentation guide.');
 await input('textarea[aria-label="Agreed activation outcome"]','Review the guide');
 await input('input:not([type])', 'ledger');
 await input('[aria-label="Agreement attribution"]','Customer via Chris');
 expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Publish customer'))?.disabled).toBe(true);
 await act(async()=>{host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();});
 api.intake.mockResolvedValue(state('ledger'));await click('Publish customer');
 expect(api.intake).toHaveBeenCalledWith('A new customer needs a reviewable documentation guide.','Review the guide','Customer via Chris',true);
 expect(host.querySelector('[data-testid=outcome-status]')?.textContent).toBe('unassessed');
});

it('polls pending recovery and stops once a replacement is ready',async()=>{
 vi.useFakeTimers();const s=state('ledger');s.replan.status='pending';api.read.mockResolvedValue(s);await click('Load / refresh');
 api.read.mockResolvedValue({...s,revision:2,replan:{...s.replan,status:'ready'}});
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(api.read).toHaveBeenCalledTimes(2);
 await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});expect(api.read).toHaveBeenCalledTimes(2);vi.useRealTimers();
});
it('preserves both drafts on HTTP 409 and never silently rebases a reviewed command',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);await click('Load / refresh');
 const draft=JSON.stringify(fixtures.blockerReplan.blocker);await input('textarea[aria-label="Blocker command"]',draft);await input('textarea[aria-label="Blocker note"]','Access is denied');
 api.blocker.mockRejectedValue({status:409});await click('Submit / retry reviewed blocker');expect(host.textContent).toContain('Your draft is still here');
 api.read.mockResolvedValue({...s,revision:3});await click('Load / refresh');await click('Submit / retry reviewed blocker');
 expect(api.blocker.mock.calls[1][0]).toEqual(JSON.parse(draft));expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Blocker note"]')?.value).toBe('Access is denied');
});
it.each(['customerId','developerSessionId','expectedRevision','planRevision'])('rejects mismatched reviewed %s before sending',async field=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');const command={...fixtures.blockerReplan.blocker,[field]:field.includes('Revision')?42:'other'};
 await input('textarea[aria-label="Blocker command"]',JSON.stringify(command));await click('Submit / retry reviewed blocker');expect(api.blocker).not.toHaveBeenCalled();expect(host.textContent).toContain('different customer, session, or revision');
});
it('keeps local note review honest and renders proof type separately from outcome',async()=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');await input('textarea[aria-label="Blocker note"]','Cannot inspect');await click('Review blocker');
 expect(host.textContent).toContain('not submitted to the server');expect(api.blocker).not.toHaveBeenCalled();expect(host.textContent).toContain('proof: none');expect(host.textContent).toContain('not checked');
});

it('submits a separately confirmed attributed report and preserves exact retry identity on timeout',async()=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');await input('textarea[aria-label="Blocker note"]','Access denied');await click('Review blocker');expect(api.reportBlocker).not.toHaveBeenCalled();
 const error=new Error('timeout');error.name='TimeoutError';api.reportBlocker.mockRejectedValue(error);await click('Submit / retry attributed');
 expect(host.textContent).toContain('request timed out');const first=api.reportBlocker.mock.calls[0][0];expect(first.message).toBe('Access denied');expect(first.expectedRevision).toBe(0);
 await click('Load / refresh');api.reportBlocker.mockResolvedValue({...state('ledger'),revision:1});await click('Submit / retry attributed');expect(api.reportBlocker.mock.calls[1][0]).toEqual(first);expect(host.textContent).toContain('report saved to the server');
});

it('shows original constraints, exact action proof and safe reference navigation',async()=>{
 const s=state('ledger');const e=structuredClone(s.evidence[0]);e.id='artifact-test';e.kind='action_record';e.proof={type:'artifact',actionId:'review',actionRevision:2,reference:'https://github.com/example/service/pull/1',verifier:'local-check',result:'passed'};
 s.evidence.push(e);s.actions.review={kind:'prepare_artifact',revision:2,status:'prepared',at:'2026-10-27T00:00:00Z',planRevision:0,blockedByIds:[],evidenceIds:[e.id]};api.read.mockResolvedValue(s);await click('Load / refresh');
 expect(host.textContent).toContain(s.context.briefing);for(const constraint of s.context.constraints)expect(host.textContent).toContain(constraint);
 expect(host.querySelector('a[href="#evidence-artifact-test"]')).not.toBeNull();expect(host.querySelector('a[href="https://github.com/example/service/pull/1"]')?.textContent).toBe('Inspect proof reference');expect(host.textContent).toContain('Action: review · revision 2');expect(host.textContent).toContain('does not fetch or execute');
});

it('submits progress explicitly, keeps exact retries and renders canonical reported outcome',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);await click('Load / refresh');await click('Draft my plan review');expect(api.reportProgress).not.toHaveBeenCalled();
 const error=new Error('timeout');error.name='TimeoutError';api.reportProgress.mockRejectedValue(error);await click('Submit / retry progress report');
 const first=api.reportProgress.mock.calls[0][0];expect(first.message).toContain('reviewed plan revision 0');expect(first.expectedRevision).toBe(0);
 api.read.mockResolvedValue({...s,revision:2});await click('Load / refresh');api.reportProgress.mockResolvedValue({...s,revision:3,outcome:{...s.outcome,status:'reported',summary:first.message}});await click('Submit / retry progress report');
 expect(api.reportProgress.mock.calls[1][0]).toEqual(first);expect(host.querySelector('[data-testid=outcome-status]')?.textContent).toBe('reported');expect(host.textContent).toContain('Progress report saved');
});
it('clears operator raw notes and initialization on customer change',async()=>{
 await act(async()=>root.render(<ActivationPage surface="operator" key="op"/>));await input('input','ledger');await input('input[type=password]','x'.repeat(32));
 await input('[aria-label="Raw account and call notes"]','Private customer text');await click('Preview developer handoff');await input('[aria-label="Admitted initialization"]','Private wrapper');
 await input('input','orbit');expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Raw account and call notes"]')?.value).toBe('');expect(host.querySelector('[aria-label="Existing customer briefing"]')).toBeNull();expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Admitted initialization"]')?.value).toBe('');
});
it('rejects cross-customer action progress before sending',async()=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');await input('[aria-label="Progress command"]',JSON.stringify({customerId:'orbit'}));await click('Submit / retry reviewed progress');expect(api.progress).not.toHaveBeenCalled();expect(host.textContent).toContain('different customer, session, milestone');
});

it('sends exact reviewed action progress across a conflict and canonical refresh',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);await click('Load / refresh');
 const command={contractVersion:'1.0.0',customerId:'ledger',developerSessionId:'session-ledger',expectedRevision:0,revision:1,planRevision:0,milestoneId:s.milestone.id,id:'reviewed-progress',evidence:[],transitions:[],milestoneStatus:'in_progress',valueDemonstrated:'',needsChris:false};
 await input('[aria-label="Progress command"]',JSON.stringify(command));api.progress.mockRejectedValue({status:409});await click('Submit / retry reviewed progress');
 api.read.mockResolvedValue({...s,revision:3});await click('Load / refresh');api.progress.mockResolvedValue({...s,revision:4});await click('Submit / retry reviewed progress');expect(api.progress.mock.calls[1][0]).toEqual(command);expect(host.textContent).toContain('Reviewed action progress saved.');
});

it('preserves preparation command on uncertain failure and clears it with customer identity',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);await click('Load / refresh');api.prepareGitHub.mockRejectedValue(new Error('TimeoutError'));
 await click('Inspect / retry');const first=api.prepareGitHub.mock.calls[0][0];api.read.mockResolvedValue({...s,revision:3});await click('Load / refresh');await click('Inspect / retry');expect(api.prepareGitHub.mock.calls[1][0]).toEqual(first);
 await input('input','orbit');api.read.mockResolvedValue(state('orbit'));await click('Load / refresh');await click('Inspect / retry');expect(api.prepareGitHub.mock.calls[2][0].actionId).toBe(fixtures.orbit.plan.suggestedNextAction.id);expect(api.prepareGitHub.mock.calls[2][0].id).not.toBe(first.id);
});
it('shows prepared packet provenance and missing authorization without promoting outcome or action',async()=>{
 const s=state('ledger');s.githubPreparations={'prepare:demo':{id:'prepare:demo',commandDigest:'digest',scopeDigest:'scope',actionId:s.plan.suggestedNextAction.id,actionRevision:0,planRevision:0,startedRevision:1,status:'prepared',repository:'example/fictional',commit:'a'.repeat(40),templatePath:'template.yaml',templateBlob:'b'.repeat(40),observedAt:'2026-10-27T10:00:00Z',completedAt:'2026-10-27T10:01:00Z',evidenceIds:[],artifact:'Fictional review packet',artifactDigest:'digest',blockers:['Separate write authorization missing'],errorCode:null,authorization:'inspect_prepare_only',approved:false,executed:false,verified:false,prUrl:null}};
 api.read.mockResolvedValue(s);await click('Load / refresh');expect(host.textContent).toContain('prepared · local review packet');expect(host.textContent).toContain('Separate write authorization missing');expect(host.textContent).toContain('Proposal approval: pending explicit approval. Execution: absent. Verified action: no. PR: none.');expect(host.querySelector('[data-testid=outcome-status]')?.textContent).toBe('unassessed');
});

it('resumes the exact persisted inspection command after a browser restart',async()=>{
 const s=state('ledger');s.revision=7;s.githubPreparations={'prepare:resume':{id:'prepare:resume',commandDigest:'digest',scopeDigest:'scope',actionId:s.plan.suggestedNextAction.id,actionRevision:0,planRevision:0,startedRevision:3,status:'inspecting',repository:'example/fictional',commit:'a'.repeat(40),templatePath:'template.yaml',templateBlob:null,observedAt:'2026-10-27T10:00:00Z',completedAt:null,evidenceIds:[],artifact:null,artifactDigest:null,blockers:['pending'],errorCode:null,authorization:'inspect_prepare_only',approved:false,executed:false,verified:false,prUrl:null}};
 api.read.mockResolvedValue(s);api.prepareGitHub.mockResolvedValue(s);await click('Load / refresh');await click('Resume saved inspection');expect(api.prepareGitHub).toHaveBeenCalledWith({id:'prepare:resume',expectedRevision:2,planRevision:0,actionId:s.plan.suggestedNextAction.id,actionRevision:0});
});

it('requires explicit artifact review, preserves exact approval retries, and shows acceptance without execution',async()=>{
 const s=state('ledger');s.revision=2;const id='prepare:setup',digest='d'.repeat(64);
 const packet={id,commandDigest:'command',scopeDigest:'scope',actionId:s.plan.suggestedNextAction.id,actionRevision:0,planRevision:0,startedRevision:1,status:'prepared' as const,repository:'example/fictional',commit:'a'.repeat(40),templatePath:'template.yaml',templateBlob:'b'.repeat(40),observedAt:'2026-10-27T10:00:00Z',completedAt:'2026-10-27T10:01:00Z',evidenceIds:[],artifact:'Fictional setup',artifactDigest:digest,blockers:['Missing skeletons'],errorCode:null,authorization:'inspect_prepare_only' as const,approved:false as const,executed:false as const,verified:false as const,prUrl:null,
 setupProposal:{version:1 as const,sourceTree:'c'.repeat(40),kind:'fictional_recommendation_service_setup' as const,targetPath:'.portal/recommendation-service.setup.json',proposedFile:'{}',diff:'+++ b/.portal/recommendation-service.setup.json',templateReview:'reviewed_known_template' as const,dependencies:[{path:'skeletons/node',status:'missing' as const,source:'https://github.com/example/fictional/tree/'+ 'a'.repeat(40)+'/skeletons/node'}],missingPrerequisites:['Missing skeletons','Installed action schemas unknown'],semantics:['Needs review'],readyToRun:false as const}};
 s.githubPreparations={[id]:packet};api.read.mockResolvedValue(s);await click('Load / refresh');
 expect(host.textContent).toContain('Missing prerequisites and blockers');expect(host.textContent).toContain('Installed action schemas unknown');expect(host.textContent).toContain('+++ b/.portal/recommendation-service.setup.json');
 const button=()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Accept / retry setup'))!;
 expect(button().disabled).toBe(true);await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Reviewed proposal prepare:setup"]')!.click());
 const error=new Error('timeout');error.name='TimeoutError';api.acceptSetupProposal.mockRejectedValue(error);await click('Accept / retry setup');const first=api.acceptSetupProposal.mock.calls[0][0];
 expect(first).toMatchObject({expectedRevision:2,preparationId:id,artifactDigest:digest,sourceCommit:packet.commit,decision:'accept_proposal_only'});
 api.read.mockResolvedValue({...s,revision:3});await click('Load / refresh');await click('Accept / retry setup');expect(api.acceptSetupProposal.mock.calls[1][0]).toEqual(first);
 api.acceptSetupProposal.mockResolvedValue({...s,revision:3,githubPreparations:{[id]:{...packet,proposalApproval:{decision:'accept_proposal_only',artifactDigest:digest,sourceCommit:packet.commit,planRevision:0,actionRevision:0,acceptedAt:'2026-10-27T12:00:00Z'}}}});await click('Accept / retry setup');
 expect(host.textContent).toContain('accepted for review only');expect(host.textContent).toContain('all runtime blockers remain');expect(host.textContent).toContain('Execution: absent. Verified action: no');expect(host.querySelector('[data-testid="outcome-status"]')?.textContent).toBe('unassessed');
 await input('input','orbit');expect(host.textContent).not.toContain('Missing skeletons');
});

it('edits and copies a local champion message, clearing it on customer or token change',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);await click('Load / refresh');
 expect(host.querySelector('[aria-label="Bring Your Team Along"]')).toBeNull();await click('Accept this onboarding direction');expect(host.querySelector('[aria-label="Bring Your Team Along"]')).not.toBeNull();expect(host.querySelector('[aria-label="Chris team handoff summary"]')).toBeNull();
 const copy=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});
 await input('[aria-label="Champion kickoff message"]','Private ledger kickoff');await click('Copy kickoff');expect(copy).toHaveBeenCalledWith('Private ledger kickoff');expect(host.textContent).toContain('Message copied');expect(api.reportProgress).not.toHaveBeenCalled();
 await input('input','orbit');expect(host.querySelector('[aria-label="Champion kickoff message"]')).toBeNull();api.read.mockResolvedValue(state('orbit'));await click('Load / refresh');expect(host.querySelector('[aria-label="Champion kickoff message"]')).toBeNull();await click('Accept this onboarding direction');expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Champion kickoff message"]')?.value).not.toContain('Private ledger');
 await input('input[type=password]','y'.repeat(32));expect(host.querySelector('[aria-label="Champion kickoff message"]')).toBeNull();
});
it('refreshes the champion draft against new canonical evidence and handles unavailable clipboard',async()=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');await click('Accept this onboarding direction');await input('[aria-label="Champion kickoff message"]','Old draft');
 const s=state('ledger');s.revision=1;s.milestone.status='blocked';api.read.mockResolvedValue(s);await click('Load / refresh');expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Champion kickoff message"]')?.value).toContain('Review blockers');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(Error('denied'))}});await click('Copy kickoff');expect(host.textContent).toContain('Select and copy');
});
