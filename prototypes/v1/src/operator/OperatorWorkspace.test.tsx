// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {OperatorWorkspace} from './OperatorWorkspace';
import {activationClient,ActivationRequestError} from '../activation/client';
import {byLabel,click,fixtureState,flush,mockApi,mount,type} from '../activation/testing';

vi.mock('../activation/client',async orig=>({...(await orig<typeof import('../activation/client')>()),activationClient:vi.fn()}));
let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>;
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({accounts:[{id:'north',label:'Northstar',user:'Dev',customerId:'fictional-north'}]}))));
 api=mockApi();vi.mocked(activationClient).mockReturnValue(api);
 m=mount();await m.render(<OperatorWorkspace/>);await flush();
});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});

async function open(){await type(byLabel(m.host,'Operator access token')!,'o'.repeat(40));await click(m.host,'Open workspace');await flush();}

it('routes a configured account through the operator proxy with the typed token only',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await open();
 expect(activationClient).toHaveBeenLastCalledWith('fictional-north','o'.repeat(40),'','/operator-api/north');
 expect(m.host.textContent).toContain('Activation at a glance');
 expect(m.host.textContent).not.toContain('Bring your team along');
});

it('publishes only the reviewed developer-visible text after explicit confirmation',async()=>{
 api.read.mockRejectedValue(new ActivationRequestError('NOT_FOUND',404));await open();
 await type(byLabel<HTMLTextAreaElement>(m.host,'Raw account and call notes')!,'PRIVATE pricing: 20% discount.\nExisting Node.js service on GitHub; SSO uses Okta.');
 await click(m.host,'Organize notes');
 expect(byLabel<HTMLTextAreaElement>(m.host,'Developer-visible customer context')!.value).toBe('Existing Node.js service on GitHub; SSO uses Okta.');
 expect(m.host.querySelector('[aria-label="Held back"]')!.textContent).toContain('PRIVATE pricing');
 await type(byLabel<HTMLTextAreaElement>(m.host,'Agreed activation outcome')!,'Onboard the existing service');
 await type(byLabel(m.host,'Agreement attribution')!,'Platform lead, trial call');
 const publish=()=>Array.from(m.host.querySelectorAll('button')).find(b=>b.textContent==='Publish to developers')!;
 expect(publish().disabled).toBe(true);
 await click(m.host,'Publish to developers');expect(api.intake).not.toHaveBeenCalled();
 const check=m.host.querySelector<HTMLInputElement>('.op-check input')!;await (await import('react')).act(async()=>{check.click();});
 api.intake.mockRejectedValue(new ActivationRequestError('REVISION_CONFLICT',409));
 await click(m.host,'Publish to developers');
 expect(api.intake).toHaveBeenCalledWith('Existing Node.js service on GitHub; SSO uses Okta.','Onboard the existing service','Platform lead, trial call',true);
 // A conflict keeps the reviewed draft on screen.
 expect(m.host.textContent).toContain('changed elsewhere');
 expect(byLabel<HTMLTextAreaElement>(m.host,'Developer-visible customer context')!.value).toContain('Okta');
});

it('shows follow-up and reported outcome text without claiming verification',async()=>{
 const s=fixtureState('orbit',{chrisHelp:{status:'requested',blockerIds:['developer:a'],owner:'Chris',reason:'Review the developer report',evidenceIds:[]},outcome:{agreedGoalContextRevision:0,status:'reported',summary:'Which repo?',evidenceIds:[],scope:'goal'}});
 api.read.mockResolvedValue(s);await open();
 expect(m.host.textContent).toContain('Chris intervention requested');
 expect(m.host.textContent).toContain('Latest reported outcome text: “Which repo?”');
 expect(m.host.querySelector('[aria-label="Chris team handoff summary"]')!.textContent).toContain('not');
});
