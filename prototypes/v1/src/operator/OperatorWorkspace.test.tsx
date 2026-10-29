// @vitest-environment happy-dom
import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {OperatorWorkspace} from './OperatorWorkspace';
import {activationClient,ActivationRequestError} from '../activation/client';
import {byLabel,click,fixtureState,flush,mockApi,mount,type} from '../activation/testing';
import type {AnalysisJob,HandoffOverview,HandoffRecord,ReviewDraft,SourceInput} from '../../../../contracts/activation/v1/handoff';
import type {Persona} from '../portal-app/session';
import {interpretRuleBased} from '../../../../services/workflow-api/src/activation/handoff/interpret';
import {proposeMilestones} from '../../../../services/workflow-api/src/activation/handoff/milestones';
import {reviewFromAnalysis} from '../../../../services/workflow-api/src/activation/handoff/review';

vi.mock('../activation/client',async orig=>({...(await orig<typeof import('../activation/client')>()),activationClient:vi.fn()}));
let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>|null,changed:ReturnType<typeof vi.fn<()=>void>>;
const chris:Persona={id:'chris',name:'Chris',role:'operator',title:'Spotify account operator',customers:[{id:'north',label:'Northstar',customerId:'fictional-north'},{id:'lumen',label:'Lumen',customerId:'fictional-lumen'}]};

// A realistic draft: the analysis of real fixture text, with a second milestone so ordering and dependencies matter.
const SOURCES:SourceInput[]=[{id:'s1',type:'conversation',label:'Discovery call',text:'We keep walking teams through the same setup. Start with checkout-api in repo northstar/checkout-api on GitHub. Nobody knows who owns it.'},
 {id:'s2',type:'chris_notes',label:'My notes',text:'PRIVATE pricing: 20% discount.'}];
function record(patch:Partial<HandoffRecord>={}):HandoffRecord{
 const understanding=interpretRuleBased(SOURCES),proposal=proposeMilestones(understanding),review=reviewFromAnalysis({understanding,proposal});
 const second={...review.milestones[0],id:'model-2',title:'Validate checkout-api discoverability',actions:['Search the Catalog for checkout-api'],completionCriteria:['checkout-api is found from Catalog search'],dependsOn:[review.milestones[0].id]};
 return {draft:1,status:'draft',createdAt:'2026-10-29T00:00:00Z',publishedVersion:null,publishedAt:null,sources:SOURCES,understanding,proposal,developer:null,
  review:{...review,milestones:[review.milestones[0],second]},reviewRevision:0,basedOnWorkspaceRevision:1,...patch};
}
const job=(patch:Partial<AnalysisJob>):AnalysisJob=>({id:'job-1',status:'running',stage:'preparing',stageDetail:null,startedAt:'2026-10-29T00:00:00Z',finishedAt:null,elapsedMs:0,workspaceRevision:1,draft:null,interpreter:null,modelOk:null,modelError:null,error:null,...patch});
const overview=(patch:Partial<HandoffOverview>={}):HandoffOverview=>({drafts:[],workspace:{revision:0,updatedAt:null,sources:[]},analysis:null,...patch});

beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);window.history.replaceState(null,'','/operator');
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));
 api=mockApi();vi.mocked(activationClient).mockReturnValue(api);changed=vi.fn<()=>void>();m=null;
 api.read.mockRejectedValue(new ActivationRequestError('NOT_FOUND',404));
});
afterEach(async()=>{await m?.unmount();vi.useRealTimers();vi.unstubAllGlobals();});

// Operator access comes from the signed-in persona: no token is typed, the workspace opens directly.
async function open(persona=chris){
 m=mount();await m.render(<OperatorWorkspace persona={persona} user={{name:'Chris',detail:'Account operator',actionLabel:'Sign out',onAction:()=>undefined}} onPersonaChanged={changed} notice={null}/>);await flush();await flush();
}
const host=()=>m!.host,text=()=>host().textContent??'';
const button=(label:string)=>Array.from(host().querySelectorAll('button')).find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label);
const tick=async(ms:number)=>{await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});};

