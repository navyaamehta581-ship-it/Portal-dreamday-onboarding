// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import type {AikaJob} from '../../../../../contracts/activation/v1/handoff';
import {byLabel,click,flush,mockApi,mount,type} from '../../activation/testing';
import {useMilestoneWork} from '../work/useMilestoneWork';
import {AikaPage} from './AikaPage';

let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>;
const job=(patch:Partial<AikaJob>):AikaJob=>({id:'j1',status:'running',question:'What should I do next on this milestone?',milestoneId:'m-1',startedAt:'2026-10-29T11:00:00Z',elapsedMs:0,answer:null,error:null,model:'qwen3:1.7b',...patch});
function Harness(){const work=useMilestoneWork(api as never);return <AikaPage api={api as never} work={work}/>;}
const text=()=>m.host.textContent??'';
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api=mockApi();m=mount();
 api.milestoneWork.mockResolvedValue({viewer:{role:'developer',name:'Alex Rivera'},approval:{by:'Maya Chen',at:'2026-10-29T10:00:00Z'},objective:null,
  milestones:[{id:'m-1',title:'Assess payments-api repository readiness',assignee:'Alex Rivera',status:'in_progress',openBlockers:0,mine:true,dependsOn:[],detail:{description:'',system:null,actions:[],completionCriteria:[],updates:[],revision:1,updatedAt:null,updatedBy:null}}]});});
afterEach(async()=>{vi.useRealTimers();await m.unmount();vi.unstubAllGlobals();});

it('asks through the Portal API, shows progress while it runs, then labelled sections and what was removed',async()=>{
 window.history.replaceState(null,'','/aika?milestone=m-1');
 await m.render(<Harness/>);await flush();await flush();
 expect(byLabel<HTMLSelectElement>(m.host,'Milestone for AiKA')!.value).toBe('m-1');
 api.askAika.mockResolvedValue({job:job({}),duplicate:false});
 api.aikaStatus.mockResolvedValueOnce({job:job({elapsedMs:2000})}).mockResolvedValue({job:job({status:'succeeded',elapsedMs:4200,answer:{sections:[
  {kind:'known',text:'Your milestone is to assess payments-api readiness.'},{kind:'reported',text:'Alex reported a missing CODEOWNERS file.'},
  {kind:'suggestion',text:'Start with the repository settings.'},{kind:'unknown',text:'Which CI deploys it; ask Maya.'}],nextStep:'Mark action 1 started.',removed:1}})});
 vi.useFakeTimers();
 await click(m.host,'What should I do next on this milestone?');
 expect(api.askAika).toHaveBeenCalledWith('What should I do next on this milestone?','m-1');
 expect(text()).toContain('AiKA is working on your question');
 expect(m.host.querySelector('[aria-label="Question for AiKA"]')!.hasAttribute('disabled')).toBe(true);
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 expect(text()).toContain('Thinking… 2s');
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 const pills=Array.from(m.host.querySelectorAll('.pt-aika-sections .pt-pill')).map(p=>p.textContent);
 expect(pills).toEqual(['Known','Reported','Suggestion','Unknown']);
 expect(text()).toContain('Mark action 1 started.');expect(text()).toContain('1 part was removed');expect(text()).toContain('nothing here was inspected or verified by AiKA');
 expect(text()).toContain('Answered in 4s');
});

it('reports failures and timeouts as plain messages, and an unconfigured model as unavailable',async()=>{
 await m.render(<Harness/>);await flush();
 api.askAika.mockRejectedValueOnce(new Error('AIKA_UNAVAILABLE'));
 await type(byLabel<HTMLTextAreaElement>(m.host,'Question for AiKA')!,'What does my milestone depend on?');
 await click(m.host,'Ask AiKA');await flush();
 expect(text()).toContain('AiKA isn’t connected to a model on this Portal');
 api.askAika.mockResolvedValue({job:job({}),duplicate:false});
 api.aikaStatus.mockResolvedValue({job:job({status:'failed',error:'MODEL_TIMEOUT',elapsedMs:120000})});
 vi.useFakeTimers();
 await click(m.host,'Ask AiKA');
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 expect(m.host.querySelector('[role=alert]')!.textContent).toContain('AiKA took too long to answer');
 expect(m.host.querySelector('[aria-label="Question for AiKA"]')!.hasAttribute('disabled')).toBe(false);
});
