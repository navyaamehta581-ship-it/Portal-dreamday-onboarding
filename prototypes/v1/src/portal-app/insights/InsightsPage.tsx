import {useCallback,useEffect,useState} from 'react';
import {ChartColumn,RefreshCw} from 'lucide-react';
import type {Insights} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';
import {when} from '../work/Thread';
import {STATUS_LABEL,statusTone} from '../work/useMilestoneWork';

const STAGE:Record<string,string>={not_started:'No plan yet',draft:'Draft with Chris',submitted:'Sent for review (earlier version)',changes_requested:'Changes requested (earlier version)',resubmitted:'Sent for review (earlier version)',approved:'Finalized',published:'Published'};
const REVIEW:Record<string,string>={none:'—',awaiting_review:'Marked ready',reviewed:'Reviewed',reviewed_outdated:'Changed since review'};

/** Insights (075–077 family): onboarding progress computed on the server from what people recorded in this Portal.
 * Nothing here is estimated or detected automatically; anything not recorded shows as not recorded. Chris only reads
 * it. Demo data is labelled as such. */
export function InsightsPage({api,customer,demo}:{api:ReturnType<typeof activationClient>|null;customer:string;demo:boolean}){
 const [data,setData]=useState<Insights|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{if(!api)return;setLoading(true);try{setData(await api.insights());setError(null);}catch(e){setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');}finally{setLoading(false);}},[api]);
 useEffect(()=>{void load();},[load]);
 const s=data?.summary,team=data?.viewer.role!=='developer',operator=data?.viewer.role==='operator';
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><ChartColumn size={16} aria-hidden="true"/></span>Insights</h1>
   <div className="tools"><button className="pt-tool" disabled={loading} onClick={()=>void load()}><RefreshCw size={15} aria-hidden="true"/>{loading?'Refreshing…':'Refresh'}</button></div></div>
  <div className="pt-entity">
   <div className="pt-entity-head"><div><p className="pt-crumb">Insights — {customer}</p><h2>Onboarding progress</h2>
    <p className="pt-note" style={{marginTop:6}}>Counted from what developers and the Champion recorded in Portal as they work{data?` · updated ${when(data.generatedAt)}`:''}. Nothing is detected automatically from repositories or tools, and recorded progress isn’t verified.{operator?' Read-only: the Champion and developers make every change, so nothing here needs your follow-up.':''}</p></div></div>
   {demo&&<div className="pt-banner warn" role="status">Fictional demo data: every number comes from activity recorded for the fictional customer. Repository evidence is sample data unless it’s marked live.</div>}
   {error&&<div className="pt-banner error" role="alert">Insights couldn’t be loaded. Check that the demo API is running, then refresh.</div>}
   {!data?(!error&&<p className="pt-note" role="status">Loading insights…</p>):<div style={{display:'grid',gap:20,marginTop:22}}>
    <section className="pt-card" aria-label="Plan status">
     <h3>Onboarding plan</h3>
     <p style={{marginTop:10}}>{data.plan.approved?`Published by ${data.plan.approvedBy} on ${when(data.plan.approvedAt)}.`:`Not published yet. Milestones appear here once ${operator?'you finalize':'Chris finalizes'} the onboarding plan.`}</p>
     {data.plan.stage&&<p className="pt-note">Stage: {STAGE[data.plan.stage]??data.plan.stage}</p>}
    </section>
    {s&&<section className="pt-card" aria-label="Progress summary">
     <h3>Completion</h3>
     <div className="pt-progress" aria-hidden="true" style={{marginTop:14}}><span style={{width:`${s.milestones?s.completed/s.milestones*100:0}%`}}/></div>
     <dl className="pt-coord-summary">
      <div><dt>Milestones completed</dt><dd>{s.completed}<small> of {s.milestones}</small></dd></div>
      <div><dt>Reviewed by the Champion</dt><dd>{s.reviewed}<small> of {s.milestones}</small></dd></div>
      <div><dt>Marked ready for review</dt><dd>{s.awaitingReview}</dd></div>
      <div><dt>Blocked</dt><dd>{s.blocked}</dd></div>
      <div><dt>Open blockers</dt><dd>{s.openBlockers}</dd></div>
      <div><dt>Open questions</dt><dd>{s.openQuestions+s.openFollowUps}</dd></div>
      <div><dt>Actions done</dt><dd>{s.actionsCompleted}<small> of {s.actionsTotal}</small></dd></div>
     </dl>
     <p className="pt-note">The plan has no deadlines, so nothing is shown as overdue. A Champion review is optional and never required to complete a milestone.</p>
    </section>}
    {data.milestones.length>0&&<section className="pt-card" aria-label="Milestones">
     <h3>Milestones</h3>
     <table className="pt-table"><thead><tr><th>Milestone</th><th>Working on it</th><th>Status</th><th>Review</th><th>Actions</th><th>Blockers · questions</th><th>Last activity</th></tr></thead>
      <tbody>{data.milestones.map(m=><tr key={m.id}><td>{m.title}</td><td>{m.workingOn?.length?m.workingOn.join(', '):m.assignee?`Suggested: ${m.assignee}`:'Nobody yet'}</td>
       <td><span className={'pt-pill '+statusTone(m.status as keyof typeof STATUS_LABEL)}>{STATUS_LABEL[m.status as keyof typeof STATUS_LABEL]??m.status}</span></td>
       <td>{REVIEW[m.reviewState??'none']}</td><td>{m.actionsCompleted} of {m.actionsTotal}</td><td>{m.openBlockers} · {m.openQuestions}</td><td>{m.lastActivityAt?when(m.lastActivityAt):'—'}</td></tr>)}</tbody></table>
    </section>}
    {data.plan.approved&&<section className="pt-card" aria-label="Activity">
     <h3>{team?'Activity recorded in Portal':'Your recorded activity'}</h3>
     {data.activity.length?<table className="pt-table"><thead><tr><th>Person</th><th>Action changes</th><th>Updates</th><th>Blockers</th><th>Questions</th><th>Replies · notes · reviews</th><th>Last active</th></tr></thead>
      <tbody>{data.activity.map(a=><tr key={a.name}><td>{a.name}{a.role==='champion'?' (Champion)':''}</td><td>{a.actionChanges}</td><td>{a.updates}</td><td>{a.blockers}</td><td>{a.questions}</td><td>{a.replies} · {a.coordination} · {a.reviews}</td><td>{when(a.lastActiveAt)||'—'}</td></tr>)}</tbody></table>
      :<p className="pt-note">No activity recorded yet.</p>}
     {team&&<p className="pt-note">{data.reportedReferences} evidence reference{data.reportedReferences===1?'':'s'} reported by developers (not verified).</p>}
    </section>}
    <section className="pt-card" aria-label="Evidence coverage">
     <h3>Repository evidence coverage</h3>
     {data.evidence.length?<table className="pt-table"><thead><tr><th>Repository</th><th>Kind</th><th>Last observed by the Portal</th><th>Observed</th><th>Not found</th><th>Not readable</th><th>Not checked</th></tr></thead>
      <tbody>{data.evidence.map(e=><tr key={e.id}><td>{e.label}<br/><small className="pt-note">{e.repository}</small></td>
       <td><span className={'pt-pill '+(e.mode==='live'?'green':'amber')}>{e.mode==='live'?'Live':'Sample data'}</span></td>
       <td>{e.inspected?<>{when(e.lastInspectedAt)}{e.stale&&<> <span className="pt-pill amber">Stale</span></>}{e.lastAttemptFailed&&<> <span className="pt-pill red">Last attempt failed</span></>}</>:'Not observed yet'}</td>
       <td>{e.observed}</td><td>{e.notFound}</td><td>{e.notReadable}</td><td>{e.notInspected}</td></tr>)}</tbody></table>
      :<p className="pt-note">No repository is configured for this work, so nothing about its repositories is verified.</p>}
    </section>
   </div>}
  </div>
 </div>;
}
