import type {ReactNode} from 'react';
import type {WorkUpdate} from '../../../../../contracts/activation/v1/handoff';

export const when=(at:string|null)=>at?new Date(at).toLocaleString():'';
const label=(u:WorkUpdate)=>u.kind==='blocker'?(u.resolved?'Resolved blocker':'Blocker'):u.kind==='question'?'Question':u.kind==='response'?'Reply':u.kind==='coordination'?'Coordination note':u.kind==='follow_up'?'Follow-up requested':'Update';
const tone=(u:WorkUpdate)=>u.kind==='blocker'?(u.resolved?'':'red'):u.kind==='question'||u.kind==='follow_up'?'amber':u.role==='champion'?'green':'blue';
/** Questions and follow-up requests stay open until someone replies to them. */
export const isOpen=(u:WorkUpdate,all:WorkUpdate[])=>u.kind==='blocker'?!u.resolved:u.kind==='question'||u.kind==='follow_up'?!all.some(x=>x.replyTo===u.id):false;

/** A milestone's record and discussion, oldest first, each entry with who wrote it and when. Developer references
 * are always labelled as reported; the Portal hasn't verified them. */
export function Thread({updates,actions,empty='Nothing recorded yet.'}:{updates:WorkUpdate[];actions?:(u:WorkUpdate)=>ReactNode;empty?:string}){
 if(!updates.length)return <p className="pt-note">{empty}</p>;
 return <ul className="pt-work-log">{updates.map(u=>{const parent=u.replyTo?updates.find(x=>x.id===u.replyTo):null,open=isOpen(u,updates);
  return <li key={u.id} className={u.replyTo?'reply':undefined} data-entry-kind={u.kind}>
   <span className={'pt-pill '+tone(u)}>{label(u)}</span>
   <div><p>{u.text}</p>
    {u.evidence&&<p className="pt-note" style={{marginTop:4}}>Reference (reported, not verified): <code>{u.evidence}</code></p>}
    <p className="pt-note" style={{marginTop:4}}>{u.by}{u.role==='champion'?' (Champion)':''}, {when(u.at)}{parent?` · in reply to ${parent.by}’s ${label(parent).toLowerCase()}`:''}
     {u.resolved?` · resolved by ${u.resolved.by}, ${when(u.resolved.at)}`:''}{(u.kind==='question'||u.kind==='follow_up')?(open?' · awaiting a reply':' · answered'):''}</p>
    {actions?.(u)}
   </div></li>;})}</ul>;
}
