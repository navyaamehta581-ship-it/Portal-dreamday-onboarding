import {describe,it,expect} from 'vitest';
import {parse} from 'yaml';
import {teams,actions,capabilities,services} from '../data/catalog';
import type {Request} from '../domain/models';
import {recommend,validate} from './engine';
import {generate} from './generate';
import {simulate} from './execution';
const node:Request={problem:'Launch API',needs:['service','ci','monitoring','docs'],stack:'node',name:'demo-api',repo:'github.com?owner=example-org&repo=demo-api'};
const java:Request={...node,problem:'Onboard developer',needs:['onboarding','monitoring','docs'],stack:'java',name:'ledger-guide'};
describe('structured recommendation',()=>{
 it('includes ten distinct services across three teams',()=>{expect(new Set(services.map(s=>s.name)).size).toBe(10);expect(teams).toHaveLength(3);});
 it('builds the complete Node service chain',()=>{const p=recommend(teams[0],node);expect(p.blocked).toEqual([]);expect(p.uncovered).toEqual([]);expect(p.steps.map(s=>s.id)).toEqual(['node','ci','monitoring','docs','publish','register']);expect(validate(teams[0],node,p.steps)).toEqual([]);});
 it('uses structured requirements independently of prose',()=>{expect(recommend(teams[0],{...node,problem:'Java no monitoring'}).steps).toEqual(recommend(teams[0],node).steps);});
 it('onboards Java without publishing or creating services',()=>{const p=recommend(teams[1],java);expect(p.steps.map(s=>s.id)).toEqual(['onboard','monitoring','docs']);expect(p.steps[0].config.existingService).toBe('ledger-api');expect(validate(teams[1],java,p.steps)).toEqual([]);});
 it('blocks new repositories for the constrained Java team',()=>{expect(recommend(teams[1],{...java,needs:['service']}).blocked.join(' ')).toContain('prohibits');});
 it('blocks disallowed stacks',()=>{expect(recommend(teams[1],node).steps).toEqual([]);});
 it('supports the third team',()=>{expect(recommend(teams[2],{...node,stack:'python'}).steps[0].id).toBe('python');});
 it('resolves shared base dependencies once',()=>{const ids=recommend(teams[0],{...node,needs:['monitoring','docs']}).steps.map(s=>s.id);expect(ids).toEqual(['onboard','monitoring','docs']);});
 it('blocks contradictory intents and empty requirements',()=>{expect(recommend(teams[0],{...node,needs:[]}).blocked.length).toBeGreaterThan(0);expect(recommend(teams[0],{...node,needs:['service','onboarding']}).blocked.length).toBeGreaterThan(0);});
});
describe('editable approval validation',()=>{
 it('rejects removing a dependency',()=>{const s=recommend(teams[0],node).steps.filter(s=>s.id!=='node');expect(validate(teams[0],node,s).join(' ')).toContain('dependency');});
 it('rejects reordering dependencies',()=>{const s=recommend(teams[0],node).steps;[s[0],s[1]]=[s[1],s[0]];expect(validate(teams[0],node,s).join(' ')).toContain('out of order');});
 it('rejects incomplete required configuration',()=>{const s=recommend(teams[0],node).steps;s[1].config.testCommand='';expect(validate(teams[0],node,s).join(' ')).toContain('required');});
 it('rejects cross-team onboarding targets',()=>{const s=recommend(teams[1],java).steps;s[0].config.existingService='discovery-api';expect(validate(teams[1],java,s).join(' ')).toContain('owned');});
 it('rejects invalid name and repository',()=>{const s=recommend(teams[0],node).steps;expect(validate(teams[0],{...node,name:'bad name',repo:'https://evil.test'},s)).toHaveLength(2);});
 it('rejects publishing tampered into a constrained workflow',()=>{const s=recommend(teams[1],java).steps;s.push({id:'publish',title:'Publish',justification:'',config:{},capability:capabilities.find(c=>c.id==='publish')!});expect(validate(teams[1],java,s).join(' ')).toContain('prohibited');});
});
describe('Scaffolder YAML',()=>{
 it('round trips with supported actions and output dependencies',()=>{const y=parse(generate(teams[0],node,recommend(teams[0],node).steps));expect(y.apiVersion).toBe('scaffolder.backstage.io/v1beta3');expect(y.spec.steps.every((s:{action:string})=>(actions as readonly string[]).includes(s.action))).toBe(true);expect(y.spec.steps.at(-1).input.repoContentsUrl).toBe('${{ steps.publish.output.repoContentsUrl }}');});
 it('serializes editable values safely',()=>{const s=recommend(teams[0],node).steps;s[0].title='Title: # with YAML syntax';const y=parse(generate(teams[0],node,s));expect(y.spec.steps[0].name).toBe(s[0].title);});
 it('never emits repository actions for onboarding',()=>{const y=parse(generate(teams[1],java,recommend(teams[1],java).steps));expect(y.spec.steps.every((s:{action:string})=>s.action==='fetch:template')).toBe(true);});
 it('refuses invalid workflows',()=>{expect(()=>generate(teams[0],node,[])).toThrow();});
});
describe('local simulation',()=>{
 it('stops subsequent steps after failure and recovers on a fresh run',()=>{const s=recommend(teams[0],node).steps;expect(simulate(s,'ci').map(l=>l.status)).toEqual(['success','failed','skipped','skipped','skipped','skipped']);expect(simulate(s).every(l=>l.status==='success')).toBe(true);});
});

describe('environment grounding and task evidence',()=>{
 it('respects a corrected unavailable capability',()=>{const r={...node,unavailableCapabilities:['ci']};const p=recommend(teams[0],r);expect(p.blocked.join(' ')).toContain('unavailable');expect(p.uncovered).toContain('ci');expect(()=>generate(teams[0],r,p.steps)).toThrow();});
 it('does not include a dependent step when its base is missing',()=>{const p=recommend(teams[0],{...node,unavailableCapabilities:['node']});expect(p.steps.some(s=>s.id==='ci')).toBe(false);});
 it('uses materially different Java configuration and supported actions',()=>{const s=recommend(teams[1],java).steps;expect(s[0].config.runtime).toBe('Java 21');expect(s[0].capability.template).toBe('./skeletons/onboarding-java');expect(parse(generate(teams[1],java,s)).spec.parameters[0].properties.repoUrl).toBeUndefined();});
 it('rejects an incompatible edited runtime',()=>{const s=recommend(teams[1],java).steps;s[0].config.runtime='Node.js 22 LTS';expect(validate(teams[1],java,s).join(' ')).toContain('runtime must match');});
 it('retrieves the selected service rather than always the first service',()=>{const s=recommend(teams[1],{...java,targetService:'audit-service'}).steps;expect(s[0].config.existingService).toBe('audit-service');});
 it('uses canonical action metadata in generation',()=>{const s=recommend(teams[0],node).steps;s[0].capability={...s[0].capability,action:'unsupported:execute' as never};expect(()=>generate(teams[0],node,s)).toThrow();});
 it('shows step inputs and outputs without claiming actual changes',()=>{const logs=simulate(recommend(teams[0],node).steps);expect(logs[0].inputs.runtime).toBe('Node.js 22 LTS');expect(logs[0].outputs.artifact).toMatch(/^simulated:/);});
});
