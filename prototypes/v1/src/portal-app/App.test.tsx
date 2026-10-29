// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {App} from './App';
import {click,fixtureState,flush,mount} from '../activation/testing';
import type {Persona} from './session';
import type {MilestoneDraft} from '../../../../contracts/activation/v1/handoff';

// A fake session layer + workflow API: the persona lives in a "cookie" (server state), never in the page.
const north={id:'north',label:'Northstar (fictional)',customerId:'orbit'};
const PERSONAS:Persona[]=[
 {id:'chris',name:'Chris',role:'operator',title:'Spotify account operator',customers:[north]},
 {id:'maya',name:'Maya Chen',role:'champion',title:'Platform Champion',customers:[north]},
 {id:'alex',name:'Alex Rivera',role:'developer',title:'Developer',customers:[north]},
 {id:'jordan',name:'Jordan Lee',role:'developer',title:'Developer',customers:[north]},
];
const milestone=(id:string,objective:string):MilestoneDraft=>({id,objective,system:{service:'payments-api',repository:null,platform:'GitHub'},why:'',actions:['Inspect the repository','Record findings'],prerequisites:[],requiredInformation:[],destinations:[],expectedOutput:'',completionCriteria:['Each item is marked verified, missing or inaccessible'],dependencies:[],developerUnknowns:[],recommendedRole:'developer',proposedAssignee:null,assignmentStatus:'proposed'});
const published=()=>fixtureState('orbit',{handoff:{version:1,publishedAt:'2026-10-28T00:00:00Z',interpreter:'hosted_model',summary:'s',context:[],unknowns:[],
 milestones:[milestone('m1','Assess payments-api repository readiness'),milestone('m2','Validate payments-api discoverability')],
 team:[{name:'Maya Chen',role:'Champion',status:'reported'},{name:'Alex Rivera',role:'Developer',status:'reported'},{name:'Jordan Lee',role:'Developer',status:'reported'}]}});

let m:ReturnType<typeof mount>,server:{persona:string|null},calls:{method:string;url:string;persona:string|null}[];
function backend(signedIn:string|null=null){
 server={persona:signedIn};calls=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  const headers=(init?.headers??{}) as Record<string,string>;
  calls.push({method:init?.method??'GET',url,persona:headers['X-Portal-Persona']??null});
  const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status});
  const me=PERSONAS.find(p=>p.id===server.persona);
  if(url==='/portal-auth/personas')return json({personas:PERSONAS});
  if(url==='/portal-auth/session')return me?json({persona:me}):json({error:{code:'SIGN_IN_REQUIRED'}},401);
  if(url==='/portal-auth/login'){server.persona=JSON.parse(String(init!.body)).personaId;return json({persona:PERSONAS.find(p=>p.id===server.persona)});}
  if(url==='/portal-auth/logout'){server.persona=null;return json({});}
  if(!me)return json({error:{code:'SIGN_IN_REQUIRED'}},401);
  if(headers['X-Portal-Persona']&&headers['X-Portal-Persona']!==me.id)return json({error:{code:'PERSONA_CHANGED'}},409);
  // Same rules as the session layer: customer personas use /portal-api, the operator /operator-api.
  if(url.startsWith('/portal-api/'))return me.role==='operator'?json({error:{code:'WRONG_SURFACE'}},403):json(published());
  if(url.startsWith('/operator-api/'))return me.role!=='operator'?json({error:{code:'FORBIDDEN'}},403):url.endsWith('/handoff')?json({drafts:[]}):json(published());
  return json({error:{code:'NOT_FOUND'}},404);
 }));
}
const text=()=>m.host.textContent??'';
async function render(path:string){window.history.replaceState(null,'',path);m=mount();await m.render(<App/>);await settle();}
async function settle(){const {act}=await import('react');for(let i=0;i<6;i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});}
async function choose(name:string){
 const radio=Array.from(m.host.querySelectorAll<HTMLInputElement>('input[name=persona]')).find(r=>r.closest('label')!.textContent!.includes(name))!;
 await (await import('react')).act(async()=>{radio.click();});
 await click(m.host,'Continue');await settle();
}
const apiCalls=()=>calls.filter(c=>c.url.includes('-api/'));
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});

it('one entry: Welcome → Get started → clearly labelled demo personas, no credentials collected',async()=>{
 backend();await render('/');
 expect(text()).toContain('Portal is ready for you');
 await click(m.host,'Get started');await settle();
 expect(window.location.pathname).toBe('/login');
 const options=Array.from(m.host.querySelectorAll('label.pt-account')).map(l=>l.textContent);
 expect(options).toEqual([expect.stringMatching(/Chris.*Account operator.*Spotify account operator/),expect.stringMatching(/Maya Chen.*Champion.*Platform Champion/),expect.stringMatching(/Alex Rivera.*Developer/),expect.stringMatching(/Jordan Lee.*Developer/)]);
 expect(text()).toMatch(/simulated sign-in, not authentication/);
 expect(m.host.querySelector('input[type=password],input[type=email]')).toBeNull();
});

