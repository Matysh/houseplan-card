import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureShipReview } from '../lib/ship-review-host.mjs';
import { initialReleaseState, reduceRelease } from '../lib/release.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40);
function harness({ pending = [1], verdict = 'accepted' } = {}) {
  let state = reduceRelease(initialReleaseState(), { id: 'create', type: 'create', kind: 'beta', candidate: 'beta',
    sourceSha: B, branch: 'release/beta' }), run = null, result = null, dispatches = 0, now = 0;
  const packet = { schema: 1, candidateId: 'beta', head: B, base: A, version: 'v1-beta.1',
    requestId: 'ship-review:test', selectionDigest: 'selection', tasks: pending.map(issue => ({ issue })), pending, reused: [] };
  const receipt = extra => ({ kind: 'ship-batch', candidateId: 'beta', requestId: packet.requestId, materialSha: B,
    base: A, selectionDigest: packet.selectionDigest, verdict, markdown: 'Подробный русский отчёт', ...extra });
  const options = {
    store: { read: async () => ({ state: structuredClone(state) }) },
    dispatch: async event => { state = reduceRelease(state, event); return structuredClone(state); },
    queue: { store: { read: async () => ({ state: { tasks: {} } }) } }, git: {}, config: {},
    api: { root: '/repo', request: async (method, _path, body) => {
      if (method === 'GET') return run;
      dispatches++;
      assert.equal(body.inputs.kind, 'ship-batch'); assert.equal(body.inputs.head, B);
      assert.equal(body.inputs.issue, ''); assert.equal(JSON.parse(body.inputs.batch).stateBranch, 'process-release-state');
      assert.equal(state.shipReviews[packet.requestId].packet.head, B, 'packet is saved before readonly job starts');
      run = { id: 10, display_title: `Пакет ship ${packet.requestId}`, status: 'in_progress', html_url: 'https://run/10', run_attempt: 1 };
      throw Error('response lost after dispatch');
    } },
    review: { workflow: 'process-next-review.yml', ref: 'dev', runs: async () => run ? [run] : [], artifactResult: async () => result },
    dependencies: { buildShipReviewPacket: async () => structuredClone(packet), clock: () => now,
      sleep: async ms => { now += ms; if (run) { run.status = 'completed'; result = receipt(); } } },
  };
  return { options, packet, receipt, state: () => state, dispatches: () => dispatches,
    setRun: (value, valueResult) => { run = value; result = valueResult; },
    invoke: () => ensureShipReview({ ...options, candidate: state.candidates.beta }) };
}

test('one frozen batch survives a lost dispatch response and accepted retries do not call the model', async () => {
  const h = harness(); await h.invoke(); await h.invoke();
  assert.equal(h.dispatches(), 1);
  assert.equal(h.state().candidates.beta.shipReview.status, 'accepted');
  assert.equal(h.state().shipReviews[h.packet.requestId].result.markdown, 'Подробный русский отчёт');
});

test('empty pending selection records not-required without any workflow or runner', async () => {
  const h = harness({ pending: [] }); await h.invoke();
  assert.equal(h.dispatches(), 0); assert.equal(h.state().candidates.beta.shipReview.status, 'not-required');
});

test('blocking findings are stored and repeated publication does not dispatch or reinterpret them', async () => {
  const h = harness({ verdict: 'changes_requested' });
  await assert.rejects(h.invoke(), /нужны исправления/);
  await assert.rejects(h.invoke(), /нужны исправления/);
  assert.equal(h.dispatches(), 1); assert.equal(h.state().candidates.beta.shipReview.status, 'changes_requested');
});

test('incomplete workflow requires an explicit job rerun; same command reads the new attempt', async () => {
  const h = harness({ verdict: 'incomplete' });
  await assert.rejects(h.invoke(), /не завершено/);
  await assert.rejects(h.invoke(), /не завершено/); assert.equal(h.dispatches(), 1);
  h.setRun({ id: 10, display_title: h.packet.requestId, status: 'completed', run_attempt: 2 },
    h.receipt({ verdict: 'accepted', workflowRunAttempt: 2 }));
  await h.invoke(); assert.equal(h.dispatches(), 1); assert.equal(h.state().candidates.beta.shipReview.status, 'accepted');
});

test('a result for another candidate or obsolete workflow attempt cannot authorize publication', async () => {
  for (const wrong of [{ materialSha: A }, { verdict: 'incomplete', workflowRunAttempt: 1 }]) {
    const h = harness(); h.setRun({ id: 10, display_title: h.packet.requestId, status: 'completed', run_attempt: 2 }, h.receipt(wrong));
    await assert.rejects(h.invoke(), /different material or workflow attempt/);
    assert.equal(h.state().candidates.beta.shipReview.status, 'pending'); assert.equal(h.dispatches(), 0);
  }
});
