import {useState} from 'react';
import {CheckCircle2} from 'lucide-react';
import {navigate} from '../../portal-app/router';
import {routeBase} from '../api';
import type {IgnitionSession} from '../useIgnition';

/** Catalog setup in the original three-step layout (012 → 014 → 018). */
export function Setup({session,stage}:{session:IgnitionSession;stage:'team'|'components'|'register'}){
 const base=routeBase(session.person),state=session.state!;
 const [team,setTeam]=useState('northstar/team-payments'),[type,setType]=useState(''),[lifecycle,setLifecycle]=useState('production'),[selected,setSelected]=useState(true);
 const prepared=!!state.steps?.[state.person]?.prepare,registered=!!state.steps?.[state.person]?.register;
 const step=stage==='team'?1:stage==='components'?2:3;
 return <div className="pt-page" style={{paddingTop:40}}><div className="pt-stepper">
  <div className="pt-stepbar" aria-hidden="true"><span style={{width:`${(stage==='register'&&registered?3:step-.5)/3*100}%`}}/></div>
  <p className="step-of">Step {step} of 3</p>
  {stage==='team'&&<>
   <h2>First, let’s find your team</h2>
   <p className="lede">Adding your team’s components to the Catalog makes it easier for people to find, reuse and extend them.</p>
   <div className="pt-formfield" style={{marginTop:40}}><label htmlFor="team">Choose your team</label>
    <select id="team" className="pt-input" aria-label="Choose your team" value={team} onChange={e=>setTeam(e.target.value)}><option>northstar/team-payments</option></select></div>
   <div className="pt-actions" style={{justifyContent:'flex-end'}}><button className="pt-btn outline" onClick={()=>navigate(base)}>Cancel</button><button className="pt-btn sm" onClick={()=>navigate(base+'/setup/components')}>Next</button></div>
  </>}
  {stage==='components'&&<>
   <h2>We’ve found your components</h2>
   <p className="lede">Choose a type so people in your organization know what these components are whenever they visit the Catalog.</p>
   <div className="pt-tablebox"><table className="pt-table"><thead><tr><th style={{width:44}}><input type="checkbox" aria-label="Select all components" checked={selected} onChange={e=>setSelected(e.target.checked)}/></th><th>Name</th><th>Type</th><th>Lifecycle</th></tr></thead>
    <tbody><tr><td><input type="checkbox" aria-label="Select payments-api" checked={selected} onChange={e=>setSelected(e.target.checked)}/></td><td>payments-api</td>
     <td><select className="pt-input" aria-label="Type for payments-api" style={{height:38,padding:'0 10px'}} value={type} onChange={e=>setType(e.target.value)}><option value="">Choose Type*</option><option value="service">service</option><option value="library">library</option><option value="website">website</option></select></td>
     <td><select className="pt-input" aria-label="Lifecycle for payments-api" style={{height:38,padding:'0 10px'}} value={lifecycle} onChange={e=>setLifecycle(e.target.value)}><option value="production">Production</option><option value="experimental">Experimental</option></select></td></tr></tbody></table>
    <p className="foot">1 component · found in GitHub · northstar/payments-api <span className="pt-tag sim">Simulated discovery</span></p></div>
   {session.error&&<div className="pt-banner error" role="alert">{session.error}</div>}
   <div className="pt-actions" style={{justifyContent:'flex-end'}}><button className="pt-btn outline" onClick={()=>navigate(base+'/setup/team')}>Back</button>
    <button className="pt-btn sm" disabled={session.busy||!selected||!type} onClick={async()=>{if(prepared||await session.save({action:'step',step:'prepare'}))navigate(base+'/setup/register');}}>Next</button></div>
  </>}
  {stage==='register'&&<>
   <h2>{registered?'Your pull request is ready':'Create your pull request'}</h2>
   <p className="lede">We’ll create a pull request for payments-api containing a single <code>catalog-info.yaml</code> with its team ownership. Once it’s merged, payments-api appears in the Catalog.</p>
   <div className="pt-tablebox"><table className="pt-table"><thead><tr><th style={{width:44}}></th><th>Name</th><th>Type</th><th></th></tr></thead>
    <tbody><tr><td>{registered?<CheckCircle2 size={22} color="var(--p-green)" aria-label="Created"/>:null}</td><td>payments-api</td><td>service</td><td style={{textAlign:'right'}}>{registered&&<span className="pt-tag sim">Simulated pull request</span>}</td></tr></tbody></table>
    <p className="foot">1 component</p></div>
   {!prepared&&<div className="pt-banner warn" role="status">Prepare payments-api first.</div>}
   {session.error&&<div className="pt-banner error" role="alert">{session.error}</div>}
   <div className="pt-actions" style={{justifyContent:'flex-end'}}>{registered?<button className="pt-btn sm" onClick={()=>navigate(base+'/catalog')}>Go to Catalog</button>
    :<><button className="pt-btn outline" onClick={()=>navigate(base)}>Cancel</button><button className="pt-btn sm" disabled={session.busy||!prepared} onClick={()=>void session.save({action:'step',step:'register'})}>Create pull request</button></>}</div>
   {!registered&&<p className="pt-note" style={{textAlign:'right'}}>Simulated — no pull request is opened on GitHub.</p>}
  </>}
 </div></div>;
}
