import {CONTRACT_VERSION, type AgentState, type MessageRequest, type AgentStage, type ErrorCode} from './contract.ts';
export class ConversationError extends Error { code: ErrorCode; constructor(code: ErrorCode, message: string) {super(message); this.code=code;} }
export function createConversation(id: string): AgentState {
 return {contractVersion: CONTRACT_VERSION, conversationId:id, revision:0, messages:[], developerNeed:{statedProblem:'',desiredOutcome:null,intent:'unclassified',verifiedContext:[],constraints:[],observedFriction:[],assumptions:[],unknowns:['Interpretation requires Phase B.'],confidence:0}, hypotheses:[],evidence:[],capabilities:[],constraints:[],candidateSolutions:[],stage:'ready',events:[],boundary:'read_only',mode:'phase_a_deterministic'};
}
export function appendMessage(current: AgentState, input: MessageRequest, now: string): AgentState {
 if (!input || typeof input !== 'object') throw new ConversationError('INVALID_REQUEST','A message is required.');
 if(input.contractVersion!==CONTRACT_VERSION) throw new ConversationError('UNSUPPORTED_VERSION','Use contract 1.0.0.');
 if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0) throw new ConversationError('INVALID_REQUEST','expectedRevision must be a non-negative integer.');
 const allowed=['contractVersion','expectedRevision','content','confirmedConstraints','answersQuestionId'];
 if(Object.keys(input).some(key=>!allowed.includes(key))) throw new ConversationError('INVALID_REQUEST','Unknown message field. Stages, evidence and boundaries are backend controlled.');
 if(input.expectedRevision!==current.revision) throw new ConversationError('REVISION_CONFLICT','Reload the latest conversation before sending.');
 if(typeof input.content!=='string'||!input.content.trim()||input.content.length>4000 || (input.confirmedConstraints!==undefined && (!Array.isArray(input.confirmedConstraints)||input.confirmedConstraints.length>20||input.confirmedConstraints.some(x=>typeof x!=='string'||!x.trim()||x.length>500)))) throw new ConversationError('INVALID_REQUEST','Enter a message up to 4000 characters and constraints up to 500 characters.');
 if(input.answersQuestionId!==undefined && (!current.pendingQuestion || input.answersQuestionId!==current.pendingQuestion.id)) throw new ConversationError('INVALID_REQUEST','The clarification is no longer pending.');
 const state=structuredClone(current);
 const transition=(stage:AgentStage,operation:string)=>{state.stage=stage;state.events.push({sequence:state.events.length+1,stage,operation,at:now});};
 transition('understanding_request','Record message and explicitly confirmed constraints; semantic interpretation deferred.');
 const id=`m-${state.messages.length+1}`;
 state.messages.push({id,role:'user',content:input.content.trim(),createdAt:now});
 if(!state.developerNeed.statedProblem)state.developerNeed.statedProblem=input.content.trim();
 for(const text of input.confirmedConstraints??[]) if(!state.constraints.some(c=>c.text===text.trim()))state.constraints.push({id:`c-${state.constraints.length+1}`,text:text.trim(),status:'confirmed',sourceMessageId:id});
 state.developerNeed.constraints=structuredClone(state.constraints);
 state.evidence.push({id:`e-${state.evidence.length+1}`,claim:input.content.trim(),status:'developer_statement',source:id,observedAt:now});
 if(input.answersQuestionId) delete state.pendingQuestion;
 state.messages.push({id:`m-${state.messages.length+1}`,role:'assistant',content:`Recorded your message. ${state.constraints.length} confirmed constraint(s) retained. Phase A does not interpret goals, inspect repositories through chat, or propose artifacts.`,createdAt:now});
 transition('ready','Persistable response assembled; no investigation, model, or artifact operation performed.');
 state.revision++;
 return state;
}
