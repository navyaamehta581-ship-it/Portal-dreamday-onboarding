/** Rule-based interpretation of unstructured customer sources into a structured understanding.
 * It classifies statements, extracts technical entities, separates reported claims from assumptions,
 * flags contradictions and maps recognised needs to technical playbooks. It is not general language
 * understanding: statements it cannot classify are kept as internal notes for Chris, never passed on. */
import type {Contradiction,Entities,Finding,FindingCategory,FindingStatus,Goal,Playbook,SourceInput,SourceRef,SourceType,Understanding,Unknown} from '../../../../../contracts/activation/v1/handoff.ts';

export const SOURCE_LABEL:Record<SourceType,string>={crm:'CRM record',conversation:'Conversation',chris_notes:'Chris’s notes',account_prep:'Account preparation',integration_tools:'Integration tools',technical_requirements:'Technical requirements',repository:'Repository observation'};
const EXCERPT=80;

type Statement={sourceId:string;type:SourceType;label:string;text:string;speaker:string|null};

/** Split sources into statements; strip timestamps and speaker prefixes but remember the speaker. */
export function statements(sources:SourceInput[]):Statement[]{
 const out:Statement[]=[];
 for(const s of sources){
  for(const raw of s.text.split(/\r?\n/)){
   let line=raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/,'').replace(/^\s*\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/,'').trim();
   if(!line)continue;
   let speaker:string|null=null;
   const who=/^([A-Z][\w.'-]*(?:\s[A-Z][\w.'-]*)?(?:\s*\([^)]{1,40}\))?)\s*[:—-]\s+(.+)$/.exec(line);
   if(who&&!/^(note|todo|stage|owner|amount|arr|acv|employees|account|next steps?|status|repo|repository|service|ci|sso|docs)\b/i.test(who[1])){speaker=who[1];line=who[2];}
   for(const part of line.split(/(?<=[.!?])\s+(?=[A-Z"“`])/)){const text=part.trim();if(text.length>2)out.push({sourceId:s.id,type:s.type,label:s.label,text,speaker});}
  }
 }
 return out;
}

const STALE_BEFORE=/\b(?:used to(?: \w+)?|previously(?: \w+)?|formerly(?: \w+)?|migrat\w* (?:off|away from|from)|moving off|replaced|no longer(?: \w+)?|old)\s*(?:on|run|use|using|had)?\s*$/i;
// Ordinary hyphenated words that look like service names but are not.
const COMMON_HYPHENATED=new Set(['self-service','micro-service','web-service','customer-service','full-service','in-app','web-app','mobile-app','front-end','back-end','end-to-end','on-call','single-page-app']);
const RX={
 commercial:/[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m|million)\b(?!\w)|\b(?:arr|acv|tcv|mrr|pricing|price|discount|renewal|budget|opportunity|deal size|procurement|licen[cs]e|seats?|invoice|quote|contract|commercial|close date|forecast|upsell|expansion)\b/i,
 stakeholder:/\b(?:employees|headcount|\d[\d,]*\s+(?:engineers|developers|people)|vp|svp|director|cto|ceo|cio|head of|champion|sponsor|economic buyer|decision[- ]maker|account owner|account executive|\bae\b|csm|stakeholder|reports to|org chart)\b/i,
 evaluation:/\b(?:stage|pipeline|evaluation|evaluating|poc|proof of concept|pilot|trial|\d+[- ]day|timeline|deadline|q[1-4]\b|go[- ]live|kick[- ]?off|success plan)\b/i,
 internalTone:/\b(?:internal|note to self|we should|our (?:team|ae|sales)|sales|competit\w*|incumbent|negotiat\w*|relationship|politic\w*|nervous|sceptic\w*|skeptic\w*)\b/i,
 hedge:/\b(?:i think|i believe|probably|maybe|might|perhaps|not sure|unsure|unclear|unconfirmed|assum\w*|apparently|i guess|supposedly|allegedly|tbc|tbd|to be confirmed|we believe|rumou?r)\b|\?\s*$/i,
 outdated:/\b(?:used to|previously|formerly|no longer|last year|deprecated|outdated|old (?:setup|system|repo)|as of 20\d\d|migrat\w* (?:off|away) from|moving off)\b/i,
 requirement:/\b(?:must|need(?:s|ed)? to|required?|requirement|has to|have to|should support|mandatory|non[- ]negotiable)\b/i,
};

const PLATFORMS:{key:keyof Pick<Entities,'scm'|'sso'|'docs'|'ci'>;name:string;rx:RegExp}[]=[
 {key:'scm',name:'GitHub',rx:/\bgithub(?!\s+actions)\b|github\.com/i},{key:'scm',name:'GitLab',rx:/\bgitlab(?!\s+ci)\b/i},{key:'scm',name:'Bitbucket',rx:/\bbitbucket\b/i},{key:'scm',name:'Azure DevOps',rx:/\bazure devops\b/i},
 {key:'sso',name:'Okta',rx:/\bokta\b/i},{key:'sso',name:'Microsoft Entra ID',rx:/\b(?:entra(?: id)?|azure ad)\b/i},{key:'sso',name:'Google Workspace',rx:/\bgoogle workspace\b/i},{key:'sso',name:'Auth0',rx:/\bauth0\b/i},
 {key:'docs',name:'Confluence',rx:/\bconfluence\b/i},{key:'docs',name:'Notion',rx:/\bnotion\b/i},{key:'docs',name:'SharePoint',rx:/\bsharepoint\b/i},{key:'docs',name:'TechDocs',rx:/\btechdocs\b/i},{key:'docs',name:'README files',rx:/\breadme\b/i},
 {key:'ci',name:'GitHub Actions',rx:/\bgithub actions\b/i},{key:'ci',name:'Jenkins',rx:/\bjenkins\b/i},{key:'ci',name:'CircleCI',rx:/\bcircle\s?ci\b/i},{key:'ci',name:'GitLab CI',rx:/\bgitlab ci\b/i},{key:'ci',name:'Buildkite',rx:/\bbuildkite\b/i},{key:'ci',name:'Argo CD',rx:/\bargo\s?cd\b/i},
];
const LANGUAGES:[string,RegExp][]=[['Node.js',/\bnode(?:\.js|js)?\b/i],['TypeScript',/\btypescript\b/i],['Java',/\bjava\b(?!script)/i],['Spring Boot',/\bspring boot\b/i],['Python',/\bpython\b/i],['Go',/\bgolang\b|\bgo (?:service|1\.\d+)/i],['Kotlin',/\bkotlin\b/i],['Ruby',/\bruby\b/i],['.NET',/\.net\b|\bc#/i]];
const SERVICE=/`([a-z0-9][a-z0-9._-]{2,60})`|\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:api|service|svc|web|app|worker|gateway|ui|backend|frontend|server))\b|\bservice (?:called|named)\s+([a-z][a-z0-9-]{2,60})/g;
const REPO=/github\.com\/([\w.-]+\/[\w.-]+)|gitlab\.com\/([\w.-]+\/[\w.-]+)|\b(?:repo(?:sitory)?|monorepo)\s+(?:is\s+|at\s+|called\s+|named\s+)?(?:https?:\/\/)?(?:(?:github|gitlab|bitbucket)\.(?:com|org)\/)?`?([a-z0-9][\w.-]*\/[a-z0-9][\w.-]*)`?/gi;

const technical=(t:string)=>PLATFORMS.some(p=>p.rx.test(t))||LANGUAGES.some(([,r])=>r.test(t))||new RegExp(SERVICE.source,'i').test(t)||/\b(?:repo(?:sitory)?|monorepo|catalog(?:-info)?|yaml|ci\/cd|pipeline|deploy\w*|kubernetes|k8s|helm|terraform|docker|runbook|on-?call|incident|ownership|owned by|service owner|code ?owners?|scaffolder|template|backstage|techdocs|api|database|postgres\w*|kafka|service metadata)\b/i.test(t);

/** Category of one statement; internal categories win so private text never becomes developer content. */
function categorize(s:Statement):FindingCategory{
 const t=s.text;
 if(RX.commercial.test(t))return 'commercial';
 if(RX.stakeholder.test(t)&&!technical(t))return 'stakeholder';
 if(s.type==='repository')return 'repository';
 if(RX.evaluation.test(t)&&!technical(t))return 'evaluation';
 if(technical(t))return RX.requirement.test(t)?'technical_requirement':'technical_fact';
 if(NEEDS.some(n=>n.rx.test(t)))return 'business_need';
 if(s.type==='crm')return RX.stakeholder.test(t)?'stakeholder':'evaluation';
 return 'internal_note';
}
function status(s:Statement,category:FindingCategory):FindingStatus{
 if(RX.outdated.test(s.text))return 'outdated';
 if(RX.hedge.test(s.text))return 'assumption';
 return category==='repository'?'verified':'reported';
}

/** Needs expressed in business language, mapped to a technical playbook. */
const NEEDS:{rx:RegExp;need:string;goal:string;playbook:Playbook}[]=[
 {rx:/\b(?:same|repeat\w*|again and again|every time|each team|walk(?:ing)? (?:\w+ )*through|hand-?hold\w*|standardi[sz]\w*|consistent(?:ly)?|onboard(?:ing)? (?:new )?(?:teams|services))\b/i,need:'Teams need a repeatable way to get services production-ready without one-to-one help',goal:'Establish a repeatable service-readiness baseline (ownership, catalog metadata, documentation) starting with one service',playbook:'service_readiness'},
 {rx:/\bonboard\w*\b.{0,40}\b(?:existing|service|api|repo\w*)\b|\bregister\w* .{0,40}\bcatalog\b|\binto (?:the )?(?:software )?catalog\b/i,need:'An existing service needs to be brought into the Software Catalog',goal:'Prepare the named service for Catalog registration with a confirmed owner',playbook:'service_readiness'},
 {rx:/\b(?:who owns|don'?t know (?:who|which team)|no (?:clear )?owner|unclear owner\w*|ownership)\b/i,need:'It is not clear which team owns services',goal:'Make service ownership explicit and discoverable in the Catalog',playbook:'service_readiness'},
 {rx:/\b(?:hard to find|can'?t find|discoverab\w*|no (?:service )?inventory|don'?t know what (?:services|apis) (?:we|they) have)\b/i,need:'Services are hard to discover',goal:'Register services in the Software Catalog with accurate metadata',playbook:'service_readiness'},
 {rx:/\b(?:docs?|documentation|runbooks?|wiki) (?:are |is )?(?:scattered|outdated|hard to find|everywhere|out of date|missing)|\bscattered docs\b/i,need:'Operational documentation is hard to find or out of date',goal:'Move service documentation next to the code with TechDocs',playbook:'techdocs'},
 {rx:/\b(?:new service|from (?:a )?template|scaffold\w*|golden path|bootstrap\w* (?:a |new )?service|create\w* (?:a )?(?:new )?service)\b/i,need:'Teams need to create new services consistently',goal:'Create new services from an approved Software Template',playbook:'scaffolder'},
 {rx:/\b(?:build|pipeline|ci|deploy\w*) (?:is |are |keeps? )?(?:fail\w*|broken|flaky|red|slow)|\bflaky tests?\b/i,need:'Builds or deployments are unreliable',goal:'Investigate the failing CI/CD path and record the cause',playbook:'ci_investigation'},
];

function excerpt(s:Statement):SourceRef{return {sourceId:s.sourceId,type:s.type,label:s.speaker?`${s.label} · ${s.speaker.replace(/\s*\(.*\)/,'')}`:s.label,excerpt:s.text.length>EXCERPT?s.text.slice(0,EXCERPT-1).trimEnd()+'…':s.text};}

function entities(list:Statement[]){
 const e:Entities={services:[],repositories:[],scm:null,sso:null,docs:null,ci:null,languages:[]};
 const values:Record<string,Map<string,Statement[]>>={scm:new Map(),sso:new Map(),docs:new Map(),ci:new Map()};const stale=new Set<string>();
 for(const s of list){
  if(categorize(s)==='commercial')continue;
  for(const m of s.text.matchAll(SERVICE)){const name=(m[1]??m[2]??m[3]).toLowerCase();if(!e.services.includes(name)&&!/\//.test(name)&&!/^(?:node|java|type|catalog-info|spring)/.test(name)&&!COMMON_HYPHENATED.has(name))e.services.push(name);}
  for(const m of s.text.matchAll(REPO)){const repo=(m[1]??m[2]??m[3]).replace(/\.git$|[.,;]$/,'');if(!e.repositories.includes(repo)&&!/^node\.js\//i.test(repo))e.repositories.push(repo);}
  for(const p of PLATFORMS){const hit=p.rx.exec(s.text);if(!hit)continue;const m=values[p.key];m.set(p.name,[...(m.get(p.name)??[]),s]);
   // Staleness belongs to the mention, not the sentence: 'on X now, we used to run Y' keeps X current.
   if(STALE_BEFORE.test(s.text.slice(Math.max(0,hit.index-40),hit.index)))stale.add(p.name+'\u0000'+s.text);}
  for(const [name,rx] of LANGUAGES)if(rx.test(s.text)&&!e.languages.includes(name))e.languages.push(name);
 }
 // Repository names also identify services; prefer a service that matches a repository.
 for(const r of e.repositories){const tail=r.split('/')[1].toLowerCase();if(/-(?:api|service|svc|web|app|worker|gateway)$/.test(tail)&&!e.services.includes(tail))e.services.push(tail);}
 const current=(m:Map<string,Statement[]>)=>{const live=[...m].filter(([n,ss])=>ss.some(s=>!stale.has(n+'\u0000'+s.text)));return (live.length?live:[...m]).map(([n])=>n);};
 for(const key of ['scm','sso','docs','ci'] as const){const names=current(values[key]);e[key]=names[0]??null;}
 return {entities:e,values,current};
}

/** Ownership signal: an owner value, an explicit gap, or nothing. */
function ownership(list:Statement[]){
 const owners:Statement[]=[],gaps:Statement[]=[];let owner:string|null=null;
 for(const s of list){
  const gap=/\b(?:no (?:clear )?owner|unowned|(?:don'?t|do not|nobody) know\w* (?:who|which team)|who owns|owner(?:ship)? (?:is )?(?:unclear|unknown|unverified|not confirmed))\b/i.test(s.text);
  const m=/\bowned by\s+(?:the\s+)?([a-z0-9][\w-]*(?:\s(?:team|squad|group))?)|\bowner(?:ship)?\s*(?:is|:)\s*(?:the\s+)?(team[-\s][\w-]+|[a-z0-9-]+-team)\b/i.exec(s.text);
  if(gap)gaps.push(s);else if(m){owners.push(s);owner??=m[1]??m[2];}
 }
 return {owner,owners,gaps};
}
function catalogMetadata(list:Statement[]){
 const mentions=list.filter(s=>/catalog-info|catalog metadata|service metadata|catalog entry|registered in (?:the )?catalog/i.test(s.text));
 const missing=mentions.filter(s=>/\b(?:no|missing|without|incomplete|partial|outdated|stale|doesn'?t have|does not have|not (?:yet )?registered|half|wrong)\b/i.test(s.text));
 const present=mentions.filter(s=>!missing.includes(s)&&/\b(?:has|have|exists?|already|present|registered)\b/i.test(s.text));
 return {mentions,missing,present};
}

export function interpretRuleBased(sources:SourceInput[]):Understanding{
 const list=statements(sources);
 const findings:Finding[]=[];const contradictions:Contradiction[]=[];
 const add=(category:FindingCategory,topic:string,statement:string,st:FindingStatus,ss:Statement[])=>{const f:Finding={id:`f${findings.length+1}`,category,topic,statement,status:st,audience:category==='commercial'||category==='stakeholder'||category==='evaluation'||category==='internal_note'?'internal':category==='business_need'?'champion':'developer',sources:dedupe(ss.map(excerpt))};findings.push(f);return f;};
 // One reference per source keeps provenance compact; the full source stays available to Chris.
 const dedupe=(refs:SourceRef[])=>refs.filter((r,i)=>refs.findIndex(x=>x.sourceId===r.sourceId)===i).slice(0,4);
 // Internal statements stay as they were written; Chris needs the wording, developers never see it.
 for(const s of list){const c=categorize(s);if(c==='commercial'||c==='stakeholder'||c==='evaluation'||c==='internal_note')add(c,c==='commercial'?'Commercial':c==='stakeholder'?'People and organisation':c==='evaluation'?'Evaluation':'Notes',s.text,status(s,c),[s]);}
 const {entities:e,values,current}=entities(list);
 // Technical facts are restated from structured signals, not copied from quotes.
 const platformTopic:Record<string,string>={scm:'Source control',sso:'Sign-in',docs:'Documentation',ci:'CI/CD'};
 const platformText:Record<string,(n:string)=>string>={scm:n=>`Repositories are hosted on ${n}.`,sso:n=>`Sign-in uses ${n}.`,docs:n=>`Operational documentation currently lives in ${n}.`,ci:n=>`CI/CD runs on ${n}.`};
 for(const key of ['scm','sso','docs','ci'] as const){
  const m=values[key];if(!m.size)continue;
  const live=current(m);
  for(const [name,ss] of m){const outdated=!live.includes(name);const conflicting=live.length>1&&live.includes(name);
   const f=add(ss.some(s=>s.type==='repository')?'repository':'technical_fact',platformTopic[key],platformText[key](name),outdated?'outdated':conflicting?'contradicted':ss.some(s=>s.type==='repository')?'verified':ss.every(s=>RX.hedge.test(s.text))?'assumption':'reported',ss);
   if(conflicting&&!contradictions.some(c=>c.topic===platformTopic[key]))contradictions.push({topic:platformTopic[key],summary:`Sources disagree: ${live.join(' vs ')}.`,findingIds:[]});
   if(conflicting)contradictions.find(c=>c.topic===platformTopic[key])!.findingIds.push(f.id);}
 }
 const serviceStatements=(name:string)=>list.filter(s=>s.text.toLowerCase().includes(name));
 for(const svc of e.services){const ss=serviceStatements(svc);add(ss.some(s=>s.type==='repository')?'repository':'technical_fact','Service',`${svc} is in scope.`,ss.some(s=>s.type==='repository')?'verified':ss.every(s=>RX.hedge.test(s.text))?'assumption':'reported',ss);}
 for(const repo of e.repositories){const ss=list.filter(s=>s.text.includes(repo));add(ss.some(s=>s.type==='repository')?'repository':'technical_fact','Repository',`Code lives in ${repo}.`,ss.some(s=>s.type==='repository')?'verified':'reported',ss);}
 if(e.languages.length){const ss=list.filter(s=>LANGUAGES.some(([n,r])=>e.languages.includes(n)&&r.test(s.text)));add('technical_fact','Runtime',`Stack: ${e.languages.join(', ')}.`,ss.every(s=>RX.hedge.test(s.text))?'assumption':'reported',ss);}
 const own=ownership(list);
 if(own.owner&&own.gaps.length){const a=add('technical_fact','Ownership',`Ownership is reported as ${own.owner}, but other sources say it is unclear.`,'contradicted',[...own.owners,...own.gaps]);contradictions.push({topic:'Ownership',summary:`One source names ${own.owner}; another says ownership is unclear.`,findingIds:[a.id]});}
 else if(own.owner)add('technical_fact','Ownership',`Ownership is reported as ${own.owner}.`,own.owners.some(s=>RX.hedge.test(s.text))?'assumption':'reported',own.owners);
 else if(own.gaps.length)add('technical_fact','Ownership','Service ownership is not confirmed.','reported',own.gaps);
 const cat=catalogMetadata(list);
 if(cat.missing.length&&cat.present.length){const a=add('technical_fact','Catalog metadata','Catalog metadata may exist but is reported as incomplete.','contradicted',[...cat.present,...cat.missing]);contradictions.push({topic:'Catalog metadata',summary:'Sources disagree on whether catalog metadata exists.',findingIds:[a.id]});}
 else if(cat.missing.length)add(cat.missing.some(s=>s.type==='repository')?'repository':'technical_fact','Catalog metadata','Catalog metadata is missing or incomplete.',cat.missing.some(s=>s.type==='repository')?'verified':'reported',cat.missing);
 else if(cat.present.length)add('technical_fact','Catalog metadata','Catalog metadata is reported to exist.','reported',cat.present);
 // Technical statements not captured above stay internal: they still inform Chris, never developers verbatim.
 const used=new Set<string>();for(const f of findings)if(f.audience==='developer')for(const st of list)if(f.sources.some(r=>r.sourceId===st.sourceId)&&(f.statement.toLowerCase().split(/[^a-z0-9-]+/).filter(w=>w.length>4).some(w=>st.text.toLowerCase().includes(w))))used.add(st.sourceId+'\u0000'+st.text);
 for(const s of list){const c=categorize(s);if((c==='technical_fact'||c==='technical_requirement'||c==='repository')&&!used.has(s.sourceId+'\u0000'+s.text)&&!NEEDS.some(n=>n.rx.test(s.text)))add('internal_note','Other technical notes',s.text,status(s,c),[s]);}
 // Needs → goals. Each need is restated in neutral terms with its sources.
 const goals:Goal[]=[];
 for(const n of NEEDS){const ss=list.filter(s=>n.rx.test(s.text)&&categorize(s)!=='commercial');if(!ss.length)continue;
  const f=add('business_need','Need',n.need,ss.every(s=>RX.hedge.test(s.text))?'assumption':'reported',ss);
  const g=goals.find(x=>x.playbook===n.playbook);if(g)g.findingIds.push(f.id);else goals.push({need:n.need,technicalGoal:n.goal,playbook:n.playbook,findingIds:[f.id]});}
 // A named service with ownership or catalog gaps implies readiness work even without a stated need.
 if(!goals.length&&e.services.length&&(e.repositories.length||own.gaps.length||cat.missing.length))goals.push({need:'Service ownership or catalog metadata is incomplete',technicalGoal:'Prepare the service for Catalog registration with a confirmed owner',playbook:'service_readiness',findingIds:[]});
 const understanding:Understanding={interpreter:'rule_based',findings,goals,unknowns:[],contradictions,entities:e};
 understanding.unknowns=unknownsFor(understanding,own.owner!==null&&!own.gaps.length,cat,list.some(s=>/\bsecurity (?:review|approval|sign-?off|team)\b/i.test(s.text)));
 return understanding;
}

/** Unknowns ranked by whether they block the first milestone; only investigable ones go to developers. */
export function unknownsFor(u:Understanding,ownerKnown:boolean,cat={mentions:[] as unknown[],missing:[] as unknown[]},security=false):Unknown[]{
 const e=u.entities,playbook=u.goals[0]?.playbook??null,svc=e.services[0]??'the first service';
 const out:Unknown[]=[];const push=(question:string,priority:Unknown['priority'],audience:Unknown['audience'],reason:string)=>out.push({id:`u${out.length+1}`,question,priority,audience,reason});
 if(!playbook)push('Which service or workflow should the first milestone cover?','blocks_first_milestone','chris','No technical goal could be derived from the sources yet.');
 if(!e.services.length&&!e.repositories.length)push('Which service or repository is in scope first?','blocks_first_milestone','chris','A milestone needs a concrete service or repository.');
 if(!e.repositories.length&&(e.services.length||playbook))push(`Where is the ${svc} repository?`,'blocks_first_milestone','chris','The first milestone starts by inspecting the repository.');
 if(!e.scm)push('Which source control platform hosts the code?','blocks_first_milestone','chris','Repository inspection depends on it.');
 if(playbook==='service_readiness'||playbook==='techdocs'){
  if(!ownerKnown)push(`Which team owns ${svc}?`,'blocks_first_milestone','developer','A Catalog entry needs a confirmed owner. Ask the maintainers.');
  if(!cat.mentions.length)push(`Does ${svc} already have catalog-info.yaml?`,'needed_later','developer','The repository inspection shows whether metadata exists.');
 }
 if((playbook==='service_readiness'||playbook==='techdocs')&&!e.docs)push(`Where is the operational documentation for ${svc}?`,'needed_later','developer','Needed to make docs discoverable from the Catalog.');
 if(playbook==='scaffolder')push('Which Software Template and runtime are approved?','blocks_first_milestone','chris','A new service must start from an approved template.');
 if(playbook==='ci_investigation'&&!e.ci)push('Which CI/CD system runs the failing pipeline?','blocks_first_milestone','developer','The investigation starts in the pipeline configuration.');
 push(`Do you have read access to ${e.repositories[0]??'the repository'}?`,'blocks_first_milestone','developer','Nothing can be inspected without it. Check before you start.');
 if(security)push('Is a security review required before the service is registered?','needed_later','chris','Mentioned as possible; it doesn’t block reviewing repository readiness.');
 if(!e.sso)push('Which identity provider is used for sign-in?','not_needed_now','chris','Not required for the first milestone.');
 for(const c of u.contradictions)push(`Confirm ${c.topic.toLowerCase()}: ${c.summary}`,'blocks_first_milestone',c.topic==='Ownership'||c.topic==='Catalog metadata'?'developer':'chris','Sources disagree; the plan should not rely on either claim until confirmed.');
 return out;
}
