import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createConversation,appendMessage,ConversationError} from '../../src/phase-a/controller.ts';
export function createStore(directory) {
 let queue=Promise.resolve();
 const serial=task=>{const next=queue.then(task);queue=next.catch(()=>{});return next;};
 const path=id=>{if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw new ConversationError('NOT_FOUND','Conversation not found.');return join(directory,`${id}.json`);};
 const read=async id=>{try{return JSON.parse(await readFile(path(id),'utf8'));}catch(e){if(e.code==='ENOENT')throw new ConversationError('NOT_FOUND','Conversation not found.');throw e;}};
 const save=async state=>{await mkdir(directory,{recursive:true,mode:0o700});const target=path(state.conversationId);const temp=`${target}.tmp`;await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,target);return state;};
 return {create:()=>serial(()=>save(createConversation(randomUUID()))),read,append:(id,input)=>serial(async()=>save(appendMessage(await read(id),input,new Date().toISOString())))};
}
