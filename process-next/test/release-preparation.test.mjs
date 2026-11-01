import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildCandidateMembership, readTaskReleaseMilestone } from '../lib/release-data.mjs';
import { prepareReleaseVersions, prepareReleaseData, prepareReleaseNotes, preparePublicationArtifacts } from '../lib/release-preparation.mjs';
import { digest } from '../lib/storage.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-release-preparation-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, body) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); };
  const run = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = message => { run(['add', '.']); run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message]); return run(['rev-parse', 'HEAD']); };
  run(['init', '-q']); write('README.md', 'base'); const baseSha = commit('base');
  return { root, write, run, commit, baseSha, git: { git: async args => run(args) } };
}
test('membership reads all merged parents and excludes spec-only, release repeats, previous and later/unreachable tasks', async t => {
  const f = fixture(t), { write, commit, run, git, baseSha } = f;
  write('one.txt', 'one'); const one = commit('implemented\n\nIssue: #1');
  run(['checkout', '-qb', 'side']); write('two.txt', 'two'); const two = commit('implemented\n\nIssue: #2');
  run(['checkout', '-q', '-']); write('main.txt', 'main'); commit('main without footer');
  run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'merge', '--no-ff', '-m', 'merge side', 'side']);
  write('docs/reviews/SPEC-REVIEW-3-r1.md', 'review'); commit('spec result\n\nIssue: #3');
  write('phase.txt', 'review report'); commit('phase report\n\nIssue: #4\nDelivery-Phase: spec-review/v1');
  write('version.txt', 'version'); commit('release\n\nIssue: #5\nRelease: v2-beta.1');
  write('footerless.txt', 'real delivery'); const footerless = commit('executor forgot footer');
  const candidateSha = run(['rev-parse', 'HEAD']); write('late.txt', 'late'); const late = commit('later task\n\nIssue: #99');
  const membership = await buildCandidateMembership({ git, baseSha, candidateSha, tag: 'v2.0.0-beta.1', tasks: [
    { issue: 6, status: 'S8-merged', mergedSha: footerless }, { issue: 99, status: 'S8-merged', mergedSha: late },
    { issue: 100, status: 'S8-merged', mergedSha: baseSha }, { issue: 101, status: 'S7-code-review', mergedSha: footerless },
    { issue: 102, status: 'S8-merged', mergedSha: footerless, releaseTag: 'v1.9.0' },
  ] });
  assert.deepEqual(membership.issues.map(row => row.number), [1, 2, 6]);
  assert.deepEqual(membership.issues.find(row => row.number === 2).commits, [two]); assert.equal(membership.candidate, candidateSha);
  assert.notEqual(one, baseSha);
  const afterPruning = await buildCandidateMembership({ git, baseSha, candidateSha, tag: 'v2.0.0-beta.1', previousMembership: membership });
  assert.deepEqual(afterPruning.issues, membership.issues);
  const movedBase = await buildCandidateMembership({ git, baseSha: candidateSha, candidateSha: late, previousMembership: membership });
  assert.deepEqual(movedBase.issues.map(row => row.number), [99]);
});
test('missing milestone metadata is repairable later in its original cycle, without moving the task to the new cycle', async t => {
  const f = fixture(t); f.write('docs/release-ledger/cycle.json', JSON.stringify({ baseStable: 'v1.0.0', milestone: { number: 7 } }));
  const materialSha = f.commit('task');
  assert.equal((await readTaskReleaseMilestone({ git: f.git, materialSha, issue: 1 })).status, 'pending');
  f.write('docs/release-ledger/cycle.json', JSON.stringify({ baseStable: 'v2.0.0', milestone: { number: 8 } }));
  f.write('docs/release-ledger/v1.0.0/1.json', JSON.stringify({ issue: 1, baseStable: 'v1.0.0', category: 'major' }));
  const fallbackSha = f.commit('bookkeeping repair');
  const result = await readTaskReleaseMilestone({ git: f.git, materialSha, issue: 1, fallbackSha });
  assert.equal(result.status, 'ready'); assert.equal(result.milestone, 7); assert.equal(result.cycle.baseStable, 'v1.0.0');
});
test('version preparation plans first and updates all version sources together without publication', t => {
  const f = fixture(t); f.write('package.json', '{"version":"1.0.0"}');
  f.write('package-lock.json', '{"version":"1.0.0","packages":{"":{"version":"1.0.0"}}}');
  f.write('custom_components/houseplan/manifest.json', '{"version":"1.0.0","domain":"houseplan"}');
  f.write('custom_components/houseplan/const.py', 'VERSION = "1.0.0"\nOTHER = 2\n');
  f.write('src/houseplan-card.ts', 'const CARD_VERSION = "1.0.0";\n');
  f.write('src/houseplan-editor-runtime.ts', 'const CARD_VERSION = "1.0.0";\n');
  const plan = prepareReleaseVersions({ root: f.root, version: '2.0.0-beta.1' });
  assert.equal(plan.files.length, 6); assert.equal(JSON.parse(readFileSync(join(f.root, 'package.json'))).version, '1.0.0');
  prepareReleaseVersions({ root: f.root, version: '2.0.0-beta.1', write: true });
  const lock = JSON.parse(readFileSync(join(f.root, 'package-lock.json')));
  assert.equal(lock.version, '2.0.0-beta.1'); assert.equal(lock.packages[''].version, lock.version);
  assert.match(readFileSync(join(f.root, 'custom_components/houseplan/const.py'), 'utf8'), /OTHER = 2/);
  assert.deepEqual(prepareReleaseVersions({ root: f.root, version: '2.0.0-beta.1' }).files, []);
});
test('stable notes copy only the author-written current sections and candidate reads ignore later checkout edits', async t => {
  const f = fixture(t), tag = 'v2.0.0';
  f.write('package.json', '{"version":"2.0.0"}');
  f.write('docs/CHANGELOG.ru.md', '## v2.0.0 — date\n\n- Техническое изменение.\n');
  f.write('docs/CHANGELOG.md', '## v2.0.0 — date\n\n- Technical change.\n');
  f.write('docs/changelog_user_stable_ru.md', '<!-- release: v2.0.0 -->\n<!-- base: v1.0.0 -->\n## Релиз Houseplan 2.0.0\n\nАвторский текст.\n\n<!-- release: v1.0.0 -->\nold history\n');
  f.write('docs/changelog_user_stable_en.md', '<!-- release: v2.0.0 -->\n<!-- base: v1.0.0 -->\n## Houseplan 2.0.0 release\n\nAuthored text.\n\n<!-- release: v1.0.0 -->\nold history\n');
  f.write('docs/RELEASE-NOTES.md', 'old');
  const prepared = await prepareReleaseNotes({ root: f.root, kind: 'stable', tag, write: true });
  assert.match(prepared.body, /Авторский текст/); assert.match(prepared.body, /Authored text/); assert.doesNotMatch(prepared.body, /old history/);
  const candidateSha = f.commit('authored release'); f.write('docs/changelog_user_stable_ru.md', 'later bad edit');
  const result = await prepareReleaseData({ git: f.git, candidateSha, baseSha: f.baseSha, kind: 'stable', tag });
  assert.equal(result.body, prepared.body); assert.doesNotMatch(result.userChangelog.ru, /old history|later bad edit/);
  await assert.rejects(prepareReleaseData({ git: f.git, candidateSha, baseSha: f.baseSha, kind: 'stable', tag: 'v2.0.1' }), /tag differs/);
});
test('beta preparation refuses notes left over from a different release', async t => {
  const f = fixture(t), tag = 'v2.0.0-beta.1';
  f.write('docs/CHANGELOG.ru.md', `## ${tag}\n\n- Авторская запись.\n`);
  f.write('docs/CHANGELOG.md', `## ${tag}\n\n- Authored entry.\n`);
  f.write('docs/RELEASE-NOTES.md', '<!-- release: v1.0.0-beta.1 -->\nOld release prose.\n');
  await assert.rejects(prepareReleaseNotes({ root: f.root, kind: 'beta', tag }), /Author the beta RELEASE-NOTES/);
  f.write('docs/RELEASE-NOTES.md', `<!-- release: ${tag} -->\nАвторский текст. Authored prose.\n`);
  const result = await prepareReleaseNotes({ root: f.root, kind: 'beta', tag });
  assert.match(result.body, /Authored prose/);
});
test('public assets preserve tested ZIP/JS and publish exact membership and checksums without rebuilding', t => {
  const f = fixture(t); f.write('artifacts/houseplan.zip', 'checked ZIP'); f.write('artifacts/houseplan-card.js', 'checked JS');
  const sha = f.baseSha, zip = join(f.root, 'artifacts/houseplan.zip'), standalone = join(f.root, 'artifacts/houseplan-card.js');
  const candidate = { sha, tag: 'v2.0.0-beta.1', membership: { schema: 1, candidate: sha, base: null, issues: [{ number: 1, commits: [sha] }] } };
  const packageResult = { sourceSha: sha, zip, standalone, artifactDigest: digest(readFileSync(zip)), standaloneDigest: digest(readFileSync(standalone)) };
  const assets = preparePublicationArtifacts({ root: f.root, candidate, packageResult });
  assert.deepEqual(assets.map(asset => asset.name), ['houseplan.zip', 'houseplan-card.js', 'RELEASE-MEMBERSHIP.json', 'SHA256SUMS']);
  for (const asset of assets) assert.equal(asset.expectedDigest, digest(readFileSync(asset.path)));
  const sums = readFileSync(assets.at(-1).path, 'utf8'); assert.match(sums, /houseplan.zip/); assert.match(sums, /RELEASE-MEMBERSHIP.json/);
  f.write('artifacts/houseplan.zip', 'changed ZIP');
  assert.throws(() => preparePublicationArtifacts({ root: f.root, candidate, packageResult }), /changed after testing/);
  f.write('artifacts/houseplan.zip', 'checked ZIP'); f.write('artifacts/houseplan-card.js', 'changed JS');
  assert.throws(() => preparePublicationArtifacts({ root: f.root, candidate, packageResult }), /JS changed/);
});