it.each([
 ['Alex Rivera','/portal','/portal-api/'],
 ['Jordan Lee','/portal','/portal-api/'],
 ['Maya Chen','/portal','/portal-api/'],
 ['Chris','/operator','/operator-api/'],
])('%s opens their own Portal and only calls their own API surface',async(name,home,prefix)=>{
 backend();await render('/login');await choose(name);
 expect(window.location.pathname).toBe(home);
 expect(m.host.querySelector(`[aria-label="Account: ${name}"]`)).not.toBeNull();
 const persona=PERSONAS.find(p=>p.name===name)!;
 expect(apiCalls().length).toBeGreaterThan(0);
 expect(apiCalls().every(c=>c.url.startsWith(prefix)&&c.persona===persona.id)).toBe(true);
 const nav=Array.from(m.host.querySelectorAll('nav.pt-side a')).map(a=>a.getAttribute('href'));
 if(persona.role==='operator'){expect(text()).toContain('Customer Onboarding');expect(nav.some(h=>h?.startsWith('/portal')||h==='/activation')).toBe(false);}
 else{expect(text()).toContain('Welcome to Portal');expect(nav).toContain('/activation');expect(nav.some(h=>h?.startsWith('/operator'))).toBe(false);}
 expect(nav.includes('/champion')).toBe(persona.role==='champion');
});

it('Alex and Jordan see the shared onboarding and an honest assignment state, never proposed assignees',async()=>{
 backend('alex');await render('/portal');
 const work=m.host.querySelector('[aria-label="Your assigned work"]')!.textContent!;
 expect(work).toContain('Nothing is assigned to you yet');expect(work).toMatch(/approval step isn’t available/);
 expect(m.host.querySelector('[aria-label="Your onboarding"]')).not.toBeNull();
 await m.unmount();await render('/champion');
 expect(text()).toContain('Team Coordination is for your team’s Champion');
 expect(m.host.querySelector('[aria-label="Proposed work"]')).toBeNull();
});

it('Maya gets the developer Portal plus Team Coordination, with proposals only and no approval controls',async()=>{
 backend('maya');await render('/portal');
 expect(m.host.querySelector('[aria-label="Your onboarding"]')).not.toBeNull();
 await click(m.host,'Open Team Coordination');await settle();
 expect(window.location.pathname).toBe('/champion');
 expect(m.host.querySelector('[aria-label="Technical team"]')!.textContent).toMatch(/Alex Rivera.*Jordan Lee/);
 const work=m.host.querySelector('[aria-label="Proposed work"]')!.textContent!;
 expect(work).toContain('Assess payments-api repository readiness');expect(work).toContain('Proposed — not approved');
 expect(work).toContain('not shown until the assignment is approved');expect(work).not.toMatch(/\bApproved\b/);
 expect(text()).toContain('Nothing has been approved');
 expect(Array.from(m.host.querySelectorAll('button')).some(b=>/approve|reject/i.test(b.textContent??''))).toBe(false);
});

it('a reload keeps the persona; typed URLs for another surface explain instead of switching persona',async()=>{
 backend();await render('/login');await choose('Maya Chen');await m.unmount();
 await render('/champion');
 expect(window.location.pathname).toBe('/champion');expect(m.host.querySelector('[aria-label="Account: Maya Chen"]')).not.toBeNull();
 await m.unmount();calls=[];await render('/operator');
 expect(text()).toContain('This workspace is for the Spotify account operator');
 expect(m.host.querySelector('[aria-label="Account: Maya Chen"]')).not.toBeNull();
 expect(apiCalls().filter(c=>c.url.startsWith('/operator-api/'))).toEqual([]);
 await m.unmount();await render('/login');
 expect(window.location.pathname).toBe('/portal');expect(server.persona).toBe('maya');
 await m.unmount();server.persona='chris';calls=[];await render('/activation');
 expect(text()).toContain('This is the customer’s developer Portal');
 expect(apiCalls().filter(c=>c.url.startsWith('/portal-api/'))).toEqual([]);
});

it('signing in at a deep link lands there when the persona may use it, else at the persona’s start page',async()=>{
 backend();await render('/activation/guide');
 expect(text()).toContain('Sign in to Portal');expect(apiCalls()).toEqual([]);
 await choose('Jordan Lee');expect(window.location.pathname).toBe('/activation/guide');
 await m.unmount();backend();await render('/activation');await choose('Chris');
 expect(window.location.pathname).toBe('/operator');
});

it('when another tab signs in as someone else, this tab stops and says so instead of acting for the new persona',async()=>{
 const {act}=await import('react');
 // Detected by the API on the next request…
 backend('alex');await render('/activation');
 server.persona='maya';
 await click(m.host,'Refresh');await settle();
 const portal=calls.filter(c=>c.url.startsWith('/portal-api/')).map(c=>c.persona);
 expect(portal.lastIndexOf('alex')).toBeLessThan(portal.indexOf('maya'));
 expect(text()).toContain('You signed in as Maya Chen in another tab');
 expect(m.host.querySelector('[aria-label="Account: Maya Chen"]')).not.toBeNull();
 await m.unmount();
 // …and when the tab regains focus, before any request.
 backend('jordan');await render('/portal');
 server.persona=null;calls=[];
 await act(async()=>{window.dispatchEvent(new Event('focus'));});await settle();
 expect(text()).toContain('You were signed out in another tab');
 expect(apiCalls()).toEqual([]);
});

it('signing out returns to the entry and the next sign-in can choose any persona',async()=>{
 backend('jordan');await render('/portal');
 await click(m.host,'Account: Jordan Lee');await click(m.host,'Sign out');await settle();
 expect(window.location.pathname).toBe('/');expect(server.persona).toBeNull();
 expect(text()).toContain('Portal is ready for you');
});
