import { afterEach, expect, it, vi } from 'vitest';
import { activationClient } from './client';
afterEach(()=>vi.unstubAllGlobals());
it('uses distinct activation route, bearer scope and canonical reload response',async()=>{
  const state={contractVersion:'1.0.0',customerId:'ledger',revision:2,context:{},plan:{},actions:{},evidence:[],replan:{},outcome:{}};
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
 const state={contractVersion:'1.0.0',customerId:'ledger',revision:0,context:{},plan:{},actions:{},evidence:[],replan:{},outcome:{}};
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>state});vi.stubGlobal('fetch',fetch);
 await activationClient('ledger','token').initialize({customerId:'ledger'} as never);
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({context:{customerId:'ledger'}});
});
