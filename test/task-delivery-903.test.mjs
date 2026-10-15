import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCatalogue, readMergeEntry } from '../scripts/release-ledger.mjs';
import { buildReleaseMembership, readCandidateHistory, verifyReleaseMembershipAgainstGit } from '../scripts/release-membership.mjs';
import { taskDelivery, reviewPublicationMessage } from '../scripts/task-delivery.mjs';
import { withMaterialAnchors } from '../scripts/review-doc-guard.mjs';
import { readLine, buildLineMembership } from '../scripts/release-review.mjs';

const cycle = { schema: 1, baseStable: 'v1.80.1', targetStable: 'v1.81.0', milestone: { number: 3, title: '1.81' } };
const publisher = 'claude[bot] <209825114+claude[bot]@users.noreply.github.com>';
const phase = 'Delivery-Phase: spec-review/v1';
const classification = rationale => ({ schema: 1, issue: 2, baseStable: 'v1.80.1', category: 'infra', rationale });

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-delivery-903-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = args => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.com' } }).trim();
  const put = (path, text) => { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), text); };
  const commit = (message, author) => { run(['add', '.']); run(['commit', '-qm', message, ...(author ? [`--author=${author}`] : [])]); return run(['rev-parse', 'HEAD']); };
  run(['init', '-q', '-b', 'dev']);
  put('docs/release-ledger/cycle.json', JSON.stringify(cycle));
  commit('base'); run(['tag', cycle.baseStable]);
  const spec = ({ trailer = phase, extra, malformed = false, author = publisher } = {}) => {
    const path = 'docs/reviews/SPEC-REVIEW-2-r1.md';
    put(path, malformed ? '# SPEC-REVIEW-2-r1\nno machine evidence' : withMaterialAnchors('# SPEC-REVIEW-2-r1\n', {
      sha: run(['rev-parse', 'HEAD']), tree: run(['rev-parse', 'HEAD^{tree}']), issueBody: 'a'.repeat(64), verdict: 'green', high: 0,
    }));
    put('docs/reviews/INDEX.md', 'SPEC-REVIEW-2-r1.md\n');
    if (extra) put(extra, 'extra');
    return commit(`docs: review document for #2\n\nIssue: #2\nUser-Visible: no${trailer ? `\n${trailer}` : ''}`, author);
  };
  return { dir, run, put, commit, spec, catalogue: () => readCatalogue({ gitRunner: run }) };
}

for (const trailer of [phase, '']) test(`#903 verified ${trailer ? 'v1' : 'legacy'} SPEC keeps trace without implementation membership`, t => {
  const f = fixture(t); const sha = f.spec({ trailer });
  const result = f.catalogue();
  assert.deepEqual(result.entries, []); assert.deepEqual(result.userIssues, []);
  assert.deepEqual(result.specDeliveries, [{ issue: 2, commit: sha, phase: 'spec-review' }]);
  const before = f.run(['status', '--porcelain']);
  // The history reader and both manifest create/verify use the same proof.
  const old = process.cwd(); process.chdir(f.dir);
  try {
    const history = readCandidateHistory(sha);
    const { manifest, unmatched } = buildReleaseMembership({ tag: 'v1.81.0-beta.4', candidate: sha,
      ...history, issueNumbers: [2], allowUnmatched: true });
    assert.deepEqual(manifest.issues, []); assert.deepEqual(unmatched, [2]);
    assert.doesNotThrow(() => verifyReleaseMembershipAgainstGit(manifest));
    assert.throws(() => verifyReleaseMembershipAgainstGit({ ...manifest, issues: [{ number: 2, commits: [sha] }] }), /does not prove/);
    const line = readLine('v1.81.0', sha);
    assert.deepEqual(buildLineMembership({ tag: 'v1.81.0', candidate: sha, ...line }).issues, []);
  } finally { process.chdir(old); }
  assert.equal(f.run(['status', '--porcelain']), before);
});

