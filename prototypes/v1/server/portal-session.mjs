/**
 * Local demo session layer for the reconstructed Portal (Vite dev/preview only).
 *
 * One entry page offers clearly labelled fictional personas. Choosing a persona is a simulated sign-in, not
 * authentication: anyone who can open this local page can choose any persona. What a persona can do is decided
 * on the server, never by the browser:
 *   - the session cookie names a persona; the browser never holds a token;
 *   - each persona maps to one server-held credential: each developer uses their own developer token
 *     (`developer-token-<persona id>` next to the customer's token file), so the API knows who changed their
 *     work; without one they fall back to the customer's shared developer token, which can read but not update
 *     milestone work. The
 *     Champion uses the customer's Champion token (Dream Day review and approval), the operator persona uses each
 *     listed customer's operator token;
 *   - forwarded requests name the signed-in persona (X-Portal-Actor) so the API can record who approved and show
 *     each developer their own assigned work; the browser cannot set it;
 *   - the workflow API still authorizes every request by that token, binds it to one customer, rejects
 *     developer tokens on operator-only routes and applies the developer-safe projection.
 * Requests carry the persona the page believes is signed in; if another tab signed in as someone else, the
 * request is refused instead of silently acting as the new persona.
 */
import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const COOKIE = 'portal_demo_session';
const SESSION_MS = 8 * 3600_000;
const ROUTES = /^\/activation\/v1\/customers\/([A-Za-z0-9_-]{1,200})\/(state|blocker-reports|progress-reports|github-preparations|setup-approvals|intake|progress|blockers|handoff|handoff-drafts|handoff-publications|handoff-workspace|handoff-documents|handoff-analyses|handoff-reviews|handoff-submissions|champion-review|champion-reviews|champion-decisions|milestone-work|milestone-updates|milestone-coordination|aika-questions|aika-capabilities|repository-evidence|repository-inspections|insights|opportunities|opportunity-priorities|opportunity-pursuits|adoption)$/;
const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;
const ROLES = ['operator', 'champion', 'developer'];
// Model-assisted drafting can take minutes on a laptop; every other route keeps the short limit.
const timeoutFor = route => route.endsWith('/handoff-drafts') ? 300_000 : route.endsWith('/handoff-documents') ? 90_000 : 30_000;
// Chris's PDF upload is the one binary request: forwarded as-is, up to the API's own 8 MB limit.
const DOCUMENT_LIMIT = 8 * 1024 * 1024 + 1;

/** The challenge personas, used when the demo launcher's directory is configured. Fictional people. */
export const DEFAULT_PERSONAS = [
  {id: 'chris', name: 'Chris', role: 'operator', title: 'Spotify account operator'},
  {id: 'maya', name: 'Maya Chen', role: 'champion', title: 'Platform Champion'},
  {id: 'alex', name: 'Alex Rivera', role: 'developer', title: 'Developer'},
  {id: 'jordan', name: 'Jordan Lee', role: 'developer', title: 'Developer'},
];

function validCustomer(c, ids) {
  if (!c || typeof c !== 'object' || !/^[a-z0-9-]{1,40}$/.test(c.id) || ids.has(c.id)) throw Error('Each customer needs a unique lowercase id');
  if (typeof c.label !== 'string' || !c.label.trim()) throw Error(`Customer ${c.id} needs a label`);
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(c.customerId)) throw Error(`Customer ${c.id} has an invalid customerId`);
  if (!LOOPBACK.test(c.apiOrigin)) throw Error(`Customer ${c.id} apiOrigin must be an explicit loopback origin`);
  if (typeof c.tokenFile !== 'string' || !c.tokenFile) throw Error(`Customer ${c.id} needs tokenFile`);
  for (const key of ['operatorTokenFile', 'championTokenFile']) if (c[key] !== undefined && (typeof c[key] !== 'string' || !c[key])) throw Error(`Customer ${c.id} has an invalid ${key}`);
  ids.add(c.id);
  return {id: c.id, label: c.label, customerId: c.customerId, apiOrigin: c.apiOrigin, tokenFile: c.tokenFile, operatorTokenFile: c.operatorTokenFile ?? join(c.tokenFile, '..', 'operator-token'), championTokenFile: c.championTokenFile ?? join(c.tokenFile, '..', 'champion-token')};
}

