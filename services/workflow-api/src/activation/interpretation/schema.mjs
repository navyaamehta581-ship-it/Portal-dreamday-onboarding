/** Internal model boundary. No model-owned evidence, stages, actions or permissions. */
export const INTENTS = ['unclassified', 'discovery', 'troubleshooting', 'optimization', 'creation', 'modification'];
const text = {type:'string', minLength:1, maxLength:1000};
const list = items => ({type:'array', items, maxItems:20});
const object = properties => ({type:'object', properties, required:Object.keys(properties), additionalProperties:false});
const statement = object({text, sourceMessageIds:list({type:'string',minLength:1,maxLength:80})});
export const interpretationSchema = object({
 intent:{type:'string',enum:INTENTS}, secondaryIntents:list({type:'string',enum:INTENTS.slice(1)}),
 rationale:text, ambiguous:{type:'boolean'},
 statedProblem:text, desiredOutcome:{anyOf:[text,{type:'null'}]},
 context:list(statement), friction:list(statement), constraints:list(statement), existingCapabilities:list(statement),
 missingInformation:list(object({text, source:{type:'string',enum:['developer','retrieval','inference']}, blocksNextDecision:{type:'boolean'}})),
 assumptions:list(text), conflictingConstraintIds:list({type:'string',minLength:1,maxLength:80}),
 clarification:{anyOf:[object({question:text,reason:text}),{type:'null'}]},
});
export class InterpretationError extends Error {
 constructor(code) {super(code);this.code=code;}
}
function validate(value, schema, path='$') {
 if(schema.anyOf) {if(schema.anyOf.some(s=>{try{validate(value,s,path);return true;}catch{return false;}}))return;throw new InterpretationError('INVALID_MODEL_OUTPUT');}
 const fail=()=>{throw new InterpretationError('INVALID_MODEL_OUTPUT');};
 if(schema.type==='null') {if(value!==null)fail();return;}
 if(schema.type==='object') {
  if(!value||typeof value!=='object'||Array.isArray(value))fail();
  if(Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k))||schema.required.some(k=>!Object.hasOwn(value,k)))fail();
  for(const [k,s] of Object.entries(schema.properties))validate(value[k],s,`${path}.${k}`);
 } else if(schema.type==='array') {
  if(!Array.isArray(value)||value.length>schema.maxItems)fail();
  for(const item of value)validate(item,schema.items,path);
 } else if(typeof value!==schema.type)fail();
 else if(schema.type==='string' && (!value.trim()||value.length<schema.minLength||value.length>schema.maxLength))fail();
 if(schema.enum&&!schema.enum.includes(value))fail();
}
export function validateInterpretation(value, state) {
 validate(value,interpretationSchema);
 const messages=new Map(state.messages.filter(m=>m.role==='user').map(m=>[m.id,m.content]));
 for(const key of ['context','friction','constraints','existingCapabilities'])for(const item of value[key]) {
  // Require literal developer statements; paraphrases/inferences belong in assumptions.
  if(!item.sourceMessageIds.length||item.sourceMessageIds.some(id=>!messages.get(id)?.includes(item.text)))throw new InterpretationError('INVALID_MODEL_OUTPUT');
 }
 if(value.conflictingConstraintIds.some(id=>!state.constraints.some(c=>c.id===id)))throw new InterpretationError('INVALID_MODEL_OUTPUT');
 if(value.clarification && !value.ambiguous && !value.conflictingConstraintIds.length && !value.missingInformation.some(x=>x.source==='developer'&&x.blocksNextDecision))throw new InterpretationError('INVALID_MODEL_OUTPUT');
 return structuredClone(value);
}
