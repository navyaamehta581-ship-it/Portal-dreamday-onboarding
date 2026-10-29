/** A stand-in for GitHub's REST API for one repository, built from a file map. It records every request (method,
 * path, authorization) so tests can prove the inspector only reads, and can fail specific requests. */
import {blobSha} from '../../src/activation/repository.ts';

export type MockOptions={repository?:string;files?:Record<string,string>;truncated?:boolean;
 /** Per-request override: return a Response to fail that request, or undefined to answer normally. */
 fail?:(path:string,n:number)=>Response|undefined|Promise<Response|undefined>};
export const SAMPLE_FILES:Record<string,string>={
 'README.md':'# example payments-api\n\nTest repository content.\n',
 'docs/index.md':'# Docs\n','mkdocs.yml':'site_name: test\n',
 '.github/CODEOWNERS':'# owners\n* @example-org/payments-team\n/docs/ @example-org/docs-team @someone@example.com\n',
 '.github/workflows/ci.yml':'name: ci\non: [push]\n','Dockerfile':'FROM scratch\n',
 'catalog-info.yaml':'apiVersion: backstage.io/v1alpha1\nkind: Component\nmetadata:\n  name: payments-api\nspec:\n  type: service\n  lifecycle: production\n  owner: group:payments-team\n',
 'src/main.ts':'export {};\n'};
export function githubMock(o:MockOptions={}){
 const repository=o.repository??'example-org/payments-api',files=o.files??SAMPLE_FILES;
 const commit='a'.repeat(40),tree='b'.repeat(40);
 const blobs=new Map(Object.entries(files).map(([path,c])=>{const bytes=Buffer.from(c);return [blobSha(bytes),{path,bytes}];}));
 const calls:{method:string;path:string;auth:string|null}[]=[];let n=0;
 const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 const fetchImpl=(async(input:string|URL|Request,init?:RequestInit)=>{
  const url=new URL(String(input)),path=url.pathname+url.search,method=init?.method??'GET';
  const headers=new Headers(init?.headers);calls.push({method,path,auth:headers.get('authorization')});
  const failed=await o.fail?.(path,n++);if(failed)return failed;
  const root=`/repos/${repository}`;
  if(path===root)return json({full_name:repository,default_branch:'main',html_url:`https://github.com/${repository}`,pushed_at:'2026-10-28T10:00:00Z',visibility:'private',archived:false});
  if(path===`${root}/commits/main`)return json({sha:commit,commit:{committer:{date:'2026-10-28T09:00:00Z'},tree:{sha:tree}}});
  if(path===`${root}/git/trees/${tree}?recursive=1`){
   const dirs=new Set<string>();for(const f of Object.keys(files))f.split('/').slice(0,-1).forEach((_,i,a)=>dirs.add(a.slice(0,i+1).join('/')));
   return json({sha:tree,truncated:!!o.truncated,tree:[...[...blobs].map(([sha,b])=>({path:b.path,type:'blob',mode:'100644',sha,size:b.bytes.length})),...[...dirs].map(d=>({path:d,type:'tree',mode:'040000',sha:'c'.repeat(40)}))]});
  }
  const blob=/\/git\/blobs\/([a-f0-9]{40})$/.exec(path);
  if(blob&&path.startsWith(root)&&blobs.has(blob[1])){const b=blobs.get(blob[1])!;return json({sha:blob[1],encoding:'base64',size:b.bytes.length,content:b.bytes.toString('base64')});}
  return json({message:'Not Found'},404);
 }) as typeof fetch;
 return {fetchImpl,calls,commit,repository};
}
