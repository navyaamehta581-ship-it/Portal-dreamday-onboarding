// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {click,flush,mount} from '../activation/testing';
import {DemoMenu,loadDemoRoom} from './DemoRoom';

let m:ReturnType<typeof mount>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);m=mount();});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});
const ROOM={room:'K7M2Q-9XRTB',expiresAt:'2026-10-30T10:00:00Z',storage:'ephemeral',aiProvider:'gemini'};
function server(onPost:(url:string)=>Response=()=>new Response('{}')){
 const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{calls.push(`${init?.method??'GET'} ${url}`);return url==='/demo-gate/room'?new Response(JSON.stringify(ROOM)):onPost(url);}));
 const assign=vi.fn();vi.stubGlobal('location',{...window.location,assign});
 void loadDemoRoom(true);
 return {calls,assign};
}
const panel=()=>m.host.querySelector('[role=dialog]');

it('is a compact top-bar control; the room, its end and both warnings are one click away',async()=>{
 server();
 await m.render(<DemoMenu/>);await flush();await flush();
 expect(m.host.textContent).toBe('Fictional demo');
 const toggle=m.host.querySelector('button')!;expect(toggle.getAttribute('aria-expanded')).toBe('false');
 await click(m.host,'Fictional demo');
 expect(panel()?.getAttribute('aria-label')).toBe('Demo room');
 expect(panel()!.textContent).toContain('K7M2Q-9XRTB');expect(panel()!.textContent).toContain('or sooner');
 expect(panel()!.textContent).toContain('lost if the service restarts, redeploys or sleeps');
 expect(panel()!.textContent).toContain('Gemini’s free tier');
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await flush();
 expect(panel()).toBeNull();
});

it('starts a fresh room (back to persona selection) or leaves the demo',async()=>{
 const {calls,assign}=server(()=>new Response('{}',{status:201}));
 await m.render(<DemoMenu/>);await flush();await flush();
 await click(m.host,'Fictional demo');await click(m.host,'Start a new room');await flush();
 expect(calls).toContain('POST /demo-gate/new-room');expect(assign).toHaveBeenCalledWith('/login');
 await click(m.host,'Leave demo');await flush();
 expect(calls).toContain('POST /demo-gate/leave');expect(assign).toHaveBeenCalledWith('/demo-gate');
});

it('explains when a new room can’t be started',async()=>{
 server(url=>url==='/demo-gate/new-room'?new Response('{}',{status:503}):new Response('{}'));
 await m.render(<DemoMenu/>);await flush();await flush();
 await click(m.host,'Fictional demo');await click(m.host,'Start a new room');await flush();
 expect(m.host.querySelector('[role=alert]')?.textContent).toContain('at capacity');
});

it('shows nothing outside the hosted demo (local development has no gate)',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})));void loadDemoRoom(true);
 await m.render(<DemoMenu/>);await flush();await flush();
 expect(m.host.textContent).toBe('');
});
