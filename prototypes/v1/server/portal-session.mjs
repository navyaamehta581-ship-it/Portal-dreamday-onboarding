/**
 * Local demo session layer for the reconstructed Portal (Vite dev/preview only).
 *
 * The simulated Portal login selects one operator-configured demo account. The
 * account's developer token is read from a private file on the server side and
 * attached to proxied activation requests; it never reaches the browser.
 * Backend authorization is unchanged: the workflow API still requires the bearer
 * token, still binds it to one customer and still rejects developer tokens for
 * operator-only routes. This is not Spotify authentication.
 */
import {randomBytes} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const COOKIE = 'portal_demo_session';
const SESSION_MS = 8 * 3600_000;
const ROUTES = /^\/activation\/v1\/customers\/([A-Za-z0-9_-]{1,200})\/(state|blocker-reports|progress-reports|github-preparations|setup-approvals|intake|progress|blockers)$/;
const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;

export function loadAccounts(env = process.env) {
  let list = [];
  if (env.PORTAL_DEMO_ACCOUNTS) list = JSON.parse(readFileSync(env.PORTAL_DEMO_ACCOUNTS, 'utf8'));
  else if (env.ACTIVATION_DEMO_DIR) list = [{
    id: 'demo',
    label: env.PORTAL_DEMO_LABEL ?? 'Demo customer',
    user: env.PORTAL_DEMO_USER ?? 'Developer',
    customerId: env.ACTIVATION_DEMO_CUSTOMER_ID ?? 'fictional-recommendation-demo',
    apiOrigin: env.ACTIVATION_API_ORIGIN ?? 'http://127.0.0.1:7007',
    tokenFile: join(env.ACTIVATION_DEMO_DIR, 'token'),
  }];
  if (!Array.isArray(list)) throw Error('PORTAL_DEMO_ACCOUNTS must be a JSON array');
  const ids = new Set();
  for (const a of list) {
    if (!a || typeof a !== 'object' || !/^[a-z0-9-]{1,40}$/.test(a.id) || ids.has(a.id)) throw Error('Each demo account needs a unique lowercase id');
    if (typeof a.label !== 'string' || !a.label.trim() || typeof a.user !== 'string' || !a.user.trim()) throw Error(`Account ${a.id} needs label and user`);
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(a.customerId)) throw Error(`Account ${a.id} has an invalid customerId`);
    if (!LOOPBACK.test(a.apiOrigin)) throw Error(`Account ${a.id} apiOrigin must be an explicit loopback origin`);
    if (typeof a.tokenFile !== 'string' || !a.tokenFile) throw Error(`Account ${a.id} needs tokenFile`);
    ids.add(a.id);
  }
  return list;
}

function readToken(account) {
  if (!existsSync(account.tokenFile)) return null;
  const token = readFileSync(account.tokenFile, 'utf8').trim();
  return token.length >= 32 ? token : null;
}

const publicAccount = a => ({id: a.id, label: a.label, user: a.user, customerId: a.customerId});

