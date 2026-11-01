import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { continuationDiscovery, discoveryFailure, discoveryJsonRead, DISCOVERY_BODY_BYTES } from '../scripts/continuation-discovery.mjs';
import { continueWorkflows } from '../scripts/workflow-continuation.mjs';

const runPath = 'repos/o/r/actions/runs/5';
const listPath = 'repos/o/r/actions/artifacts?per_page=100';
const bytes = value => new Response(value, { headers: { 'Content-Type': 'application/json' } });
async function server(t, handle) {
  const s = createServer(handle);
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  t.after(() => new Promise(done => { s.closeAllConnections(); s.close(done); }));
  return `http://127.0.0.1:${s.address().port}`;
}

test('#1116 actual interrupted body recovers only its GET, with one shared retry boundary', async t => {
  const paths = [], methods = [], pauses = [];
  const base = await server(t, (req, res) => {
    paths.push(req.url); methods.push(req.method);
    assert.equal(req.headers.authorization, 'Bearer fixture-token');
    if (paths.length === 1) {
      res.writeHead(200, { 'Content-Length': 64 });
      res.write('{"id":');
      setImmediate(() => res.destroy());
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.url.includes('/runs/') ? { id: 5 } : { artifacts: [] }));
    }
  });
  const read = discoveryJsonRead({ token: 'fixture-token', pause: async ms => pauses.push(ms),
    fetchImpl: (url, init) => fetch(base + new URL(url).pathname + new URL(url).search, init) });
  assert.deepEqual(await continuationDiscovery('o/r', 5, read), { event: { id: 5 }, artifacts: [] });
  assert.deepEqual(paths, ['/' + runPath, '/' + runPath, '/' + listPath]);
  assert.deepEqual(methods, ['GET', 'GET', 'GET']);
  assert.deepEqual(pauses, [100]);
});

test('#1116 known socket failures have at most three attempts, never retry times retry', async () => {
  let calls = 0;
  const pauses = [];
  const read = discoveryJsonRead({ pause: async ms => pauses.push(ms), fetchImpl: async () => {
    calls++;
    throw new TypeError('fixture secret must not escape', { cause: Object.assign(new Error('socket'), { code: 'UND_ERR_SOCKET' }) });
  } });
  await assert.rejects(continuationDiscovery('o/r', 5, read), error => {
    assert.deepEqual(discoveryFailure(error), { action: 'unverified', code: 'discovery-failed', stage: 'event-run',
      endpoint: runPath, reason: 'transport-failed', authority: false });
    assert.doesNotMatch(error.message, /fixture secret/);
    return true;
  });
  assert.equal(calls, 3);
  assert.deepEqual(pauses, [100, 400]);
});

test('#1116 HTTP errors stay terminal with their status even if the body is empty or malformed', async t => {
  let requests = 0;
  const base = await server(t, (req, res) => {
    requests++;
    res.writeHead(Number(req.url.slice(1)), { 'Content-Type': 'application/json' });
    res.end('{"message":');
  });
  for (const status of [401, 403, 429, 500, 502]) {
    const read = discoveryJsonRead({ pause: () => assert.fail('HTTP errors must not retry'),
      fetchImpl: (_, init) => fetch(base + '/' + status, init) });
    const before = requests;
    await assert.rejects(continuationDiscovery('o/r', 5, read), error => {
      assert.equal(discoveryFailure(error).reason, `http-${status}`);
      return true;
    });
    assert.equal(requests - before, 1);
  }
});

test('#1116 malformed JSON, invalid UTF-8, bad shapes and foreign run IDs never become an empty successful list', async () => {
  for (const [body, reason] of [['', 'malformed-json'], ['{"artifacts":', 'malformed-json'],
    [new Uint8Array([255]), 'invalid-utf8'], ['{}', 'invalid-response'], ['[]', 'invalid-response'], ['{\"artifacts\":[null]}', 'invalid-response'], ['{\"artifacts\":[{}]}', 'invalid-response']]) {
    let calls = 0;
    const read = discoveryJsonRead({ pause: () => assert.fail('malformed evidence must not retry'), fetchImpl: async () => {
      calls++;
      return bytes(body);
    } });
    await assert.rejects(continuationDiscovery('o/r', null, read), error => {
      assert.equal(discoveryFailure(error).stage, 'artifact-list');
      assert.equal(discoveryFailure(error).reason, reason);
      return true;
    });
    assert.equal(calls, 1);
  }
  await assert.rejects(continuationDiscovery('o/r', 5, async () => ({ id: 6 })), /invalid-response/);
  await assert.rejects(continuationDiscovery('o/r', null, async () => ({ artifacts: null })), /invalid-response/);
});

