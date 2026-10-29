/** Browser side of the local demo session layer (server/portal-session.mjs). No tokens are handled here.
 * A persona is a simulated sign-in that picks which Portal opens; the server decides what it may access. */
export type PersonaRole='operator'|'champion'|'developer';
export type PersonaCustomer={id:string;label:string;customerId:string};
export type Persona={id:string;name:string;role:PersonaRole;title:string;customers:PersonaCustomer[]};

async function call(path:string,body?:unknown){
 return fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
}
const code=async(r:Response)=>((await r.json().catch(()=>null)) as {error?:{code?:string}}|null)?.error?.code??`HTTP_${r.status}`;

export async function currentSession():Promise<Persona|null>{
 const r=await call('/portal-auth/session');
 if(r.status===401)return null;
 if(!r.ok)throw Error(await code(r));
 return (await r.json()).persona as Persona;
}
export async function demoPersonas():Promise<Persona[]>{
 const r=await call('/portal-auth/personas');
 if(!r.ok)throw Error(await code(r));
 return (await r.json()).personas as Persona[];
}
export async function signIn(personaId:string):Promise<Persona>{
 const r=await call('/portal-auth/login',{personaId});
 if(!r.ok)throw Error(await code(r));
 return (await r.json()).persona as Persona;
}
export async function signOut(){await call('/portal-auth/logout',{});}

/** Where each persona starts. Chris works in the customer handoff workspace; everyone else in the Portal. */
export const homeFor=(p:Persona)=>p.role==='operator'?'/operator':'/portal';
/** Which surface a path belongs to. Unknown paths are left to the legacy prototype. */
export function surfaceOf(path:string):'entry'|'operator'|'portal'|null{
 if(path==='/'||path==='/login')return 'entry';
 if(path==='/operator'||path.startsWith('/operator/'))return 'operator';
 if(path==='/portal'||path.startsWith('/portal/')||path==='/onboarding'||path==='/activation'||path.startsWith('/activation/')||path==='/champion')return 'portal';
 return null;
}
export const roleLabel:Record<PersonaRole,string>={operator:'Account operator',champion:'Champion',developer:'Developer'};
/** The customer-facing view of a customer persona, as the onboarding pages use it. */
export type PortalAccount={id:string;label:string;user:string;customerId:string};
export const portalAccount=(p:Persona):PortalAccount=>({id:p.id,label:p.customers[0].label,user:p.name,customerId:p.customers[0].customerId});
