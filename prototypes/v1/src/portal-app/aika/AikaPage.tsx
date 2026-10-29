import {useState} from 'react';
import {Triangle} from 'lucide-react';
import type {AikaSection} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';
import type {MilestoneWorkSession} from '../work/useMilestoneWork';
import {aikaProblem,useAika} from './useAika';
import {SIGNAL_LABEL,type RepositoryEvidenceSession} from '../work/useRepositoryEvidence';

const KIND:Record<AikaSection['kind'],[string,string]>={known:['Known','green'],verified:['Verified · repository','green'],sample:['Sample data','amber'],reported:['Reported','blue'],suggestion:['Suggestion','amber'],unknown:['Unknown','']};
const SUGGESTIONS=['What should I do next on this milestone?','What does this milestone depend on, and is it ready?','What is still unknown, and who could answer it?'];

/** AiKA inside the Portal. The server builds its context from the approved, developer-safe plan and this
 * person's own progress, runs the local model, and checks the answer; the browser never talks to the model. */
export function AikaPage({api,work,repos}:{api:ReturnType<typeof activationClient>;work:MilestoneWorkSession;repos?:RepositoryEvidenceSession}){
 const aika=useAika(api);
 const options=(work.progress?.milestones??[]).filter(m=>m.detail);
 const initial=new URLSearchParams(window.location.search).get('milestone');
 const [milestone,setMilestone]=useState<string>(initial??'');
 const [question,setQuestion]=useState('');
 const job=aika.job,valid=question.trim().length>=3&&question.trim().length<=500;
 const chosen=options.some(m=>m.id===milestone)?milestone:'';
 async function send(q=question){if(await aika.ask(q.trim(),chosen||null))setQuestion('');}
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><Triangle size={16} aria-hidden="true"/></span>AiKA</h1></div>
  <div className="pt-entity">
   <div className="pt-entity-head"><div><p className="pt-crumb">AiKA — your onboarding assistant</p><h2>Ask about your approved onboarding work</h2>
    <p className="pt-note" style={{marginTop:6}}>AiKA answers from your team’s approved plan and your own progress only. It can’t open repositories or systems, and it labels what is known, reported, a suggestion or unknown.</p></div></div>
   <div style={{display:'grid',gap:22,marginTop:26}}>
    <section className="pt-card" aria-label="Ask AiKA">
     <div className="pt-form-row two">
      <label className="pt-form-field"><span>About</span><select className="pt-input" aria-label="Milestone for AiKA" value={chosen} onChange={e=>setMilestone(e.target.value)}>
       <option value="">All of my approved work</option>{options.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
     </div>
     <label className="pt-form-field"><span>Your question</span><textarea className="pt-textarea compact" rows={3} maxLength={500} aria-label="Question for AiKA" value={question} disabled={aika.running} onChange={e=>setQuestion(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&valid)void send();}}/></label>
     <div className="pt-actions">
      <button className="pt-btn sm" disabled={!valid||aika.running||aika.sending} onClick={()=>void send()}>{aika.running||aika.sending?'AiKA is answering…':'Ask AiKA'}</button>
      {SUGGESTIONS.map(s=><button key={s} className="pt-btn sm ghost" disabled={aika.running||aika.sending} onClick={()=>void send(s)}>{s}</button>)}
     </div>
     {aika.error&&<div className="pt-banner error" role="alert">{aikaProblem(aika.error)}</div>}
    </section>
    {job&&<section className="pt-card" aria-label="AiKA answer" aria-busy={job.status==='running'}>
     <div className="pt-card-head"><h3>{job.question}</h3><span className="pt-note" style={{marginTop:0}}>{job.status==='running'?`Thinking… ${Math.round(job.elapsedMs/1000)}s`:`Answered in ${Math.round(job.elapsedMs/1000)}s`}</span></div>
     {job.status==='running'&&<p className="pt-note" role="status">AiKA is working on your question with the local model. This can take a minute on a laptop; you can keep using the Portal.</p>}
     {job.status==='failed'&&<div className="pt-banner error" role="alert">{aikaProblem(job.error??'AIKA_FAILED')}</div>}
     {job.answer&&<>
      <ul className="pt-aika-sections">{job.answer.sections.map((s,i)=><li key={i}><span className={'pt-pill '+KIND[s.kind][1]}>{KIND[s.kind][0]}</span><div><p>{s.text}</p>
       {s.citations?.length?<p className="pt-note" style={{marginTop:4}} data-testid="aika-citations">Based on: {s.citations.map(c=>{const o=repos?.observations.get(c);return o?`${SIGNAL_LABEL[o.signal]} (${o.mode==='fixture'?'sample data':`live, ${o.repository}${o.commit?`@${o.commit.slice(0,12)}`:''}`}, retrieved ${new Date(o.retrievedAt).toLocaleString()})`:`recorded observation ${c}`;}).join('; ')}</p>:null}</div></li>)}</ul>
      {job.answer.nextStep&&<><p className="pt-label" style={{marginTop:20}}>Suggested next step</p><p style={{marginTop:6}}>{job.answer.nextStep}</p></>}
      <p className="pt-note">{job.answer.removed?`${job.answer.removed} part${job.answer.removed===1?' was':'s were'} removed because ${job.answer.removed===1?'it':'they'} didn’t pass AiKA’s checks. `:''}AiKA can be wrong. “Known” means stated in your approved plan; “Verified” cites a repository observation the Portal recorded (“Sample data” cites sample evidence). AiKA itself inspected nothing.</p>
     </>}
    </section>}
   </div>
  </div>
 </div>;
}
