// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {Insights} from '../../../../../contracts/activation/v1/handoff';
import {flush,mockApi,mount} from '../../activation/testing';
import {InsightsPage} from './InsightsPage';

let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>;
const text=()=>m.host.textContent??'';
const base=(patch:Partial<Insights>={}):Insights=>({generatedAt:'2026-10-29T12:00:00Z',viewer:{role:'champion',name:'Maya Chen'},
 plan:{approved:true,approvedBy:'Maya Chen',approvedAt:'2026-10-29T10:00:00Z',stage:'published'},
 summary:{milestones:2,notStarted:0,inProgress:1,blocked:1,readyForReview:0,completed:0,reviewed:0,awaitingReview:0,openBlockers:1,openQuestions:1,openFollowUps:0,actionsCompleted:1,actionsTotal:5,overdue:null},
 milestones:[{id:'m-1',title:'Assess payments-api repository readiness',assignee:'Alex Rivera',status:'blocked',reviewState:'none',actionsCompleted:1,actionsTotal:3,openBlockers:1,openQuestions:0,lastActivityAt:'2026-10-29T11:00:00Z'}],
 activity:[{name:'Alex Rivera',role:'developer',actionChanges:1,updates:0,blockers:1,questions:0,replies:0,coordination:0,reviews:0,lastActiveAt:'2026-10-29T11:00:00Z'},{name:'Maya Chen',role:'champion',actionChanges:0,updates:0,blockers:0,questions:0,replies:1,coordination:0,reviews:0,lastActiveAt:'2026-10-29T11:30:00Z'}],
 reportedReferences:1,evidence:[{id:'payments-api',label:'payments-api',repository:'aperture-commerce/payments-api',mode:'fixture',inspected:true,lastInspectedAt:'2026-10-29T11:10:00Z',stale:false,lastAttemptFailed:false,observed:7,notFound:2,notReadable:0,notInspected:1}],...patch});
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api=mockApi();m=mount();});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});

it('shows the server’s numbers with demo, sample and reported labels; no deadlines, no estimates',async()=>{
 api.insights.mockResolvedValue(base());
 await m.render(<InsightsPage api={api as never} customer="Aperture Commerce (fictional)" demo/>);await flush();await flush();
 expect(text()).toContain('Fictional demo data');expect(text()).toContain('Approved by Maya Chen');expect(text()).toContain('Stage: Approved and published');
 expect(m.host.querySelector('[aria-label="Progress summary"]')!.textContent).toContain('Actions done1 of 5');
 expect(text()).toContain('nothing is shown as overdue');
 expect(m.host.querySelector('[aria-label="Activity"]')!.textContent).toContain('Team activity');
 expect(text()).toContain('Maya Chen (Champion)');expect(text()).toContain('1 evidence reference reported by developers (not verified)');
 expect(m.host.querySelector('[aria-label="Evidence coverage"]')!.textContent).toContain('Sample data');
});

it('a developer sees their own activity; before approval there is nothing to count',async()=>{
 api.insights.mockResolvedValue(base({viewer:{role:'developer',name:'Alex Rivera'},plan:{approved:true,approvedBy:'Maya Chen',approvedAt:'2026-10-29T10:00:00Z',stage:null},activity:[base().activity[0]],reportedReferences:0}));
 await m.render(<InsightsPage api={api as never} customer="Aperture" demo={false}/>);await flush();await flush();
 expect(text()).toContain('Your activity');expect(text()).not.toContain('Maya Chen (Champion)');expect(text()).not.toContain('Stage:');expect(text()).not.toContain('Fictional demo data');
 await m.unmount();m=mount();
 api.insights.mockResolvedValue(base({plan:{approved:false,approvedBy:null,approvedAt:null,stage:'submitted'},summary:null,milestones:[],activity:[],evidence:[]}));
 await m.render(<InsightsPage api={api as never} customer="Aperture" demo/>);await flush();await flush();
 expect(text()).toContain('Not approved yet');expect(text()).toContain('Waiting for Champion review');
 expect(m.host.querySelector('[aria-label="Progress summary"]')).toBeNull();
 expect(text()).toContain('No repository is configured');
});