test('#903 later A/B delivery rejects absent/unchanged doc placeholder at catalogue and merge boundaries', t => {
  const f = fixture(t); f.spec();
  const path = 'docs/release-ledger/v1.80.1/2.json';
  f.put(path, JSON.stringify(classification('Documentation only; no implementation delivered'))); f.commit('docs: old placeholder');
  f.put('scripts/implemented.mjs', 'export const implemented = true;'); f.commit('implementation\n\nIssue: #2\nUser-Visible: no');
  assert.throws(f.catalogue, /stale doc-only classification/);
  assert.throws(() => readMergeEntry('HEAD', 2, f.run), /stale doc-only classification/);
  f.put(path, JSON.stringify({ ...classification('Documentation only; no implementation delivered'), ignored: 'not a reclassification' }, null, 2));
  f.commit('format old placeholder');
  assert.throws(f.catalogue, /stale doc-only classification/, 'formatting or unknown fields cannot renew the author decision');
  f.put(path, JSON.stringify(classification('Actual CLI implementation relative to v1.80.1; no runtime product change')));
  f.commit('classify actual implementation\n\nIssue: #2\nUser-Visible: no');
  assert.deepEqual(f.catalogue().entries.map(e => e.issue), [2]);
  assert.equal(readMergeEntry('HEAD', 2, f.run).entry.issue, 2);
  f.put('scripts/implemented.mjs', 'export const implemented = false;'); f.commit('later repair\n\nIssue: #2\nUser-Visible: no');
  assert.doesNotThrow(f.catalogue, 'a classification written for actual implementation remains valid for subsequent fixes');
});

test('#903 subsequent implementation without any classification remains fail-closed', t => {
  const f = fixture(t); f.spec();
  f.put('src/feature.ts', 'export const value = 1;'); f.commit('feature\n\nIssue: #2\nUser-Visible: no');
  assert.throws(f.catalogue, /Missing classification for #2/);
});

for (const [name, options, error] of [
  ['unknown phase', { trailer: 'Delivery-Phase: invented/v9' }, /Unknown\/malformed/],
  ['duplicate phase', { trailer: `${phase}\n${phase}` }, /Unknown\/malformed/],
  ['A disguised as SPEC', { extra: 'src/hidden.ts' }, /Unproven spec-only/],
  ['B disguised as SPEC', { extra: 'scripts/hidden.mjs' }, /Unproven spec-only/],
  ['unconfirmed C path', { extra: 'docs/unrelated.md' }, /Unproven spec-only/],
  ['malformed record', { malformed: true }, /Unproven spec-only/],
  ['foreign publisher', { author: 'somebody <somebody@example.com>' }, /Unproven spec-only/],
]) test(`#903 rejects ${name}`, t => {
  const f = fixture(t); f.spec(options); assert.throws(f.catalogue, error);
});

test('#903 a marker alone cannot confer spec phase', () => {
  assert.throws(() => taskDelivery({ sha: 'a'.repeat(40), message: `forged\nIssue: #2\n${phase}` }), /Unproven spec-only/);
});

test('#903 producer message is stage-aware, terminal and understood by the consumer', t => {
  const f = fixture(t);
  assert.match(reviewPublicationMessage(2, 'spec'), /User-Visible: no\nDelivery-Phase: spec-review\/v1\n$/);
  assert.doesNotMatch(reviewPublicationMessage(2, 'code'), /Delivery-Phase/);
  assert.throws(() => reviewPublicationMessage(2, 'invented'), /spec\/code stage/);
  f.spec({ trailer: reviewPublicationMessage(2, 'spec').trim().split('\n').at(-1) });
  assert.equal(f.catalogue().specDeliveries.length, 1);
  const path = 'docs/release-ledger/v1.80.1/2.json';
  f.put(path, JSON.stringify(classification('Documentation placeholder only')));
  f.commit('release promotion\n\nRelease: v1.81.0-beta.4\nIssue: #2\nUser-Visible: no');
  assert.throws(() => readMergeEntry('HEAD', 2, f.run), /only SPEC delivery/);
  assert.deepEqual(f.catalogue().entries, []);
  const { manifest } = buildReleaseMembership({ tag: 'v1.81.0-beta.4', candidate: f.run(['rev-parse', 'HEAD']),
    commits: [{ sha: f.run(['rev-parse', 'HEAD']), message: 'Release: v1.81.0-beta.4\nIssue: #2' }],
    issueNumbers: [2], allowUnmatched: true });
  assert.deepEqual(manifest.issues, [], 'promotion trailer repetition cannot confer close eligibility');
});

test('#903 stale base and immutable candidate checks survive spec phase separation', t => {
  const f = fixture(t); const spec = f.spec();
  f.put('docs/unclassified.md', 'ordinary documentation is not a SPEC publication'); f.commit('docs\n\nIssue: #3\nUser-Visible: no');
  assert.throws(f.catalogue, /Missing classification for #3/);
  assert.deepEqual(readCatalogue({ candidate: spec, gitRunner: f.run }).entries, []);
  f.run(['tag', 'v1.80.2']);
  assert.throws(f.catalogue, /latest reachable previous stable/);
});