/**
 * Configuration: `PORTAL_DEMO_ACCOUNTS` names a JSON file with `{customers, personas}`. The older array form (one
 * entry per customer with a `user`) still works and yields one developer persona per customer. Without a file,
 * `ACTIVATION_DEMO_DIR` (the demo launcher's directory) yields one customer and the four challenge personas.
 */
export function loadDirectory(env = process.env) {
  let raw = null;
  if (env.PORTAL_DEMO_ACCOUNTS) raw = JSON.parse(readFileSync(env.PORTAL_DEMO_ACCOUNTS, 'utf8'));
  else if (env.ACTIVATION_DEMO_DIR) raw = {
    customers: [{
      id: 'demo',
      label: env.PORTAL_DEMO_LABEL ?? 'Fictional demo customer',
      customerId: env.ACTIVATION_DEMO_CUSTOMER_ID ?? 'fictional-recommendation-demo',
      apiOrigin: env.ACTIVATION_API_ORIGIN ?? 'http://127.0.0.1:7007',
      tokenFile: join(env.ACTIVATION_DEMO_DIR, 'token'),
      operatorTokenFile: join(env.ACTIVATION_DEMO_DIR, 'operator-token'),
      championTokenFile: join(env.ACTIVATION_DEMO_DIR, 'champion-token'),
    }],
    personas: DEFAULT_PERSONAS.map(p => ({...p, customers: ['demo']})),
  };
  if (raw === null) return {customers: [], personas: []};
  if (Array.isArray(raw)) raw = {customers: raw, personas: raw.map(a => ({id: a.id, name: a.user, role: 'developer', title: 'Developer', customers: [a.id]}))};
  if (!raw || !Array.isArray(raw.customers) || !Array.isArray(raw.personas)) throw Error('PORTAL_DEMO_ACCOUNTS must be an array or {customers, personas}');
  const ids = new Set();
  const customers = raw.customers.map(c => validCustomer(c, ids));
  const personaIds = new Set();
  const personas = raw.personas.map(p => {
    if (!p || typeof p !== 'object' || !/^[a-z0-9-]{1,40}$/.test(p.id) || personaIds.has(p.id)) throw Error('Each persona needs a unique lowercase id');
    if (typeof p.name !== 'string' || !p.name.trim() || typeof p.title !== 'string' || !p.title.trim()) throw Error(`Persona ${p.id} needs name and title`);
    if (!ROLES.includes(p.role)) throw Error(`Persona ${p.id} role must be one of ${ROLES.join(', ')}`);
    if (!Array.isArray(p.customers) || !p.customers.length || !p.customers.every(id => ids.has(id))) throw Error(`Persona ${p.id} must list configured customers`);
    // A customer persona belongs to exactly one customer; only the operator works across customers.
    if (p.role !== 'operator' && p.customers.length !== 1) throw Error(`Persona ${p.id} must belong to exactly one customer`);
    personaIds.add(p.id);
    return {id: p.id, name: p.name, role: p.role, title: p.title, customers: [...new Set(p.customers)]};
  });
  return {customers, personas};
}

function readToken(file) {
  if (!file || !existsSync(file)) return null;
  const token = readFileSync(file, 'utf8').trim();
  return token.length >= 32 ? token : null;
}

/**
 * Options for the hosted deployment (all optional; local development uses none of them):
 *   - secret: sign session cookies (HMAC-SHA256) instead of keeping them in memory, so sign-ins survive a restart;
 *   - secure: the page is served over HTTPS (Secure cookies; same-origin checks expect https://);
 *   - room: (req) => the visitor's demo room id from the server-verified gate cookie, or null. When set, every
 *     sign-in and API request needs a room, a session belongs to the room it was made in, and forwarded requests
 *     name the room (X-Portal-Room) so the API keeps each room's data apart.
 */
