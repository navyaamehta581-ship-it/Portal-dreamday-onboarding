import { activationRoute } from './activation/routes.ts';
import type { ActivationOptions } from './activation/routes.ts';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { validateCreateGoal } from '../../../contracts/goals.ts';
import type { ApiError } from '../../../contracts/goals.ts';
import type { GoalStore } from './store.ts';

class RequestError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send Content-Type: application/json.');
  }
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16_384) throw new RequestError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 16 KiB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new RequestError(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }
}

function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

/** Local single-user service. Only the explicitly configured frontend origin is allowed. */
export function createApp(store: GoalStore, allowedOrigin = 'http://127.0.0.1:5173', activation?: ActivationOptions) {
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Vary', 'Origin');
    const fail = (status: number, code: string, message: string, details?: ApiError['error']['details']) =>
      send(response, status, { error: { code, message, requestId, ...(details ? { details } : {}) } } satisfies ApiError);
    try {
      // Reject non-loopback Host headers to reduce DNS rebinding exposure.
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host || '')) {
        return fail(403, 'HOST_NOT_ALLOWED', 'Use a localhost address.');
      }
      const origin = request.headers.origin;
      if (origin && origin !== allowedOrigin) return fail(403, 'ORIGIN_NOT_ALLOWED', 'Frontend origin is not allowed.');
      if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
      if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', activation ? 'Content-Type, Authorization' : 'Content-Type');
        response.writeHead(204);
        return response.end();
      }
      const path = new URL(request.url || '/', 'http://localhost').pathname;
      if (activation && await activationRoute(request, response, path, activation, readJson)) return;
      if (path === '/health') {
        if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return fail(405, 'METHOD_NOT_ALLOWED', 'Use GET.'); }
        return send(response, 200, { status: 'ok', mode: 'local-development', apiVersion: '1' });
      }
      if (path === '/api/goals') {
        if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST.'); }
        const result = validateCreateGoal(await readJson(request));
        if (!result.success) return fail(400, 'INVALID_REQUEST', 'Check the submitted fields.', result.details);
        const goal = store.create(result.value);
        response.setHeader('Location', `/api/goals/${goal.id}`);
        return send(response, 201, goal);
      }
      const match = /^\/api\/goals\/(goal_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(path);
      if (match) {
        if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return fail(405, 'METHOD_NOT_ALLOWED', 'Use GET.'); }
        const goal = store.get(match[1]);
        return goal ? send(response, 200, goal) : fail(404, 'GOAL_NOT_FOUND', 'Goal was not found.');
      }
      return fail(404, 'NOT_FOUND', 'Endpoint was not found.');
    } catch (error) {
      if (response.destroyed) return;
      if (error instanceof RequestError) return fail(error.status, error.code, error.message);
      // Do not log request bodies, database paths or raw database errors.
      console.error(JSON.stringify({ requestId, code: 'INTERNAL_ERROR' }));
      return fail(500, 'INTERNAL_ERROR', 'The request could not be completed.');
    }
  });
}
