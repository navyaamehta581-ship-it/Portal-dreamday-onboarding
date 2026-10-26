import {validateContract,validateProgress} from './validate.mjs';
import type {CustomerContext,ActivationPlan,ProgressUpdate,BlockerUpdate} from './types.ts';
function consume(json:unknown) {
 const context:CustomerContext=validateContract('CustomerContext',json);
 const plan:ActivationPlan=validateContract('ActivationPlan',json);
 const progress:ProgressUpdate=validateContract('ProgressUpdate',json);
 const blocker:BlockerUpdate=validateContract('BlockerUpdate',json);
 // @ts-expect-error A plan cannot be passed as a progress event.
 validateProgress(plan,{});
 // @ts-expect-error Verification is never the initial suggested action state.
 plan.suggestedNextAction.status='verified';
 return {context,plan,progress,blocker};
}
void consume;