it('routes the operator persona through the operator proxy without any token in the page',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await open();
 expect(activationClient).toHaveBeenLastCalledWith('fictional-north','','','/operator-api/north','chris');
 expect(host().querySelector('input[type=password]')).toBeNull();expect(text()).not.toMatch(/access token/i);
 await click(host(),'Developer Progress');
 expect(window.location.pathname).toBe('/operator/progress');expect(text()).toContain('Activation at a glance');
});

it('offers only the customers authorized for this persona and holds the switch while edits are unsaved',async()=>{
 await open();
 const select=byLabel<HTMLSelectElement>(host(),'Customer account')!;
 expect(Array.from(select.options).map(o=>o.value)).toEqual(['north','lumen']);
 await type(byLabel<HTMLTextAreaElement>(host(),'Information 1 text')!,'Draft notes');
 expect(select.disabled).toBe(true);expect(text()).toContain('Save or discard your changes before switching customer.');
 await click(host(),'Discard changes');expect(select.disabled).toBe(false);
 await type(select,'lumen');await flush();
 expect(activationClient).toHaveBeenLastCalledWith('fictional-lumen','','','/operator-api/lumen','chris');
});

it('adds, edits, categorizes, removes and saves information; saved entries come back after a reload',async()=>{
 await open();
 expect(text()).toContain('Not started');
 const categories=Array.from(byLabel<HTMLSelectElement>(host(),'Information 1 category')!.options).map(o=>o.textContent);
 expect(categories).toEqual(['Conversational Transcript','CRM Record','My Notes','Account Preparation','Technical Requirements','Repository Observation','Integration Tools']);
 await type(byLabel<HTMLTextAreaElement>(host(),'Information 1 text')!,SOURCES[0].text);
 await type(byLabel(host(),'Information 1 name')!,'Discovery call');
 await click(host(),'Add information');await click(host(),'Add information');
 await type(byLabel<HTMLSelectElement>(host(),'Information 2 category')!,'integration_tools');
 await type(byLabel<HTMLTextAreaElement>(host(),'Information 2 text')!,'Docs live in Confluence.');
 await click(host(),'Remove information 3');
 expect(host().querySelector('[aria-label="Information 3 text"]')).toBeNull();
 expect(text()).toContain('Unsaved changes');
 api.saveWorkspace.mockImplementation(async(_rev:number,sources:SourceInput[])=>({revision:1,updatedAt:'2026-10-29T10:00:00Z',sources}));
 await click(host(),'Save information');await flush();
 const [rev,saved]=api.saveWorkspace.mock.calls[0];
 expect(rev).toBe(0);expect(saved.map((s:SourceInput)=>[s.type,s.label,s.text])).toEqual([['conversation','Discovery call',SOURCES[0].text],['integration_tools','','Docs live in Confluence.']]);
 expect(text()).not.toContain('Unsaved changes');expect(text()).toMatch(/Saved \d/);
 // Reload: the server returns the saved entries.
 await m!.unmount();api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:'2026-10-29T10:00:00Z',sources:saved}}));await open();
 expect(byLabel<HTMLTextAreaElement>(host(),'Information 2 text')!.value).toBe('Docs live in Confluence.');expect(text()).toContain('Draft');
});

