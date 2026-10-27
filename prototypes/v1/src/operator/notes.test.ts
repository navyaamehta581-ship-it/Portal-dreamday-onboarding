import {expect,it} from 'vitest';
import {organizeNotes} from './notes';

it('holds back commercial lines, keeps technical context and suggests the agreed outcome',()=>{
 const o=organizeNotes('PRIVATE CONTRACT NOTE: exclude.\nExisting checkout-api on GitHub monorepo.\nSSO uses Okta.\nDiscount of $40k approved.\nAgreed goal: register checkout-api in the catalog.');
 expect(o.heldBack).toEqual(['PRIVATE CONTRACT NOTE: exclude.','Discount of $40k approved.']);
 expect(o.publishable).not.toMatch(/PRIVATE|Discount/);
 expect(o.signals.reported.map(s=>s.label)).toEqual(expect.arrayContaining(['Identity and SSO','Repository structure and permissions']));
 expect(o.outcomeCandidates).toEqual(['Agreed goal: register checkout-api in the catalog.']);
});
it('flags truncation beyond the publishable limit',()=>{
 const o=organizeNotes('x'.repeat(7000));
 expect(o.truncated).toBe(true);expect(o.publishable).toHaveLength(6000);
});
