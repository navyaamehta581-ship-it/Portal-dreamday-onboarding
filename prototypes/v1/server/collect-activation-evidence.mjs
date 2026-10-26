// Operator use: node server/collect-activation-evidence.mjs owner/repo > candidate.json
// Review records into the scoped admission bundle; restart before POST /progress.
import {collectActivationEvidence} from './activation-evidence.mjs';
const repository=process.argv[2];
const result=await collectActivationEvidence({repository,goal:'Inspect repository CI readiness without writes'});
console.log(JSON.stringify(result,null,2));
if(result.inspection.diagnosis==='blocked')process.exitCode=2;
