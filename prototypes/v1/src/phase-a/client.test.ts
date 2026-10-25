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
