import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceCommitLog, sourceChurn, sourceCommitType, sourceGrowthMetrics,
  sourceReplacementWarnings, renderSourceGrowth } from '../scripts/source-replacement.mjs';
import { buildReport, parseGitLog, renderMarkdown } from '../scripts/process-metrics.mjs';
import { buildPacket, renderPacket } from '../scripts/task-packet.mjs';
import { checkReviewInput } from '../scripts/review-preflight.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { handoffDigest } from '../scripts/review-handoff.mjs';
import { renderBrief } from '../scripts/release-review.mjs';

const sha = 'a'.repeat(40), tree = 'b'.repeat(40);
const file = (path, added, deleted) => ({ path, added, deleted });
const commit = (type, added, deleted) => ({ sha, body: `${type}(test): change`, files: [file('src/a.ts', added, deleted)] });
const handoff = 'Сделано: change · Файлы: src/a.ts · Гейты: node --test PASS · НЕ сделано: нет · Риски: нет · Следующий статус: S7-code-review';

test('#1014 advisory counts actual source lines, excludes i18n/tests/binary and has a strict 3x boundary', () => {
  const source = commit('fix', 4, 1);
  source.files.push(file('src/i18n/en.json', 300, 0), file('test/a.test.mjs', 1000, 0), file('src/font.woff', null, null));
  assert.deepEqual(sourceChurn(source), { files: 1, added: 4, deleted: 1 });
  assert.equal(sourceReplacementWarnings([source]).length, 1);
  for (const type of ['fix', 'refactor', 'chore']) {
    assert.equal(sourceReplacementWarnings([commit(type, 3, 1)]).length, 0);
    assert.equal(sourceReplacementWarnings([commit(type, 1, 0)]).length, 1);
    assert.equal(sourceReplacementWarnings([commit(type, 0, 0)]).length, 0);
  }
  assert.equal(sourceReplacementWarnings([commit('feat', 500, 0)]).length, 0);
  assert.equal(sourceReplacementWarnings([{ body: 'fix: docs', files: [file('docs/a.md', 500, 0)] }]).length, 0);
  assert.deepEqual(sourceReplacementWarnings(null), []);
  assert.equal(sourceCommitType('refactor(core)!: replace\n\nBody'), 'refactor');
});

test('#1014 only a real selected handoff suppresses the hint; examples do not count as an explanation', () => {
  const explanation = 'оставлен старый путь: src/a.ts:old — переход — задача на удаление #8';
  const commits = [commit('fix', 20, 1)];
  assert.equal(sourceReplacementWarnings(commits, handoff.replace('НЕ сделано: нет', 'НЕ сделано: ' + explanation)).length, 0);
  for (const text of [explanation, handoff + '\n> ' + explanation,
    handoff + '\n```text\n' + explanation + '\n```']) assert.equal(sourceReplacementWarnings(commits, text).length, 1);
});

test('#1014 packet and preflight print advice without changing rights, track or acceptance', () => {
  const growing = { ...commit('fix', 12, 1), message: 'fix: change\n\nIssue: #7\nUser-Visible: no', files: ['src/a.ts'],
    sourceFiles: [file('src/a.ts', 12, 1)] };
  const body = '## ТЗ\nAC1 — unit';
  const packet = buildPacket({ issue: { number: 7, title: 'Test', state: 'OPEN', body }, labels: ['S6-in-progress', 'track:show'],
    branch: { name: 'issue/7-test', tip: sha, base: tree, changedFiles: ['src/a.ts'], diff: '', commits: [growing] } });
  assert.match(renderPacket(packet), /Предупреждение:.*src \+12\/−1/);
  assert.equal(packet.trackDetail.track, 'show');
  assert.equal(packet.status, 'S6-in-progress');
  const input = { issue: 7, stage: 'code', track: 'show', body, bodyDigest: issueBodyDigest(body), sha, tree,
    currentSha: sha, currentTree: tree, infrastructure: false, files: ['src/a.ts'], commits: [growing], handoff,
    handoffProvenance: { id: 1, url: 'https://github.com/o/r/issues/7#issuecomment-1', createdAt: '2026-10-23',
      updatedAt: '2026-10-23', digest: handoffDigest(handoff) } };
  const result = checkReviewInput(input, { ledgerReader: () => ({}) });
  assert.equal(result.ok, true); assert.equal(result.semanticApproval, false); assert.equal(result.warnings.length, 1);
  assert.equal(checkReviewInput({ ...input, currentSha: tree }, { ledgerReader: () => ({}) }).ok, false);
});

test('#1014 source metrics use the same numstat parser and exclude release promotions/window outsiders', () => {
  const raw = `\x1e${sha}\x1f2026-10-23T00:00:00Z\x1ffix: change\n\nIssue: #7\x1f\n1\t5\tsrc/a.ts\n99\t0\tsrc/i18n/en.json\n`;
  const parsed = parseSourceCommitLog(raw);
  assert.deepEqual(parseGitLog(raw), parsed.map(row => ({ ...row, issues: [7] })));
  const metrics = sourceGrowthMetrics(parsed);
  assert.deepEqual(metrics, { commits: 1, reduced: 1, reducedShare: 1,
    byType: [{ type: 'fix', commits: 1, reduced: 1, added: 1, deleted: 5, net: -4 }] });
  const outside = { ...commit('chore', 500, 0), date: '2026-10-20' };
  const promotion = { ...commit('chore', 1000, 0), date: '2026-10-23',
    body: 'Release v1.83.0-beta.1 candidate\n\nRelease: v1.83.0-beta.1',
    files: [file('src/a.ts', 1000, 0), file('custom_components/houseplan/frontend/houseplan-card.js', 50, 0)] };
  const report = buildReport({ since: '2026-10-22', until: '2026-10-24', commits: [...parseGitLog(raw), outside, promotion] });
  assert.deepEqual(report.sourceGrowth, metrics);
  assert.match(renderMarkdown(report), /Уменьшили src: 1\/1 \(100.0%\)/);
  const brief = renderBrief({ membership: { tag: 'v1.83.0', candidate: sha, base: null, issues: [] },
    files: ['src/a.ts'], sourceGrowth: metrics });
  assert.match(brief, /Уменьшили src: 1\/1 \(100.0%\)/);
  assert.match(renderSourceGrowth(sourceGrowthMetrics()), /нет данных/);
});

test('#1014 release-range CLI measures real Git commits without GitHub and preserves output/JSON', () => {
  const root = mkdtempSync(join(tmpdir(), 'hp-churn-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
    mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src', 'a.ts'), 'one\ntwo\nthree\n');
    git('add', '.'); git('commit', '-m', 'feat: initial'); git('tag', 'base');
    writeFileSync(join(root, 'src', 'a.ts'), 'one\n'); git('add', '.'); git('commit', '-m', 'refactor: remove old path');
    const script = fileURLToPath(new URL('../scripts/process-metrics.mjs', import.meta.url));
    const text = execFileSync(process.execPath, [script, '--source-range=base..HEAD', '--json=out.json', '--output=out.md'],
      { cwd: root, encoding: 'utf8' });
    assert.match(text, /refactor \| 1 \| 1 \| 0 \| 2 \| -2/);
    assert.equal(readFileSync(join(root, 'out.md'), 'utf8'), text);
    assert.equal(JSON.parse(readFileSync(join(root, 'out.json'), 'utf8')).reducedShare, 1);
  } finally {
    assert.ok(isAbsolute(root) && dirname(resolve(root)) === resolve(tmpdir()) && basename(root).startsWith('hp-churn-'));
    rmSync(root, { recursive: true, force: true });
  }
});
