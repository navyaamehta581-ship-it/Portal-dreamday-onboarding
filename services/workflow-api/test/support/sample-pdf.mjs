/** The fictional Aperture Commerce discovery document Chris uploads in tests, the browser tests and the demo
 * (prototypes/v1/public/samples/). Same story as scenario A in fixtures/scenarios.json, laid out like a real
 * account-team document: title, headings, a call transcript, private notes, running footer and page numbers. */
import {makePdf} from './pdf.mjs';

const footer=(n,of)=>[{text:'Aperture Commerce (FICTIONAL) · Discovery notes',size:8,y:40},{text:`Page ${n} of ${of}`,size:8,x:520,y:40}];
const h=(text,size=14)=>({text,size,bold:true});
const p=text=>({text});
const gap={text:''};

export function aperturePdf({compress=true}={}){
 return makePdf([
  {lines:[h('Aperture Commerce — Discovery notes',20),p('Customer: Aperture Commerce (FICTIONAL)'),p('Prepared by Chris, Spotify account team. Every name and number in this document is invented.'),gap,
   h('Account overview'),p('Enterprise commerce and payments infrastructure. Employees: 6,800. Engineers: 1,350 across 94 teams; roughly 720 services.'),
   p('Opportunity: Portal Enterprise, potential $300K ARR. 60-day evaluation, stage: technical validation.'),p('Champion: Maya Chen, Director of Platform Engineering. Account owner: Chris.'),gap,
   h('Discovery call'),p('[00:03] Maya Chen: Our biggest pain is that nobody can tell who owns a service. Ownership is all over the place and the runbooks are inconsistent or missing.'),
   p("[00:07] Maya Chen: For the pilot let's use payments-api. It's on GitHub, but I'm honestly not sure the catalog file is up to date."),
   p('[00:10] Maya Chen: Alex Rivera can do the initial repository readiness assessment. Jordan Lee should independently check whether people can actually find the service and its docs.'),
   p('[00:14] Maya Chen: Our VP thinks Backstage is a nice-to-have, so we need something concrete in 60 days.'),...footer(1,3)]},
  {lines:[h('Technical requirements'),p('The pilot must start with payments-api only. Ownership must be visible in the Catalog before any other service is added.'),
   p('Runbooks should live next to the code. Deployments must keep working during the pilot.'),gap,
   h('Internal notes'),p("Maya is the right champion. Don't share pricing or the VP comment with engineers."),
   p('Not clear whether payments-api deploys with GitHub Actions or Jenkins - Maya said Actions, the SRE in the call said Jenkins.'),...footer(2,3)]},
  {lines:[h('Tools and integrations'),p('Code is on GitHub (aperture-commerce organisation). Docs are spread across a wiki and README files.'),p('CI: GitHub Actions for most teams; some services still on Jenkins.'),...footer(3,3)]},
 ],{compress,title:'Aperture Commerce — Discovery notes (fictional)'});
}
