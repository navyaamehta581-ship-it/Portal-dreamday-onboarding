// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {click,flush,mount} from '../activation/testing';
import {DemoRoomBar} from './DemoRoom';

let m:ReturnType<typeof mount>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);m=mount();});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});

it('shows the hosted demo room with its code and lets the visitor leave it',async()=>{
 const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{calls.push(`${init?.method??'GET'} ${url}`);return url==='/demo-gate/room'?new Response(JSON.stringify({room:'K7M2Q-9XRTB',expiresAt:'2026-10-30T10:00:00Z'})):new Response('{}');}));
 const assign=vi.fn();vi.stubGlobal('location',{...window.location,assign});
 await m.render(<DemoRoomBar/>);await flush();await flush();
 expect(m.host.textContent).toContain('Fictional demo');expect(m.host.textContent).toContain('Room K7M2Q-9XRTB');
 await click(m.host,'Leave room');await flush();
 expect(calls).toEqual(['GET /demo-gate/room','POST /demo-gate/leave']);expect(assign).toHaveBeenCalledWith('/demo-gate');
});

it('shows nothing outside the hosted demo (local development has no gate)',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})));
 await m.render(<DemoRoomBar/>);await flush();await flush();
 expect(m.host.textContent).toBe('');
});
