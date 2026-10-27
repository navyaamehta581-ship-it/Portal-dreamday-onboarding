// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PortalJourney} from './PortalJourney';
let host:HTMLDivElement,root:Root;
beforeEach(async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(window,'scrollTo').mockImplementation(()=>{});host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<PortalJourney/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function click(label:string){await act(async()=>{const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(label));expect(button).toBeTruthy();button!.click();});}
it('takes the recording path into the real module without collecting login credentials',async()=>{
 expect(host.textContent).toContain('Welcome to Portal.');await click('Get started');expect(host.querySelector('input')).toBeNull();expect(host.textContent).toContain('No email, password, or Spotify account is collected');
 await click('Continue with simulated login');expect(host.textContent).toContain('Welcome to your developer portal.');expect(host.querySelectorAll('.pj-placeholder')).toHaveLength(7);
 await click('Open onboarding');expect(host.textContent).toContain('after Chris has a customer brief');await click('Open Activation Intelligence');
 expect(host.textContent).toContain('Open an activation session');expect(host.querySelector('input[type=password]')).not.toBeNull();expect(host.textContent).toContain('AiKA integration is simulated');expect(host.textContent).toContain('Nothing loaded yet');
});
it('unmounts sensitive activation state when restarting the demo',async()=>{
 await click('Get started');await click('Continue with simulated login');await click('Activation Intelligence');
 const token=host.querySelector<HTMLInputElement>('input[type=password]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(token,'private-session-token');token.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('Restart demo');expect(host.querySelector('input')).toBeNull();await click('Get started');await click('Continue with simulated login');await click('Activation Intelligence');expect(host.querySelector<HTMLInputElement>('input[type=password]')!.value).toBe('');
});
