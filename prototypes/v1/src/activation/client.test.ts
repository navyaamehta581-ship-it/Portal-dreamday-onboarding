import { afterEach, expect, it, vi } from 'vitest';
import { activationClient } from './client';
afterEach(()=>vi.unstubAllGlobals());
it('uses distinct activation route, bearer scope and canonical reload response',async()=>{
  const state={contractVersion:'1.0.0',customerId:'ledger',revision:2,context:{customerId:'ledger'},plan:{customerId:'ledger'},developerSessionId:'session-ledger',milestone:{},chrisHelp:{},actions:{},evidence:[],replan:{},outcome:{}};
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>state});vi.stubGlobal('fetch',fetch);
  expect(await activationClient('ledger','local-token').read()).toEqual(state);
  expect(fetch.mock.calls[0][0]).toBe('/api/activation/v1/customers/ledger/state');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer local-token');
});
it('rejects conversation envelopes and surfaces revision conflicts',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({contractVersion:'1.0.0',state:{}})}).mockResolvedValueOnce({ok:false,json:async()=>({error:{code:'REVISION_CONFLICT'}})}));
  await expect(activationClient('ledger','token').read()).rejects.toThrow('INVALID_ACTIVATION_RESPONSE');
  await expect(activationClient('ledger','token').read()).rejects.toThrow('REVISION_CONFLICT');
});
it('allows context-only initialization without sending client-selected plan authority',async()=>{
 const state={contractVersion:'1.0.0',customerId:'ledger',revision:0,context:{customerId:'ledger'},plan:{customerId:'ledger'},developerSessionId:'session-ledger',milestone:{},chrisHelp:{},actions:{},evidence:[],replan:{},outcome:{}};
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>state});vi.stubGlobal('fetch',fetch);
 await activationClient('ledger','token').initialize({customerId:'ledger'} as never);
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({context:{customerId:'ledger'}});
});

it('posts attributed progress on the bounded route and preserves conflict status',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:409,json:async()=>({error:{code:'REVISION_CONFLICT'}})});vi.stubGlobal('fetch',fetch);
 const command={id:'progress:test',expectedRevision:2,planRevision:1,message:'Reviewed plan',needsChris:true};
 await expect(activationClient('ledger','token').reportProgress(command)).rejects.toMatchObject({status:409,code:'REVISION_CONFLICT'});
 expect(fetch.mock.calls[0][0]).toBe('/api/activation/v1/customers/ledger/progress-reports');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(command);
});
it('rejects a nested cross-customer response before exposing it to the UI',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({contractVersion:'1.0.0',customerId:'ledger',revision:0,context:{customerId:'orbit'},plan:{customerId:'ledger'}})}));
 await expect(activationClient('ledger','token').read()).rejects.toThrow('INVALID_ACTIVATION_RESPONSE');
});

it('prepares only through the bounded action route, with no authority or repository fields',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({error:{code:'FORBIDDEN'}})});vi.stubGlobal('fetch',fetch);
 const command={id:'prepare:test',expectedRevision:0,planRevision:0,actionId:'inspect',actionRevision:0};
 await expect(activationClient('ledger','token').prepareGitHub(command)).rejects.toMatchObject({status:403,code:'FORBIDDEN'});
 expect(fetch.mock.calls[0][0]).toBe('/api/activation/v1/customers/ledger/github-preparations');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(command);
});
it('sends only explicit proposal acceptance bindings and preserves authorization failure',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({error:{code:'FORBIDDEN'}})});vi.stubGlobal('fetch',fetch);
 const command={id:'approval:test',expectedRevision:2,preparationId:'prepare:test',artifactDigest:'d'.repeat(64),sourceCommit:'a'.repeat(40),planRevision:0,actionRevision:0,decision:'accept_proposal_only' as const};
 await expect(activationClient('ledger','token').acceptSetupProposal(command)).rejects.toMatchObject({status:403,code:'FORBIDDEN'});
 expect(fetch.mock.calls[0][0]).toBe('/api/activation/v1/customers/ledger/setup-approvals');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(command);
});
