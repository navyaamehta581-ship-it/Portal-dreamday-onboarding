import {useState} from 'react';
import {Logo} from '../portal-app/Logo';
import {ACCOUNTS,type Person} from './api';

const COPY:Record<Person,{title:string;lede:string}>={
 chris:{title:'Customer Activation.',lede:'Sign in with your work email to open your customer files.'},
 maya:{title:'Team Activation.',lede:'Sign in with your work email to bring your team to its first workflow.'},
 alex:{title:'Welcome to Portal.',lede:'Sign in with your Northstar work email to continue your onboarding.'},
 jordan:{title:'Welcome to Portal.',lede:'Sign in with your Northstar work email to continue your onboarding.'},
};

/** Split sign-in following reference 001. Demo accounts only: account-matched email, no password. */
export function Login({person,busy,error,onSignIn}:{person:Person;busy:boolean;error:string;onSignIn:(email:string)=>void}){
 const [email,setEmail]=useState('');
 return <main className="pt-entry">
  <div className="pt-art diamond" role="img" aria-label="Portal artwork"><div className="pt-art-logo"><Logo backstage/></div></div>
  <form className="pt-entry-copy signin" onSubmit={e=>{e.preventDefault();onSignIn(email.trim());}}>
   <h1>{COPY[person].title}</h1>
   <p>{COPY[person].lede}</p>
   <div className="pt-signin-field"><input className="pt-input" type="email" aria-label="Work email" placeholder="Work email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
   {error&&<div className="pt-alert" role="alert">{error}</div>}
   <button className="pt-btn" type="submit" disabled={busy||!email.trim()}>{busy?'Signing in…':'Sign in'}</button>
   <p className="pt-entry-note">Demo account for {ACCOUNTS[person].name}: {person}@northstar.example · no password</p>
  </form>
 </main>;
}
