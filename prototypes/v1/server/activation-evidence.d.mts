import type {EvidenceRecord} from '../../../contracts/activation/v1/types.ts';
export function collectActivationEvidence(input:{goal:string;repository:string}, options?:{fetchImpl?: typeof fetch;token?:string}):Promise<{inspection:{diagnosis:string;[key:string]:unknown};records:EvidenceRecord[]}>;
