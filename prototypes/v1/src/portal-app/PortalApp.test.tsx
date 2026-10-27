// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PortalApp} from './PortalApp';
import {click,flush,mount} from '../activation/testing';

let m:ReturnType<typeof mount>,calls:string[];
function respond(signedIn:boolean){
 calls=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{calls.push(`${init?.method??'GET'} ${url}`);
  if(url==='/portal-auth/session')return signedIn?new Response(JSON.stringify({account:{id:'north',label:'Northstar',user:'Alex',customerId:'fictional-north'}})):new Response('{"error":{"code":"SIGN_IN_REQUIRED"}}',{status:401});
  if(url==='/portal-auth/accounts')return new Response(JSON.stringify({accounts:[{id:'north',label:'Northstar',user:'Alex',customerId:'fictional-north'}]}));
  if(url==='/portal-auth/login'){signedIn=true;return new Response(JSON.stringify({account:{id:'north',label:'Northstar',user:'Alex',customerId:'fictional-north'}}));}
  return new Response('{"error":{"code":"NOT_FOUND"}}',{status:404});}));
}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);window.history.replaceState(null,'','/');m=mount();});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});

it('goes welcome → simulated sign-in → Portal without collecting credentials or showing tokens',async()=>{
 respond(false);await m.render(<PortalApp/>);await flush();
 expect(m.host.textContent).toContain('Portal is ready for you');
 await click(m.host,'Get started');await flush();
 expect(m.host.textContent).toContain('Sign in to Portal');
 expect(m.host.querySelector('input[type=password],input[type=email]')).toBeNull();
 await click(m.host,'Continue');await flush();await flush();
 expect(window.location.pathname).toBe('/portal');
 expect(m.host.textContent).toContain('Welcome to Portal');
 expect(m.host.textContent).toContain('hasn’t been published yet');
 expect(calls).toContain('GET /portal-api/activation/v1/customers/fictional-north/state');
 expect(m.host.textContent).not.toMatch(/token|Customer ID|operator/i);
 expect(Array.from(m.host.querySelectorAll('a')).some(a=>a.getAttribute('href')?.startsWith('/operator'))).toBe(false);
 expect(m.host.textContent).not.toContain('Customer Onboarding');
});

it('requires sign-in on direct developer routes and keeps Chris’s workspace out of the Portal',async()=>{
 window.history.replaceState(null,'','/activation');respond(false);await m.render(<PortalApp/>);await flush();
 expect(m.host.textContent).toContain('Sign in to Portal');
 expect(calls.some(c=>c.includes('/portal-api/'))).toBe(false);
 expect(m.host.textContent).not.toContain('Raw account and call notes');
});
