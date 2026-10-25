import {expect,it} from 'vitest';
import {appendMessage,createConversation} from './controller';
import {developmentFixtures} from './fixtures';
import {CONTRACT_VERSION} from './contract';
it('fixtures share version, IDs, provenance, and honest evidence boundaries',()=>{
 for(const response of [developmentFixtures.examples.empty,developmentFixtures.examples.confirmedConstraint]){
  const s=response.state;expect(response.contractVersion).toBe(CONTRACT_VERSION);expect(s.contractVersion).toBe(CONTRACT_VERSION);
  expect(s.boundary).toBe('read_only');expect(s.mode).toBe('phase_a_deterministic');
  expect(s.developerNeed.constraints).toEqual(s.constraints);
  for(const c of s.constraints)expect(s.messages.some(m=>m.id===c.sourceMessageId&&m.role==='user')).toBe(true);
  expect(s.evidence.every(e=>e.status==='developer_statement')).toBe(true);
  expect(s.hypotheses).toEqual([]);expect(s.developerNeed.assumptions).toEqual([]);
 }
});
it('reducer preserves confirmed constraints, assumptions, hypotheses and verified evidence separately',()=>{
 const original=createConversation('test');
 original.evidence=[{id:'verified-1',claim:'Observed fact',status:'verified',source:'test adapter',observedAt:'2026-10-25T00:00:00Z'}];
 original.developerNeed.assumptions=['Unverified assumption'];original.hypotheses=[{id:'h1',claim:'Possible cause',evidenceIds:[],status:'unassessed'}];
 const snapshot=structuredClone(original);
 const next=appendMessage(original,{contractVersion:CONTRACT_VERSION,expectedRevision:0,content:'User claim',confirmedConstraints:['Keep tests']},'2026-10-25T00:01:00Z');
 expect(original).toEqual(snapshot);expect(next.evidence[0]).toEqual(snapshot.evidence[0]);expect(next.evidence[1].status).toBe('developer_statement');expect(next.hypotheses).toEqual(snapshot.hypotheses);expect(next.developerNeed.assumptions).toEqual(snapshot.developerNeed.assumptions);
});
it('rich synthetic UI scenarios preserve constraints and resolve all references',()=>{
 const examples=developmentFixtures.examples;
 expect(examples.multiTurn!.state.messages).toHaveLength(4);
 expect(examples.clarification!.state.pendingQuestion?.question).toContain('manual approval');
 expect(examples.investigation!.state.stage).toBe('investigating_environment');
 expect(examples.recommendation!.state.selectedSolution?.approach).toBe('modify');
 for(const response of [examples.multiTurn!,examples.clarification!,examples.investigation!,examples.recommendation!]){
  const s=response.state;
  expect(s.constraints).toEqual(examples.confirmedConstraint.state.constraints);
  expect(s.boundary).toBe('read_only');expect(s.artifact).toBeUndefined();
  expect(s.stage).toBe(s.events.at(-1)?.stage);
  expect(s.events.map(e=>e.sequence)).toEqual(s.events.map((_,i)=>i+1));
  expect(new Set(s.messages.map(m=>m.id)).size).toBe(s.messages.length);
  const evidenceIds=s.evidence.map(e=>e.id), constraintIds=s.constraints.map(c=>c.id);
  for(const id of s.developerNeed.verifiedContext)expect(s.evidence.find(e=>e.id===id)?.status).toBe('verified');
  for(const h of s.hypotheses)for(const id of h.evidenceIds)expect(evidenceIds).toContain(id);
  for(const c of s.capabilities)for(const id of c.evidenceIds)expect(evidenceIds).toContain(id);
  for(const candidate of s.candidateSolutions){for(const id of candidate.evidenceIds)expect(evidenceIds).toContain(id);for(const id of candidate.constraintIds)expect(constraintIds).toContain(id);}
 }
 expect(Object.keys(examples.errors!)).toHaveLength(8);
 for(const [code,error] of Object.entries(examples.errors!)){expect(error.contractVersion).toBe(CONTRACT_VERSION);expect(error.error.code).toBe(code);}
 expect(examples.investigation!.state.developerNeed.assumptions.length).toBeGreaterThan(0);
 expect(examples.investigation!.state.evidence.some(e=>e.status==='inferred')).toBe(true);
});