export function createPortalSession({accounts, now = () => Date.now(), fetchImpl = fetch} = {}) {
  const sessions = new Map();
  const send = (res, status, value, headers = {}) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
    res.end(JSON.stringify(value));
  };
  const fail = (res, status, code) => send(res, status, {error: {code}});
  const cookieSession = req => {
    const match = /(?:^|;\s*)portal_demo_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '');
    const entry = match && sessions.get(match[1]);
    if (!entry) return null;
    if (entry.expires <= now()) {sessions.delete(match[1]); return null;}
    return {sid: match[1], account: accounts.find(a => a.id === entry.accountId)};
  };
  // State-changing requests must come from this page's own origin.
  const sameOrigin = req => req.headers.origin === `http://${req.headers.host}`;
  async function body(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {size += chunk.length; if (size > 1_000_000) throw Object.assign(Error('too large'), {code: 'PAYLOAD_TOO_LARGE'}); chunks.push(chunk);}
    return Buffer.concat(chunks).toString('utf8');
  }
  async function forward(req, res, account, path, authorization) {
    const payload = req.method === 'POST' ? await body(req) : undefined;
    let upstream;
    try {
      upstream = await fetchImpl(`${account.apiOrigin}/api${path}`, {
        method: req.method,
        headers: {Authorization: authorization, ...(payload === undefined ? {} : {'Content-Type': 'application/json'})},
        body: payload,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return fail(res, 502, 'ACTIVATION_API_UNREACHABLE');
    }
    const text = await upstream.text();
    res.writeHead(upstream.status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(upstream.headers.get('etag') ? {ETag: upstream.headers.get('etag')} : {})});
    res.end(text);
  }

  return async function handle(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://local');
    const path = url.pathname;
    try {
      if (path === '/portal-auth/accounts' && req.method === 'GET') return send(res, 200, {accounts: accounts.map(publicAccount)});
      if (path === '/portal-auth/session' && req.method === 'GET') {
        const s = cookieSession(req);
        return s ? send(res, 200, {account: publicAccount(s.account)}) : fail(res, 401, 'SIGN_IN_REQUIRED');
      }
      if (path === '/portal-auth/login' && req.method === 'POST') {
        if (!sameOrigin(req)) return fail(res, 403, 'ORIGIN_NOT_ALLOWED');
        let input;
        try {input = JSON.parse(await body(req));} catch {return fail(res, 400, 'INVALID_REQUEST');}
        const account = accounts.find(a => a.id === input?.accountId);
        if (!account) return fail(res, 404, 'UNKNOWN_ACCOUNT');
        if (!readToken(account)) return fail(res, 503, 'ACCOUNT_UNAVAILABLE');
        const sid = randomBytes(32).toString('hex');
        sessions.set(sid, {accountId: account.id, expires: now() + SESSION_MS});
        return send(res, 200, {account: publicAccount(account)}, {'Set-Cookie': `${COOKIE}=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`});
      }
      if (path === '/portal-auth/logout' && req.method === 'POST') {
        if (!sameOrigin(req)) return fail(res, 403, 'ORIGIN_NOT_ALLOWED');
        const s = cookieSession(req);
        if (s) sessions.delete(s.sid);
        return send(res, 200, {}, {'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`});
      }
      if (path.startsWith('/portal-api/')) {
        const route = path.slice('/portal-api'.length), match = ROUTES.exec(route);
        if (!match || !['GET', 'POST'].includes(req.method)) return fail(res, 404, 'NOT_FOUND');
        const s = cookieSession(req);
        if (!s) return fail(res, 401, 'SIGN_IN_REQUIRED');
        if (req.method === 'POST' && !sameOrigin(req)) return fail(res, 403, 'ORIGIN_NOT_ALLOWED');
        // The signed-in account fixes the customer; another ID is never forwarded.
        if (match[1] !== s.account.customerId) return fail(res, 403, 'FORBIDDEN');
        const token = readToken(s.account);
        if (!token) return fail(res, 503, 'ACCOUNT_UNAVAILABLE');
        return await forward(req, res, s.account, route, `Bearer ${token}`);
      }
      const operator = /^\/operator-api\/([a-z0-9-]{1,40})(\/.*)$/.exec(path);
      if (operator) {
        const account = accounts.find(a => a.id === operator[1]);
        if (!account || !ROUTES.test(operator[2]) || !['GET', 'POST'].includes(req.method)) return fail(res, 404, 'NOT_FOUND');
        if (req.method === 'POST' && !sameOrigin(req)) return fail(res, 403, 'ORIGIN_NOT_ALLOWED');
        // Operator access is never injected: the workspace user supplies the operator token.
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith('Bearer ')) return fail(res, 401, 'TOKEN_REQUIRED');
        return await forward(req, res, account, operator[2], authorization);
      }
    } catch (error) {
      return fail(res, error?.code === 'PAYLOAD_TOO_LARGE' ? 413 : 500, error?.code === 'PAYLOAD_TOO_LARGE' ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR');
    }
    return next();
  };
}

/** Vite plugin wiring for `vite` and `vite preview`. */
export function portalSessionPlugin() {
  let handler;
  const install = server => {
    handler ??= createPortalSession({accounts: loadAccounts()});
    server.middlewares.use((req, res, next) => {void handler(req, res, next);});
  };
  return {name: 'portal-demo-session', configureServer: install, configurePreviewServer: install};
}