it('analysis: saves first, shows real stages and elapsed time, stays editable while running, ignores repeated clicks, then offers the draft',async()=>{
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:'2026-10-29T10:00:00Z',sources:SOURCES}}));
 await open();
 // Controlled clock from here on: polling and the elapsed timer advance only when the test says so.
 vi.useFakeTimers({toFake:['setInterval','clearInterval','Date']});
 let release!:(v:{job:AnalysisJob;duplicate:boolean})=>void;
 api.startAnalysis.mockReturnValue(new Promise(r=>{release=r;}));
 // A fast double click on the same button: the second click must not start a second run.
 const analyzeButton=button('Analyze customer')!;
 await act(async()=>{analyzeButton.click();analyzeButton.click();});await act(async()=>{analyzeButton.click();});
 expect(api.startAnalysis).toHaveBeenCalledTimes(1);expect(api.startAnalysis).toHaveBeenCalledWith(1);
 await act(async()=>{release({job:job({stage:'interpreting',stageDetail:'part 1 of 2'}),duplicate:false});});await flush();
 const progress=host().querySelector('[aria-label="Analysis progress"]')!.textContent!;
 expect(progress).toMatch(/Preparing information \(finished\)/);expect(progress).toMatch(/Interpreting customer context · part 1 of 2 \(in progress\)/);
 expect(progress).toMatch(/Generating technical onboarding plan \(not started\)/);expect(progress).toContain('may take 1–2 minutes');expect(progress).not.toMatch(/%/);
 expect(button('Analyzing…')!.disabled).toBe(true);
 // The page stays usable: Chris keeps typing while the server works, and the clock runs.
 await type(byLabel<HTMLTextAreaElement>(host(),'Information 2 text')!,'Extra note while waiting');
 expect(byLabel<HTMLTextAreaElement>(host(),'Information 2 text')!.value).toBe('Extra note while waiting');
 api.analysisStatus.mockResolvedValue({job:job({stage:'planning',elapsedMs:61000})});
 await tick(1600);
 expect(host().querySelector('[aria-label="Analysis progress"]')!.textContent).toMatch(/Generating technical onboarding plan \(in progress\)/);
 // Between polls the clock keeps running locally from the server's last elapsed time.
 api.analysisStatus.mockReturnValue(new Promise(()=>undefined));
 await tick(3000);expect(text()).toMatch(/Elapsed 1:0[3-5]/);
 expect(api.startAnalysis).toHaveBeenCalledTimes(1);
 api.analysisStatus.mockResolvedValue({job:job({status:'succeeded',stage:'preparing_review',elapsedMs:83000,draft:1,interpreter:'hosted_model',modelOk:true})});
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:'2026-10-29T10:00:00Z',sources:SOURCES},drafts:[record()],analysis:job({status:'succeeded',draft:1,interpreter:'hosted_model',modelOk:true,elapsedMs:83000})}));
 await tick(1600);await flush();
 expect(text()).toContain('Analysis ready · produced by the local model');expect(text()).toContain('Your information changed after this analysis.');
 expect(byLabel<HTMLTextAreaElement>(host(),'Information 2 text')!.value).toBe('Extra note while waiting');// unsaved typing survives the refresh
});

it('analysis failures and model fallback are explicit; the information is kept',async()=>{
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},analysis:job({status:'failed',error:'ANALYSIS_FAILED',elapsedMs:5000})}));
 await open();
 expect(host().querySelector('[role=alert]')!.textContent).toContain('The analysis stopped unexpectedly. Your information is saved');
 expect(byLabel<HTMLTextAreaElement>(host(),'Information 1 text')!.value).toBe(SOURCES[0].text);
 await m!.unmount();
 const fallback=record({understanding:{...record().understanding,model:{provider:'ollama',model:'qwen3:1.7b',ok:false,error:'MODEL_UNAVAILABLE',durationMs:1,chunks:0,discarded:0}}});
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[fallback],analysis:job({status:'succeeded',draft:1,interpreter:'rule_based',modelOk:false,modelError:'MODEL_UNAVAILABLE'})}));
 await open();
 expect(text()).toContain('The local model wasn’t available (MODEL_UNAVAILABLE), so this draft comes from rule-based analysis, not the model.');
 await click(host(),'Onboarding Draft');
 expect(text()).toContain('Rule-based fallback · model unavailable (MODEL_UNAVAILABLE)');expect(text()).toContain('It was not generated by the model.');
 expect(text()).not.toContain('AI suggestion');expect(text()).toContain('Rule-based suggestion');
 // Starting while the server is unreachable shows an error instead of hanging.
 await click(host(),'Customer Context');api.startAnalysis.mockRejectedValue(new ActivationRequestError('ACTIVATION_API_UNREACHABLE',502));
 await click(host(),'Analyze again');await flush();
 expect(host().querySelector('[aria-label="Analysis"] [role=alert]')!.textContent).toContain('ACTIVATION_API_UNREACHABLE');
});

