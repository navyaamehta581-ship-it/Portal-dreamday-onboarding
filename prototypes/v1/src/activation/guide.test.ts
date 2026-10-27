import {expect,it} from 'vitest';
import {contextMatches,guideTranscript} from './guide';
import {fixtureState} from './testing';
import type {EvidenceRecord} from '../../../../contracts/activation/v1/types';

const report=(id:string,source:string,claim:string,at='2026-01-01T00:00:00Z'):EvidenceRecord=>({id:'report:'+id,kind:'developer_report',claim,source,sourceRevision:'x',observedAt:at,scope:'goal',producer:'p',basisIds:[],proof:{type:'none',actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked'}});

it('derives blocker replies from canonical replan state only',()=>{
 const base=fixtureState('orbit');
 const blocker=report('developer:a','Authenticated activation blocker report','No staging access');
 const pending=fixtureState('orbit',{evidence:[...base.evidence,blocker],replan:{status:'pending',blockerId:'developer:a',replacementPlanRevision:null,errorCode:null}});
 expect(guideTranscript(pending)[0].reply.status).toBe('pending');
 const replanned=fixtureState('orbit',{planRevision:1,evidence:[...base.evidence,blocker],plan:{...base.plan,blockerIds:['developer:a']},replan:{status:'ready',blockerId:'developer:a',replacementPlanRevision:1,errorCode:null}});
 const turn=guideTranscript(replanned)[0];
 expect(turn.reply.status).toBe('replanned');
 expect(turn.reply.lines[0]).toBe(base.plan.suggestedNextAction.description);
});

it('answers questions only with matching published context and records help requests',()=>{
 const base=fixtureState('orbit');
 const q=report('progress:q','Authenticated activation progress report','What about '+base.context.constraints[0].split(' ').slice(-3).join(' ')+'?');
 const state=fixtureState('orbit',{evidence:[...base.evidence,q],chrisHelp:{status:'requested',blockerIds:[],owner:'Chris',reason:'x',evidenceIds:[q.id]}});
 const [turn]=guideTranscript(state);
 expect(turn.kind).toBe('question');
 expect(turn.reply.title).toContain('Chris as a help request');
 expect(contextMatches(state,'zzzz unrelated qqqq')).toEqual([]);
});

it('matches short technical terms such as SSO but ignores short filler words',()=>{
 const state=fixtureState('orbit');state.context.briefing='SSO uses Okta. Docs live in Confluence.';
 expect(contextMatches(state,'Which SSO provider was already shared?').map(m=>m.text)).toContain('SSO uses Okta.');
 expect(contextMatches(state,'and the for you')).toEqual([]);
});