export function createPortalSession({directory, now = () => Date.now(), fetchImpl = fetch, secret = null, secure = false, room = null} = {}) {
  const {customers, personas} = directory;
  const customer = id => customers.find(c => c.id === id);
  const publicPersona = p => ({id: p.id, name: p.name, role: p.role, title: p.title,
    customers: p.customers.map(id => {const c = customer(id); return {id: c.id, label: c.label, customerId: c.customerId};})});
  // The credential a persona uses for one customer, or null when it has none for that surface.
  const credential = (p, c, surface) => surface === 'operator'
    ? (p.role === 'operator' ? readToken(c.operatorTokenFile) : null)
    : p.role === 'champion' ? readToken(c.championTokenFile)
    : p.role === 'developer' ? (readToken(join(c.tokenFile, '..', `developer-token-${p.id}`)) ?? readToken(c.tokenFile)) : null;
  const available = p => p.customers.some(id => credential(p, customer(id), p.role === 'operator' ? 'operator' : 'portal'));

  const sessions = new Map();
  const send = (res, status, value, headers = {}) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
    res.end(JSON.stringify(value));
  };
  const fail = (res, status, code) => send(res, status, {error: {code}});
  const sign = value => createHmac('sha256', secret).update(value).digest('base64url');
  const cookieSession = req => {
    const raw = /(?:^|;\s*)portal_demo_session=([A-Za-z0-9_.-]{1,600})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
    if (!raw) return null;
    let entry;
    if (secret) {
      // Stateless: the cookie carries persona, room and expiry, signed with the server secret.
      const [data, mac] = raw.split('.');
      const expected = data && sign(data);
      if (!mac || !expected || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
      try {entry = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));} catch {return null;}
      entry = {personaId: entry.p, room: entry.r ?? null, expires: entry.e};
    } else {
      entry = /^[a-f0-9]{64}$/.test(raw) ? sessions.get(raw) : null;
      if (entry && entry.expires <= now()) {sessions.delete(raw); entry = null;}
    }
    if (!entry || !(entry.expires > now())) return null;
    // A session made in another demo room (or before entering one) doesn't count here.
    if (room && entry.room !== room(req)) return null;
    const persona = personas.find(p => p.id === entry.personaId);
    return persona ? {sid: raw, persona} : null;
  };
  const issue = (persona, req) => {
    const entry = {personaId: persona.id, room: room ? room(req) : null, expires: now() + SESSION_MS};
    if (secret) {const data = Buffer.from(JSON.stringify({p: entry.personaId, r: entry.room, e: entry.expires})).toString('base64url'); return `${data}.${sign(data)}`;}
    const sid = randomBytes(32).toString('hex');
    sessions.set(sid, entry);
    return sid;
  };
  const cookie = (value, maxAge) => `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  // State-changing requests must come from this page's own origin.
  const sameOrigin = req => req.headers.origin === `${secure ? 'https' : 'http'}://${req.headers.host}`;
  async function bytes(req, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {size += chunk.length; if (size > limit) throw Object.assign(Error('too large'), {code: 'PAYLOAD_TOO_LARGE'}); chunks.push(chunk);}
    return Buffer.concat(chunks);
  }
  const body = async req => (await bytes(req, 1_000_000)).toString('utf8');
  async function forward(req, res, c, route, token, persona) {
    const document = req.method === 'POST' && route.endsWith('/handoff-documents');
    if (document && req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/pdf') return fail(res, 415, 'PDF_REQUIRED');
    const payload = req.method !== 'POST' ? undefined : document ? await bytes(req, DOCUMENT_LIMIT) : await body(req);
    const name = document && typeof req.headers['x-file-name'] === 'string' ? {'X-File-Name': req.headers['x-file-name'].slice(0, 400)} : {};
    let upstream;
    try {
      upstream = await fetchImpl(`${c.apiOrigin}/api${route}`, {
        method: req.method,
        headers: {Authorization: `Bearer ${token}`, 'X-Portal-Actor': persona.name, ...(room ? {'X-Portal-Room': room(req)} : {}), ...(payload === undefined ? {} : {'Content-Type': document ? 'application/pdf' : 'application/json'}), ...name},
        body: payload,
        signal: AbortSignal.timeout(timeoutFor(route)),
      });
    } catch {
      return fail(res, 502, 'ACTIVATION_API_UNREACHABLE');
    }
    const text = await upstream.text();
    res.writeHead(upstream.status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(upstream.headers.get('etag') ? {ETag: upstream.headers.get('etag')} : {})});
    res.end(text);
  }
  // Every API request needs the signed-in persona, and the persona the page expects when it says so.
  function personaFor(req, res) {
    const s = cookieSession(req);
    if (!s) {fail(res, 401, 'SIGN_IN_REQUIRED'); return null;}
    const expected = req.headers['x-portal-persona'];
    if (expected !== undefined && expected !== s.persona.id) {fail(res, 409, 'PERSONA_CHANGED'); return null;}
    if (req.method === 'POST' && !sameOrigin(req)) {fail(res, 403, 'ORIGIN_NOT_ALLOWED'); return null;}
    return s.persona;
  }

  return async function handle(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://local');
    const path = url.pathname;
    try {
      // Hosted demo: nothing here works outside a demo room (the gate decides who has one).
      if (room && (path.startsWith('/portal-auth/') || path.startsWith('/portal-api/') || path.startsWith('/operator-api/')) && !room(req)) return fail(res, 401, 'DEMO_GATE_REQUIRED');
      if (path === '/portal-auth/personas' && req.method === 'GET') return send(res, 200, {personas: personas.map(publicPersona)});
      if (path === '/portal-auth/session' && req.method === 'GET') {
        const s = cookieSession(req);
        return s ? send(res, 200, {persona: publicPersona(s.persona)}) : fail(res, 401, 'SIGN_IN_REQUIRED');
      }
      if (path === '/portal-auth/login' && req.method === 'POST') {
        if (!sameOrigin(req)) return fail(res, 403, 'ORIGIN_NOT_ALLOWED');
        let input;
        try {input = JSON.parse(await body(req));} catch {return fail(res, 400, 'INVALID_REQUEST');}
        const persona = personas.find(p => p.id === input?.personaId);
        if (!persona) return fail(res, 404, 'UNKNOWN_PERSONA');
        if (!available(persona)) return fail(res, 503, 'PERSONA_UNAVAILABLE');
        // Signing in replaces any earlier session in this browser.
        const previous = cookieSession(req);
        if (previous) sessions.delete(previous.sid);
        return send(res, 200, {persona: publicPersona(persona)}, {'Set-Cookie': cookie(issue(persona, req), SESSION_MS / 1000)});
      }
      if (path === '/portal-auth/logout' && req.method === 'POST') {
        if (!sameOrigin(req)) return fail(res, 403, 'ORIGIN_NOT_ALLOWED');
        const s = cookieSession(req);
        if (s) sessions.delete(s.sid);
        return send(res, 200, {}, {'Set-Cookie': cookie('', 0)});
      }
      // Customer personas: their single customer; developer or Champion credential.
      if (path.startsWith('/portal-api/')) {
        const route = path.slice('/portal-api'.length), match = ROUTES.exec(route);
        if (!match || !['GET', 'POST'].includes(req.method)) return fail(res, 404, 'NOT_FOUND');
        const persona = personaFor(req, res);
        if (!persona) return;
        if (persona.role === 'operator') return fail(res, 403, 'WRONG_SURFACE');
        const c = customer(persona.customers[0]);
        // The persona fixes the customer; another ID is never forwarded.
        if (match[1] !== c.customerId) return fail(res, 403, 'FORBIDDEN');
        const token = credential(persona, c, 'portal');
        if (!token) return fail(res, 503, 'PERSONA_UNAVAILABLE');
        return await forward(req, res, c, route, token, persona);
      }
      // Operator persona: one of its listed customers, operator credential.
      const operator = /^\/operator-api\/([a-z0-9-]{1,40})(\/.*)$/.exec(path);
      if (operator) {
        const c = customer(operator[1]), match = ROUTES.exec(operator[2]);
        if (!c || !match || !['GET', 'POST'].includes(req.method)) return fail(res, 404, 'NOT_FOUND');
        const persona = personaFor(req, res);
        if (!persona) return;
        if (persona.role !== 'operator' || !persona.customers.includes(c.id)) return fail(res, 403, 'FORBIDDEN');
        if (match[1] !== c.customerId) return fail(res, 403, 'FORBIDDEN');
        const token = credential(persona, c, 'operator');
        if (!token) return fail(res, 503, 'PERSONA_UNAVAILABLE');
        return await forward(req, res, c, operator[2], token, persona);
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
    handler ??= createPortalSession({directory: loadDirectory()});
    server.middlewares.use((req, res, next) => {void handler(req, res, next);});
  };
  return {name: 'portal-demo-session', configureServer: install, configurePreviewServer: install};
}
