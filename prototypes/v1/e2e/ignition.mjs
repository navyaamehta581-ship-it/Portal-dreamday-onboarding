import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.IGNITION_URL??'http://127.0.0.1:5186';
const out=process.env.IGNITION_EVIDENCE??'../../docs/ignition/screenshots';mkdirSync(out,{recursive:true});
async function persona(p){await page.goto(base+({chris:'/ignition/chris',maya:'/ignition/champion',alex:'/ignition/developer',jordan:'/ignition/developer/jordan'}[p]));if(await page.getByLabel('Work email').count()){await page.getByLabel('Work email').fill(p+'@northstar.example');await page.getByRole('button',{name:'Sign in',exact:true}).click();}await page.getByRole('button',{name:`Account: ${p[0].toUpperCase()+p.slice(1)}`,exact:true}).waitFor();}
async function shot(name){await page.locator('.pt-main').evaluate(e=>e.scrollTop=0).catch(()=>{});await page.screenshot({path:`${out}/${name}.png`,fullPage:true});}
try{
 await page.goto(base+'/');await page.getByRole('button').first().waitFor();await shot('00-welcome-preserved');
 await page.goto(base+'/ignition');await persona('chris');
 await page.getByRole('button',{name:'Simulate Claude Agent import'}).click();await page.getByText('Claude Agent import · SIMULATED ·',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Extract a review draft'}).click();await page.getByLabel('I reviewed both fields').check();await shot('01-chris-review');
 await page.getByRole('button',{name:'Approve handoff v1'}).click();await page.getByText('Approved handoff v1',{exact:true}).waitFor();
 await persona('alex');assert.equal(await page.getByText('~$100K',{exact:false}).count(),0);
 await page.getByText('Open simulated catalog entry',{exact:true}).click();await page.getByLabel('Which team owns payments-api?').fill('wrong');await page.getByRole('button',{name:'Verify outcome in simulation'}).click();await page.getByRole('alert').filter({hasText:'OUTCOME_NOT_VERIFIED'}).waitFor();
 await page.getByLabel('Which team owns payments-api?').fill('team-payments');await page.getByRole('button',{name:'Verify outcome in simulation'}).click();await page.getByRole('status').filter({hasText:'verified in simulation'}).waitFor();await shot('02-developer-outcome');
 await page.getByRole('button',{name:'AiKA · simulated help'}).click();await page.getByRole('button',{name:'Still blocked? Technical support'}).click();await page.getByLabel('What blocked you?').fill('Real repository access is not confirmed.');await page.getByRole('button',{name:'Prepare support draft'}).click();await shot('03-contextual-help');
 await persona('maya');await page.getByLabel('First workflow').selectOption('docs');await page.getByLabel('Optional team goal').fill('Both developers find ownership and a runbook this week.');await page.getByLabel('Alex',{exact:true}).check();await page.getByLabel('Jordan',{exact:true}).check();await page.getByRole('button',{name:'Save preferences & simulate invites'}).click();await page.getByRole('status').filter({hasText:'Preferences saved'}).waitFor();await shot('04-team-activation');
 await persona('jordan');await page.getByText('Open simulated documentation',{exact:true}).click();await page.getByLabel('What is the runbook heading?').fill('Payments recovery');await page.getByRole('button',{name:'Verify outcome in simulation'}).click();await page.getByRole('status').filter({hasText:'verified in simulation'}).waitFor();
 await persona('chris');await page.getByRole('button',{name:'Revise approved handoff'}).click();await page.getByLabel('Developer context',{exact:true}).fill('Maya prioritizes service ownership and documentation for payments-api on GitHub. Updated POC handoff.');await page.getByLabel('I reviewed both fields').check();await page.getByRole('button',{name:'Approve handoff v2'}).click();await page.getByText('Approved handoff v2',{exact:true}).waitFor();await page.getByRole('link',{name:'Adoption overview →'}).click();await page.getByRole('cell',{name:'Verified in simulation · handoff v1'}).first().waitFor();await shot('05-adoption-after-revision');
 await page.reload();await page.getByRole('cell',{name:'Verified in simulation · handoff v1'}).first().waitFor();
 await page.setViewportSize({width:820,height:1000});await shot('06-compact');
 assert.deepEqual(errors,[]);console.log('PASS: approval, optional champion, two developers, support, revision, retained adoption; no browser errors.');
}finally{await browser.close();}
