import {it,expect} from 'vitest';
import {resolveConversationContext} from './conversation';
it('preserves Ledger when a developer requests an incompatible Node service',()=>{expect(resolveConversationContext('Launch a Node.js service.','ledger','java')).toEqual({teamId:'ledger',stack:'node'});});
it('preserves an explicit customer team while retaining the requested incompatible language',()=>{expect(resolveConversationContext('I am on Ledger Platform and need a Node.js service.','orbit','node')).toEqual({teamId:'ledger',stack:'node'});});
it('allows explicit team selection and derives its default stack',()=>{expect(resolveConversationContext('Help the Signal Intelligence team get started.','orbit','node')).toEqual({teamId:'signal',stack:'python'});});
it('retains confirmed context when no team or language is named',()=>{expect(resolveConversationContext('Add documentation.','ledger','java')).toEqual({teamId:'ledger',stack:'java'});});
