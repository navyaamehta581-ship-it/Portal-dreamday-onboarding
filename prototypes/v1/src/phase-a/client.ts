import {CONTRACT_VERSION,ROUTES,type StateResponse,type MessageRequest,type ErrorCode} from './contract';
export class ConversationError extends Error {
 constructor(message:string,public code?:ErrorCode,public status?:number){super(message);this.name='ConversationError';}
}
export async function requestState(path:string,body?:unknown):Promise<StateResponse> {
 let response:Response;
 try{response=await fetch(path,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});}catch{throw new ConversationError('Server unavailable. Your draft is preserved. Reload before retrying; your message may have been saved.');}
 let data:StateResponse & {error?:{code:ErrorCode;message:string}};
 try{data=await response.json();}catch{throw new ConversationError('Unreadable server response. Reload before retrying.',undefined,response.status);}
 if(!response.ok)throw new ConversationError(data.error?.message??'Conversation request failed.',data.error?.code,response.status);
 if(data.contractVersion!==CONTRACT_VERSION||!data.state||data.state.contractVersion!==CONTRACT_VERSION)throw new ConversationError('Unsupported conversation response.');
 return data;
}
export const conversationClient={create:()=>requestState(ROUTES.create,{contractVersion:CONTRACT_VERSION}),read:(id:string)=>requestState(ROUTES.state(id)),send:(id:string,input:MessageRequest)=>requestState(ROUTES.messages(id),input)};