it('review: edits several milestones, reorders, removes and adds, and saves the structure the server expects',async()=>{
 const rec=record();
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[rec]}));
 window.history.replaceState(null,'','/operator/draft');await open();
 expect(text()).toContain('Analysis ready');
 const sections=['Customer engineering problem','Known facts','Stakeholders','Technical goals','Onboarding milestones','Questions for the customer','Kept internal'];
 for(const s of sections)expect(host().querySelector(`[aria-label="${s}"]`),s).not.toBeNull();
 expect(host().querySelector('[aria-label="Kept internal"]')!.textContent).toContain('PRIVATE pricing');
 await type(byLabel(host(),'Milestone 2 title')!,'Validate that people can find checkout-api');
 await type(byLabel<HTMLTextAreaElement>(host(),'Milestone 1 actions')!,'Locate the repository\nInspect catalog-info.yaml\n');
 await click(host(),'Move milestone 2 up');
 expect(byLabel<HTMLInputElement>(host(),'Milestone 1 title')!.value).toBe('Validate that people can find checkout-api');
 await click(host(),'Add milestone');
 await type(byLabel(host(),'Milestone 3 title')!,'Document the checkout-api runbook location');
 await type(byLabel<HTMLTextAreaElement>(host(),'Milestone 3 actions')!,'Find the current runbook\nLink it from the Catalog');
 await type(byLabel<HTMLTextAreaElement>(host(),'Milestone 3 completion criteria')!,'The runbook link resolves from the Catalog entry');
 const dep=Array.from(host().querySelectorAll<HTMLInputElement>('[aria-label="Milestone 3"] .pt-depends input'))[1];
 await act(async()=>{dep.click();});
 await type(byLabel<HTMLTextAreaElement>(host(),'Question 1')!,'Which team owns checkout-api today?');
 await click(host(),'Add question');await type(byLabel<HTMLTextAreaElement>(host(),`Question ${rec.review!.questions.length+1}`)!,'Where do runbooks live?');
 expect(text()).toContain('Unsaved changes');
 api.saveReview.mockImplementation(async(draft:number,rev:number,review:ReviewDraft)=>({...rec,review,reviewRevision:rev+1,reviewUpdatedAt:'2026-10-29T11:00:00Z'}));
 await click(host(),'Save draft');await flush();
 const [draft,rev,saved]=api.saveReview.mock.calls[0] as [number,number,ReviewDraft];
 expect([draft,rev]).toEqual([1,0]);
 expect(saved.milestones.map(x=>x.title)).toEqual(['Validate that people can find checkout-api',rec.review!.milestones[0].title,'Document the checkout-api runbook location']);
 expect(saved.milestones[1].actions).toEqual(['Locate the repository','Inspect catalog-info.yaml']);// blank lines are dropped
 expect(saved.milestones[0].edited).toBe(true);expect(saved.milestones[2].origin).toBe('chris');
 expect(saved.milestones[2].dependsOn).toEqual([rec.review!.milestones[0].id]);
 expect(saved.questions.at(-1)).toMatchObject({text:'Where do runbooks live?',origin:'chris'});expect(saved.questions[0]).toMatchObject({text:'Which team owns checkout-api today?',edited:true});
 expect(text()).not.toContain('Unsaved changes');
 // Removing a milestone also removes dependencies on it.
 await click(host(),'Remove milestone 2');
 expect(Array.from(host().querySelectorAll('[aria-label^="Milestone "][aria-label$=" title"]')).length).toBe(2);
});

