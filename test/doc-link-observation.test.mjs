import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { channel } from 'node:diagnostics_channel';
import { observeDocLink, publicLink } from '../scripts/doc-link-observation.mjs';

async function server(t, listener) {
  const instance = createServer(listener);
  instance.listen(0, '127.0.0.1'); await once(instance, 'listening');
  t.after(() => { instance.closeAllConnections(); instance.close(); });
  return `http://127.0.0.1:${instance.address().port}`;
}

test('#1083 original HEAD/UA/follow contract survives a genuine redirect and keeps only safe metadata', async t => {
  const seen = [];
  const origin = await server(t, (req, res) => {
    seen.push([req.method, req.headers['user-agent'], req.url]);
    if (req.url === '/first?private=secret') res.writeHead(308, { location: '/next?private=secret', 'set-cookie': 'private=secret' });
    else res.writeHead(200, { 'x-private': 'secret' });
    res.end();
  });
  let trace;
  const response = await observeDocLink(origin + '/first?private=secret', value => { trace = value; });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, [['HEAD', 'houseplan-docs-check/1', '/first?private=secret'], ['HEAD', 'houseplan-docs-check/1', '/next?private=secret']]);
  assert.equal(trace.timeoutMs, 8000);
  assert.deepEqual(trace.events.filter(e => e.phase === 'response-headers').map(e => [e.status, e.location]), [[308, origin + '/next'], [200, null]]);
  assert.deepEqual(trace.events.filter(e => e.phase === 'response-headers').map(e => e.request), [1, 2]);
  assert.equal(trace.finalUrl, origin + '/next');
  assert.equal(JSON.stringify(trace).includes('secret'), false);
  assert.equal(JSON.stringify(trace).includes('cookie'), false);
});

test('#1083 dead, broken and invalid TLS-like inputs never become successful observations', async t => {
  const origin = await server(t, (_req, res) => { res.writeHead(404); res.end(); });
  let trace;
  const response = await observeDocLink(origin + '/missing', value => { trace = value; });
  assert.equal(response.status, 404);
  assert.equal(trace.status, 404);
  const error = Object.assign(new TypeError('private credentials'), { cause: { code: 'CERT_HAS_EXPIRED', message: 'secret' } });
  await assert.rejects(observeDocLink('https://user:secret@example.invalid/?token=secret', value => { trace = value; }, {
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, 'HEAD'); assert.equal(options.redirect, 'follow');
      assert.ok(options.signal instanceof AbortSignal);
      throw error;
    },
  }), actual => actual === error);
  assert.equal(trace.failure.code, 'CERT_HAS_EXPIRED');
  assert.equal(JSON.stringify(trace).includes('secret'), false);
  assert.equal(publicLink('javascript:private'), null);
  assert.equal(publicLink('https://example.invalid/' + 'x'.repeat(5000)).length, 1024);
});

test('#1083 unchanged eight-second deadline stops a peer that never sends headers', { timeout: 20000 }, async t => {
  const origin = await server(t, () => {});
  let trace;
  await assert.rejects(observeDocLink(origin + '/never', value => { trace = value; }), { name: 'TimeoutError' });
  assert.equal(trace.failure.name, 'TimeoutError');
  assert.ok(trace.events.some(e => e.phase === 'headers-sent'));
  assert.equal(trace.events.some(e => e.phase === 'response-headers'), false);
  assert.ok(trace.elapsedMs >= 7900);
  assert.ok(trace.elapsedMs < 12000, `the original 8s budget must not become a longer per-hop wait (${trace.elapsedMs}ms)`);
});

test('#1083 observer callbacks cannot change the result and subscriptions are removed', async () => {
  const names = ['undici:request:create', 'undici:request:headers', 'net.client.socket'];
  const before = names.map(name => channel(name).hasSubscribers);
  const response = { status: 200, url: 'https://example.invalid/final' };
  assert.equal(await observeDocLink('https://example.invalid', () => { throw Error('observer'); }, { fetchImpl: async () => response }), response);
  assert.deepEqual(names.map(name => channel(name).hasSubscribers), before);
});

test('#1083 unknown and excessive telemetry stays bounded without masking the real result', async () => {
  let trace;
  const response = { status: 200, url: 'https://example.invalid/final' };
  assert.equal(await observeDocLink('https://example.invalid', value => { trace = value; }, {
    fetchImpl: async () => {
      for (let i = 0; i < 80; i++) channel('undici:request:create').publish({ request: { origin: 'https://example.invalid', path: '/?secret=private' } });
      channel('undici:request:headers').publish(null);
      return response;
    },
  }), response);
  assert.equal(trace.events.length, 64);
  assert.equal(trace.omitted, 16);
  assert.equal(trace.observerError, true);
  assert.equal(JSON.stringify(trace).includes('private'), false);
});
