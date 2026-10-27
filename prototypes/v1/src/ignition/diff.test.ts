import {expect,it} from 'vitest';
import {lineDiff,provenance} from './diff';
it('marks added and removed handoff lines and keeps unchanged ones',()=>{
 expect(lineDiff('a\nb\nc','a\nc\nd')).toEqual([{kind:'same',text:'a'},{kind:'del',text:'b'},{kind:'same',text:'c'},{kind:'add',text:'d'}]);
});
it('separates extraction provenance from the line text',()=>{
 expect(provenance('[CRM paste · crm] 30-day POC.')).toEqual({source:'CRM paste · crm',text:'30-day POC.'});
 expect(provenance('Plain line')).toEqual({source:null,text:'Plain line'});
});
