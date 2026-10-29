import {useCallback,useEffect,useState} from 'react';
import type {RepositoryEvidence,RepositoryObservation} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';

/** Repository evidence as the server shows it to this viewer. Inspections run on the server, read-only; the browser
 * only names a configured repository id. */
export function useRepositoryEvidence(api:ReturnType<typeof activationClient>|null){
 const [data,setData]=useState<RepositoryEvidence|null>(null),[loading,setLoading]=useState(true);
 const [inspecting,setInspecting]=useState<string|null>(null),[error,setError]=useState<{code:string;repositoryId:string|null}|null>(null);
 const load=useCallback(async()=>{
  if(!api)return;setLoading(true);
  try{setData(await api.repositoryEvidence());setError(null);}
  catch(e){setData(null);setError({code:e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE',repositoryId:null});}
  finally{setLoading(false);}
 },[api]);
 useEffect(()=>{void load();},[load]);
 async function inspect(repositoryId:string){
  if(!api||inspecting)return;setInspecting(repositoryId);setError(null);
  try{setData((await api.inspectRepository(repositoryId)).evidence);}
  catch(e){setError({code:e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE',repositoryId});}
  finally{setInspecting(null);}
 }
 /** Every observation this viewer can see, by id (for AiKA's citations). */
 const observations=new Map<string,RepositoryObservation>((data?.repositories??[]).flatMap(r=>r.evidence?.observations??[]).map(o=>[o.id,o]));
 return {data,loading,inspecting,error,reload:load,inspect,observations};
}
export type RepositoryEvidenceSession=ReturnType<typeof useRepositoryEvidence>;

export const SIGNAL_LABEL={identity:'Repository',default_branch:'Default branch',readme:'README',docs:'Documentation',codeowners:'CODEOWNERS (ownership)',ci_config:'CI configuration',
 deployment:'Deployment configuration',catalog_info:'Backstage metadata (catalog-info.yaml)',runbooks:'Runbooks',ci_runs:'CI run results'} as const;
export const STATUS={observed:['Observed','green'],missing:['Not found','blue'],inaccessible:['Not readable','red'],not_inspected:['Not inspected','']} as const;
/** Plain-language messages for inspection and request codes; no GitHub response text is shown. */
export function repositoryProblem(code:string,retryAfter?:string|null):string{
 switch(code){
  case 'GITHUB_RATE_LIMITED':return `GitHub’s rate limit was reached.${retryAfter?` Try again after ${new Date(retryAfter).toLocaleTimeString()}.`:' Try again later.'}`;
  case 'GITHUB_NOT_ACCESSIBLE':return 'GitHub didn’t return the repository: it may not exist, or the configured read access can’t see it.';
  case 'GITHUB_AUTH_FAILED':return 'The configured GitHub credential was rejected. Ask your Portal admin to check it.';
  case 'GITHUB_FORBIDDEN':return 'The configured GitHub access isn’t allowed to read this.';
  case 'GITHUB_TIMEOUT':case 'GITHUB_UNAVAILABLE':return 'GitHub couldn’t be reached. Your onboarding work is unaffected; try again later.';
  case 'GITHUB_INVALID_RESPONSE':case 'GITHUB_RESPONSE_TOO_LARGE':case 'GITHUB_BLOB_MISMATCH':return 'GitHub returned something the inspector couldn’t use, so nothing from it was recorded.';
  case 'FIXTURE_INVALID':return 'The sample data for this repository couldn’t be read.';
  case 'NO_APPROVED_PLAN':return 'Repository evidence opens once your team’s onboarding plan is published.';
  case 'DEVELOPER_IDENTITY_REQUIRED':return 'Your sign-in isn’t linked to your own developer credential, so you can’t start an inspection.';
  case 'FORBIDDEN':return 'You can view this evidence but not start an inspection.';
  case 'NOT_FOUND':return 'That repository isn’t configured for your team’s work.';
  default:return 'The repository couldn’t be inspected right now. Your onboarding work is unaffected; try again later.';
 }
}
