import test from 'node:test';
import assert from 'node:assert/strict';
import {customerSignals} from '../src/activation/customer-signals.ts';
test('customer context quotes reports without verifying setup or inventing absent providers',()=>{
 const s=customerSignals('Existing Backstage migration. SSO uses Okta but access is blocked. GitHub monorepo. Confluence wiki. Weekly trial with solutions engineer.');
 assert.equal(s.reported.length,5);assert.equal(s.unknowns.length,0);
 assert.equal(s.reported[1].quote,'SSO uses Okta but access is blocked.');
 const absent=customerSignals('Need a useful first outcome.');assert.equal(absent.reported.length,0);assert.equal(absent.unknowns.length,5);
 assert.ok(absent.unknowns.every(x=>x.includes('not stated')));assert.ok(!JSON.stringify(absent).includes('Okta'));
});
