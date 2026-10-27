import {useState} from 'react';
import {Logo} from '../portal-app/Logo';
import type {Person} from './api';

/** Sign-in following reference 001. Demo accounts only: account-matched work email, no password. */
export function Login({person,busy,error,onSignIn}:{person:Person;busy:boolean;error:string;onSignIn:(email:string)=>void}){
 const [email,setEmail]=useState('');
 return <main className="pt-entry">
  <div className="pt-art diamond" role="img" aria-label="Portal artwork"><div className="pt-art-logo"><Logo backstage/></div></div>
  <form className="pt-entry-copy signin" onSubmit={e=>{e.preventDefault();onSignIn(email.trim());}}>
   <h1>Welcome to Portal.</h1>
   <p>Sign into Portal using your work email. If you don’t know which account to use, contact your Portal administrator.</p>
   <div className="pt-signin-field"><input className="pt-input" type="email" aria-label="Work email" placeholder={`${person}@northstar.example`} autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
   {error&&<div className="pt-alert" role="alert">{error}</div>}
   <button className="pt-btn" type="submit" disabled={busy||!email.trim()}>{busy?'Signing in…':'Sign in'}</button>
  </form>
 </main>;
}
