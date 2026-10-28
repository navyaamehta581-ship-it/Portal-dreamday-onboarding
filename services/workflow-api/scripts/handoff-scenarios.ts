/** Runs the four fictional scenarios through the handoff analysis and prints what was produced.
 * With PORTAL_LLM_PROVIDER=ollama (and Ollama running) this exercises the real model; otherwise it shows
 * the rule-based fallback and says so. Fictional data only. */
import {readFileSync} from 'node:fs';
import {createOllama,ollamaConfigFromEnv} from '../src/llm/ollama.ts';
import {analyzeWithModel,ruleBasedAnalysis} from '../src/activation/handoff/intelligence.ts';
import {developerHandoff} from '../src/activation/handoff/project.ts';
import {parseSources} from '../src/activation/handoff/service.ts';

const scenarios=JSON.parse(readFileSync(new URL('../test/fixtures/scenarios.json',import.meta.url),'utf8')) as Record<string,{expect:string;sources:unknown[]}>;
const config=ollamaConfigFromEnv();
const only=process.argv[2];
const PRIVATE=/\$\d|\b\d[\d,]*\s+(?:employees|engineers)\b|\bARR\b|\bprocurement\b|nice-to-have|VP thinks|\bstage \d|technical validation/i;
console.log(config?`Model: ${config.model} at ${config.endpoint} (timeout ${config.timeoutMs} ms)`:'No model configured (set PORTAL_LLM_PROVIDER=ollama). Showing the rule-based fallback.');
for(const [name,s] of Object.entries(scenarios)){
 if(only&&!name.startsWith(only))continue;
 const sources=parseSources({sources:s.sources});
 const started=Date.now();
 const {understanding:u,proposal:p}=config?await analyzeWithModel(createOllama(config),sources):ruleBasedAnalysis(sources);
 const h=developerHandoff(1,new Date().toISOString(),u,p.milestones);
 console.log(`\n=== ${name}\nExpected: ${s.expect}`);
 console.log(`Produced by: ${u.model?.ok?`model ${u.model.model} (${u.model.chunks} chunk(s), ${u.model.discarded} item(s) discarded by validation)`:u.model?`RULE-BASED FALLBACK — model failed: ${u.model.error}`:'RULE-BASED (no model configured)'} · ${Date.now()-started} ms`);
 for(const st of u.model?.stages??[])console.log(`  stage ${st.name}: ${st.ms} ms · attempts ${st.attempts} · prompt ${st.promptTokens??'?'} tok · output ${st.outputTokens??'?'} tok · thinking ${st.thinkingChars} chars · load ${st.loadMs??'?'} ms · num_ctx ${st.numCtx}${st.truncated?' · OUTPUT TRUNCATED':''}`);
 if(u.model?.errorDetail)console.log('  failure detail:',u.model.errorDetail);
 if(u.model?.discards?.length)console.log('  discarded (reason codes only):',Object.entries(u.model.discards.reduce<Record<string,number>>((a,d)=>{const k=`${d.stage}/${d.item}/${d.reason}`;a[k]=(a[k]??0)+1;return a;},{})).map(([k,n])=>`${k}×${n}`).join(', '));
 if(u.classifications?.length)console.log('Classified passages:',u.classifications.map(c=>`${c.category}: “${c.excerpt}”`).join(' | '));
 if(u.engineeringProblem)console.log('Engineering problem:',u.engineeringProblem);
 if(u.stakeholders?.length)console.log('Stakeholders:',u.stakeholders.map(x=>`${x.name??'(unnamed)'} — ${x.role} [${x.confidence}]${x.responsibilities[0]?` · work: ${x.responsibilities[0]}`:''}`).join('; '));
 if(u.baseline?.length)console.log('Baseline checks:',u.baseline.map(b=>`${b.area} (${b.status})`).join(', '));
 if(u.contradictions.length)console.log('Contradictions:',u.contradictions.map(c=>c.summary).join(' | '));
 for(const m of p.milestones)console.log(`Milestone: ${m.objective}\n  role: ${m.recommendedRole??'—'} · proposed assignee: ${m.proposedAssignee??'not confirmed'} · evidence: ${m.evidenceStatus??'—'}\n  actions: ${m.actions.join(' → ')}\n  done when: ${m.completionCriteria.join(' / ')}${m.dependencies.length?`\n  depends on: ${m.dependencies.join(', ')}`:''}`);
 if(!p.milestones.length)console.log('No milestone proposed.');
 if(p.missing.length)console.log('Ask the customer:',p.missing.join(' | '));
 console.log('Developer view leaks private text:',PRIVATE.test(JSON.stringify(h))?'YES — investigate':'no');
}
