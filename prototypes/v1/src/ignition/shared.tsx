import {useEffect,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {provenance} from './diff';
import {needsRevalidation,type IgnitionState} from './api';

/** Dialog following reference 070: title bar, body, footer with text Close and compact primary. */
export function Dialog({title,onClose,children,footer}:{title:string;onClose:()=>void;children:ReactNode;footer:ReactNode}){
 useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',esc);return()=>document.removeEventListener('keydown',esc);},[onClose]);
 return <div className="pt-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="pt-dialog" role="dialog" aria-modal="true" aria-label={title}>
   <div className="pt-dialog-head">{title}<button aria-label="Close dialog" onClick={onClose}><X size={16}/></button></div>
   <div className="pt-dialog-body">{children}</div>
   <div className="pt-dialog-foot">{footer}</div>
  </div>
 </div>;
}

/** Approved handoff lines, with extraction provenance shown as small source tags. */
export function HandoffLines({text}:{text:string}){
 return <ul className="pt-list">{text.split('\n').filter(Boolean).map((line,i)=>{const p=provenance(line);return <li key={i}><span>{p.text}{p.source&&<> <span className="pt-tag">{p.source.split(' · ')[0]}</span></>}</span></li>;})}</ul>;
}

/** Entity-style header (047): crumb, title, right-aligned meta. */
export function EntityHead({crumb,title,meta}:{crumb:string;title:string;meta:[string,ReactNode][]}){
 return <div className="pt-entity-head"><div><p className="pt-crumb">{crumb}</p><h2>{title}</h2></div>
  <div className="pt-meta">{meta.map(([k,v])=><div key={k}>{k}<span>{v}</span></div>)}</div></div>;
}

/** Cohort or personal adoption in the Insights layout (075). Invitations never count as adoption. */
export function Adoption({state}:{state:IgnitionState}){
 const rows=Object.entries(state.progress),ids=Object.keys(state.workflows);
 const active=rows.filter(([,p])=>Object.keys(p??{}).length>0).length,complete=rows.filter(([,p])=>ids.every(w=>p?.[w])).length;
 const stale=rows.reduce((n,[,p])=>n+ids.filter(w=>needsRevalidation(p?.[w],state)).length,0);
 const personal=state.role==='developer';
 return <>
  <div className="pt-headlines">
   <section className="pt-headline" aria-label="Developers with a verified outcome"><h3>{personal?'Your workflows':'Developers'}</h3>
    <p>{personal?`${ids.filter(w=>rows[0]?.[1]?.[w]).length} of ${ids.length} workflows verified in simulation`:`${active} of ${rows.length} invited developers have a verified outcome`}</p>
    <div className="pt-ring" style={{['--v' as string]:personal?ids.filter(w=>rows[0]?.[1]?.[w]).length/ids.length*100:rows.length?active/rows.length*100:0}}><div><strong>{personal?ids.filter(w=>rows[0]?.[1]?.[w]).length:active}</strong><span>{personal?'verified':'developers'}</span></div></div></section>
   <section className="pt-headline"><h3>Completed onboarding</h3><p>{personal?(complete?'Both workflows verified.':'Not complete yet.'):`${complete} developer(s) verified both ownership and documentation`}</p></section>
   <section className="pt-headline"><h3>{personal?'Handoff':'Invitations'}</h3><p>{personal?`Current approved handoff: v${state.handoff?.version??'—'}`:`${state.preferences.invites.length} simulated invitation(s) prepared. Invitations are not adoption.`}</p>
    {stale>0&&<p><span className="pt-pill amber">{stale} outcome(s) to revalidate</span></p>}</section>
  </div>
  <section className="pt-section" style={{marginTop:40}} aria-label="Outcomes">
   <h3>{personal?'Your outcomes':'Outcomes by developer'}</h3>
   <table className="pt-table"><thead><tr><th>Developer</th>{ids.map(w=><th key={w}>{state.workflows[w].title}</th>)}</tr></thead>
    <tbody>{rows.map(([p,progress])=><tr key={p}><td style={{textTransform:'capitalize'}}>{p}</td>{ids.map(w=>{const o=progress?.[w];return <td key={w}>{o?<><span className="pt-ok">✓</span> Verified in simulation · handoff v{o.handoffVersion}<br/><small className="pt-note" style={{marginTop:0}}>{new Date(o.at).toLocaleString()}</small>{needsRevalidation(o,state)&&<><br/><span className="pt-pill amber">Revalidate against v{state.handoff!.version}</span></>}</>:<span style={{color:'var(--p-subtle)'}}>Not verified</span>}</td>;})}</tr>)}</tbody></table>
   <p className="pt-note">Outcomes come from simulated verification, not live telemetry. Each outcome keeps the handoff version it was verified against.</p>
  </section>
 </>;
}
