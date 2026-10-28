import type {HandoffRecord} from '../../../../contracts/activation/v1/handoff';

/** User-facing version names: drafts are numbered, publication freezes one draft as a version. */
export const versionLabel=(r:HandoffRecord)=>r.status==='published'?`Published version ${r.publishedVersion} · ${new Date(r.publishedAt!).toLocaleDateString()}`:`Draft ${r.draft} · not published`;
/** Plan versions count from 1; later versions follow a developer blocker. */
export const planLabel=(planRevision:number)=>planRevision===0?'Version 1':`Version ${planRevision+1} · updated after a blocker`;
