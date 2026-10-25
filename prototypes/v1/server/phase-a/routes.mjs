import {CONTRACT_VERSION} from '../../src/phase-a/contract.ts';
import {developmentFixtures} from '../../src/phase-a/fixtures.ts';
export async function conversationRoute(store,method,url,input) {
 if(method==='GET' && url==='/api/conversations/v1/fixtures')return {status:200,body:structuredClone(developmentFixtures)};
 const match=/^\/api\/conversations\/v1(?:\/([a-zA-Z0-9-]+)(\/messages)?)?$/.exec(url);
 if(!match)return {status:404,body:{contractVersion:CONTRACT_VERSION,error:{code:'NOT_FOUND',message:'Route not found.'}}};
 try {
 let state;
 if(method==='POST'&&!match[1]) {
 if(input?.contractVersion!==CONTRACT_VERSION)return {status:400,body:{contractVersion:CONTRACT_VERSION,error:{code:'UNSUPPORTED_VERSION',message:'Use contract 1.0.0.'}}};
 if(Object.keys(input).some(key=>key!=='contractVersion'))return {status:400,body:{contractVersion:CONTRACT_VERSION,error:{code:'INVALID_REQUEST',message:'Only contractVersion is accepted when creating a conversation.'}}};
 state=await store.create();
 }else if(method==='GET'&&match[1]&&!match[2])state=await store.read(match[1]);
 else if(method==='POST'&&match[1]&&match[2])state=await store.append(match[1],input);
 else return {status:404,body:{contractVersion:CONTRACT_VERSION,error:{code:'NOT_FOUND',message:'Route not found.'}}};
 return {status:method==='POST'&&!match[1]?201:200,body:{contractVersion:CONTRACT_VERSION,state}};
 }catch(e){const code=e.code??'INTERNAL_ERROR';const status={NOT_FOUND:404,REVISION_CONFLICT:409,INVALID_REQUEST:400,UNSUPPORTED_VERSION:400}[code]??500;return {status,body:{contractVersion:CONTRACT_VERSION,error:{code:status===500?'INTERNAL_ERROR':code,message:status===500?'Conversation could not be saved.':e.message}}};}
}
