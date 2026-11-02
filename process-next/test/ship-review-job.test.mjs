import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareShipReviewJob, renderShipReviewSummary } from '../templates/ship-review-job.mjs';

function fixture(t) {
  const reportDir = mkdtempSync(join(tmpdir(), 'ship-review-job-'));
  t.after(() => rmSync(reportDir, { recursive: true, force: true }));
  const packet = { schema: 1, candidateId: 'beta:1.99.0-1', base: 'a'.repeat(40), head: 'b'.repeat(40),
    version: '1.99.0 beta 1', requestId: 'ship-review:' + 'c'.repeat(64), selectionDigest: 'd'.repeat(64),
    tasks: [{ issue: 9999, title: 'Локальная правка', url: 'https://example.invalid/issues/9999', body: 'Замороженные требования.',
      commits: ['b'.repeat(40)], fingerprint: 'e'.repeat(64), track: 'ship' }], pending: [9999], reused: [] };
  const entry = { packet, result: null }, state = { shipReviews: { [packet.requestId]: entry } };
  const env = { PROCESS_NEXT_ENABLED: 'true', HP_KIND: 'ship-batch', HP_TRACK: 'ship', HP_ISSUE: '',
    HP_BASE: packet.base, HP_HEAD: packet.head, HP_REQUEST_ID: packet.requestId,
    HP_BATCH: JSON.stringify({ candidateId: packet.candidateId, version: packet.version, selectionDigest: packet.selectionDigest }),
    GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '2' };
  const reads = [], progress = [];
  const api = { getContents: async (path, branch) => {
    reads.push({ path, branch });
    return { sha: 'f'.repeat(40), encoding: 'base64', content: Buffer.from(JSON.stringify(state)).toString('base64') };
  } };
  const reviewAdapter = { runs: async () => [], artifactResult: async () => { throw Error('Unexpected artifact lookup'); } };
  let calls = 0, context;
  const runReviewImpl = async ({ context: value, onProgress }) => {
    calls++; context = value; onProgress({ step: 'analysis' });
    const file = join(reportDir, 'report.md');
    writeFileSync(file, '# Подробный русский отчёт\n\nПроверены требования, исходники и связи.');
    return { status: 'accept', file, model: 'pinned-opus', report: { verdict: 'accept', blockers: [], improvements: ['Необязательное упрощение.'] } };
  };
  return { env, packet, entry, state, api, reviewAdapter, reportDir, reads, progress,
    runReviewImpl, buildContext: value => ({ kind: 'ship-batch', batch: value.packet }),
    onProgress: value => progress.push(value), get calls() { return calls; }, get context() { return context; } };
}

test('batch job reads the frozen release packet, produces a durable result and never needs an issue writer', async t => {
  const f = fixture(t), result = await prepareShipReviewJob(f);
  assert.deepEqual(f.reads, [{ path: 'releases.json', branch: 'process-release-state' }]);
  assert.deepEqual(f.context.batch, f.packet);
  assert.equal(f.calls, 1); assert.equal(result.kind, 'ship-batch'); assert.equal(result.verdict, 'accepted');
  assert.equal(result.issue, undefined); assert.equal(result.materialSha, f.packet.head);
  assert.equal(result.candidateId, f.packet.candidateId); assert.equal(result.selectionDigest, f.packet.selectionDigest);
  assert.equal(result.workflowRunId, 12345); assert.equal(result.workflowRunAttempt, 2);
  assert.equal(result.releaseVersion, '1.99.0 beta 1');
  assert.deepEqual(result.report.improvements, ['Необязательное упрощение.']);
  assert.match(result.markdown, /Подробный русский отчёт/);
  assert.deepEqual(JSON.parse(readFileSync(join(f.reportDir, 'result.json'), 'utf8')), result);
  assert.equal(f.progress[0].name, 'Пакетное код-ревью ship перед 1.99.0 beta 1');
});

