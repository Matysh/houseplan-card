import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from '../lib/github.mjs';
import { prepareShipReviewArtifacts } from '../lib/ship-review-artifacts.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), D = 'd'.repeat(64);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-ship-review-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const packet = { schema: 1, requestId: 'ship:current', candidateId: 'beta2', base: null,
    head: B, version: 'v2-beta.2', selectionDigest: D,
    tasks: [{ issue: 1, fingerprint: D, commits: [A], track: 'ship', body: 'Полное ТЗ №1' },
      { issue: 2, fingerprint: 'second', commits: [B], track: 'ship', body: 'Полное ТЗ №2' }],
    pending: [2], reused: [{ issue: 1, fingerprint: D, requestId: 'ship:previous', reportUrl: 'https://example.invalid/report' }] };
  const previous = { packet: { ...packet, requestId: 'ship:previous', candidateId: 'beta1', head: A,
    tasks: [packet.tasks[0]], pending: [1], reused: [] },
  result: { verdict: 'accepted', markdown: 'Предыдущий подробный русский отчёт.', report: { improvements: ['Можно упростить условие.'] } } };
  const current = { packet, result: { verdict: 'accepted', markdown: 'Текущий подробный русский отчёт.', report: { blockers: [] } } };
  const candidate = { id: 'beta2', kind: 'beta', sourceSha: B, sha: B, tag: 'v2-beta.2',
    shipReview: { sha: B, requestId: packet.requestId, selectionDigest: D, status: 'accepted', inventoryComplete: true } };
  return { root, candidate, records: { 'ship:current': current, 'ship:previous': previous } };
}

test('ship review assets preserve full current and reused reports with immutable source identities', t => {
  const input = fixture(t);
  input.records['ship:current'].result.markdown += `\n${'Детальное замечание. '.repeat(8000)}`;
  const assets = prepareShipReviewArtifacts(input);
  assert.deepEqual(assets.map(asset => asset.name), ['SHIP-REVIEW.json', 'SHIP-REVIEW.md']);
  for (const asset of assets) {
    assert.equal(asset.path, join(input.root, 'artifacts/process-next/publication', asset.name));
    assert.equal(asset.expectedDigest, sha256(readFileSync(asset.path)));
  }
  const data = JSON.parse(readFileSync(assets[0].path, 'utf8'));
  assert.deepEqual(data.current, input.records['ship:current']);
  assert.deepEqual(data.reused[0].packet, input.records['ship:previous'].packet);
  assert.deepEqual(data.reused[0].result, input.records['ship:previous'].result);
  assert.deepEqual(data.reused[0].references, input.records['ship:current'].packet.reused);
  const markdown = readFileSync(assets[1].path, 'utf8');
  assert.ok(markdown.includes(input.records['ship:current'].result.markdown));
  assert.ok(markdown.includes(input.records['ship:previous'].result.markdown));
  assert.match(markdown, /<details>\n<summary>Полный отчёт текущего запроса<\/summary>/);
  assert.match(markdown, /<summary>Ранее принятое ревью: #1<\/summary>/);
  assert.ok(markdown.includes(A) && markdown.includes(B));
  assert.match(markdown, /High останавливает бету; Medium и Low/);
});

test('stable keeps the original beta review SHA separate from its later fixed candidate', t => {
  const input = fixture(t);
  input.candidate = { ...input.candidate, id: 'stable', kind: 'stable', tag: 'v2', sourceSha: B, sha: A };
  const assets = prepareShipReviewArtifacts(input), data = JSON.parse(readFileSync(assets[0].path, 'utf8'));
  assert.equal(data.candidate.sha, A); assert.equal(data.shipReview.sha, B); assert.equal(data.current.packet.candidateId, 'beta2');
  const markdown = readFileSync(assets[1].path, 'utf8');
  assert.ok(markdown.includes(`Кандидат выпуска: \`${A}\``));
  assert.ok(markdown.includes(`Проверенный кандидат беты: \`${B}\``));
});

test('missing or mismatched accepted reports cannot be replaced by an expiring external link', t => {
  const input = fixture(t), previous = input.records['ship:previous'];
  delete input.records['ship:previous'];
  assert.throws(() => prepareShipReviewArtifacts(input), /Accepted ship review receipt is unavailable for #1/);
  input.records['ship:previous'] = { ...previous, result: { verdict: 'changes_requested' } };
  assert.throws(() => prepareShipReviewArtifacts(input), /Accepted ship review receipt/);
  input.records['ship:previous'] = previous;
  input.candidate.shipReview.sha = A;
  assert.throws(() => prepareShipReviewArtifacts(input), /receipt is unavailable for this candidate/);
});

test('a release without a review reference has no synthetic report assets', () => {
  assert.deepEqual(prepareShipReviewArtifacts({ root: 'unused', candidate: { kind: 'hotfix' } }), []);
});

test('an empty selection reports not-required without claiming that the model accepted it', t => {
  const input = fixture(t), record = input.records['ship:current'];
  record.packet.tasks = []; record.packet.pending = []; record.packet.reused = [];
  record.result = { verdict: 'not-required' }; input.candidate.shipReview.status = 'not-required';
  const assets = prepareShipReviewArtifacts(input), markdown = readFileSync(assets[1].path, 'utf8');
  assert.match(markdown, /новое ревью не требуется/);
  assert.match(markdown, /В выборке: 0; передано на анализ: 0; засчитано ранее: 0/);
  assert.doesNotMatch(markdown, /Результат: \*\*принято/);
});
