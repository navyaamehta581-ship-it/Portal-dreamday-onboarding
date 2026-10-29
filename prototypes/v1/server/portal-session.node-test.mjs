import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DEFAULT_PERSONAS, createPortalSession, loadDirectory} from './portal-session.mjs';

const dir = mkdtempSync(join(tmpdir(), 'portal-session-'));
const devA = 'a'.repeat(64), opA = 'c'.repeat(64), champA = 'e'.repeat(64), devB = 'b'.repeat(64), opB = 'd'.repeat(64);
for (const [name, value] of [['a', devA], ['a-op', opA], ['a-champ', champA], ['b', devB], ['b-op', opB]]) writeFileSync(join(dir, name), value);
const customers = [
  {id: 'north', label: 'Northstar', customerId: 'fictional-north', apiOrigin: 'http://127.0.0.1:7001', tokenFile: join(dir, 'a'), operatorTokenFile: join(dir, 'a-op'), championTokenFile: join(dir, 'a-champ')},
  {id: 'other', label: 'Other', customerId: 'fictional-other', apiOrigin: 'http://127.0.0.1:7002', tokenFile: join(dir, 'b'), operatorTokenFile: join(dir, 'b-op')},
  {id: 'missing', label: 'Missing', customerId: 'fictional-missing', apiOrigin: 'http://127.0.0.1:7003', tokenFile: join(dir, 'none'), operatorTokenFile: join(dir, 'none')},
];
const personas = [
  {id: 'chris', name: 'Chris', role: 'operator', title: 'Spotify account operator', customers: ['north', 'other']},
  {id: 'maya', name: 'Maya Chen', role: 'champion', title: 'Platform Champion', customers: ['north']},
  {id: 'alex', name: 'Alex Rivera', role: 'developer', title: 'Developer', customers: ['north']},
  {id: 'sam', name: 'Sam Okafor', role: 'developer', title: 'Developer', customers: ['other']},
  {id: 'ghost', name: 'Ghost', role: 'developer', title: 'Developer', customers: ['missing']},
];

async function harness() {
  const calls = [];
  const fetchImpl = async (url, init) => {calls.push({url, init}); return new Response(JSON.stringify({ok: true}), {status: 200, headers: {ETag: '"activation-1"'}});};
  const handle = createPortalSession({directory: loadDirectory({PORTAL_DEMO_ACCOUNTS: config({customers, personas})}), fetchImpl});
  const server = createServer((req, res) => {void handle(req, res, () => {res.writeHead(418); res.end();});});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = (path, init = {}) => fetch(origin + path, init);
  const signIn = async (personaId, jar = {}) => {
    const r = await call('/portal-auth/login', {method: 'POST', headers: {...jar, Origin: origin}, body: JSON.stringify({personaId})});
    assert.equal(r.status, 200);
    return {Cookie: r.headers.get('set-cookie').split(';')[0]};
  };
  return {calls, origin, call, signIn, close: () => new Promise(r => server.close(r))};
}
let n = 0;
function config(value) {const file = join(dir, `config-${n++}.json`); writeFileSync(file, JSON.stringify(value)); return file;}
const STATE = '/activation/v1/customers/fictional-north/state';

test('lists personas with role and customer, never tokens, files or API origins', async () => {
  const h = await harness();
  try {
    const text = await (await h.call('/portal-auth/personas')).text();
    for (const secret of [devA, opA, 'tokenFile', 'apiOrigin', dir]) assert.ok(!text.includes(secret));
    const maya = JSON.parse(text).personas.find(p => p.id === 'maya');
    assert.deepEqual(maya, {id: 'maya', name: 'Maya Chen', role: 'champion', title: 'Platform Champion', customers: [{id: 'north', label: 'Northstar', customerId: 'fictional-north'}]});
  } finally {await h.close();}
});

test('sign-in is same-origin, sets an HttpOnly cookie and survives a reload as the same persona', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('/portal-api' + STATE)).status, 401);
    assert.equal((await h.call('/portal-auth/login', {method: 'POST', body: '{"personaId":"alex"}'})).status, 403);
    assert.equal((await h.call('/portal-auth/login', {method: 'POST', headers: {Origin: h.origin}, body: '{"personaId":"ghost"}'})).status, 503);
    assert.equal((await h.call('/portal-auth/login', {method: 'POST', headers: {Origin: h.origin}, body: '{"personaId":"nobody"}'})).status, 404);
    const login = await h.call('/portal-auth/login', {method: 'POST', headers: {Origin: h.origin}, body: '{"personaId":"alex"}'});
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.ok(!(await login.clone().text()).includes(devA));
    const jar = {Cookie: login.headers.get('set-cookie').split(';')[0]};
    for (let i = 0; i < 2; i++) assert.equal((await (await h.call('/portal-auth/session', {headers: jar})).json()).persona.id, 'alex');
    assert.equal((await h.call('/portal-auth/logout', {method: 'POST', headers: {...jar, Origin: h.origin}})).status, 200);
    assert.equal((await h.call('/portal-auth/session', {headers: jar})).status, 401);
    assert.equal((await h.call('/portal-api' + STATE, {headers: jar})).status, 401);
  } finally {await h.close();}
});

