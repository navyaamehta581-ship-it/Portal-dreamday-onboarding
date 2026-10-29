import {useEffect,useState,type FormEvent} from 'react';
import {Logo} from './Logo';
import {demoPersonas,roleLabel,signIn,type Persona} from './session';

/** No sign-in reference was supplied: this screen reuses the 010 entry layout and Portal components.
 * It is a simulated sign-in for fictional personas. Nothing is collected; the server holds each persona's access. */
export function Login({onSignedIn,onBack,notice=''}:{onSignedIn:(p:Persona)=>void;onBack:()=>void;notice?:string}){
 const [personas,setPersonas]=useState<Persona[]|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{demoPersonas().then(list=>{setPersonas(list);setSelected(list[0]?.id??'');}).catch(()=>{setPersonas([]);setError('Sign-in is unavailable right now.');});},[]);
 async function submit(e:FormEvent){
  e.preventDefault();if(!selected)return;setBusy(true);setError('');
  try{onSignedIn(await signIn(selected));}
  catch(err){setError(err instanceof Error&&err.message==='PERSONA_UNAVAILABLE'?'This persona isn’t available right now. Start the demo API and try again.':'Sign-in failed. Try again.');}
  finally{setBusy(false);}
 }
 const customers=(p:Persona)=>p.customers.map(c=>c.label).join(', ');
 return <main className="pt-entry">
  <div className="pt-art" role="img" aria-label="Portal artwork"><div className="pt-art-logo"><Logo backstage/></div></div>
  <form className="pt-entry-copy login" onSubmit={submit} aria-busy={busy}>
   <h1>Sign in to Portal</h1>
   <p>Choose a demo persona.</p>
   {notice&&<div className="pt-alert" role="status">{notice}</div>}
   {personas===null?<p role="status">Loading personas…</p>:personas.length>0?<fieldset className="pt-accounts"><legend className="pt-sr">Persona</legend>
    {personas.map(p=><label className="pt-account" key={p.id}><input type="radio" name="persona" value={p.id} checked={selected===p.id} onChange={()=>setSelected(p.id)}/>
     <span><strong>{p.name} <span className={'pt-pill'+(p.role==='operator'?' blue':p.role==='champion'?' green':'')}>{roleLabel[p.role]}</span></strong><small>{p.title} · {customers(p)}</small></span></label>)}
   </fieldset>:!error&&<p role="status">No demo personas are configured. Start the demo API first.</p>}
   {error&&<div className="pt-alert" role="alert">{error}</div>}
   <div className="pt-entry-actions"><button className="pt-btn" type="submit" disabled={!selected||busy}>{busy?'Signing in…':'Continue'}</button><button type="button" className="pt-link" onClick={onBack}>Back</button></div>
   <p className="pt-entry-note">Fictional demo personas. Choosing one is a simulated sign-in, not authentication: no password is needed and anyone using this local demo can pick any persona. The server, not this page, decides what each persona can access.</p>
  </form>
 </main>;
}
