import {CONTRACT_VERSION,ROUTES,type StateResponse,type MessageRequest} from './contract';
export async function requestState(path:string,body?:unknown):Promise<StateResponse> {
 const response=await fetch(path,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error?.message??'Conversation request failed.');
 if(data.contractVersion!==CONTRACT_VERSION||!data.state||data.state.contractVersion!==CONTRACT_VERSION)throw new Error('Unsupported conversation response.');
 return data;
}
export const conversationClient={create:()=>requestState(ROUTES.create,{contractVersion:CONTRACT_VERSION}),read:(id:string)=>requestState(ROUTES.state(id)),send:(id:string,input:MessageRequest)=>requestState(ROUTES.messages(id),input)};
