import {useEffect,useState} from 'react';
import {navigate} from '../portal-app/router';
import {problem,request,routeBase,routePerson,type IgnitionState} from './api';

/** One persona session: canonical server state, revision-checked writes, independent sign-in/out. */
export function useIgnition(path:string){
 const [state,setState]=useState<IgnitionState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[checked,setChecked]=useState(false);
 const person=routePerson(path),login=path.endsWith('/login');
 useEffect(()=>{let live=true;setChecked(false);setError('');
  if(!person||login){setState(null);setChecked(true);return;}
  void (async()=>{try{const d=await request('state');if(live)setState(d);}catch(e){if(live){setState(null);if((e as Error).message!=='SIGN_IN_REQUIRED')setError(problem((e as Error).message));}}finally{if(live)setChecked(true);}})();
  return()=>{live=false;};
 // Identity is re-read whenever the persona or login route changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[person,login]);
 async function refresh(){try{setState(await request('state'));setError('');}catch(e){if((e as Error).message==='SIGN_IN_REQUIRED')setState(null);else setError(problem((e as Error).message));}}
 async function signIn(email:string){setBusy(true);setError('');try{await request('session',{person,email});setState(await request('state'));navigate(routeBase(person));return true;}catch(e){setError(problem((e as Error).message));return false;}finally{setBusy(false);}}
 async function signOut(){setBusy(true);try{await request('logout',{});}catch{/* already signed out */}finally{setState(null);setBusy(false);navigate(routeBase(person)+'/login');}}
 /** Writes carry the loaded revision; a conflict keeps the caller's draft and asks for a refresh. */
 async function save(input:object){setBusy(true);try{setState(await request('state',{...input,revision:state!.revision}));setError('');return true;}catch(e){setError(problem((e as Error).message));return false;}finally{setBusy(false);}}
 return {person,state,error,setError,busy,checked,refresh,signIn,signOut,save,conflict:error===problem('REVISION_CONFLICT')};
}
export type IgnitionSession=ReturnType<typeof useIgnition>;