test('developers use the developer credential, the Champion the Champion credential; forged headers or customer IDs change nothing', async () => {
  const h = await harness();
  try {
    for (const [id, token, name] of [['alex', devA, 'Alex Rivera'], ['maya', champA, 'Maya Chen']]) {
      const jar = await h.signIn(id);
      const read = await h.call('/portal-api' + STATE, {headers: {...jar, Authorization: 'Bearer forged', 'X-Portal-Persona': id, 'X-Portal-Actor': 'Someone Else'}});
      assert.equal(read.status, 200); assert.equal(read.headers.get('etag'), '"activation-1"');
      assert.equal(h.calls.at(-1).url, 'http://127.0.0.1:7001/api' + STATE);
      assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${token}`);
      assert.equal(h.calls.at(-1).init.headers['X-Portal-Actor'], name, 'the actor comes from the signed-in persona, never the browser');
      // Dream Day routes pass through; the API decides who may use them by the credential.
      assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/champion-review', {headers: jar})).status, 200);
      assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${token}`);
      const before = h.calls.length;
      assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-other/state', {headers: jar})).status, 403);
      assert.equal((await h.call('/operator-api/north' + STATE, {headers: jar})).status, 403, 'no operator credential for customer personas');
      assert.equal((await h.call('/operator-api/north/activation/v1/customers/fictional-north/handoff-workspace', {method: 'POST', headers: {...jar, Origin: h.origin}, body: '{}'})).status, 403, 'no access to Chris’s workspace');
      assert.equal(h.calls.length, before, 'refused before anything is forwarded');
    }
    const jar = await h.signIn('alex');
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/blocker-reports', {method: 'POST', headers: jar, body: '{}'})).status, 403, 'cross-site POST refused');
    const post = await h.call('/portal-api/activation/v1/customers/fictional-north/blocker-reports', {method: 'POST', headers: {...jar, Origin: h.origin}, body: '{"x":1}'});
    assert.equal(post.status, 200); assert.equal(h.calls.at(-1).init.body, '{"x":1}');
  } finally {await h.close();}
});

