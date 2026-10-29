import {useCallback,useEffect,useState} from 'react';
import {ChartColumn,RefreshCw} from 'lucide-react';
import type {Insights} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';
import {when} from '../work/Thread';
import {STATUS_LABEL,statusTone} from '../work/useMilestoneWork';

const STAGE:Record<string,string>={not_started:'No plan yet',draft:'Draft with Chris',submitted:'Waiting for Champion review',changes_requested:'Changes requested',resubmitted:'Resubmitted for review',approved:'Approved',published:'Approved and published'};
const REVIEW:Record<string,string>={none:'—',awaiting_review:'Awaiting review',reviewed:'Reviewed',reviewed_outdated:'Changed since review'};

/** Insights (075–077 family): onboarding progress computed on the server from records in this Portal. Nothing here is
 * estimated; anything not recorded shows as not recorded. Demo data is labelled as such. */
export function InsightsPage({api,customer,demo}:{api:ReturnType<typeof activationClient>|null;customer:string;demo:boolean}){
 const [data,setData]=useState<Insights|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{if(!api)return;setLoading(true);try{setData(await api.insights());setError(null);}catch(e){setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');}finally{setLoading(false);}},[api]);
 useEffect(()=>{void load();},[load]);
 const s=data?.summary,team=data?.viewer.role!=='developer';
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><ChartColumn size={16} aria-hidden="true"/></span>Insights</h1>
   <div className="tools"><button className="pt-tool" disabled={loading} onClick={()=>void load()}><RefreshCw size={15} aria-hidden="true"/>{loading?'Refreshing…':'Refresh'}</button></div></div>
  <div className="pt-entity">
   <div className="pt-entity-head"><div><p className="pt-crumb">Insights — {customer}</p><h2>Onboarding progress</h2>
    <p className="pt-note" style={{marginTop:6}}>Counted from what people recorded in this Portal{data?` · updated ${when(data.generatedAt)}`:''}. Developers report progress; the Portal doesn’t verify it.</p></div></div>
   {demo&&<div className="pt-banner warn" role="status">Fictional demo data: every number comes from activity recorded for the fictional customer{error===null?'':''}. Repository evidence is sample data unless it’s marked live.</div>}
   {error&&<div className="pt-banner error" role="alert">Insights couldn’t be loaded. Check that the demo API is running, then refresh.</div>}
   {!data?(!error&&<p className="pt-note" role="status">Loading insights…</p>):<div style={{display:'grid',gap:20,marginTop:22}}>
    <section className="pt-card" aria-label="Plan status">
     <h3>Approved onboarding plan</h3>
     <p style={{marginTop:10}}>{data.plan.approved?`Approved by ${data.plan.approvedBy} on ${when(data.plan.approvedAt)}.`:'Not approved yet. Milestones appear here once the Champion approves the plan in Dream Day.'}</p>
     {data.plan.stage&&<p className="pt-note">Stage: {STAGE[data.plan.stage]??data.plan.stage}</p>}
    </section>
    {s&&<section className="pt-card" aria-label="Progress summary">
     <h3>Completion and review</h3>
     <div className="pt-progress" aria-hidden="true" style={{marginTop:14}}><span style={{width:`${s.milestones?s.completed/s.milestones*100:0}%`}}/></div>
     <dl className="pt-coord-summary">
      <div><dt>Milestones completed</dt><dd>{s.completed}<small> of {s.milestones}</small></dd></div>
      <div><dt>Reviewed by the Champion</dt><dd>{s.reviewed}<small> of {s.milestones}</small></dd></div>
      <div><dt>Awaiting review</dt><dd>{s.awaitingReview}</dd></div>
      <div><dt>Blocked</dt><dd>{s.blocked}</dd></div>
      <div><dt>Open blockers</dt><dd>{s.openBlockers}</dd></div>
      <div><dt>Open questions</dt><dd>{s.openQuestions+s.openFollowUps}</dd></div>
      <div><dt>Actions done</dt><dd>{s.actionsCompleted}<small> of {s.actionsTotal}</small></dd></div>
     </dl>
     <p className="pt-note">The approved plan has no deadlines, so nothing is shown as overdue.</p>
    </section>}
    {data.milestones.length>0&&<section className="pt-card" aria-label="Milestones">
     <h3>Approved milestones</h3>
     <table className="pt-table"><thead><tr><th>Milestone</th><th>Assignee</th><th>Status</th><th>Review</th><th>Actions</th><th>Blockers · questions</th><th>Last activity</th></tr></thead>
      <tbody>{data.milestones.map(m=><tr key={m.id}><td>{m.title}</td><td>{m.assignee??'Unassigned'}</td>
       <td><span className={'pt-pill '+statusTone(m.status as keyof typeof STATUS_LABEL)}>{STATUS_LABEL[m.status as keyof typeof STATUS_LABEL]??m.status}</span></td>
       <td>{REVIEW[m.reviewState??'none']}</td><td>{m.actionsCompleted} of {m.actionsTotal}</td><td>{m.openBlockers} · {m.openQuestions}</td><td>{m.lastActivityAt?when(m.lastActivityAt):'—'}</td></tr>)}</tbody></table>
    </section>}
    {data.plan.approved&&<section className="pt-card" aria-label="Activity">
     <h3>{team?'Team activity':'Your activity'}</h3>
     {data.activity.length?<table className="pt-table"><thead><tr><th>Person</th><th>Action changes</th><th>Updates</th><th>Blockers</th><th>Questions</th><th>Replies · notes · reviews</th><th>Last active</th></tr></thead>
      <tbody>{data.activity.map(a=><tr key={a.name}><td>{a.name}{a.role==='champion'?' (Champion)':''}</td><td>{a.actionChanges}</td><td>{a.updates}</td><td>{a.blockers}</td><td>{a.questions}</td><td>{a.replies} · {a.coordination} · {a.reviews}</td><td>{when(a.lastActiveAt)||'—'}</td></tr>)}</tbody></table>
      :<p className="pt-note">No activity recorded yet.</p>}
     {team&&<p className="pt-note">{data.reportedReferences} evidence reference{data.reportedReferences===1?'':'s'} reported by developers (not verified).</p>}
    </section>}
    <section className="pt-card" aria-label="Evidence coverage">
     <h3>Repository evidence coverage</h3>
     {data.evidence.length?<table className="pt-table"><thead><tr><th>Repository</th><th>Kind</th><th>Last inspected</th><th>Observed</th><th>Not found</th><th>Not readable</th><th>Not inspected</th></tr></thead>
      <tbody>{data.evidence.map(e=><tr key={e.id}><td>{e.label}<br/><small className="pt-note">{e.repository}</small></td>
       <td><span className={'pt-pill '+(e.mode==='live'?'green':'amber')}>{e.mode==='live'?'Live':'Sample data'}</span></td>
       <td>{e.inspected?<>{when(e.lastInspectedAt)}{e.stale&&<> <span className="pt-pill amber">Stale</span></>}{e.lastAttemptFailed&&<> <span className="pt-pill red">Last attempt failed</span></>}</>:'Not inspected'}</td>
       <td>{e.observed}</td><td>{e.notFound}</td><td>{e.notReadable}</td><td>{e.notInspected}</td></tr>)}</tbody></table>
      :<p className="pt-note">No repository is configured for this work, so nothing about its repositories is verified.</p>}
    </section>
   </div>}
  </div>
 </div>;
}
