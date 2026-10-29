/** Phase 8: Insights. Onboarding progress computed on the server from the records the Portal already keeps
 * (published milestones and the work developers recorded on them, coordination and reviews, repository observations). Nothing is estimated or
 * invented: every number counts stored records, and anything not recorded is reported as missing.
 *
 * Authorization follows the existing views: the Champion and Chris see everyone's activity; a developer sees the
 * team's totals and milestone statuses, and only their own activity in detail. */
import type {DeveloperHandoff,HandoffRecord,Insights,PersonActivity,RepositoryEvidenceView} from '../../../../contracts/activation/v1/handoff.ts';
import type {Principal} from './store.ts';
import type {Viewer,WorkService} from './handoff/work.ts';
import type {RepositoryService} from './repository.ts';

export function createInsights(deps:{work:WorkService;repositories:RepositoryService;records:(p:Principal)=>HandoffRecord[];published:(p:Principal)=>DeveloperHandoff|null;now?:()=>number}){
 const now=deps.now??(()=>Date.now());
 return {view(p:Principal,viewer:Viewer):Insights{
  const h=deps.published(p),approved=!!h?.approval,full=viewer.role!=='developer';
  const latest=deps.records(p).at(-1);
  const plan={approved,approvedBy:h?.approval?.by??null,approvedAt:h?.approval?.at??null,stage:full?(latest?.status??'not_started'):null};
  let evidence:RepositoryEvidenceView[]=[];
  try{evidence=deps.repositories.view(p,viewer).repositories;}catch{evidence=[];}
  const ev=evidence.map(r=>{const o=r.evidence?.observations??[],n=(s:string)=>o.filter(x=>x.status===s).length;
   return {id:r.id,label:r.label,repository:r.repository,mode:r.mode,inspected:!!r.evidence,lastInspectedAt:r.evidence?.completedAt??null,stale:r.stale,lastAttemptFailed:r.latest?.status==='failed',
    observed:n('observed'),notFound:n('missing'),notReadable:n('inaccessible'),notInspected:n('not_inspected')};});
  if(!approved)return {generatedAt:new Date(now()).toISOString(),viewer,plan,summary:null,milestones:[],activity:[],reportedReferences:0,evidence:ev};
  // Activity is counted from every record; what is returned depends on the viewer.
  const all=deps.work.view(p,{role:'champion',name:null}),mine=deps.work.view(p,viewer);
  const people=new Map<string,PersonActivity>();
  const person=(name:string,role:PersonActivity['role'])=>{let a=people.get(name);if(!a){a={name,role,actionChanges:0,updates:0,blockers:0,questions:0,replies:0,coordination:0,reviews:0,lastActiveAt:null};people.set(name,a);}return a;};
  const seen=(a:PersonActivity,at:string|null)=>{if(at&&(!a.lastActiveAt||at>a.lastActiveAt))a.lastActiveAt=at;};
  let references=0;
  const last=new Map<string,string|null>();
  for(const m of all.milestones){
   const d=m.detail!;let latestAt:string|null=null;const touch=(at:string|null)=>{if(at&&(!latestAt||at>latestAt))latestAt=at;};
   for(const a of d.actions)if(a.by&&a.status!=='not_started'){const x=person(a.by,'developer');x.actionChanges++;seen(x,a.at);touch(a.at);}
   for(const u of d.updates){
    const x=person(u.by,u.role==='champion'?'champion':'developer');seen(x,u.at);touch(u.at);
    if(u.evidence)references++;
    if(u.kind==='update')x.updates++;else if(u.kind==='blocker')x.blockers++;else if(u.kind==='question')x.questions++;
    else if(u.kind==='response')x.replies++;else x.coordination++;
   }
   if(m.review){const x=person(m.review.by,'champion');x.reviews++;seen(x,m.review.at);touch(m.review.at);}
   last.set(m.id,latestAt);
  }
  const activity=[...people.values()].filter(a=>full||a.name===viewer.name).sort((a,b)=>(b.lastActiveAt??'').localeCompare(a.lastActiveAt??''));
  return {generatedAt:new Date(now()).toISOString(),viewer,plan,summary:all.summary??null,
   milestones:mine.milestones.map(m=>({id:m.id,title:m.title,assignee:m.assignee,workingOn:m.workingOn??[],status:m.status,reviewState:m.reviewState??null,actionsCompleted:m.actionsCompleted??0,actionsTotal:m.actionsTotal??0,
    openBlockers:m.openBlockers,openQuestions:m.openQuestions??0,lastActivityAt:full||m.mine?last.get(m.id)??null:null})),
   activity,reportedReferences:full?references:0,evidence:ev};
 }};
}
export type InsightsService=ReturnType<typeof createInsights>;
