import {isDeepStrictEqual} from 'node:util';
import type {Policy,Principal} from './store.ts';
export type SetupApprovalGrant={principal:Principal;preparationId:string;artifactDigest:string;sourceCommit:string;planRevision:number;actionId:string;actionRevision:number;expiresAt:string};
/** Independent operator grant for proposal review only. Never grants remote execution. */
export function setupApprovalPolicy(base:Policy,grants:SetupApprovalGrant[],now=Date.now):Policy {
 const owned=structuredClone(grants);
 if(!Array.isArray(owned)||owned.some(g=>!g.principal||!['tenantId','customerId','sessionId'].every(k=>typeof g.principal[k as keyof Principal]==='string'&&g.principal[k as keyof Principal].length>0)||!/^prepare:[A-Za-z0-9_-]{1,80}$/.test(g.preparationId)||!/^[a-f0-9]{64}$/.test(g.artifactDigest)||!/^[a-f0-9]{40}$/.test(g.sourceCommit)||!g.actionId||![g.planRevision,g.actionRevision].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isFinite(Date.parse(g.expiresAt))))throw new Error('Invalid setup proposal approval grant');
 return {...base,approveSetup:(p,packet)=>owned.some(g=>isDeepStrictEqual(g.principal,p)&&g.preparationId===packet.id&&g.artifactDigest===packet.artifactDigest&&g.sourceCommit===packet.commit&&g.planRevision===packet.planRevision&&g.actionId===packet.actionId&&g.actionRevision===packet.actionRevision&&Date.parse(g.expiresAt)>now())};
}
