import {createConversation, appendMessage} from './controller.ts';
import {CONTRACT_VERSION, type StateResponse, type ErrorResponse, type FixtureResponse} from './contract.ts';
export const fixtureResponse:StateResponse={contractVersion:CONTRACT_VERSION,state:appendMessage(createConversation('fixture-conversation'),{contractVersion:CONTRACT_VERSION,expectedRevision:0,content:'Automate deployment; keep existing tests unchanged.',confirmedConstraints:['Existing tests must remain unchanged.']},'2026-10-25T09:00:00Z')};
export const conflictFixture:ErrorResponse={contractVersion:CONTRACT_VERSION,error:{code:'REVISION_CONFLICT',message:'Reload the latest conversation before sending.'}};

/** All scenarios below are synthetic UI snapshots, never live tool/model results. */
const multiTurn = appendMessage(fixtureResponse.state, {
 contractVersion: CONTRACT_VERSION, expectedRevision: 1,
 content: 'Target staging first. Our existing tests must still remain unchanged.',
}, '2026-10-25T09:01:00Z');

const clarification = structuredClone(multiTurn);
clarification.stage = 'awaiting_clarification';
clarification.pendingQuestion = {
 id: 'fixture-question-1', question: 'Should staging deployment require manual approval?',
 reason: 'Synthetic example: the approval requirement is developer-specific and changes the proposed intervention.',
};
clarification.messages.push({id: 'm-5', role: 'assistant', content: clarification.pendingQuestion.question, createdAt: '2026-10-25T09:02:00Z'});
clarification.events.push({sequence: clarification.events.length+1, stage: clarification.stage, operation: 'Synthetic snapshot: clarification pending; no model decision executed.', at: '2026-10-25T09:02:00Z'});

const investigation = structuredClone(multiTurn);
investigation.stage = 'investigating_environment';
investigation.evidence.push(
 {id: 'fixture-file-1', claim: 'Synthetic repository contains .github/workflows/ci.yml with a test job.', status: 'verified', source: 'fixture://repository/.github/workflows/ci.yml', revision: 'fixture-revision-001', observedAt: '2026-10-25T09:02:00Z'},
 {id: 'fixture-inference-1', claim: 'Existing CI may be reusable for a staging deployment extension.', status: 'inferred', source: 'fixture-file-1', observedAt: '2026-10-25T09:02:00Z'},
);
investigation.developerNeed.verifiedContext = ['fixture-file-1'];
investigation.developerNeed.assumptions = ['Synthetic assumption: staging accepts the same build artifact.'];
investigation.developerNeed.unknowns = ['Deployment credentials and approval policy have not been verified.'];
investigation.hypotheses = [{id: 'fixture-hypothesis-1', claim: 'A missing deployment job may explain the manual staging effort.', evidenceIds: ['fixture-file-1'], status: 'unassessed'}];
investigation.capabilities = [{id: 'fixture-capability-1', name: 'GitHub Actions configuration', status: 'verified', evidenceIds: ['fixture-file-1'], limitations: ['Synthetic configuration observation only; no passing run or deployment access is established.']}];
investigation.events.push({sequence: investigation.events.length+1, stage: investigation.stage, operation: 'Synthetic snapshot: read-only inspection in progress; no live tool executed.', at: '2026-10-25T09:02:00Z'});

const recommendation = structuredClone(investigation);
recommendation.stage = 'ready';
recommendation.candidateSolutions = [{
 id: 'fixture-solution-1', approach: 'modify',
 description: 'Synthetic recommendation: review an extension to existing CI for staging deployment while preserving its test job.',
 evidenceIds: ['fixture-file-1'], constraintIds: recommendation.constraints.map(c=>c.id),
 assumptions: ['Confirm approval policy and authorized deployment configuration before preparing an artifact.'],
}];
recommendation.selectedSolution = recommendation.candidateSolutions[0];
recommendation.messages.push({id: 'm-5', role: 'assistant', content: recommendation.selectedSolution.description, createdAt: '2026-10-25T09:03:00Z'});
recommendation.events.push({sequence: recommendation.events.length+1, stage: 'preparing_recommendation', operation: 'Synthetic snapshot: example recommendation assembled; no reasoning engine executed.', at: '2026-10-25T09:03:00Z'}, {sequence: recommendation.events.length+2, stage: 'ready', operation: 'Synthetic example ready for UI rendering; no artifact or execution.', at: '2026-10-25T09:03:00Z'});

const errorMessages = {
 INVALID_REQUEST: 'Enter a non-empty message.', NOT_FOUND: 'Conversation not found.',
 REVISION_CONFLICT: conflictFixture.error.message, UNSUPPORTED_VERSION: 'Use contract 1.0.0.',
 INTERNAL_ERROR: 'Conversation could not be saved.', FORBIDDEN: 'Origin is not allowed.',
 UNSUPPORTED_MEDIA_TYPE: 'Use application/json.', PAYLOAD_TOO_LARGE: 'Request body exceeds 8192 bytes.',
} as const;
const errors = Object.fromEntries(Object.entries(errorMessages).map(([code,message])=>[code,{contractVersion: CONTRACT_VERSION,error:{code,message}}])) as Record<keyof typeof errorMessages, ErrorResponse>;
const response = (state: StateResponse['state']): StateResponse => ({contractVersion: CONTRACT_VERSION,state});

/** Static examples are tagged at bundle level. Fixture IDs cannot resume live conversations. */
export const developmentFixtures: FixtureResponse = {
 contractVersion: CONTRACT_VERSION, mode: 'development_fixture', examples: {
  empty: response(createConversation('fixture-empty')),
  confirmedConstraint: fixtureResponse, conflict: conflictFixture,
  multiTurn: response(multiTurn), clarification: response(clarification),
  investigation: response(investigation), recommendation: response(recommendation), errors,
 },
};
