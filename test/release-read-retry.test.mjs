import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { probeGreenWorkflow, waitForGreenWorkflow } from '../scripts/release-gate.mjs';
import { retryingReadFetch } from '../scripts/read-only-fetch.mjs';

const sha = 'a'.repeat(40);
const run = (conclusion = 'success') => ({
  id: 1, status: 'completed', conclusion, head_sha: sha,
  repository: { full_name: 'x/y' }, head_repository: { full_name: 'x/y' },
  path: '.github/workflows/performance.yml', html_url: 'https://example.test/run/1',
});

test('#921: wait path also recovers the read, but still rejects a red run', async () => {
  for (const conclusion of ['success', 'failure']) {
    let calls = 0;
    const pending = waitForGreenWorkflow({ ...options, fetchImpl: async () => {
      if (++calls === 1) throw brokenPipe();
      return Response.json({ workflow_runs: [run(conclusion)] });
    } });
    if (conclusion === 'success') await pending;
    else await assert.rejects(pending, /is not green/);
    assert.equal(calls, 2);
  }
});

test('#921: three total attempts for known socket codes, then the original last error', async () => {
  for (const code of ['EPIPE', 'ECONNRESET', 'UND_ERR_SOCKET']) {
    const errors = Array.from({ length: 3 }, () => new TypeError('fetch failed', {
      cause: Object.assign(new Error('fixture transport failure'), { code }),
    }));
    let calls = 0;
    const pauses = [];
    const read = retryingReadFetch(async () => { throw errors[calls++]; }, { pause: async (ms) => { pauses.push(ms); } });
    await assert.rejects(read('https://example.test/read'), (error) => error === errors[2]);
    assert.equal(calls, 3);
    assert.deepEqual(pauses, [100, 400]);
  }
});

test('#921: unrelated failures, cancelled reads and HTTP responses are never retried', async () => {
  for (const failure of [
    Object.assign(new Error('DNS unavailable'), { code: 'ENOTFOUND' }),
    new TypeError('invalid URL'),
    new DOMException('owner cancelled', 'AbortError'),
    new DOMException('deadline', 'TimeoutError'),
    new TypeError('fetch failed', { cause: new DOMException('cancelled', 'AbortError') }),
  ]) {
    let calls = 0;
    const read = retryingReadFetch(async () => { calls += 1; throw failure; }, {
      pause: () => assert.fail('non-transient failures must not pause/retry'),
    });
    await assert.rejects(read('https://example.test/read'), (error) => error === failure);
    assert.equal(calls, 1);
  }
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const read = retryingReadFetch(async () => { calls += 1; throw brokenPipe(); }, { pause: () => assert.fail('cancelled') });
  await assert.rejects(read('https://example.test/read', { signal: controller.signal }), /fetch failed/);
  assert.equal(calls, 1);
  for (const status of [401, 403, 429, 500, 503]) {
    calls = 0;
    await assert.rejects(probeGreenWorkflow({ ...options, fetchImpl: async () => {
      calls += 1; return new Response('fixture HTTP refusal', { status });
    } }), new RegExp(`GitHub Actions API ${status}`));
    assert.equal(calls, 1);
  }
});

test('#921: read-only boundary refuses writes before any transport call', async () => {
  const read = retryingReadFetch(() => assert.fail('no request may be sent'));
  for (const init of [{ method: 'POST' }, { method: 'PATCH' }, { method: 'DELETE' }, { body: 'not a read' }])
    await assert.rejects(read('https://example.test/releases', init), /bodyless GET/);
  await assert.rejects(read(new Request('https://example.test/releases', { method: 'POST', body: 'fixture' })), /bodyless GET/);
});

test('#921: recovered transport does not accept foreign or malformed readiness', async () => {
  let calls = 0;
  const verdict = await probeGreenWorkflow({ ...options, fetchImpl: async () => {
    if (++calls === 1) throw brokenPipe();
    return Response.json({ workflow_runs: [{ ...run(), head_sha: 'b'.repeat(40) }] });
  } });
  assert.equal(verdict.status, 'missing');
  assert.equal(verdict.note, 'foreign run');
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(probeGreenWorkflow({ ...options, fetchImpl: async () => {
    calls += 1; return new Response('not JSON');
  } }), SyntaxError);
  assert.equal(calls, 1);
});

test('#921: an actual loopback socket close is recovered without public writes', async (t) => {
  let requests = 0;
  const methods = [];
  const failures = [];
  const pauses = [];
  const server = createServer((request, response) => {
    methods.push(request.method);
    if (++requests === 1) { request.socket.destroy(); return; }
    response.setHeader('Content-Type', 'application/json');
    response.end('{"ready":true}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((done) => { server.closeAllConnections(); server.close(done); }));
  const read = retryingReadFetch(async (...args) => {
    try { return await fetch(...args); }
    catch (error) { failures.push(error.cause?.code); throw error; }
  }, { pause: async (ms) => { pauses.push(ms); } });
  const response = await read(`http://127.0.0.1:${server.address().port}/readiness`);
  assert.deepEqual(await response.json(), { ready: true });
  assert.deepEqual(methods, ['GET', 'GET']);
  assert.equal(requests, 2);
  assert.deepEqual(failures, ['UND_ERR_SOCKET']);
  assert.deepEqual(pauses, [100]);
});
const options = { repo: 'x/y', sha, token: 'fixture-token', workflow: 'performance.yml' };
const brokenPipe = () => new TypeError('fetch failed', { cause: Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }) });

test('#921: exact-SHA readiness recovers one EPIPE GET without weakening its verdict', async () => {
  for (const [conclusion, status] of [['success', 'green'], ['failure', 'failed']]) {
    const calls = [];
    const verdict = await probeGreenWorkflow({ ...options, fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) throw brokenPipe();
      return Response.json({ workflow_runs: [run(conclusion)] });
    } });
    assert.equal(verdict.status, status);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1], 'same read URL, token and headers, no publication request');
    assert.match(calls[1].url, new RegExp(`head_sha=${sha}`));
    assert.equal(calls[1].init.method || 'GET', 'GET');
  }
});

test('#921: candidate-tree and proof-context GETs use the same bounded recovery, missing proof stays missing', async () => {
  const counts = new Map();
  const verdict = await probeGreenWorkflow({ ...options, workflow: 'validate.yml', expected: null,
    fetchImpl: async (url) => {
      const count = (counts.get(url) || 0) + 1;
      counts.set(url, count);
      if (url.includes('/git/commits/')) {
        if (count === 1) throw brokenPipe();
        return Response.json({ tree: { sha: 'b'.repeat(40) } });
      }
      if (url.includes('/artifacts?')) {
        if (count === 1) throw brokenPipe();
        return Response.json({ artifacts: [] });
      }
      if (url.endsWith('/jobs?per_page=100')) {
        if (count === 1) throw brokenPipe();
        return Response.json({ jobs: [] });
      }
      assert.match(url, /\/actions\/workflows\/validate.yml\/runs\?/);
      return Response.json({ workflow_runs: [{ ...run(), path: '.github/workflows/validate.yml', run_attempt: 1 }] });
    },
  });
  assert.equal(verdict.status, 'missing', 'recovered transport is not proof of a green candidate');
  assert.equal([...counts.keys()].filter(url => url.includes('/git/commits/')).length, 1);
  assert.equal([...counts.keys()].filter(url => url.includes('/artifacts?')).length, 1);
  assert.equal([...counts.keys()].filter(url => url.endsWith('/jobs?per_page=100')).length, 1);
  for (const [url, count] of counts) assert.equal(count, url.includes('/workflows/') ? 1 : 2, url);
});
