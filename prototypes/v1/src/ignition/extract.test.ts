import {expect,it} from 'vitest';
import {extract} from './extract';
it('keeps provenance, withholds commercial context, and separates uncertainty',()=>{
 const d=extract([{id:'crm1',kind:'CRM paste',text:'Potential $100K. GitHub hosts payments-api. Okta unverified. Earlier note says enabled: conflict.'}]);
 expect(d.briefing).toContain('[CRM paste · crm1] GitHub');expect(d.briefing).not.toContain('100K');expect(d.held[0]).toContain('100K');expect(d.uncertainties).toContain('conflict');expect(d.briefing).not.toContain('Okta');
});
