import {posix} from 'node:path';
import type {GitHubPreparation,SetupProposal} from '../../../../contracts/activation/v1/state.ts';
// This is an explicitly reviewed template profile, not a general YAML interpreter.
// Any byte change requires a new semantic review. Never evaluate template expressions.
const reviewedBlob='838a456dd71d76a1ab6a46ea4e114fe09f9f997f';
export function buildSetupProposal(packet:GitHubPreparation,tree:{path:string;type:string;mode:string;sha:string}[],sourceTree:string):SetupProposal {
 const supported=packet.templateBlob===reviewedBlob;
 const base=posix.dirname(packet.templatePath);
 const dependencies=supported?['node','ci-node','monitoring','docs'].map(name=>{
  const path=posix.join(base,'skeletons',name);
  const present=tree.some(e=>e.path.startsWith(path+'/')&&e.type==='blob'&&e.mode==='100644');
  return {path,status:present?'present_uninspected' as const:'missing' as const,source:`https://github.com/${packet.repository}/tree/${packet.commit}/${path}`};
 }):[];
 const missingPrerequisites=[...(supported?dependencies.map(d=>`${d.path}: ${d.status==='missing'?'absent in complete pinned Git tree':'content not read or semantically reviewed; separate read scope required'}`):['Template blob has no reviewed semantic profile; no runnable configuration can be derived.']),
 'Installed Backstage action schemas/versions for fetch:template, publish:github and catalog:register are unknown.',
 'Customer-approved catalog owner and target repository are unknown; template defaults are demonstration values.',
 'GitHub integration permissions, catalog availability, secrets handling and runtime compatibility are unverified.',
 'Generated catalog-info.yaml and package/test commands cannot be validated without reviewed skeleton contents.'];
 const semantics=supported?[
 'fetch:template resolves four local paths relative to the template directory; targets are ., ./ci, ./monitoring and ./docs.',
 'CI files land under ./ci, not .github/workflows; automatic GitHub Actions execution is not established.',
 'Template values use Node.js 22 LTS and npm test, but no skeleton package or lockfile establishes compatibility.',
 'publish:github creates a private repository on main; catalog:register consumes its repoContentsUrl and /catalog-info.yaml. These are remote side effects and are outside this proposal approval.',
 'Action input compatibility requires the installed instance schemas; a recognized action name alone is insufficient.'
 ]:['Unknown template semantics; no dependencies or action behavior inferred.'];
 const targetPath='.portal/recommendation-service.setup.json';
 const proposedFile=JSON.stringify({schemaVersion:1,fictional:true,serviceName:'recommendation-service',purpose:'Review a possible setup; not a Scaffolder task or execution request',
 source:{repository:packet.repository,commit:packet.commit,templatePath:packet.templatePath,templateBlob:packet.templateBlob,sourceTree},
 candidateParameters:supported?{name:'recommendation-service',owner:null,repoUrl:null}:null,
 unresolvedParameters:['owner','repoUrl'],dependencies,missingPrerequisites,semantics,readyToRun:false,remoteWritesAuthorized:false},null,2)+'\n';
 const lines=proposedFile.trimEnd().split('\n');
 const diff=`diff --git a/${targetPath} b/${targetPath}\nnew file mode 100644\n--- /dev/null\n+++ b/${targetPath}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l=>'+'+l).join('\n')}\n`;
 return {version:1,sourceTree,kind:'fictional_recommendation_service_setup',targetPath,proposedFile,diff,templateReview:supported?'reviewed_known_template':'unsupported_template',dependencies,missingPrerequisites,semantics,readyToRun:false};
}