test('batch job loads a release state larger than 1 MiB through its immutable blob', async t => {
  const f = fixture(t), blobSha = 'f'.repeat(40), reads = [];
  f.state.history = 'Старый отчёт '.repeat(100_000);
  const text = JSON.stringify(f.state);
  assert.ok(Buffer.byteLength(text) > 1024 * 1024);
  f.api.root = '/repos/o/r';
  f.api.getContents = async (path, ref) => {
    reads.push({ path, ref }); return { sha: blobSha, encoding: 'none', content: '' };
  };
  f.api.request = async (method, path) => {
    reads.push({ method, path });
    return { sha: blobSha, encoding: 'base64', content: Buffer.from(text).toString('base64') };
  };
  const result = await prepareShipReviewJob(f);
  assert.equal(result.verdict, 'accepted'); assert.equal(f.calls, 1); assert.deepEqual(f.context.batch, f.packet);
  assert.deepEqual(reads, [{ path: 'releases.json', ref: 'process-release-state' },
    { method: 'GET', path: `/repos/o/r/git/blobs/${blobSha}` }]);
});

test('saved final results are reused locally and from release state without another model call', async t => {
  for (const source of ['local', 'state']) {
    const f = fixture(t), first = await prepareShipReviewJob(f);
    if (source === 'state') {
      f.entry.result = first;
      rmSync(join(f.reportDir, 'result.json'));
    }
    const retry = await prepareShipReviewJob(f);
    assert.equal(retry.reused, true); assert.equal(f.calls, 1); assert.equal(retry.markdown, first.markdown);
  }
});

test('a matching completed paid artifact is reused after the state update failed', async t => {
  const f = fixture(t), first = await prepareShipReviewJob(f);
  rmSync(join(f.reportDir, 'result.json'));
  f.reviewAdapter.runs = async () => [
    { id: 11, display_title: `Пакетное код-ревью ship перед beta · ${f.packet.requestId}` },
    { id: 99, display_title: `Похожее имя · ${f.packet.requestId}extra` },
  ];
  const read = [];
  f.reviewAdapter.artifactResult = async run => { read.push(run.id); return { ...first, artifactId: 101, reportUrl: 'https://example.invalid/run' }; };
  const retry = await prepareShipReviewJob(f);
  assert.equal(retry.artifactId, 101); assert.equal(retry.reused, true); assert.equal(f.calls, 1);
  assert.deepEqual(read, [11]);
});

test('a High changes_requested result is final for that material and is not paid for again', async t => {
  const f = fixture(t), invoke = f.runReviewImpl;
  f.runReviewImpl = async args => ({ ...await invoke(args), status: 'changes_requested' });
  const first = await prepareShipReviewJob(f);
  assert.equal(first.verdict, 'changes_requested');
  const retry = await prepareShipReviewJob(f);
  assert.equal(retry.reused, true); assert.equal(f.calls, 1);
});

test('an incomplete attempt never replaces analysis and explicit workflow retry can produce a final receipt', async t => {
  const f = fixture(t), first = await prepareShipReviewJob({ ...f,
    runReviewImpl: async () => ({ status: 'incomplete', reason: 'Анализ не завершился.' }) });
  f.entry.result = first;
  f.reviewAdapter.runs = async () => [{ id: 12345, display_title: `Batch · ${f.packet.requestId}` }];
  f.reviewAdapter.artifactResult = async () => first;
  f.env.GITHUB_RUN_ATTEMPT = '3';
  const retry = await prepareShipReviewJob(f);
  assert.equal(retry.verdict, 'accepted'); assert.equal(retry.workflowRunAttempt, 3); assert.equal(f.calls, 1);
  assert.equal(first.verdict, 'incomplete');
});

