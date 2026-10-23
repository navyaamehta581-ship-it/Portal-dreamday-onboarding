import {it,expect} from 'vitest';
import {answerInContext} from './assistant';
const ctx={page:'Catalog',teamId:'ledger',service:'ledger-api'};
it('uses the current service and approved Java guide for a setup task',()=>{const a=answerInContext('Help me set it up locally',ctx);expect(a.text).toContain('./mvnw verify');expect(a.text).not.toContain('npm ci');expect(a.task?.service).toBe('ledger-api');expect(a.sources.some(s=>s.label==='Setup guide · ledger-api')).toBe(true);});
it('offers supported onboarding instead of prohibited publishing',()=>{const a=answerInContext('Create a new service',ctx);expect(a.task?.intent).toBe('onboarding');expect(a.text).toContain('prohibits');});
it('retrieves another explicitly named service in the same team',()=>{const a=answerInContext('Set up audit-service locally',ctx);expect(a.task?.service).toBe('audit-service');});
it('asks for a target rather than inventing one',()=>{const a=answerInContext('Help me get started',{page:'Catalog',teamId:'ledger'});expect(a.task).toBeUndefined();expect(a.text).toContain('Which service');});
it('does not fabricate an answer to an unsupported question',()=>{const a=answerInContext('What happened in production yesterday?',ctx);expect(a.text).toContain('does not answer arbitrary questions or access live systems');});
