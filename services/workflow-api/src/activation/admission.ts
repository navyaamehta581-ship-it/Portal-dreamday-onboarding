import { isDeepStrictEqual } from 'node:util';
import type { CustomerContext, ActivationPlan, EvidenceRecord } from '../../../../contracts/activation/v1/types.ts';
import type { Policy, Principal } from './store.ts';

// Operator-owned registry; never populate it from an HTTP request or model response.
export type AdmissionBundle = {
  principal: Principal;
  context: CustomerContext;
  plans: ActivationPlan[];
  evidence: EvidenceRecord[];
  expiresAt: string;
};
export function registryPolicy(bundles: AdmissionBundle[], now = Date.now): Policy {
  const owned = structuredClone(bundles);
  function bundle(p: Principal) {
    return owned.find(b => isDeepStrictEqual(b.principal,p) && Date.parse(b.expiresAt)>now());
  }
  return {
    admitContext: (p,c) => isDeepStrictEqual(bundle(p)?.context,c),
    admitPlan: (p,c,plan) => isDeepStrictEqual(bundle(p)?.context,c) && !!bundle(p)?.plans.some(x=>isDeepStrictEqual(x,plan)),
    admit(p,e) {
      const b=bundle(p);
      if(!b || !b.evidence.some(x=>isDeepStrictEqual(x,e))) return false;
      const at=Date.parse(e.observedAt);
      if(!Number.isFinite(at)||at>now()||now()-at>24*60*60*1000) return false;
      if(e.kind==='github_observation') {
        if(e.proof.type!=='none'||!/^https:\/\/(api\.github\.com\/repos|github\.com)\//.test(e.source)||!/^[a-f0-9]{40,64}$/.test(e.sourceRevision))return false;
      }
      if(e.proof.type==='verification') {
        // Legacy wire name means technical verification only, never adoption or deployment.
        if(e.kind!=='verified_outcome'||!e.scope.startsWith('technical:')||e.proof.result!=='passed'||!e.proof.verifier||e.proof.verifier===e.producer)return false;
        const basis=e.basisIds.map(id=>b.evidence.find(x=>x.id===id));
        if(!basis.some(x=>x?.proof.type==='execution_receipt'&&x.proof.actionId===e.proof.actionId&&x.proof.actionRevision===e.proof.actionRevision))return false;
        const seen=new Set<string>();
        const safe=(record:EvidenceRecord):boolean=>{
          if(seen.has(record.id))return false;
          seen.add(record.id);
          if(['portal_simulated','ai_inference','customer_report','developer_report'].includes(record.kind))return false;
          return record.basisIds.every(id=>{const parent=b.evidence.find(x=>x.id===id);return !!parent&&safe(parent);});
        };
        if(!basis.every(x=>!!x&&safe(x)))return false;
      }
      return true;
    }
  };
}
export function evidenceLabel(e: EvidenceRecord): string {
  if(e.proof.type==='verification')return 'Verified technical check; no customer adoption or deployment claim';
  return ({portal_simulated:'Simulated Portal fixture',github_observation:'Read-only GitHub observation',customer_report:'Customer report',developer_report:'Developer report',ai_inference:'AI inference',action_record:'Technical action record',verified_outcome:'Unverified outcome'})[e.kind];
}