test('a queued concurrent first-attempt job does not pay again after an incomplete predecessor', async t => {
  for (const source of ['state', 'artifact']) {
    const f = fixture(t), invoke = f.runReviewImpl;
    let paid = 0;
    f.env.GITHUB_RUN_ID = '100'; f.env.GITHUB_RUN_ATTEMPT = '1';
    f.runReviewImpl = async () => { paid++; return { status: 'incomplete', reason: 'Первый анализ не завершён.' }; };
    const first = await prepareShipReviewJob(f);
    rmSync(join(f.reportDir, 'result.json'));
    if (source === 'state') f.entry.result = first;
    else {
      f.reviewAdapter.runs = async () => [{ id: 100, display_title: `Batch · ${f.packet.requestId}` }];
      f.reviewAdapter.artifactResult = async () => ({ ...first, artifactId: 101 });
    }
    f.env.GITHUB_RUN_ID = '200';
    f.runReviewImpl = async args => { paid++; return invoke(args); };
    const duplicate = await prepareShipReviewJob(f);
    assert.equal(duplicate.verdict, 'incomplete'); assert.equal(duplicate.reused, true); assert.equal(paid, 1);
    if (source === 'artifact') assert.equal(duplicate.artifactId, 101);
    f.env.GITHUB_RUN_ATTEMPT = '2';
    const explicitRetry = await prepareShipReviewJob(f);
    assert.equal(explicitRetry.verdict, 'accepted'); assert.equal(explicitRetry.workflowRunId, 200);
    assert.equal(explicitRetry.workflowRunAttempt, 2); assert.equal(paid, 2);
  }
});

test('all dispatched identities must match coordinator state before any paid analysis', async t => {
  for (const key of ['candidateId', 'base', 'head', 'requestId', 'selectionDigest', 'version']) {
    const f = fixture(t); f.packet[key] = 'different';
    await assert.rejects(prepareShipReviewJob(f), /does not match/);
    assert.equal(f.calls, 0);
  }
});

test('a cached artifact for different material cannot turn the intended batch green', async t => {
  const f = fixture(t), first = await prepareShipReviewJob(f);
  rmSync(join(f.reportDir, 'result.json'));
  f.reviewAdapter.runs = async () => [{ id: 44, display_title: `Batch · ${f.packet.requestId}` }];
  f.reviewAdapter.artifactResult = async () => ({ ...first, materialSha: 'f'.repeat(40) });
  await assert.rejects(prepareShipReviewJob(f), /different material/);
  assert.equal(f.calls, 1);
});

test('empty pending batch and first-release base are supported without model work', async t => {
  const f = fixture(t); f.packet.pending = []; f.packet.base = null; f.env.HP_BASE = '';
  f.buildContext = () => { throw Error('Empty batch does not need source context'); };
  const result = await prepareShipReviewJob(f);
  assert.equal(result.verdict, 'not-required'); assert.equal(result.base, null); assert.equal(result.model, null);
  assert.equal(f.calls, 0); assert.match(result.markdown, /модель не вызывалась/);
});

test('disabled or malformed batch jobs do not contact GitHub', async t => {
  for (const edit of [env => { env.PROCESS_NEXT_ENABLED = 'false'; }, env => { env.HP_KIND = 'code'; },
    env => { env.HP_BATCH = JSON.stringify({ candidateId: 'x', version: 'beta', selectionDigest: 'd'.repeat(64), statePath: '../secret' }); }]) {
    const f = fixture(t); edit(f.env);
    await assert.rejects(prepareShipReviewJob(f));
    assert.equal(f.reads.length, 0); assert.equal(f.calls, 0);
  }
});

test('Actions summary names the release and collapses the full Russian analysis', async t => {
  const result = await prepareShipReviewJob(fixture(t)), summary = renderShipReviewSummary(result);
  assert.match(summary, /^## Пакетное код-ревью ship перед 1\.99\.0 beta 1/);
  assert.ok(summary.indexOf('Результат: **принято**') < summary.indexOf('<details>'));
  assert.match(summary, /<summary>Полный разбор выбранных ship-задач<\/summary>[\s\S]*Подробный русский отчёт[\s\S]*<\/details>/);
  assert.doesNotMatch(summary, /S7|S6|задачи #0/);
});
