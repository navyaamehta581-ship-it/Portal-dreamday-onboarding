/** Runs the four fictional scenarios through the handoff analysis and prints what was produced.
 * With PORTAL_LLM_PROVIDER=ollama (and Ollama running) this exercises the real model; otherwise it shows
 * the rule-based fallback and says so. Fictional data only.
 *   HANDOFF_CAPTURE_DIR=dir  writes each raw model answer (per scenario, stage and attempt) for debugging.
 *   --bench                  measures generation speed with and without the JSON grammar before the scenarios. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createOllama,grammarSchema,ollamaConfigFromEnv} from '../src/llm/ollama.ts';
import {analyzeWithModel,interpretSchema,ruleBasedAnalysis} from '../src/activation/handoff/intelligence.ts';
import {developerHandoff} from '../src/activation/handoff/project.ts';
import {parseSources} from '../src/activation/handoff/service.ts';

const scenarios=JSON.parse(readFileSync(new URL('../test/fixtures/scenarios.json',import.meta.url),'utf8')) as Record<string,{expect:string;sources:unknown[]}>;
const config=ollamaConfigFromEnv();
const args=process.argv.slice(2),only=args.find(a=>!a.startsWith('--')),capture=process.env.HANDOFF_CAPTURE_DIR;
if(capture)mkdirSync(capture,{recursive:true});

/** Same prompt, three formats: unconstrained, grammar without size limits (what the client sends), full schema.
 * Separates the model's raw speed on this machine from the cost of constrained sampling. */
async function bench(){
 const url=`${config!.endpoint.replace(/\/$/,'')}/api/chat`;
 const prompt='Describe three engineering checks for a service called payments-api as JSON with the keys problems, people, facts, unknowns, confidential, segments, services, repositories, contradictions, company.';
 for(const [label,format] of [['no format',undefined],['grammar (sent)',grammarSchema(interpretSchema)],['full schema',interpretSchema]] as const){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:config!.model,stream:false,think:false,keep_alive:config!.keepAlive,format,options:{temperature:0,num_ctx:4096,num_predict:200},messages:[{role:'user',content:prompt}]})});
  const j=await r.json() as {eval_count?:number;eval_duration?:number;prompt_eval_count?:number;prompt_eval_duration?:number;load_duration?:number};
  const tps=j.eval_count&&j.eval_duration?(j.eval_count/(j.eval_duration/1e9)).toFixed(1):'?';
  console.log(`bench ${label.padEnd(15)} ${tps} tok/s · ${j.eval_count??'?'} tok in ${Math.round((j.eval_duration??0)/1e6)} ms · prompt ${j.prompt_eval_count??'?'} tok in ${Math.round((j.prompt_eval_duration??0)/1e6)} ms · load ${Math.round((j.load_duration??0)/1e6)} ms`);
 }
 try{const ps=await (await fetch(`${config!.endpoint.replace(/\/$/,'')}/api/ps`)).json() as {models?:{name:string;size:number;size_vram:number;context_length?:number}[]};
  for(const m of ps.models??[])console.log(`loaded ${m.name}: ${(m.size/1e9).toFixed(1)} GB, ${m.size?Math.round(m.size_vram/m.size*100):0}% on GPU${m.context_length?`, context ${m.context_length}`:''}`);}catch{/* older Ollama */}
}
const PRIVATE=/\$\d|\b\d[\d,]*\s+(?:employees|engineers)\b|\bARR\b|\bprocurement\b|nice-to-have|VP thinks|\bstage \d|technical validation/i;
console.log(config?`Model: ${config.model} at ${config.endpoint} (timeout ${config.timeoutMs} ms)`:'No model configured (set PORTAL_LLM_PROVIDER=ollama). Showing the rule-based fallback.');
if(config&&args.includes('--bench'))await bench();
for(const [name,s] of Object.entries(scenarios)){
 if(only&&!name.startsWith(only))continue;
 const sources=parseSources({sources:s.sources});
 const started=Date.now();
 let call=0;
 const onRaw=capture?(stage:string,attempt:number,content:string)=>writeFileSync(join(capture,`${name}.${String(++call).padStart(2,'0')}.${stage}.attempt${attempt+1}.json`),content):undefined;
 const {understanding:u,proposal:p}=config?await analyzeWithModel(createOllama({...config,onRaw}),sources):ruleBasedAnalysis(sources);
 const h=developerHandoff(1,new Date().toISOString(),u,p.milestones);
 console.log(`\n=== ${name}\nExpected: ${s.expect}`);
 console.log(`Produced by: ${u.model?.ok?`model ${u.model.model} (${u.model.chunks} chunk(s), ${u.model.discarded} item(s) discarded by validation)`:u.model?`RULE-BASED FALLBACK — model failed: ${u.model.error}`:'RULE-BASED (no model configured)'} · ${Date.now()-started} ms`);
 for(const st of u.model?.stages??[])console.log(`  stage ${st.name}: ${st.ms} ms wall · attempts ${st.attempts}${st.attemptErrors?.length?` (${st.attemptErrors.join(', ')})`:''} · prompt ${st.promptTokens??'?'} tok in ${st.promptEvalMs??'?'} ms · output ${st.outputTokens??'?'} tok in ${st.evalMs??'?'} ms = ${st.tokensPerSecond??'?'} tok/s · load ${st.loadMs??'?'} ms · thinking ${st.thinkingChars} chars · num_ctx ${st.numCtx}${st.truncated?' · OUTPUT TRUNCATED':''}`);
 if(u.model?.errorDetail)console.log('  failure detail:',u.model.errorDetail);
 if(u.model?.discards?.length)console.log('  discarded (reason codes only):',Object.entries(u.model.discards.reduce<Record<string,number>>((a,d)=>{const k=`${d.stage}/${d.item}/${d.reason}`;a[k]=(a[k]??0)+1;return a;},{})).map(([k,n])=>`${k}×${n}`).join(', '));
 if(u.classifications?.length)console.log('Classified passages:',u.classifications.map(c=>`${c.category}: “${c.excerpt}”`).join(' | '));
 if(u.engineeringProblem)console.log('Engineering problem:',u.engineeringProblem);
 if(u.stakeholders?.length)console.log('Stakeholders:',u.stakeholders.map(x=>`${x.name??'(unnamed)'} — ${x.role} [${x.confidence}]${x.responsibilities[0]?` · ${x.workBasis==='role_default'?'role default':'work'}: ${x.responsibilities[0]}`:''}`).join('; '));
 if(u.baseline?.length)console.log('Baseline checks:',u.baseline.map(b=>`${b.area} (${b.status})`).join(', '));
 if(u.contradictions.length)console.log('Contradictions:',u.contradictions.map(c=>c.summary).join(' | '));
 for(const m of p.milestones)console.log(`Milestone: ${m.objective}\n  role: ${m.recommendedRole??'—'} · proposed assignee: ${m.proposedAssignee??'not confirmed'} · evidence: ${m.evidenceStatus??'—'}\n  actions: ${m.actions.join(' → ')}\n  done when: ${m.completionCriteria.join(' / ')}${m.dependencies.length?`\n  depends on: ${m.dependencies.join(', ')}`:''}`);
 if(!p.milestones.length)console.log('No milestone proposed.');
 if(p.missing.length)console.log('Ask the customer:',p.missing.join(' | '));
 console.log('Developer view leaks private text:',PRIVATE.test(JSON.stringify(h))?'YES — investigate':'no');
}
