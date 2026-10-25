// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {ConversationPanel} from './ConversationPanel';
import {ConversationContext,safeSource} from './ConversationContext';
import {conversationClient,ConversationError} from './client';
import {developmentFixtures,fixtureResponse} from './fixtures';
vi.mock('./client',async importOriginal=>({...await importOriginal<typeof import('./client')>(),conversationClient:{create:vi.fn(),read:vi.fn(),send:vi.fn()}}));
let host:HTMLDivElement,root:Root;
const empty=developmentFixtures.examples.empty;
const text=()=>host.textContent??'';
const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(label))!;
async function click(label:string){await act(async()=>{button(label).click();});}
async function type(id:string,value:string){await act(async()=>{const field=host.querySelector<HTMLInputElement|HTMLTextAreaElement>(id)!;const proto=field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});}
async function send(){await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
beforeEach(async()=>{vi.clearAllMocks();localStorage.clear();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.mocked(conversationClient.create).mockResolvedValue(empty);await act(async()=>root.render(<ConversationPanel/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it('creates, sends explicit constraints using the shared revision, and stores only ID',async()=>{
 await click('New conversation');await type('#cw-message','Deploy staging');await type('#cw-constraint','Keep tests');
 vi.mocked(conversationClient.send).mockResolvedValue(fixtureResponse);await send();
 expect(conversationClient.send).toHaveBeenCalledWith(empty.state.conversationId,{contractVersion:'1.0.0',expectedRevision:0,content:'Deploy staging',confirmedConstraints:['Keep tests']});
 expect((host.querySelector('#cw-message') as HTMLTextAreaElement).value).toBe('');expect(text()).toContain('Existing tests must remain unchanged.');
 expect(localStorage.length).toBe(1);expect(localStorage.getItem('portal-conversation-v1')).toBe(fixtureResponse.state.conversationId);
});
it('resumes the saved conversation after remount',async()=>{
 localStorage.setItem('portal-conversation-v1','saved-id');vi.mocked(conversationClient.read).mockResolvedValue(fixtureResponse);await click('Resume');expect(conversationClient.read).toHaveBeenCalledWith('saved-id');expect(text()).toContain('Existing tests must remain unchanged.');
});
it('reloads conflicts without resending or losing the draft',async()=>{
 await click('New conversation');await type('#cw-message','Keep this draft');vi.mocked(conversationClient.send).mockRejectedValue(new ConversationError('Changed','REVISION_CONFLICT',409));vi.mocked(conversationClient.read).mockResolvedValue(fixtureResponse);await send();
 expect(text()).toContain('Another tab');expect((host.querySelector('#cw-message') as HTMLTextAreaElement).value).toBe('Keep this draft');expect(conversationClient.send).toHaveBeenCalledTimes(1);expect(button('Send message').disabled).toBe(false);
});
it('blocks retry after an uncertain failure until state reload succeeds',async()=>{
 await click('New conversation');await type('#cw-message','Preserve me');vi.mocked(conversationClient.send).mockRejectedValue(new ConversationError('Server unavailable'));await send();expect(button('Send message').disabled).toBe(true);expect(text()).toContain('Server unavailable');
 vi.mocked(conversationClient.read).mockResolvedValue(empty);await click('Reload latest state');expect(button('Send message').disabled).toBe(false);expect((host.querySelector('#cw-message') as HTMLTextAreaElement).value).toBe('Preserve me');
});
it('keeps synthetic previews isolated from live state, storage and draft',async()=>{
 await click('New conversation');await type('#cw-message','Live draft');
 const select=host.querySelector('select')!;await act(async()=>{select.value='recommendation';select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(text()).toContain('Synthetic example');expect(text()).toContain('selected recommendation');expect(button('Send message').disabled).toBe(true);expect(localStorage.getItem('portal-conversation-v1')).toBe(empty.state.conversationId);
 await act(async()=>{select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));});expect((host.querySelector('#cw-message') as HTMLTextAreaElement).value).toBe('Live draft');expect(text()).not.toContain('selected recommendation');
});
it('renders untrusted evidence as text and rejects executable source links',async()=>{
 const state=structuredClone(fixtureResponse.state);state.evidence=[{id:'unsafe',claim:'<img src=x onerror=alert(1)>',status:'inferred',source:'javascript:alert(1)',observedAt:'now'}];await act(async()=>root.render(<ConversationContext state={state} preview={false}/>));expect(host.querySelector('img')).toBeNull();expect(host.querySelector('a')).toBeNull();expect(text()).toContain('<img');expect(safeSource('https://github.com/a/b')).toBe('https://github.com/a/b');expect(safeSource('fixture://repo')).toBeNull();
});
it('prevents duplicate sends while a request is pending',async()=>{
 await click('New conversation');await type('#cw-message','One message');let resolve!:(value:typeof fixtureResponse)=>void;vi.mocked(conversationClient.send).mockImplementation(()=>new Promise(r=>{resolve=r;}));await send();await send();expect(conversationClient.send).toHaveBeenCalledTimes(1);await act(async()=>resolve(fixtureResponse));
});
it('sends an answer with the backend question ID and preserves confirmed constraints',async()=>{
 vi.mocked(conversationClient.create).mockResolvedValue(developmentFixtures.examples.clarification!);await click('New conversation');await type('#cw-message','Yes, require approval');vi.mocked(conversationClient.send).mockResolvedValue(fixtureResponse);await send();expect(conversationClient.send).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({answersQuestionId:'fixture-question-1',confirmedConstraints:[]}));
});
it('allows explicitly discarding an unsendable draft before starting over',async()=>{
 await click('New conversation');await type('#cw-message','Draft');expect(button('New conversation').disabled).toBe(true);await click('Discard draft');expect(button('New conversation').disabled).toBe(false);
});
