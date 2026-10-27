// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ActivationPage} from './ActivationPage';
import {activationClient} from './client';
import fixtures from '../../../../contracts/activation/v1/fixtures.json';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
const api={intake:vi.fn(),read:vi.fn(),initialize:vi.fn(),blocker:vi.fn(),progress:vi.fn(),reportBlocker:vi.fn()};
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
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');await input('textarea[aria-label="Blocker command"]',JSON.stringify(fixtures.blockerReplan.blocker));api.blocker.mockRejectedValue(new Error('REVISION_CONFLICT'));await click('Submit / retry');await click('Load / refresh');await click('Submit / retry');expect(api.blocker).toHaveBeenCalledTimes(2);expect(api.blocker.mock.calls[1][0]).toEqual(api.blocker.mock.calls[0][0]);expect(host.textContent).toContain('REVISION_CONFLICT');
});
it('acknowledges accepted blocker and allows a new draft only after explicit clear',async()=>{
 const s=state('ledger');api.read.mockResolvedValue(s);api.blocker.mockResolvedValue({...s,revision:1});await click('Load / refresh');
 await input('textarea[aria-label="Blocker command"]',JSON.stringify(fixtures.blockerReplan.blocker));await click('Submit / retry');
 expect(host.textContent).toContain('Blocker accepted.');expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Submit / retry'))?.disabled).toBe(true);
 await click('Clear reviewed');expect((host.querySelector('textarea[aria-label="Blocker command"]') as HTMLTextAreaElement).disabled).toBe(false);
});

it('requires separately reported agreement and sends pasted intake to the isolated client',async()=>{
 await input('textarea[aria-label="Existing customer briefing"]','A new customer needs a reviewable documentation guide.');
 await input('textarea[aria-label="Agreed activation outcome"]','Review the guide');
 await input('input:not([type])', 'ledger');
 await input('details input:not([type])','Customer via Chris');
 expect(Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Create suggested'))?.disabled).toBe(true);
 await act(async()=>{host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();});
 api.intake.mockResolvedValue(state('ledger'));await click('Create suggested');
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
 api.blocker.mockRejectedValue({status:409});await click('Submit / retry');expect(host.textContent).toContain('Your draft is still here');
 api.read.mockResolvedValue({...s,revision:3});await click('Load / refresh');await click('Submit / retry');
 expect(api.blocker.mock.calls[1][0]).toEqual(JSON.parse(draft));expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Blocker note"]')?.value).toBe('Access is denied');
});
it.each(['customerId','developerSessionId','expectedRevision','planRevision'])('rejects mismatched reviewed %s before sending',async field=>{
 api.read.mockResolvedValue(state('ledger'));await click('Load / refresh');const command={...fixtures.blockerReplan.blocker,[field]:field.includes('Revision')?42:'other'};
 await input('textarea[aria-label="Blocker command"]',JSON.stringify(command));await click('Submit / retry');expect(api.blocker).not.toHaveBeenCalled();expect(host.textContent).toContain('different customer, session, or revision');
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
