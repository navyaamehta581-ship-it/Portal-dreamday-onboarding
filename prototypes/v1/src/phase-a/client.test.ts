import {afterEach,expect,it,vi} from 'vitest';
import {conversationClient} from './client';
import {fixtureResponse,conflictFixture} from './fixtures';
afterEach(()=>vi.unstubAllGlobals());
it('frontend consumes shared fixtures and versioned routes',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>fixtureResponse});vi.stubGlobal('fetch',fetch);
 expect((await conversationClient.create()).state.constraints[0].text).toContain('unchanged');
 expect(fetch.mock.calls[0][0]).toBe('/api/conversations/v1');
});
it('surfaces conflicts and rejects incompatible responses',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>conflictFixture}));await expect(conversationClient.read('fixture')).rejects.toThrow('Reload');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({contractVersion:'2'})}));await expect(conversationClient.read('fixture')).rejects.toThrow('Unsupported');
});
it('preserves structured codes for every shared error fixture',async()=>{
 const {developmentFixtures}=await import('./fixtures');
 for(const error of Object.values(developmentFixtures.examples.errors!)){
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:400,json:async()=>error}));
  await expect(conversationClient.read('example')).rejects.toMatchObject({code:error.error.code,message:error.error.message});
 }
});
it('handles network and malformed response failures with recovery guidance',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Network')));await expect(conversationClient.read('x')).rejects.toThrow('Reload');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>{throw new SyntaxError();}}));await expect(conversationClient.read('x')).rejects.toThrow('Unreadable');
});
