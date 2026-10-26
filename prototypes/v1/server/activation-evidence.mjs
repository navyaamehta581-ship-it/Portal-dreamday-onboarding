import {createHash} from 'node:crypto';
import {diagnose} from './diagnose.mjs';

/** Server/operator collector. Output is a candidate for exact registry review, never authority. */
export async function collectActivationEvidence(input, options) {
  const inspection = await diagnose(input, options);
  if (inspection.diagnosis === 'blocked') return {inspection, records:[]};
  const revision = /^Inspected immutable revision ([a-f0-9]{40})\.$/.exec(inspection.evidence.find(e=>e.id==='revision')?.observation ?? '')?.[1];
  if (!revision) throw new Error('Missing immutable inspection revision');
  const records = inspection.evidence.map(e => {
    // Commit endpoint uses a mutable branch name; replace it with its inspected SHA.
    const source = e.id==='revision' ? `https://api.github.com/repos/${inspection.repository}/commits/${revision}` : e.source;
    const identity = JSON.stringify([inspection.repository,revision,e.id,inspection.observedAt,e.observation]);
    return {id:`github-${createHash('sha256').update(identity).digest('hex')}`,kind:'github_observation',claim:e.observation,source,observedAt:inspection.observedAt,sourceRevision:revision,scope:`technical:ci-readiness:${inspection.repository}`,producer:'read-only-github-inspector/v1',basisIds:[],proof:{type:'none',actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked'}};
  });
  return {inspection, records};
}
