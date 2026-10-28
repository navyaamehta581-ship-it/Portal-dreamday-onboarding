import {DatabaseSync} from 'node:sqlite';
import type {DeveloperHandoff,HandoffRecord} from '../../../../../contracts/activation/v1/handoff.ts';
import type {Principal} from '../store.ts';

/** Operator-only handoff records: private sources, full understanding and proposals, one row per draft.
 * Lives in its own table; activation session state never contains the private sources. */
export function openHandoffStore(filename:string){
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS activation_handoffs (tenant TEXT NOT NULL, customer TEXT NOT NULL, session TEXT NOT NULL, draft INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,customer,session,draft)) STRICT;`);
 const key=(p:Principal)=>[p.tenantId,p.customerId,p.sessionId];
 const all=(p:Principal)=>db.prepare('SELECT body FROM activation_handoffs WHERE tenant=? AND customer=? AND session=? ORDER BY draft').all(...key(p)).map(r=>JSON.parse(r.body as string) as HandoffRecord);
 return {
  all,
  get:(p:Principal,draft:number)=>all(p).find(r=>r.draft===draft)??null,
  add(p:Principal,record:Omit<HandoffRecord,'draft'>):HandoffRecord{
   const draft=(all(p).at(-1)?.draft??0)+1,full={...record,draft};
   db.prepare('INSERT INTO activation_handoffs VALUES (?,?,?,?,?)').run(...key(p),draft,JSON.stringify(full));return full;
  },
  save(p:Principal,record:HandoffRecord){db.prepare('UPDATE activation_handoffs SET body=? WHERE tenant=? AND customer=? AND session=? AND draft=?').run(JSON.stringify(record),...key(p),record.draft);},
  published:(p:Principal):DeveloperHandoff|null=>all(p).filter(r=>r.status==='published').at(-1)?.developer??null,
  close:()=>db.close(),
 };
}
export type HandoffStore=ReturnType<typeof openHandoffStore>;