test('#1116 response cap is exact and cancellation/deadline cannot retry', async () => {
  const read = discoveryJsonRead({ fetchImpl: async () => bytes(' '.repeat(DISCOVERY_BODY_BYTES - 2) + '{}') });
  assert.deepEqual(await read(listPath), {});
  let calls = 0;
  const large = discoveryJsonRead({ pause: () => assert.fail('oversized body must not retry'), fetchImpl: async () => {
    calls++;
    return bytes(' '.repeat(DISCOVERY_BODY_BYTES - 1) + '{}');
  } });
  await assert.rejects(continuationDiscovery('o/r', null, large), /response-too-large/);
  assert.equal(calls, 1);
  for (const name of ['AbortError', 'TimeoutError']) {
    calls = 0;
    const cancelled = discoveryJsonRead({ pause: () => assert.fail('cancelled read must not retry'), fetchImpl: async () => {
      calls++; throw new DOMException('fixture private text', name);
    } });
    await assert.rejects(continuationDiscovery('o/r', 5, cancelled), /read-cancelled/);
    assert.equal(calls, 1);
  }
  assert.throws(() => read('https://foreign.example/write'), /invalid-endpoint/);
});

test('#1116 failed discovery preserves a named artifact and throws; valid empty discovery stays an honest noop', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-1116-discovery-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await assert.rejects(continueWorkflows({ repo: 'o/r', eventId: 5, apply: true, out: dir, discoveryRead: async path => {
    if (path === runPath) return { id: 5 };
    throw Object.assign(new Error('fixture-secret-response'), {discoveryReason:'fixture-secret-response'});
  } }), /artifact-list/);
  const failure = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
  assert.deepEqual(failure.outcomes, [{ action: 'unverified', code: 'discovery-failed', stage: 'artifact-list',
    endpoint: listPath, reason: 'transport-failed', authority: false }]);
  assert.doesNotMatch(JSON.stringify(failure), /fixture-secret-response/);
  const success = await continueWorkflows({ repo: 'o/r', eventId: 5, out: dir,
    discoveryRead: async path => path === runPath ? { id: 5 } : { artifacts: [] } });
  assert.deepEqual(success, []);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')).outcomes, []);
});

test('#1116 actual CLI fails closed and retains its artifact before any command/write', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-1116-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const stage of ['event-run', 'artifact-list']) {
    const out = join(dir, stage), marker = join(dir, stage + '-unexpected-command');
    const bootstrap = `import cp from 'node:child_process'; import {writeFileSync} from 'node:fs';
      import {syncBuiltinESMExports} from 'node:module';
      cp.execFileSync=()=>{writeFileSync(${JSON.stringify(marker)},'unexpected');throw Error('fixture command forbidden');};
      syncBuiltinESMExports();
      globalThis.fetch=async url=>${stage === 'event-run' ? "new Response('fixture-private-response',{status:502})"
        : "url.endsWith('/runs/5')?Response.json({id:5}):new Response('fixture-private-response')"};`;
    const run = spawnSync(process.execPath, ['--import=data:text/javascript,' + encodeURIComponent(bootstrap),
      'scripts/workflow-continuation.mjs', '--repo=o/r', '--run-id=5', '--apply=true', '--out=' + out],
    { encoding: 'utf8', timeout: 10000, env: { ...process.env, GH_TOKEN: 'fixture-private-token' } });
    assert.equal(run.status, 1, run.stderr);
    assert.doesNotMatch(run.stdout + run.stderr, /fixture-private-response|fixture-private-token/);
    assert.match(run.stderr, /no verdict\/merge\/release authority/);
    assert.equal(existsSync(marker), false, 'failed discovery must reach no gh/git/dispatch command');
    const result = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8')).outcomes[0];
    assert.deepEqual(result, { action: 'unverified', code: 'discovery-failed', stage,
      endpoint: stage === 'event-run' ? runPath : listPath,
      reason: stage === 'event-run' ? 'http-502' : 'malformed-json', authority: false });
    assert.doesNotMatch(JSON.stringify(result), /fixture-private-response|fixture-private-token/);
  }
});