test('the operator persona uses operator credentials only for its listed customers and never the developer Portal API', async () => {
  const h = await harness();
  try {
    const jar = await h.signIn('chris');
    assert.equal((await h.call('/operator-api/north' + STATE, {headers: jar})).status, 200);
    assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${opA}`);
    assert.equal((await h.call('/operator-api/other/activation/v1/customers/fictional-other/handoff', {headers: jar})).status, 200);
    assert.equal(h.calls.at(-1).url, 'http://127.0.0.1:7002/api/activation/v1/customers/fictional-other/handoff');
    assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${opB}`);
    // Chris's workspace routes (saved information, analysis, review, submission) go through the same operator path.
    for (const route of ['handoff-workspace', 'handoff-analyses', 'handoff-reviews', 'handoff-submissions']) {
      assert.equal((await h.call(`/operator-api/north/activation/v1/customers/fictional-north/${route}`, {method: 'POST', headers: {...jar, Origin: h.origin}, body: '{}'})).status, 200);
      assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${opA}`);
    }
    const before = h.calls.length;
    assert.equal((await h.call('/operator-api/missing/activation/v1/customers/fictional-missing/state', {headers: jar})).status, 403, 'not one of Chris’s customers');
    assert.equal((await h.call('/operator-api/north/activation/v1/customers/fictional-other/state', {headers: jar})).status, 403, 'customer ID must match the selected customer');
    assert.equal((await h.call('/portal-api' + STATE, {headers: jar})).status, 403, 'Chris has no developer session');
    assert.equal((await h.call('/operator-api/north' + STATE, {headers: {Authorization: `Bearer ${opA}`}})).status, 401, 'a pasted token is not a session');
    assert.equal((await h.call('/operator-api/north/elsewhere', {headers: jar})).status, 404);
    assert.equal(h.calls.length, before);
  } finally {await h.close();}
});

test('a request made for one persona is refused after the browser signs in as another', async () => {
  const h = await harness();
  try {
    const maya = await h.signIn('maya');
    assert.equal((await h.call('/portal-api' + STATE, {headers: {...maya, 'X-Portal-Persona': 'maya'}})).status, 200);
    const alex = await h.signIn('alex', maya);
    const before = h.calls.length;
    const stale = await h.call('/portal-api' + STATE, {headers: {...alex, 'X-Portal-Persona': 'maya'}});
    assert.equal(stale.status, 409); assert.equal((await stale.json()).error.code, 'PERSONA_CHANGED');
    assert.equal(h.calls.length, before);
    // Signing in again replaced the earlier session.
    assert.equal((await h.call('/portal-auth/session', {headers: maya})).status, 401);
  } finally {await h.close();}
});

test('configuration: personas validated, legacy account arrays still work, demo directory yields the four challenge personas', () => {
  assert.throws(() => loadDirectory({PORTAL_DEMO_ACCOUNTS: config({customers: [{...customers[0], apiOrigin: 'http://example.com'}], personas: []})}));
  assert.throws(() => loadDirectory({PORTAL_DEMO_ACCOUNTS: config({customers, personas: [{...personas[1], role: 'admin'}]})}));
  assert.throws(() => loadDirectory({PORTAL_DEMO_ACCOUNTS: config({customers, personas: [{...personas[1], customers: ['north', 'other']}]})}), /exactly one customer/);
  assert.throws(() => loadDirectory({PORTAL_DEMO_ACCOUNTS: config({customers, personas: [{...personas[1], customers: ['nowhere']}]})}));
  const legacy = loadDirectory({PORTAL_DEMO_ACCOUNTS: config([{id: 'north', label: 'Northstar', user: 'Dev A', customerId: 'fictional-north', apiOrigin: 'http://127.0.0.1:7001', tokenFile: join(dir, 'a')}])});
  assert.deepEqual(legacy.personas, [{id: 'north', name: 'Dev A', role: 'developer', title: 'Developer', customers: ['north']}]);
  const demo = loadDirectory({ACTIVATION_DEMO_DIR: dir});
  assert.deepEqual(demo.personas.map(p => [p.name, p.role]), DEFAULT_PERSONAS.map(p => [p.name, p.role]));
  assert.deepEqual(demo.customers.map(c => [c.customerId, c.tokenFile, c.operatorTokenFile, c.championTokenFile]), [['fictional-recommendation-demo', join(dir, 'token'), join(dir, 'operator-token'), join(dir, 'champion-token')]]);
  assert.deepEqual(loadDirectory({}), {customers: [], personas: []});
});

test.after(() => rmSync(dir, {recursive: true, force: true}));

test('each developer uses their own developer credential when one exists; otherwise the shared one, which the API lets read but not update work', async () => {
  const own = 'f'.repeat(64), file = join(dir, 'developer-token-alex');
  writeFileSync(file, own);
  const h = await harness();
  try {
    const alex = await h.signIn('alex');
    for (const route of ['milestone-work', 'aika-questions']) {
      assert.equal((await h.call(`/portal-api/activation/v1/customers/fictional-north/${route}`, {headers: alex})).status, 200);
      assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${own}`);
    }
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/milestone-updates', {method: 'POST', headers: {...alex, Origin: h.origin}, body: '{}'})).status, 200);
    assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${own}`);
    // Sam has no own token file: the shared developer credential, never Alex's.
    const sam = await h.signIn('sam');
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-other/milestone-work', {headers: sam})).status, 200);
    assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${devB}`);
  } finally {await h.close(); rmSync(file);}
});

test('Champion coordination is forwarded with the Champion credential and her name; the API decides who may coordinate', async () => {
  const h = await harness();
  try {
    const maya = await h.signIn('maya');
    const r = await h.call('/portal-api/activation/v1/customers/fictional-north/milestone-coordination', {method: 'POST', headers: {...maya, Origin: h.origin, 'X-Portal-Actor': 'Someone Else'}, body: '{"milestoneId":"m","expectedRevision":0,"note":{"text":"Hi"}}'});
    assert.equal(r.status, 200);
    assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${champA}`);
    assert.equal(h.calls.at(-1).init.headers['X-Portal-Actor'], 'Maya Chen');
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-other/milestone-coordination', {method: 'POST', headers: {...maya, Origin: h.origin}, body: '{}'})).status, 403, 'not another customer');
  } finally {await h.close();}
});

test('repository evidence routes pass through with the persona’s credential; only configured ids are sent, never tokens to the browser', async () => {
  const h = await harness();
  try {
    const maya = await h.signIn('maya');
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/repository-evidence', {headers: maya})).status, 200);
    assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${champA}`);
    const post = await h.call('/portal-api/activation/v1/customers/fictional-north/repository-inspections', {method: 'POST', headers: {...maya, Origin: h.origin}, body: '{"repositoryId":"payments-api"}'});
    assert.equal(post.status, 200);assert.equal(h.calls.at(-1).init.body, '{"repositoryId":"payments-api"}');
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/repository-inspections', {method: 'POST', headers: maya, body: '{}'})).status, 403, 'cross-site POST refused');
    const chris = await h.signIn('chris');
    assert.equal((await h.call('/operator-api/north/activation/v1/customers/fictional-north/repository-evidence', {headers: chris})).status, 200);
    assert.equal(h.calls.at(-1).init.headers.Authorization, `Bearer ${opA}`);
  } finally {await h.close();}
});
