import type {Capability, Service, Team} from '../domain/models';
export const teams:Team[]=[
{id:'orbit',name:'Orbit Experience',initials:'OE',stack:'node',allowed:['node'],canPublish:true,existing:['discovery-api','playlist-edge','session-service'],constraints:['Node.js paved road','GitHub repositories','New services allowed'],goal:'Ship a Node.js service with a complete operational baseline.'},
{id:'ledger',name:'Ledger Platform',initials:'LP',stack:'java',allowed:['java'],canPublish:false,existing:['ledger-api','settlement-worker','audit-service','identity-gateway'],constraints:['Java only','No new repositories','Existing services only'],goal:'Onboard engineers to the existing Java estate without provisioning infrastructure.'},
{id:'signal',name:'Signal Intelligence',initials:'SI',stack:'python',allowed:['python','node'],canPublish:true,existing:['feature-store','model-serving','event-pipeline'],constraints:['Python preferred','Node.js allowed','GitHub repositories'],goal:'Standardize documentation and observability for data services.'}
];
export const services:Service[]=[
['discovery-api','orbit','node','production','Content discovery and ranking'],['playlist-edge','orbit','node','production','Playlist aggregation'],['session-service','orbit','node','experimental','Session context'],['ledger-api','ledger','java','production','Internal ledger interface'],['settlement-worker','ledger','java','production','Settlement processing'],['audit-service','ledger','java','production','Append-only audit trail'],['identity-gateway','ledger','java','production','Identity and access boundary'],['feature-store','signal','python','production','Shared feature retrieval'],['model-serving','signal','python','experimental','Model inference endpoint'],['event-pipeline','signal','python','production','Event transformation']
].map(([name,owner,stack,lifecycle,description])=>({name,owner,stack:stack as Service['stack'],lifecycle,description,docs:`docs/${name}/index.md`}));
const all:Capability['stacks']=['node','java','python'];
export const capabilities:Capability[]=[
{id:'node',title:'Node.js service skeleton',provides:['service'],stacks:['node'],dependencies:[],action:'fetch:template',template:'./skeletons/node',configuration:['runtime'],description:'TypeScript service, health endpoint and catalog descriptor.'},
{id:'java',title:'Java service skeleton',provides:['service'],stacks:['java'],dependencies:[],action:'fetch:template',template:'./skeletons/java',configuration:['runtime'],description:'Spring Boot service skeleton and catalog descriptor.'},
{id:'python',title:'Python service skeleton',provides:['service'],stacks:['python'],dependencies:[],action:'fetch:template',template:'./skeletons/python',configuration:['runtime'],description:'Python API skeleton with health endpoint.'},
{id:'onboard',title:'Existing-service onboarding pack',provides:['onboarding'],stacks:all,dependencies:[],action:'fetch:template',template:'./skeletons/onboarding',configuration:['existingService'],description:'Prepare a local onboarding guide for an existing service; no repository writes.'},
{id:'ci',title:'CI/CD configuration',provides:['ci'],stacks:all,dependencies:['base'],action:'fetch:template',template:'./skeletons/ci',configuration:['testCommand'],description:'Generate CI checks and a gated delivery configuration. No deployment runs.'},
{id:'monitoring',title:'Observability baseline',provides:['monitoring'],stacks:all,dependencies:['base'],action:'fetch:template',template:'./skeletons/monitoring',configuration:['alertOwner'],description:'Generate dashboard and alert configuration for review.'},
{id:'docs',title:'Documentation & ownership',provides:['docs'],stacks:all,dependencies:['base'],action:'fetch:template',template:'./skeletons/docs',configuration:['docOwner'],description:'Generate a TechDocs-ready guide, ownership and runbook.'},
{id:'publish',title:'Publish repository',provides:[],stacks:all,dependencies:['artifacts'],action:'publish:github',publish:true,configuration:[],description:'Publish the assembled workspace to a new GitHub repository.'},
{id:'register',title:'Register in catalog',provides:[],stacks:all,dependencies:['publish'],action:'catalog:register',configuration:[],description:'Register the new repository catalog-info.yaml.'}
];
export const actions=['fetch:template','publish:github','catalog:register'] as const;
export const needLabels={service:'New service',onboarding:'Existing-service onboarding',ci:'CI/CD',monitoring:'Monitoring',docs:'Documentation'};
