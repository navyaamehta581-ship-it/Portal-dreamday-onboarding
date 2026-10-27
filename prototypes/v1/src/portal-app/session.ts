/** Browser side of the local demo session layer (server/portal-session.mjs). No tokens are handled here. */
export type PortalAccount={id:string;label:string;user:string;customerId:string};

async function call(path:string,body?:unknown){
 return fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
}
const code=async(r:Response)=>((await r.json().catch(()=>null)) as {error?:{code?:string}}|null)?.error?.code??`HTTP_${r.status}`;

export async function currentSession():Promise<PortalAccount|null>{
 const r=await call('/portal-auth/session');
 if(r.status===401)return null;
 if(!r.ok)throw Error(await code(r));
 return (await r.json()).account as PortalAccount;
}
export async function demoAccounts():Promise<PortalAccount[]>{
 const r=await call('/portal-auth/accounts');
 if(!r.ok)throw Error(await code(r));
 return (await r.json()).accounts as PortalAccount[];
}
export async function signIn(accountId:string):Promise<PortalAccount>{
 const r=await call('/portal-auth/login',{accountId});
 if(!r.ok)throw Error(await code(r));
 return (await r.json()).account as PortalAccount;
}
export async function signOut(){await call('/portal-auth/logout',{});}
