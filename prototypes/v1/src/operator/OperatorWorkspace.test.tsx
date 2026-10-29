// @vitest-environment happy-dom
import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {OperatorWorkspace} from './OperatorWorkspace';
import {activationClient,ActivationRequestError} from '../activation/client';
import {byLabel,click,fixtureState,flush,mockApi,mount,type} from '../activation/testing';
import type {AnalysisJob,DocumentReport,HandoffOverview,HandoffRecord,ReviewDraft,SourceInput} from '../../../../contracts/activation/v1/handoff';
import type {Persona} from '../portal-app/session';
import {interpretRuleBased} from '../../../../services/workflow-api/src/activation/handoff/interpret';
import {proposeMilestones} from '../../../../services/workflow-api/src/activation/handoff/milestones';
import {reviewFromAnalysis} from '../../../../services/workflow-api/src/activation/handoff/review';

vi.mock('../activation/client',async orig=>({...(await orig<typeof import('../activation/client')>()),activationClient:vi.fn()}));
let api:ReturnType<typeof mockApi>,m:ReturnType<typeof mount>|null,changed:ReturnType<typeof vi.fn<()=>void>>;
const chris:Persona={id:'chris',name:'Chris',role:'operator',title:'Spotify account operator',customers:[{id:'north',label:'Aperture',customerId:'fictional-north'},{id:'lumen',label:'Lumen',customerId:'fictional-lumen'}]};

// A realistic draft: the analysis of real fixture text, with a second milestone so ordering and dependencies matter.
const SOURCES:SourceInput[]=[{id:'s1',type:'conversation',label:'Discovery call',text:'We keep walking teams through the same setup. Start with checkout-api in repo aperture/checkout-api on GitHub. Nobody knows who owns it.'},
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

// Chris's PDF as the server describes it after reading.
const REPORT:DocumentReport={fileName:'Aperture discovery.pdf',uploadedAt:'2026-10-29T10:00:00Z',pages:3,pagesRead:3,emptyPages:[],unreadablePages:[],notRead:null,truncated:false,removedLines:2,characters:420,
 customer:{name:'Aperture Commerce',basis:'stated'},sections:[{label:'Discovery call (p. 1)',type:'conversation',basis:'heading',pages:'p. 1',chars:300},{label:'Internal notes (p. 2)',type:'chris_notes',basis:'heading',pages:'p. 2',chars:40},{label:'Opening (p. 3)',type:'account_prep',basis:'default',pages:'p. 3',chars:80}],
 missing:[],complete:true};
const pdf=(name='Aperture discovery.pdf',type='application/pdf',size=1200)=>{const f=new File([new Uint8Array(size)],name,{type});return f;};
async function choosePdf(file:File){
 const input=byLabel<HTMLInputElement>(host(),'Customer PDF')!;
 Object.defineProperty(input,'files',{value:[file],configurable:true});
 await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));});await flush();
}
async function dropPdf(file:File){
 const zone=host().querySelector('.pt-drop')!;
 const drop=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:{files:[file]}});
 await act(async()=>{zone.dispatchEvent(drop);});await flush();
}
const uploaded=(report=REPORT,j=job({}))=>({workspace:{revision:1,updatedAt:'2026-10-29T10:00:00Z',sources:SOURCES,document:report},job:j,report});

it('offers only the customers authorized for this persona',async()=>{
 await open();
 const select=byLabel<HTMLSelectElement>(host(),'Customer account')!;
 expect(Array.from(select.options).map(o=>o.value)).toEqual(['north','lumen']);
 await type(select,'lumen');await flush();
 expect(activationClient).toHaveBeenLastCalledWith('fictional-lumen','','','/operator-api/lumen','chris');
});

it('one way in: a PDF upload area replaces every other way of entering customer information',async()=>{
 await open();
 expect(text()).toContain('Not started');expect(text()).toContain('Drop the customer’s PDF here');
 for(const old of ['Information 1 text','Information 1 name','Information 1 category'])expect(byLabel(host(),old)).toBeNull();
 for(const old of ['Add information','Save information','Analyze customer','Discard changes'])expect(button(old)).toBeUndefined();
 expect(host().querySelector('textarea')).toBeNull();
 const input=byLabel<HTMLInputElement>(host(),'Customer PDF')!;
 expect(input.type).toBe('file');expect(input.accept).toBe('application/pdf,.pdf');
 expect(text()).toContain('Analysis starts automatically');
});