it('a saved draft is restored after a refresh exactly as saved',async()=>{
 const rec=record();
 const edited:HandoffRecord={...rec,reviewRevision:3,reviewUpdatedAt:'2026-10-29T11:00:00Z',review:{...rec.review!,problem:{...rec.review!.problem,summary:'Edited summary by Chris'},milestones:[...rec.review!.milestones].reverse()}};
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[edited]}));
 window.history.replaceState(null,'','/operator/draft');await open();
 expect(byLabel<HTMLTextAreaElement>(host(),'Problem summary')!.value).toBe('Edited summary by Chris');
 expect(byLabel<HTMLInputElement>(host(),'Milestone 1 title')!.value).toBe('Validate checkout-api discoverability');
 expect(text()).toMatch(/Saved \d/);
});

it('submission: needs saved changes and confirmation, shows the fields to fix, locks after submitting and can be withdrawn',async()=>{
 const rec=record();
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[rec]}));
 window.history.replaceState(null,'','/operator/draft');await open();
 const submit=()=>button('Mark ready for Champion review')!;
 expect(submit().disabled).toBe(true);
 await act(async()=>{host().querySelector<HTMLInputElement>('[aria-label="Submit for Champion review"] .pt-check input')!.click();});
 expect(submit().disabled).toBe(false);
 await type(byLabel<HTMLTextAreaElement>(host(),'Problem summary')!,'Changed');
 expect(submit().disabled).toBe(true);expect(text()).toContain('Save your changes first.');
 await click(host(),'Discard');
 api.submitReview.mockRejectedValueOnce(new ActivationRequestError('CONFIDENTIAL_CONTENT',400,{issues:[{path:'milestones[0].description',label:'Milestone 1 · description',reason:'private_comment'},{path:'goals[1]',label:'Technical goals · item 2',reason:'commercial_text'}]}));
 await click(host(),'Mark ready for Champion review');await flush();
 const alert=host().querySelector('[aria-label="Submit for Champion review"] [role=alert]')!.textContent!;
 expect(alert).toContain('The Champion must not receive internal or commercial information');
 expect(alert).toContain('Milestone 1 · description: contains an executive or private comment');expect(alert).toContain('Technical goals · item 2: mentions commercial or deal details');
 api.submitReview.mockResolvedValueOnce({...rec,status:'submitted',submittedAt:'2026-10-29T12:00:00Z'});
 await click(host(),'Mark ready for Champion review');await flush();
 expect(api.submitReview).toHaveBeenLastCalledWith(1,0);
 expect(text()).toContain('Submitted for Champion review');expect(text()).toContain('Nothing is visible to developers');
 expect(host().querySelector<HTMLFieldSetElement>('fieldset.pt-fieldset')!.disabled).toBe(true);
 expect(button('Publish without Champion review')?.disabled??true).toBe(true);
 api.withdrawReview.mockResolvedValueOnce({...rec,status:'draft',submittedAt:null});
 await click(host(),'Withdraw to make changes');await flush();
 expect(api.withdrawReview).toHaveBeenCalledWith(1);expect(host().querySelector<HTMLFieldSetElement>('fieldset.pt-fieldset')!.disabled).toBe(false);
});

it('the earlier direct publication path is labelled as skipping Champion review and uses the saved draft',async()=>{
 const rec=record();
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[rec]}));
 window.history.replaceState(null,'','/operator/draft');await open();
 const tools=host().querySelector('[aria-label="Publish without Champion review"]')!;
 expect(tools.textContent).toContain('This skips the Champion review and is not an approval.');
 await type(byLabel(host(),'Agreed activation outcome')!,'Assess checkout-api readiness');await type(byLabel(host(),'Agreement attribution')!,'Platform lead, call');
 await act(async()=>{tools.querySelector<HTMLInputElement>('.pt-check input')!.click();});
 api.publishReviewed.mockResolvedValue(fixtureState('orbit'));
 await click(host(),'Publish without Champion review');await flush();
 expect(api.publishReviewed).toHaveBeenCalledWith(1,'Assess checkout-api readiness','Platform lead, call');
});

it('stops when the browser is signed in as someone else instead of acting for them',async()=>{
 api.read.mockRejectedValue(new ActivationRequestError('PERSONA_CHANGED',409));await open();await flush();
 expect(changed).toHaveBeenCalled();
});
