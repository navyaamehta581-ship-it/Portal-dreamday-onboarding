import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPortalSession, loadAccounts} from './portal-session.mjs';

const dir = mkdtempSync(join(tmpdir(), 'portal-session-'));
const tokenA = 'a'.repeat(64), tokenB = 'b'.repeat(64);
writeFileSync(join(dir, 'a'), tokenA); writeFileSync(join(dir, 'b'), tokenB);
const accounts = [
  {id: 'north', label: 'Northstar', user: 'Dev A', customerId: 'fictional-north', apiOrigin: 'http://127.0.0.1:7001', tokenFile: join(dir, 'a')},
  {id: 'other', label: 'Other', user: 'Dev B', customerId: 'fictional-other', apiOrigin: 'http://127.0.0.1:7002', tokenFile: join(dir, 'b')},
  {id: 'missing', label: 'Missing', user: 'Dev C', customerId: 'fictional-missing', apiOrigin: 'http://127.0.0.1:7003', tokenFile: join(dir, 'none')},
];

async function harness() {
  const calls = [];
  const fetchImpl = async (url, init) => {calls.push({url, init}); return new Response(JSON.stringify({ok: true}), {status: 200, headers: {ETag: '"activation-1"'}});};
  const handle = createPortalSession({accounts, fetchImpl});
  const server = createServer((req, res) => {void handle(req, res, () => {res.writeHead(418); res.end();});});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = (path, init = {}) => fetch(origin + path, init);
  return {calls, origin, call, close: () => new Promise(r => server.close(r))};
}

test('lists accounts without tokens or API origins', async () => {
  const h = await harness();
  try {
    const text = await (await h.call('/portal-auth/accounts')).text();
    assert.ok(!text.includes(tokenA) && !text.includes('tokenFile') && !text.includes('apiOrigin'));
    assert.equal(JSON.parse(text).accounts[0].customerId, 'fictional-north');
  } finally {await h.close();}
});

test('requires a same-origin simulated login before forwarding with the server-held token', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/state')).status, 401);
    assert.equal((await h.call('/portal-auth/login', {method: 'POST', body: '{"accountId":"north"}'})).status, 403);
    assert.equal((await h.call('/portal-auth/login', {method: 'POST', headers: {Origin: h.origin}, body: '{"accountId":"missing"}'})).status, 503);
    const login = await h.call('/portal-auth/login', {method: 'POST', headers: {Origin: h.origin}, body: '{"accountId":"north"}'});
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    assert.ok(!(await login.clone().text()).includes(tokenA));
    const jar = {Cookie: cookie.split(';')[0]};
    assert.equal((await (await h.call('/portal-auth/session', {headers: jar})).json()).account.id, 'north');
    const read = await h.call('/portal-api/activation/v1/customers/fictional-north/state', {headers: {...jar, Authorization: 'Bearer forged'}});
    assert.equal(read.status, 200); assert.equal(read.headers.get('etag'), '"activation-1"');
    assert.equal(h.calls[0].url, 'http://127.0.0.1:7001/api/activation/v1/customers/fictional-north/state');
    assert.equal(h.calls[0].init.headers.Authorization, `Bearer ${tokenA}`);
    // Changing the customer ID is refused before anything is forwarded.
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-other/state', {headers: jar})).status, 403);
    assert.equal(h.calls.length, 1);
    // Cross-site POSTs are refused even with the cookie.
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/blocker-reports', {method: 'POST', headers: jar, body: '{}'})).status, 403);
    const post = await h.call('/portal-api/activation/v1/customers/fictional-north/blocker-reports', {method: 'POST', headers: {...jar, Origin: h.origin}, body: '{"x":1}'});
    assert.equal(post.status, 200); assert.equal(h.calls[1].init.body, '{"x":1}');
    assert.equal((await h.call('/portal-auth/logout', {method: 'POST', headers: {...jar, Origin: h.origin}})).status, 200);
    assert.equal((await h.call('/portal-api/activation/v1/customers/fictional-north/state', {headers: jar})).status, 401);
  } finally {await h.close();}
});

test('operator passthrough forwards only the caller-supplied token to the selected account API', async () => {
  const h = await harness();
  try {
    assert.equal((await h.call('/operator-api/other/activation/v1/customers/fictional-other/state')).status, 401);
    assert.equal((await h.call('/operator-api/other/activation/v1/customers/fictional-other/state', {headers: {Authorization: 'Bearer op'}})).status, 200);
    assert.equal(h.calls[0].url, 'http://127.0.0.1:7002/api/activation/v1/customers/fictional-other/state');
    assert.equal(h.calls[0].init.headers.Authorization, 'Bearer op');
    assert.equal((await h.call('/operator-api/other/elsewhere', {headers: {Authorization: 'Bearer op'}})).status, 404);
  } finally {await h.close();}
});

test('rejects non-loopback API origins and derives the single demo account', () => {
  assert.throws(() => loadAccounts({PORTAL_DEMO_ACCOUNTS: (writeFileSync(join(dir, 'bad.json'), JSON.stringify([{...accounts[0], apiOrigin: 'http://example.com'}])), join(dir, 'bad.json'))}));
  assert.deepEqual(loadAccounts({ACTIVATION_DEMO_DIR: dir}).map(a => [a.customerId, a.tokenFile]), [['fictional-recommendation-demo', join(dir, 'token')]]);
  assert.deepEqual(loadAccounts({}), []);
});

test.after(() => rmSync(dir, {recursive: true, force: true}));