it('choosing or dropping a PDF uploads it once and starts the analysis with no other click',async()=>{
 await open();
 let release!:(v:ReturnType<typeof uploaded>)=>void;
 api.uploadDocument.mockReturnValue(new Promise(r=>{release=r;}));
 await choosePdf(pdf());
 expect(api.uploadDocument).toHaveBeenCalledTimes(1);
 const [file,name]=api.uploadDocument.mock.calls[0];expect(file).toBeInstanceOf(File);expect(name).toBe('Aperture discovery.pdf');
 expect(host().querySelector('.pt-drop [role=status]')!.textContent).toContain('Reading Aperture discovery.pdf');
 // While it's being read, another file is ignored.
 await dropPdf(pdf('second.pdf'));expect(api.uploadDocument).toHaveBeenCalledTimes(1);
 expect(api.startAnalysis).not.toHaveBeenCalled();expect(api.saveWorkspace).not.toHaveBeenCalled();
 await act(async()=>{release(uploaded(REPORT,job({stage:'interpreting'})));});await flush();
 expect(host().querySelector('[aria-label="Analysis progress"]')!.textContent).toMatch(/Interpreting customer context \(in progress\)/);
 expect(text()).toContain('Aperture discovery.pdf');expect(text()).toContain('Fully read');expect(text()).toContain('customer: Aperture Commerce');
 expect(text()).toContain('An analysis is running. You can upload a new PDF when it finishes.');
 expect(byLabel<HTMLInputElement>(host(),'Customer PDF')!.disabled).toBe(true);
 // How it was read: each section, its category and why; an uncertain one says so.
 const how=Array.from(host().querySelectorAll('details summary')).find(s=>s.textContent?.startsWith('How the document was read'))!.parentElement!.textContent!;
 expect(how).toContain('Conversational Transcript');expect(how).toContain('category from its heading');expect(how).toContain('category uncertain');
 expect(how).toContain('2 repeated header, footer or page-number lines were left out');
 // Dropping works the same way.
 await m!.unmount();api.uploadDocument.mockClear();api.uploadDocument.mockResolvedValue(uploaded());await open();
 await dropPdf(pdf('dropped.pdf'));expect(api.uploadDocument).toHaveBeenCalledTimes(1);expect(api.uploadDocument.mock.calls[0][1]).toBe('dropped.pdf');
});

it('the polled analysis finishes into the existing results and the draft',async()=>{
 api.uploadDocument.mockResolvedValue(uploaded());await open();
 vi.useFakeTimers({toFake:['setInterval','clearInterval','Date']});
 await choosePdf(pdf());
 api.analysisStatus.mockResolvedValue({job:job({status:'succeeded',stage:'preparing_review',elapsedMs:41000,draft:1,interpreter:'hosted_model',modelOk:true})});
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:'2026-10-29T10:00:00Z',sources:SOURCES,document:REPORT},drafts:[record()],analysis:job({status:'succeeded',draft:1,interpreter:'hosted_model',modelOk:true,elapsedMs:41000})}));
 await tick(1600);await flush();
 expect(text()).toContain('Analysis ready · produced by the AI model');expect(button('Analyze again')).toBeUndefined();
 expect(text()).toContain('Upload a new PDF to replace this information');
 await click(host(),'Review the onboarding draft');expect(window.location.pathname).toBe('/operator/draft');
});

