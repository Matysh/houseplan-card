import test from 'node:test';
import assert from 'node:assert/strict';
import { announceStableRelease } from '../lib/notifications.mjs';

const candidate = { kind: 'stable', status: 'published', tag: 'v1.90.0' };
const userChangelog = '<!-- release: v1.90.0 -->\n<!-- base: v1.89.0 -->\n## Релиз Houseplan 1.90.0\n\nНовый пользовательский результат.\n';
function fixture() {
  const writes = []; let calls = 0;
  return { candidate, userChangelog, chat: '-1001234', token: '12345:secret',
    persist: async value => writes.push(value),
    fetchImpl: async (_url, options) => { calls++; assert.equal(JSON.parse(options.body).parse_mode, 'HTML'); return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 7 } }) }; },
    writes, get calls() { return calls; } };
}

test('stable announcement uses authored RU text and a persisted sent receipt prevents duplicate send', async () => {
  const f = fixture(), result = await announceStableRelease(f);
  assert.equal(result.status, 'sent'); assert.equal(result.messageId, 7);
  assert.deepEqual(f.writes.map(x => x.status), ['sending', 'sent']);
  const again = await announceStableRelease({ ...f, receipt: result });
  assert.equal(again.reused, true); assert.equal(f.calls, 1);
});

test('beta is silent and unpublished stable cannot contact transport', async () => {
  const f = fixture();
  assert.equal((await announceStableRelease({ ...f, candidate: { ...candidate, kind: 'beta' } })).status, 'not-required');
  await assert.rejects(announceStableRelease({ ...f, candidate: { ...candidate, status: 'testing' } }), /published stable/);
  assert.equal(f.calls, 0); assert.equal(f.writes.length, 0);
});

test('known rejection can retry only the announcement; ambiguous send cannot blindly repeat', async () => {
  const f = fixture();
  const failed = await announceStableRelease({ ...f, fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ ok: false }) }) });
  assert.equal(failed.status, 'failed');
  assert.equal((await announceStableRelease({ ...f, receipt: failed })).status, 'sent');
  const uncertain = await announceStableRelease({ ...f, fetchImpl: async () => { throw Error('secret URL unavailable'); } });
  assert.equal(uncertain.status, 'uncertain'); assert.doesNotMatch(JSON.stringify(uncertain), /secret/);
  const calls = f.calls;
  assert.equal((await announceStableRelease({ ...f, receipt: uncertain })).status, 'uncertain');
  assert.equal(f.calls, calls);
});

test('lost state acknowledgement after send leaves a durable sending receipt, not another POST', async () => {
  const f = fixture(); let saved;
  await assert.rejects(announceStableRelease({ ...f, persist: async value => {
    if (value.status === 'sent') throw Error('state write failed'); saved = value;
  } }), /state write failed/);
  assert.equal(saved.status, 'sending'); assert.equal(f.calls, 1);
  assert.equal((await announceStableRelease({ ...f, receipt: saved })).status, 'uncertain');
  assert.equal(f.calls, 1);
});
