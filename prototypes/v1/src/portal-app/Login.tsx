import {useEffect,useState,type FormEvent} from 'react';
import {Logo} from './Logo';
import {demoAccounts,signIn,type PortalAccount} from './session';

/** No sign-in reference was supplied: this screen reuses the 010 entry layout and Portal components.
 * It is a simulated sign-in. Nothing is collected; access comes from the operator-configured demo account. */
export function Login({onSignedIn,onBack}:{onSignedIn:(a:PortalAccount)=>void;onBack:()=>void}){
 const [accounts,setAccounts]=useState<PortalAccount[]|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{demoAccounts().then(list=>{setAccounts(list);setSelected(list[0]?.id??'');}).catch(()=>{setAccounts([]);setError('Sign-in is unavailable. Start the Portal with a configured demo account.');});},[]);
 async function submit(e:FormEvent){
  e.preventDefault();if(!selected)return;setBusy(true);setError('');
  try{onSignedIn(await signIn(selected));}
  catch(err){setError(err instanceof Error&&err.message==='ACCOUNT_UNAVAILABLE'?'This demo account is not ready yet. Start its activation API, then try again.':'Sign-in failed. Try again.');}
  finally{setBusy(false);}
 }
 return <main className="pt-entry">
  <div className="pt-art" role="img" aria-label="Portal artwork"><div className="pt-art-logo"><Logo backstage/></div></div>
  <form className="pt-entry-copy login" onSubmit={submit} aria-busy={busy}>
   <h1>Sign in to Portal</h1>
   <p>Choose the account you were invited with.</p>
   {accounts===null?<p role="status">Loading accounts…</p>:accounts.length>0&&<fieldset className="pt-accounts"><legend className="pt-sr">Account</legend>
    {accounts.map(a=><label className="pt-account" key={a.id}><input type="radio" name="account" value={a.id} checked={selected===a.id} onChange={()=>setSelected(a.id)}/><span><strong>{a.user}</strong><small>{a.label}</small></span></label>)}
   </fieldset>}
   {error&&<div className="pt-alert" role="alert">{error}</div>}
   <div className="pt-entry-actions"><button className="pt-btn" type="submit" disabled={!selected||busy}>{busy?'Signing in…':'Continue'}</button><button type="button" className="pt-link" onClick={onBack}>Back</button></div>
   <p className="pt-entry-note">Simulated sign-in for this demo. No Spotify account, email or password is used.</p>
  </form>
 </main>;
}