it('wrong files are refused before upload; server refusals explain what to do',async()=>{
 await open();
 await choosePdf(pdf('notes.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
 expect(api.uploadDocument).not.toHaveBeenCalled();expect(host().querySelector('[role=alert]')!.textContent).toContain('That file isn’t a PDF');
 await choosePdf(pdf('huge.pdf','application/pdf',8*1024*1024+1));
 expect(api.uploadDocument).not.toHaveBeenCalled();expect(host().querySelector('[role=alert]')!.textContent).toContain('larger than 8 MB');
 const refuse=async(code:string,status:number,details:unknown=null)=>{api.uploadDocument.mockRejectedValueOnce(new ActivationRequestError(code,status,details));await choosePdf(pdf());return host().querySelector('[role=alert]')!.textContent!;};
 expect(await refuse('PDF_NO_TEXT',422,{pages:4,emptyPages:4})).toMatch(/No text could be read from this PDF \(4 pages\)\. It looks like a scan/);
 expect(await refuse('PDF_ENCRYPTED',422)).toContain('password-protected');
 expect(await refuse('PDF_INVALID',422)).toContain('damaged or incomplete');
 expect(await refuse('PDF_TIMEOUT',422)).toContain('took too long');
 expect(await refuse('ANALYSIS_LIMIT',429)).toContain('analysis limit');
 expect(await refuse('AWAITING_CHAMPION_REVIEW',409)).toContain('Withdraw it');
 expect(await refuse('ACTIVATION_UNAVAILABLE',0)).toContain('didn’t reach the server');
 expect(text()).toContain('Not started');
});

it('a partly read PDF is never presented as complete: pages, limits, missing topics and a different customer are flagged',async()=>{
 const partial:DocumentReport={...REPORT,pages:70,pagesRead:60,emptyPages:[2,3],notRead:{from:61,to:70},complete:false,missing:['people','goals'],customer:{name:'Globex Corporation',basis:'stated'}};
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES,document:partial},drafts:[record()],analysis:job({status:'succeeded',draft:1,interpreter:'rule_based',modelOk:null})}));
 await open();
 expect(text()).toContain('Partly read');expect(text()).toContain('60 of 70 pages read');
 expect(text()).toContain('Not everything in this PDF was read.');expect(text()).toContain('Pages 2, 3 had no readable text (probably scanned images).');
 expect(text()).toContain('Pages 61–70 are beyond the 60-page limit');
 expect(text()).toContain('Not found in the document: people and their roles; goals, problems or needs.');
 expect(text()).toContain('This PDF names Globex Corporation, but you’re working on Aperture.');
 expect(text()).toContain('This analysis is based on a partly read PDF');
 await click(host(),'Onboarding Draft');expect(text()).toContain('This draft comes from a partly read PDF (Aperture discovery.pdf)');
});

it('analysis failures and model fallback are explicit; the information read from the PDF is kept',async()=>{
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES,document:REPORT},analysis:job({status:'failed',error:'ANALYSIS_FAILED',elapsedMs:5000})}));
 await open();
 expect(host().querySelector('[aria-label="Analysis"] [role=alert]')!.textContent).toContain('The analysis stopped unexpectedly. The information read from your PDF is saved');
 expect(text()).toContain('Aperture discovery.pdf');
 api.startAnalysis.mockResolvedValue({job:job({}),duplicate:false});
 await click(host(),'Analyze again');await flush();expect(api.startAnalysis).toHaveBeenCalledWith(1);
 await m!.unmount();
 const fallback=record({understanding:{...record().understanding,model:{provider:'ollama',model:'qwen3:1.7b',ok:false,error:'MODEL_UNAVAILABLE',durationMs:1,chunks:0,discarded:0}}});
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES,document:REPORT},drafts:[fallback],analysis:job({status:'succeeded',draft:1,interpreter:'rule_based',modelOk:false,modelError:'MODEL_UNAVAILABLE'})}));
 await open();
 expect(text()).toContain('The AI model wasn’t available (MODEL_UNAVAILABLE), so this draft comes from rule-based analysis, not the model.');
 await click(host(),'Onboarding Draft');
 expect(text()).toContain('Rule-based fallback · model unavailable (MODEL_UNAVAILABLE)');expect(text()).toContain('It was not generated by the model.');
 expect(text()).not.toContain('AI suggestion');expect(text()).toContain('Rule-based suggestion');
 // Retrying while the server is unreachable shows an error instead of hanging.
 await click(host(),'Customer Context');api.startAnalysis.mockRejectedValue(new ActivationRequestError('ACTIVATION_API_UNREACHABLE',502));
 await click(host(),'Analyze again');await flush();
 expect(host().querySelector('[aria-label="Analysis"] [role=alert]')!.textContent).toContain('activation API isn’t reachable');
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
 expect(text()).toContain('Submitted for Champion review');expect(text()).toContain('Nothing is visible to developers until it is approved');
 expect(host().querySelector<HTMLFieldSetElement>('fieldset.pt-fieldset')!.disabled).toBe(true);
 api.withdrawReview.mockResolvedValueOnce({...rec,status:'draft',submittedAt:null});
 await click(host(),'Withdraw to make changes');await flush();
 expect(api.withdrawReview).toHaveBeenCalledWith(1);expect(host().querySelector<HTMLFieldSetElement>('fieldset.pt-fieldset')!.disabled).toBe(false);
});

