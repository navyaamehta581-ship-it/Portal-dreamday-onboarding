import {GitBranch} from 'lucide-react';
import type {RepositoryEvidenceView,RepositoryObservation,RepositorySignal} from '../../../../../contracts/activation/v1/handoff';
import {when} from './Thread';
import {SIGNAL_LABEL,STATUS,repositoryProblem,type RepositoryEvidenceSession} from './useRepositoryEvidence';

/** Says what kind of evidence this is, everywhere it appears: live GitHub or sample data. */
export function ModeBadge({mode}:{mode:'live'|'fixture'}){
 return mode==='live'?<span className="pt-pill green" data-testid="evidence-mode">Live GitHub · read-only</span>
  :<span className="pt-pill amber" data-testid="evidence-mode">Sample data · fictional repository, not live</span>;
}

function Observation({o}:{o:RepositoryObservation}){
 const [label,tone]=STATUS[o.status];
 return <li data-signal={o.signal} data-status={o.status}>
  <span className={'pt-pill '+tone}>{o.mode==='fixture'&&o.status==='observed'?'Sample · observed':label}</span>
  <div><p><strong>{SIGNAL_LABEL[o.signal]}</strong> — {o.summary}</p>
   {o.details.length>0&&<p className="pt-note" style={{marginTop:4}}>{o.details.join(' · ')}</p>}
   {o.limitation&&<p className="pt-note" style={{marginTop:4}}>Limitation: {o.limitation}</p>}
   <p className="pt-note" style={{marginTop:4}}>Source: {o.source.request==='none'?'not retrieved':o.source.request}{o.source.path?` · ${o.source.path}`:''}
    {o.source.url&&<> · <a href={o.source.url} target="_blank" rel="noreferrer noopener">View on GitHub</a></>} · {when(o.retrievedAt)}</p>
  </div></li>;
}

/** One configured repository's evidence. With `focus`, the signals relevant to a milestone come first. */
export function RepositoryPanel({repo,repos,focus,canInspect=repo.canInspect}:{repo:RepositoryEvidenceView;repos:RepositoryEvidenceSession;focus?:RepositorySignal[];canInspect?:boolean}){
 const ev=repo.evidence,latest=repo.latest,failed=latest&&latest.status==='failed'?latest:null;
 const err=repos.error?.repositoryId===repo.id?repos.error:null,busy=repos.inspecting===repo.id;
 const obs=ev?.observations??[],first=focus?obs.filter(o=>focus.includes(o.signal)):obs,rest=focus?obs.filter(o=>!focus.includes(o.signal)):[];
 return <section className="pt-card" aria-label={`Repository evidence: ${repo.label}`} data-repository={repo.id}>
  <div className="pt-card-head"><h3><GitBranch size={16} aria-hidden="true"/> {repo.label}</h3><ModeBadge mode={repo.mode}/></div>
  <p className="pt-note" style={{marginTop:6}}>{repo.repository}{ev?` · inspected ${when(ev.completedAt)} by ${ev.requestedBy}${ev.commit?` at commit ${ev.commit.slice(0,12)}`:''}${ev.defaultBranch?` (${ev.defaultBranch})`:''}`:' · not inspected yet'}</p>
  {repo.mode==='fixture'&&<p className="pt-note">This is sample data for the fictional scenario. It shows how evidence looks; it is not a GitHub observation.</p>}
  {repo.stale&&<div className="pt-banner warn" role="status">This evidence is more than {repo.maxAgeHours} hours old. Inspect again before relying on it.</div>}
  {failed&&<div className="pt-banner error" role="status">The latest inspection ({when(failed.completedAt)}) didn’t complete: {repositoryProblem(failed.errorCode??'',failed.retryAfter)}{ev?` The evidence below is from the earlier inspection on ${when(ev.completedAt)}.`:''}</div>}
  {ev?.status==='partial'&&!failed&&<div className="pt-banner warn" role="status">Some files couldn’t be read; they are marked “Not readable”.</div>}
  {err&&<div className="pt-banner error" role="alert">{repositoryProblem(err.code)}</div>}
  {canInspect&&<div className="pt-actions"><button className="pt-btn sm ghost" disabled={!!repos.inspecting} onClick={()=>void repos.inspect(repo.id)}>{busy?'Inspecting…':ev?'Inspect again (read-only)':'Inspect repository (read-only)'}</button>
   <span className="pt-note" style={{marginTop:0}}>Reads the repository; nothing is changed, run or created.</span></div>}
  {ev?<>
   {focus&&<p className="pt-label" style={{marginTop:18}}>Most relevant to this milestone</p>}
   <ul className="pt-work-log">{first.map(o=><Observation key={o.id} o={o}/>)}</ul>
   {rest.length>0&&<details style={{marginTop:14}}><summary className="pt-label" style={{cursor:'pointer'}}>Other signals ({rest.length})</summary><ul className="pt-work-log">{rest.map(o=><Observation key={o.id} o={o}/>)}</ul></details>}
   <p className="pt-note">Observations don’t complete any action. You decide what they mean and record your work.</p>
  </>:!failed&&<p className="pt-note">Nothing has been inspected yet, so nothing about this repository is verified.</p>}
 </section>;
}

/** The status of the signals an action relates to, from the latest evidence. */
export function relatedEvidence(repo:RepositoryEvidenceView|undefined,signals:RepositorySignal[]){
 const obs=repo?.evidence?.observations??[];
 return signals.map(s=>{const o=obs.find(x=>x.signal===s);return `${SIGNAL_LABEL[s]}: ${o?STATUS[o.status][0].toLowerCase():'not inspected'}`;}).join(' · ');
}
