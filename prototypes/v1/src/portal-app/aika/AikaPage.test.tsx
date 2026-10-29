// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import type {AikaCapability,AikaJob} from '../../../../../contracts/activation/v1/handoff';
import {byLabel,click,flush,mockApi,mount,type} from '../../activation/testing';
import {useMilestoneWork} from '../work/useMilestoneWork';
import {useRepositoryEvidence} from '../work/useRepositoryEvidence';
import type {Persona} from '../session';
import {AikaPage} from './AikaPage';
import {AikaDock} from './AikaDock';
import {useAika} from './useAika';

let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>;
const alex:Persona={id:'alex',name:'Alex Rivera',role:'developer',title:'Developer',customers:[{id:'aperture',label:'Aperture Commerce',customerId:'fictional-aperture-commerce'}]};
const job=(patch:Partial<AikaJob>):AikaJob=>({id:'j1',status:'running',question:'What should I do next on this milestone?',milestoneId:'m-1',startedAt:'2026-10-29T11:00:00Z',elapsedMs:0,answer:null,error:null,model:'gemini-2.5-flash',...patch});
const cap=(id:AikaCapability['id'],available=true):AikaCapability=>({id,label:'/'+id,description:`About ${id}`,available,reason:available?null:'Not available'});
function Harness({dock=false}:{dock?:boolean}){
 const work=useMilestoneWork(api as never),repos=useRepositoryEvidence(api as never),aika=useAika(api as never);
 return <>{dock?<AikaDock aika={aika} repos={repos} persona={alex}/>:<AikaPage aika={aika} work={work} repos={repos} persona={alex}/>}</>;
}
const text=()=>m.host.textContent??'';
const area=()=>byLabel<HTMLTextAreaElement>(m.host,'Question for AiKA')!;
async function key(k:string,shift=false){await act(async()=>{area().dispatchEvent(new KeyboardEvent('keydown',{key:k,shiftKey:shift,bubbles:true,cancelable:true}));});}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api=mockApi();m=mount();
 api.aikaCapabilities.mockResolvedValue({capabilities:[cap('onboarding'),cap('my-work'),cap('repository'),cap('team'),cap('docs',false)],modelConfigured:true});
 api.milestoneWork.mockResolvedValue({viewer:{role:'developer',name:'Alex Rivera'},approval:{by:'Maya Chen',at:'2026-10-29T10:00:00Z'},objective:null,
  milestones:[{id:'m-1',title:'Assess payments-api repository readiness',assignee:'Alex Rivera',status:'in_progress',openBlockers:0,mine:true,dependsOn:[],detail:{description:'',system:null,actions:[],completionCriteria:[],updates:[],revision:1,updatedAt:null,updatedBy:null}}]});});
afterEach(async()=>{vi.useRealTimers();await m.unmount();vi.unstubAllGlobals();});

it('keeps the original AiKA page: greeting, composer, suggestion cards, History shown as unavailable, and who you are asking',async()=>{
 window.history.replaceState(null,'','/aika');
 await m.render(<Harness/>);await flush();await flush();
 expect(text()).toContain('Hello Alex,');expect(text()).toContain('What can I help you with?');
 const history=Array.from(m.host.querySelectorAll('button')).find(b=>b.textContent==='History')!;
 expect(history.disabled).toBe(true);expect(history.title).toContain('isn’t available in this demo');
 expect(m.host.querySelectorAll('.pt-aika-grid button').length).toBe(4);
 expect(text()).toContain('You’re asking AiKA, not a person. To ask Maya, record a question on your milestone in My work.');
});

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
 expect(api.askAika).toHaveBeenCalledWith('What should I do next on this milestone?','m-1',[]);
 expect(text()).toContain('AiKA is working on your question');
 expect(area().hasAttribute('disabled')).toBe(true);
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 expect(text()).toContain('Thinking… 2s');
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 expect(Array.from(m.host.querySelectorAll('.pt-aika-sections .pt-pill')).map(p=>p.textContent)).toEqual(['Known','Reported','Suggestion','Unknown']);
 expect(text()).toContain('Mark action 1 started.');expect(text()).toContain('1 part was removed');expect(text()).toContain('AiKA itself inspected nothing');
 expect(text()).toContain('Answered in 4s');
});