it('Dream Day: Chris has no way to publish around the Champion',async()=>{
 const rec=record();
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[rec]}));
 window.history.replaceState(null,'','/operator/draft');await open();
 expect(text()).not.toMatch(/Publish without Champion review|Publish to developers|Initialize reviewed session/);
 expect(host().querySelector('[aria-label="Integration tools"],details.pt-details summary')?.textContent??'').not.toContain('Integration tools');
});

it('Dream Day: Chris sees the Champion’s requested changes, revises and resubmits',async()=>{
 const rec=record({status:'changes_requested',reviewRevision:5,history:[{action:'submitted',at:'2026-10-29T09:00:00Z',by:'Chris'},{action:'changes_requested',at:'2026-10-29T10:00:00Z',by:'Maya Chen',comment:'Please confirm which CI system deploys checkout-api.'}]});
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[rec]}));
 window.history.replaceState(null,'','/operator/draft');await open();
 expect(text()).toContain('Changes requested');
 expect(host().querySelector('[aria-label="Champion feedback"]')!.textContent).toContain('Maya Chen requested changes in Dream Day');
 expect(host().querySelector('[aria-label="Champion feedback"]')!.textContent).toContain('Please confirm which CI system deploys checkout-api.');
 expect(host().querySelector<HTMLFieldSetElement>('fieldset.pt-fieldset')!.disabled).toBe(false);
 expect(host().querySelector('[aria-label="Dream Day review history"]')!.textContent).toMatch(/Changes requested.*Maya Chen/s);
 await act(async()=>{host().querySelector<HTMLInputElement>('[aria-label="Submit for Champion review"] .pt-check input')!.click();});
 api.submitReview.mockResolvedValueOnce({...rec,status:'resubmitted',submittedAt:'2026-10-29T11:00:00Z'});
 await click(host(),'Resubmit for Champion review');await flush();
 expect(api.submitReview).toHaveBeenCalledWith(1,5);
 expect(text()).toContain('Resubmitted for Champion review');expect(host().querySelector<HTMLFieldSetElement>('fieldset.pt-fieldset')!.disabled).toBe(true);
});

it('Dream Day: after approval Chris sees who approved, when, and the approved responsibilities',async()=>{
 const base=record(),approvedReview={...base.review!,milestones:base.review!.milestones.map((x,i)=>({...x,assignee:i===0?'Alex Rivera':'Jordan Lee'}))};
 const rec=record({status:'published',review:approvedReview,approvals:{chris:{status:'approved',by:'Chris',at:'2026-10-29T09:00:00Z'},champion:{status:'approved',by:'Maya Chen',at:'2026-10-29T10:00:00Z'}},
  history:[{action:'submitted',at:'2026-10-29T09:00:00Z',by:'Chris'},{action:'approved',at:'2026-10-29T10:00:00Z',by:'Maya Chen'},{action:'published',at:'2026-10-29T10:00:00Z',by:'Maya Chen'}]});
 api.read.mockResolvedValue(fixtureState('orbit'));
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[rec]}));
 window.history.replaceState(null,'','/operator/draft');await open();
 expect(text()).toContain('Approved · Published to developers');
 expect(text()).toContain('Champion approval complete: approved by Maya Chen in Dream Day');
 const resp=host().querySelector('[aria-label="Approved responsibilities"]')!.textContent!;
 expect(resp).toContain('Alex Rivera');expect(resp).toContain('Jordan Lee');
 // A plan published before Dream Day is never shown as approved.
 await m!.unmount();
 api.handoffOverview.mockResolvedValue(overview({workspace:{revision:1,updatedAt:null,sources:SOURCES},drafts:[record({status:'published'})]}));await open();
 expect(text()).toContain('Published before Dream Day');expect(text()).not.toContain('Champion approval complete');
});

it('stops when the browser is signed in as someone else instead of acting for them',async()=>{
 api.read.mockRejectedValue(new ActivationRequestError('PERSONA_CHANGED',409));await open();await flush();
 expect(changed).toHaveBeenCalled();
});
