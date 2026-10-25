import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../src/app.ts';
import { openGoalStore } from '../src/store.ts';
import { validateCreateGoal } from '../../../contracts/goals.ts';

const input = { serviceId: 'payments-api', goal: 'Automate CI for my service' };
async function fixture() {
  const store = openGoalStore(':memory:');
  const server = createApp(store);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); store.close(); } };
}
const post = (url: string, body: unknown) => fetch(`${url}/api/goals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('health identifies the local development service', async () => {
  const app = await fixture();
  try {
    const response = await fetch(`${app.url}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, 'local-development');
  } finally { await app.close(); }
});

test('creates and retrieves the exact saved goal with timestamps and Location', async () => {
  const app = await fixture();
  try {
    const response = await post(app.url, input);
    assert.equal(response.status, 201);
    const goal = await response.json();
    assert.equal(goal.status, 'received');
    assert.equal(goal.goal, input.goal);
    assert.equal(goal.serviceId, input.serviceId);
    assert.ok(!Number.isNaN(Date.parse(goal.createdAt)));
    assert.equal(response.headers.get('location'), `/api/goals/${goal.id}`);
    const retrieved = await fetch(`${app.url}/api/goals/${goal.id}`);
    assert.equal(retrieved.status, 200);
    assert.deepEqual(await retrieved.json(), goal);
  } finally { await app.close(); }
});

test('rejects missing, invalid, oversized and unexpected fields', async () => {
  const app = await fixture();
  try {
    for (const body of [null, [], {}, { ...input, goal: ' ' }, { ...input, goal: 12 }, { ...input, serviceId: '../secret' }, { ...input, goal: 'x'.repeat(2001) }, { ...input, token: 'must-not-save' }]) {
      const response = await post(app.url, body);
      assert.equal(response.status, 400);
      const error = (await response.json()).error;
      assert.equal(error.code, 'INVALID_REQUEST');
      assert.ok(error.details.length);
      assert.equal(error.requestId, response.headers.get('x-request-id'));
    }
  } finally { await app.close(); }
});

test('rejects malformed JSON, wrong media type and excessive body bytes', async () => {
  const app = await fixture();
  try {
    for (const [body, contentType, status] of [['{', 'application/json', 400], ['hello', 'text/plain', 415], [JSON.stringify({ ...input, goal: 'x'.repeat(17_000) }), 'application/json', 413]] as const) {
      const response = await fetch(`${app.url}/api/goals`, { method: 'POST', headers: { 'Content-Type': contentType }, body });
      assert.equal(response.status, status);
    }
  } finally { await app.close(); }
});

test('missing goal, unknown routes and unsupported methods have stable errors', async () => {
  const app = await fixture();
  try {
    assert.equal((await fetch(`${app.url}/api/goals/goal_00000000-0000-0000-0000-000000000000`)).status, 404);
    assert.equal((await fetch(`${app.url}/api/goals/not-an-id`)).status, 404);
    const response = await fetch(`${app.url}/api/goals`);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assert.equal((await fetch(`${app.url}/health`, { method: 'POST' })).status, 405);
  } finally { await app.close(); }
});

test('allows the frontend preflight and blocks other origins and hosts', async () => {
  const app = await fixture();
  try {
    const response = await fetch(`${app.url}/api/goals`, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
    assert.equal((await fetch(`${app.url}/health`, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const hostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(`${app.url}/health`, { headers: { Host: 'untrusted.example' } }, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
      request.end();
    });
    assert.equal(hostStatus, 403);
  } finally { await app.close(); }
});

test('trims strings and stores SQL metacharacters as plain text', async () => {
  const app = await fixture();
  try {
    const response = await post(app.url, { serviceId: ' payments-api ', goal: "  Don't execute '); DROP TABLE goals; --  " });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).goal, "Don't execute '); DROP TABLE goals; --");
    assert.equal((await post(app.url, input)).status, 201);
  } finally { await app.close(); }
});

test('schema validates upper boundaries and rejects unknown privilege fields', () => {
  assert.equal(validateCreateGoal({ serviceId: 'a'.repeat(80), goal: 'x'.repeat(2000) }).success, true);
  assert.equal(validateCreateGoal({ ...input, serviceId: 'a'.repeat(81) }).success, false);
  assert.equal(validateCreateGoal({ ...input, status: 'approved' }).success, false);
});

test('separate server processes retrieve the same goal after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'goal-api-restart-'));
  const filename = join(directory, 'goals.sqlite');
  async function start() {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import { openGoalStore } from './src/store.ts';
      import { createApp } from './src/app.ts';
      const store = openGoalStore(process.env.TEST_DATABASE);
      const server = createApp(store);
      server.listen(0, '127.0.0.1', () => console.log(server.address().port));
      process.on('SIGTERM', () => server.close(() => { store.close(); process.exit(0); }));
    `], { cwd: new URL('../', import.meta.url), env: { ...process.env, TEST_DATABASE: filename }, stdio: ['ignore', 'pipe', 'pipe'] });
    const port = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Server start timed out')); }, 10_000);
      child.stdout.once('data', data => { clearTimeout(timeout); resolve(data.toString().trim()); });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    return { url: `http://127.0.0.1:${port}`, stop: async () => { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; } };
  }
  try {
    const first = await start();
    let saved;
    try { const response = await post(first.url, input); assert.equal(response.status, 201); saved = await response.json(); }
    finally { await first.stop(); }
    const second = await start();
    try { const response = await fetch(`${second.url}/api/goals/${saved.id}`); assert.equal(response.status, 200); assert.deepEqual(await response.json(), saved); }
    finally { await second.stop(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