it('the “/” menu: only usable capabilities, filtered as you type, keyboard selection, removable chips, sent with the question',async()=>{
 window.history.replaceState(null,'','/aika');
 await m.render(<Harness/>);await flush();await flush();
 await type(area(),'/');
 const options=()=>Array.from(m.host.querySelectorAll('[role=option]')).map(o=>o.querySelector('strong')!.textContent);
 // /docs is unavailable, so it isn't offered.
 expect(options()).toEqual(['/onboarding','/my-work','/repository','/team']);
 await type(area(),'/re');expect(options()).toEqual(['/repository']);
 await type(area(),'Who owns it? /t');expect(options()).toEqual(['/team']);
 await key('Enter');
 expect(options()).toEqual([]);expect(area().value).toBe('Who owns it? ');
 expect(m.host.querySelector('.pt-aika-chips .pt-aika-chip')!.textContent).toContain('/team');
 // Arrow keys move the selection; Escape closes without picking.
 await type(area(),'Who owns it? /');await key('ArrowDown');
 expect(m.host.querySelector('[role=option][aria-selected=true] strong')!.textContent).toBe('/my-work');
 await key('Escape');expect(options()).toEqual([]);expect(area().value).toBe('Who owns it? ');
 await type(area(),'Who owns it? /rep');await key('Tab');
 expect(Array.from(m.host.querySelectorAll('.pt-aika-chips .pt-aika-chip')).map(c=>c.textContent)).toEqual(['/team','/repository']);
 await click(m.host,'Remove /team');
 expect(Array.from(m.host.querySelectorAll('.pt-aika-chips .pt-aika-chip')).map(c=>c.textContent)).toEqual(['/repository']);
 api.askAika.mockResolvedValue({job:job({question:'Who owns it?',capabilities:['repository']}),duplicate:false});
 await key('Enter');await flush();
 expect(api.askAika).toHaveBeenCalledWith('Who owns it?',null,['repository']);
 expect(m.host.querySelector('.pt-aika-user small')!.textContent).toBe('/repository');
 expect(m.host.querySelectorAll('.pt-aika-chips .pt-aika-chip').length).toBe(0);
});

it('reports failures and timeouts as plain messages, and an unconfigured model as unavailable',async()=>{
 window.history.replaceState(null,'','/aika');
 await m.render(<Harness/>);await flush();
 api.askAika.mockRejectedValueOnce(new Error('AIKA_UNAVAILABLE'));
 await type(area(),'What does my milestone depend on?');
 await click(m.host,'Ask AiKA');await flush();
 expect(text()).toContain('AiKA isn’t connected to a model on this Portal');
 api.askAika.mockResolvedValue({job:job({}),duplicate:false});
 api.aikaStatus.mockResolvedValue({job:job({status:'failed',error:'MODEL_TIMEOUT',elapsedMs:120000})});
 vi.useFakeTimers();
 await click(m.host,'Ask AiKA');
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 expect(Array.from(m.host.querySelectorAll('[role=alert]')).at(-1)!.textContent).toContain('AiKA took too long to answer');
 expect(area().hasAttribute('disabled')).toBe(false);
});

it('shows verified repository claims with the observation they cite, and sample claims as sample data',async()=>{
 window.history.replaceState(null,'','/aika');
 const obs=(id:string,mode:'live'|'fixture',signal:string)=>({id,signal,status:'observed',mode,summary:'s',details:[],limitation:null,source:{kind:mode==='live'?'github_api':'fixture',request:'GET /repos/x',path:null,url:null},repository:'example-org/payments-api',commit:'a'.repeat(40),retrievedAt:'2026-10-29T12:00:00Z'});
 api.repositoryEvidence.mockResolvedValue({repositories:[{id:'payments-api',label:'payments-api',repository:'example-org/payments-api',mode:'live',canInspect:true,milestones:[],latest:null,stale:false,maxAgeHours:24,
  evidence:{id:'i',repositoryId:'payments-api',repository:'example-org/payments-api',mode:'live',status:'succeeded',errorCode:null,retryAfter:null,defaultBranch:'main',commit:'a'.repeat(40),startedAt:'',completedAt:'',requestedBy:'Alex Rivera',observations:[obs('obs-aaaaaaaaaa','live','codeowners')]}}]});
 api.aikaStatus.mockResolvedValue({job:job({status:'succeeded',elapsedMs:1000,answer:{sections:[{kind:'verified',text:'CODEOWNERS names the payments team.',citations:['obs-aaaaaaaaaa']},{kind:'sample',text:'Sample metadata names team-checkout.',citations:['obs-bbbbbbbbbb']}],nextStep:null,removed:2}})});
 await m.render(<Harness/>);await flush();await flush();await flush();
 const items=Array.from(m.host.querySelectorAll('.pt-aika-sections li'));
 expect(items.map(li=>li.querySelector('.pt-pill')!.textContent)).toEqual(['Verified · repository','Sample data']);
 expect(items[0].querySelector('[data-testid=aika-citations]')!.textContent).toContain('CODEOWNERS (ownership) (live, example-org/payments-api@aaaaaaaaaaaa');
 expect(items[1].querySelector('[data-testid=aika-citations]')!.textContent).toContain('recorded observation obs-bbbbbbbbbb');
 expect(m.host.querySelectorAll('.pt-aika-ref').length).toBe(2);
 expect(text()).toContain('2 parts were removed');
});

it('contextual AiKA (055): the corner mark opens “New AiKA Chat”, which asks through the same service',async()=>{
 await m.render(<Harness dock/>);await flush();
 expect(m.host.querySelector('[aria-label="Contextual AiKA"]')).toBeNull();
 await click(m.host,'Open AiKA');
 expect(text()).toContain('New AiKA Chat');
 api.askAika.mockResolvedValue({job:job({question:'What does my milestone depend on, and is it ready?',capabilities:['my-work']}),duplicate:false});
 await click(m.host,/\/my-work What does my milestone depend on/);await flush();
 expect(api.askAika).toHaveBeenCalledWith('What does my milestone depend on, and is it ready?',null,['my-work']);
 await click(m.host,'Minimize AiKA');expect(m.host.querySelector('[aria-label="Contextual AiKA"]')).toBeNull();
});
