// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {useActivation,type ActivationSession} from './useActivation';
import {ActivationRequestError} from './client';
import {fixtureState,mockApi,mount} from './testing';

let api:ReturnType<typeof mockApi>,session:ActivationSession,m:ReturnType<typeof mount>;
function Harness({scope}:{scope:string}){session=useActivation(api,scope);return null;}
beforeEach(async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);api=mockApi();m=mount();await m.render(<Harness scope="a"/>);});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();vi.useRealTimers();sessionStorage.clear();});
const run=(fn:()=>Promise<unknown>|void)=>act(async()=>{await fn();});

it('retries a blocker report with the exact original identity after a timeout',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await run(()=>session.refresh());
 api.reportBlocker.mockRejectedValueOnce(Object.assign(new Error('t'),{name:'TimeoutError'}));
 await run(()=>session.blockerReport.submit('  Cannot access the repository  '));
 expect(session.error).toContain('timed out');
 const first=api.reportBlocker.mock.calls[0][0];
 expect(first).toMatchObject({expectedRevision:0,planRevision:0,message:'Cannot access the repository'});
 // A newer canonical revision must not be adopted silently by the retry.
 api.read.mockResolvedValue(fixtureState('orbit',{revision:4}));await run(()=>session.refresh());
 api.reportBlocker.mockResolvedValue(fixtureState('orbit',{revision:5}));
 await run(()=>session.blockerReport.submit('different text'));
 expect(api.reportBlocker.mock.calls[1][0]).toEqual(first);
 expect(session.blockerReport.accepted).toBe(true);
});

it('keeps drafts and explains a 409 without rebasing',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await run(()=>session.refresh());
 api.reportProgress.mockRejectedValue(new ActivationRequestError('REVISION_CONFLICT',409));
 await run(()=>session.progressReport.submit('Reviewed plan',true));
 expect(session.error).toContain('changed elsewhere');
 expect(session.progressReport.draft).toMatchObject({message:'Reviewed plan',needsChris:true,expectedRevision:0});
 expect(session.teamUnlocked).toBe(false);
});

it('rejects a cross-customer reviewed progress command before sending',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await run(()=>session.refresh());
 await run(()=>session.reviewedProgress.submit(JSON.stringify({customerId:'ledger',developerSessionId:'session-orbit',expectedRevision:0,planRevision:0,milestoneId:'first-value'})));
 expect(api.progress).not.toHaveBeenCalled();
 expect(session.error).toContain('different customer');
});

it('polls only while a replan is pending and stops once ready',async()=>{
 vi.useFakeTimers();
 api.read.mockResolvedValue(fixtureState('orbit',{replan:{status:'pending',blockerId:'developer:x',replacementPlanRevision:null,errorCode:null}}));
 await run(()=>session.refresh());
 api.read.mockResolvedValue(fixtureState('orbit',{planRevision:1,replan:{status:'ready',blockerId:'developer:x',replacementPlanRevision:1,errorCode:null}}));
 await run(()=>{vi.advanceTimersByTime(5000);});
 expect(api.read).toHaveBeenCalledTimes(2);
 await run(()=>{vi.advanceTimersByTime(15000);});
 expect(api.read).toHaveBeenCalledTimes(2);
});

it('clears state and every draft when the customer or credential scope changes',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await run(()=>session.refresh());
 api.prepareGitHub.mockRejectedValue(new Error('ACTIVATION_UNAVAILABLE'));await run(()=>session.github.prepare());
 expect(session.github.draft).not.toBeNull();
 await m.render(<Harness scope="b"/>);
 expect(session.state).toBeNull();expect(session.github.draft).toBeNull();expect(session.error).toBe('');
});

it('unlocks the team plan from an accepted direction or a submitted report, per plan revision',async()=>{
 api.read.mockResolvedValue(fixtureState('orbit'));await run(()=>session.refresh());
 expect(session.teamUnlocked).toBe(false);
 await run(()=>session.direction.accept());
 expect(session.teamUnlocked).toBe(true);
 expect(api.reportProgress).not.toHaveBeenCalled();
 api.read.mockResolvedValue(fixtureState('orbit',{planRevision:1}));await run(()=>session.refresh());
 expect(session.teamUnlocked).toBe(false);
 api.reportProgress.mockResolvedValue(fixtureState('orbit',{planRevision:1,revision:1}));
 await run(()=>session.progressReport.submit('Reviewed',false));
 expect(session.teamUnlocked).toBe(true);
});
