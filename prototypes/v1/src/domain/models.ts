export type Stack = 'node' | 'java' | 'python';
export type Need = 'service' | 'onboarding' | 'ci' | 'monitoring' | 'docs';
export type Action = 'fetch:template' | 'publish:github' | 'catalog:register';
export interface Team {id:string; name:string; initials:string; stack:Stack; allowed:Stack[]; canPublish:boolean; existing:string[]; constraints:string[]; goal:string}
export interface Capability {id:string; title:string; provides:Need[]; stacks:Stack[]; dependencies:string[]; action:Action; template?:string; publish?:boolean; configuration:string[]; description:string}
export interface Service {name:string; owner:string; stack:Stack; lifecycle:string; description:string; docs:string}
export interface Request {problem:string; needs:Need[]; stack:Stack; name:string; repo:string; unavailableCapabilities?:string[]; targetService?:string}
export interface Step {id:string; capability:Capability; title:string; justification:string; config:Record<string,string>}
export interface Plan {steps:Step[]; blocked:string[]; rejected:string[]; uncovered:Need[]}
