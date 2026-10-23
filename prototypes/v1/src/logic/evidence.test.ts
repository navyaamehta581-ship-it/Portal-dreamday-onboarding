import {it,expect} from 'vitest';
import {assessEvidence} from './evidence';
it('does not equate a successful run with a completed task',()=>{expect(assessEvidence({prerequisites:false,setup:false,testOutput:'BUILD SUCCESS',firstChange:false}).complete).toBe(false);});
it('requires all completion evidence',()=>{expect(assessEvidence({prerequisites:true,setup:true,testOutput:'BUILD SUCCESS',firstChange:true}).complete).toBe(true);});
it('rejects missing or negated test results',()=>{expect(assessEvidence({prerequisites:true,setup:true,testOutput:'not BUILD SUCCESS',firstChange:true}).complete).toBe(false);});
