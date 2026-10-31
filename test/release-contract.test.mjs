import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { milestoneLink } from '../scripts/release-ledger.mjs';
import { readStableFieldDecision } from '../scripts/stable-field-decision.mjs';
import { narrativeLanguages } from '../scripts/release-narrative.mjs';
import { TELEGRAM_LIMIT } from '../scripts/telegram-release.mjs';
import {
  assertReleaseContract,
  changelogContainsVersion,
  parseVersionSources,
  validateReleaseNotes,
  validateVersionSources,
  versionFromTag,
} from '../scripts/release-contract.mjs';
import {
  assertHacsDiscoverableTag, parseIssueList, parsePrereleaseArgs,
  readZipEntries, verifyReleaseProjection,
} from '../scripts/release-prerelease.mjs';

const repo = 'Matysh/houseplan-card';
const packageVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;
const tag = `v${packageVersion}`;
const packageIsPrerelease = packageVersion.includes('-');
const notes = `<!-- release: ${tag} -->

## Основное
- Значимое изменение.
- Мелкие исправления и улучшения.

## Highlights
- Significant change.
- Small fixes and improvements.

[RU](https://github.com/${repo}/blob/${tag}/docs/CHANGELOG.ru.md)
[EN](https://github.com/${repo}/blob/${tag}/docs/CHANGELOG.md)
`;

test('release SemVer parser accepts prereleases and rejects unsafe tags', () => {
  assert.deepEqual(versionFromTag(tag), { version: packageVersion, prerelease: packageIsPrerelease });
  assert.deepEqual(versionFromTag('v2.0.0'), { version: '2.0.0', prerelease: false });
  assert.throws(() => versionFromTag('1.2.3-beta.1'), /start with v/);
  assert.throws(() => versionFromTag('v1.2.3-beta.01'), /leading zeroes/);
  assert.throws(() => validateVersionSources('v1.2.3', { source: '1.2.3' }), /requires a prerelease/);
});

test('HACS prerelease naming switches from beta.9 to rc.1', () => {
  assert.equal(assertHacsDiscoverableTag('v1.62.0-beta.9'), 'v1.62.0-beta.9');
  assert.equal(assertHacsDiscoverableTag('v1.62.0-rc.1'), 'v1.62.0-rc.1');
  assert.throws(
    () => assertHacsDiscoverableTag('v1.62.0-beta.10'),
    /not HACS-discoverable.*use rc\.1/,
  );
});

test('version sources include every shipped authority and must match the tag', () => {
  const sources = parseVersionSources({
    packageJson: '{"version":"1.2.3-beta.4"}',
    packageLock: '{"version":"1.2.3-beta.4","packages":{"":{"version":"1.2.3-beta.4"}}}',
    manifest: '{"version":"1.2.3-beta.4"}',
    constSource: 'VERSION = "1.2.3-beta.4"',
    cardSource: "const CARD_VERSION = '1.2.3-beta.4';",
    editorRuntimeSource: "const CARD_VERSION = '1.2.3-beta.4';",
  });
  assert.equal(Object.keys(sources).length, 7);
  assert.equal(validateVersionSources('v1.2.3-beta.4', sources).version, '1.2.3-beta.4');
  assert.throws(
    () => validateVersionSources('v1.2.3-beta.4', {
      ...sources, 'src/houseplan-editor-runtime.ts': '1.2.3-beta.3',
    }),
    /src\/houseplan-editor-runtime\.ts="1\.2\.3-beta\.3"/,
  );
  assert.throws(
    () => validateVersionSources('v1.2.3-beta.5', sources),
    /Version 1\.2\.3-beta\.5 is not synchronized/,
  );
});

test('release notes enforce the canonical bilingual short body and pinned links', () => {
  assert.equal(validateReleaseNotes(notes, { tag, repo }).trim(), notes.trim());
  assert.throws(
    () => validateReleaseNotes(notes.replace('## Основное', '## Русский'), { tag, repo }),
    /Legacy release-note headings/,
  );
  assert.throws(
    () => validateReleaseNotes(notes.replace('## Highlights', '## English\n\n## Highlights'), { tag, repo }),
    /Legacy release-note headings/,
  );
  assert.throws(
    () => validateReleaseNotes(notes.replace(`<!-- release: ${tag} -->`, '<!-- release: v9.9.9 -->'), { tag, repo }),
    /exact .* marker/,
  );
  assert.throws(
    () => validateReleaseNotes(notes.replace('## Основное', '- premature\n\n## Основное'), { tag, repo }),
    /before ## Основное/,
  );
  assert.throws(
    () => validateReleaseNotes(notes.replace(`/blob/${tag}/`, '/blob/dev/'), { tag, repo }),
    /immutable/,
  );
  assert.throws(
    () => validateReleaseNotes(notes.replace('- Significant change.\n', ''), { tag, repo }),
    /equivalent RU\/EN lists/,
  );
  const oversized = notes
    .replace('\n## Highlights', '\n- Second.\n- Third.\n- Fourth.\n\n## Highlights')
    .replace('## Highlights\n', '## Highlights\n- Second.\n- Third.\n- Fourth.\n');
  assert.throws(() => validateReleaseNotes(oversized, { tag, repo }), /at most four bullets/);
  assert.equal(changelogContainsVersion(`## ${tag} — 2026-08-10\n\n- Released.\n`, tag), true);
  assert.equal(changelogContainsVersion(`## ${tag}\n`, tag), false);
  assert.equal(changelogContainsVersion(`## ${tag} — 2026-99-99\n\n- Released.\n`, tag), false);
  assert.equal(changelogContainsVersion(`## ${tag} — 2026-08-10\n`, tag), false);
  assert.equal(changelogContainsVersion(`\`\`\`md\n## ${tag} — 2026-08-10\n- Fake.\n\`\`\``, tag), false);
  const nested = notes.replace('- Значимое изменение.', '- Значимое изменение.\n  - Деталь реализации.');
  assert.equal(validateReleaseNotes(nested, { tag, repo }).trim(), nested.trim());
});

test('current repository release metadata satisfies its own publication contract', () => {
  const result = assertReleaseContract({ tag, repo, requirePrerelease: packageIsPrerelease,
    verifyPublishedStable: true });
  assert.equal(result.version, packageVersion);
  assert.equal(result.prerelease, packageIsPrerelease);
});

test('#838/#917 real candidate contract checks publication and previous-stable metadata across cycles', async (t) => {
  // Keep the complete publication/version-authority fixture with its contract tests.
  // Narrative-unit tests operate on exported behaviour, not frontend source paths.
  const tag = 'v1.81.0', repo = 'x/y';
  const cycle = { schema: 1, baseStable: 'v1.80.1', targetStable: tag, milestone: { number: 3, title: '1.81.0' } };
  const entries = [{ issue: 1, category: 'major' }, { issue: 2, category: 'stable-fix' }, { issue: 3, category: 'line-fix' }, { issue: 4, category: 'infra' }];
  const body = `Теперь редактировать план удобнее.\n\n🧱 **Новая возможность.** Двигайте стены. [#1](https://github.com/${repo}/issues/1)\n\nТакже устранены задержки существовавшего редактора.\n\n[Все изменения](${milestoneLink(repo, cycle)})`;
  const mixed = `<!-- release: ${tag} -->\n<!-- stable-notes: 1 -->\n<!-- base: v1.80.1 -->\n<!-- language: ru -->\n## Релиз Houseplan 1.81.0\n\n${body}\n<!-- language: en -->\n## Houseplan 1.81.0 release\n\n${body}\n`;
  const root = mkdtempSync(join(tmpdir(), 'hp-narrative-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@x', ...args], { encoding: 'utf8' });
  git('init', '-q');
  write('docs/release-ledger/cycle.json', JSON.stringify(cycle));
  git('add', '.'); git('commit', '-qm', 'base'); git('tag', cycle.baseStable);
  for (const row of entries) write(`docs/release-ledger/v1.80.1/${row.issue}.json`, JSON.stringify({
    schema: 1, baseStable: cycle.baseStable, rationale: 'Evidence relative to previous stable',
    summary: { ru: 'Факт', en: 'Fact' }, ...(row.category === 'line-fix' ? { introducedBy: 1 } : {}), ...row,
  }));
  git('add', '.'); git('commit', '-qm', entries.map((row) => `Issue: #${row.issue}`).join('\n'));
  const version = tag.slice(1);
  write('package.json', JSON.stringify({ version }));
  write('package-lock.json', JSON.stringify({ version, packages: { '': { version } } }));
  write('custom_components/houseplan/manifest.json', JSON.stringify({ version }));
  write('custom_components/houseplan/const.py', `VERSION = "${version}"`);
  write('src/houseplan-card.ts', `const CARD_VERSION = "${version}"`);
  write('src/houseplan-editor-runtime.ts', `const CARD_VERSION = "${version}"`);
  const changelog = (body) => `## ${tag} — 2026-10-09\n\n${body}\n`;
  const installNotes = (text) => {
    const { ru, en } = narrativeLanguages(text, { tag });
    write('docs/RELEASE-NOTES.md', text);
    write('docs/changelog_user_stable_ru.md', `<!-- release: ${tag} -->\n<!-- base: v1.80.1 -->\n${ru}\n`);
    write('docs/changelog_user_stable_en.md', `<!-- release: ${tag} -->\n<!-- base: v1.80.1 -->\n${en}\n`);
    write('docs/CHANGELOG.ru.md', changelog('- Техническая история остаётся отдельной.'));
    write('docs/CHANGELOG.md', changelog('- Technical history remains separate.'));
  };
  installNotes(mixed);
  git('add', '.'); git('commit', '-qm', `Release: ${tag}\nIssue: #1`);
  assert.equal(assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }).version, version);
  write('docs/changelog_user_stable_ru.md', `<!-- release: ${tag} -->\n<!-- base: v1.80.1 -->\n## Релиз Houseplan 1.81.0\n\nРазошедшийся текст.\n`);
  assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }), /exact authored/);
  installNotes(mixed);
  write('docs/changelog_user_stable_en.md', '# Missing English release');
  assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }), /exactly one/);
  installNotes(mixed);
  write('docs/RELEASE-NOTES.md', mixed.replace('Двигайте стены.', 'Несогласованный текст.'));
  assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }), /exact authored/);
  installNotes(mixed.replaceAll('Теперь редактировать план удобнее.', 'я'.repeat(TELEGRAM_LIMIT)));
  assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }), /agent must shorten/);

  // Ordinary inputs in an isolated repository: no source, guard or budget mutation.
  installNotes(mixed);
  git('add', '.'); git('commit', '--allow-empty', '-qm', 'published stable metadata');
  const published = git('rev-parse', 'HEAD').trim();
  git('tag', tag);
  const nextCycle = { schema: 1, baseStable: tag, targetStable: 'v1.82.0', milestone: { number: 7, title: '1.82.0' } };
  write('docs/release-ledger/cycle.json', JSON.stringify(nextCycle));
  git('add', '.'); git('commit', '-qm', 'open next accounting cycle');
  const verify = () => assertReleaseContract({ root, tag, repo, requirePrerelease: false,
    verifyPublishedStable: true });
  await t.test('#917 published stable uses its own reachable catalogue; new publication stays strict', () => {
    assert.equal(verify().version, version);
    assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false }), /Cycle target/);
    assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false, requireStable: true }), /Cycle target/);
    assert.throws(() => assertReleaseContract({ root, tag, repo, requirePrerelease: false,
      requireStable: true, verifyPublishedStable: true }), /cannot authorize stable publication/);
    assert.throws(() => assertReleaseContract({ root, tag: 'v1.80.1', repo, requirePrerelease: false,
      verifyPublishedStable: true }), /not synchronized/);
  });
  await t.test('#917 even jointly reauthored current notes cannot rewrite the published previous stable', () => {
    installNotes(mixed.replaceAll('Двигайте стены.', 'Новый, не опубликованный текст.'));
    assert.throws(verify, /immutable tag/);
    installNotes(mixed);
    write('docs/changelog_user_stable_en.md', '# Missing English release');
    assert.throws(verify, /exactly one/);
    installNotes(mixed);
    assert.equal(verify().version, version);
  });
  await t.test('#917 missing or unrelated stable tags cannot become historical authority', () => {
    git('tag', '-d', tag);
    assert.throws(verify, /Command failed/);
    const unrelated = git('commit-tree', 'HEAD^{tree}', '-m', 'unrelated root').trim();
    git('tag', tag, unrelated);
    assert.throws(verify, /Command failed/);
    git('tag', '-d', tag); git('tag', tag, published);
    assert.equal(verify().version, version);
  });
});

test('local orchestrator validates issue lists and public release assets', () => {
  assert.deepEqual(parseIssueList('63, 56,63'), [63, 56]);
  assert.throws(() => parseIssueList('63,nope'), /positive issue numbers/);
  assert.deepEqual(parsePrereleaseArgs([tag, '--issues=63,64', '--yes']), {
    tag, repo, branch: 'dev', issueOption: '63,64',
    checkOnly: false, confirmed: true,
  });
  assert.throws(() => parsePrereleaseArgs([tag, '--isues=63']), /Unknown or malformed/);
  // Project v2 больше не используется: опция снята вместе с синхронизацией
  // статуса, и её молчаливое принятие обещало бы работу, которой нет.
  assert.throws(() => parsePrereleaseArgs([tag, '--project=1']), /Unknown or malformed/);
  assert.throws(() => parsePrereleaseArgs([tag, 'extra']), /Exactly one/);
  const release = {
    tagName: tag, isDraft: false, isPrerelease: true,
    assets: [
      { name: 'houseplan-card.js', size: 10 },
      { name: 'houseplan.zip', size: 20 },
      { name: 'RELEASE-MEMBERSHIP.json', size: 30 },
      { name: 'SHA256SUMS', size: 5 },
    ],
  };
  assert.equal(verifyReleaseProjection(release, { tag }), release);
  assert.throws(
    () => verifyReleaseProjection({ ...release, isDraft: true }, { tag }),
    /still a draft/,
  );
  assert.throws(
    () => verifyReleaseProjection({ ...release, assets: release.assets.filter((a) => a.name !== 'houseplan.zip') }, { tag }),
    /houseplan\.zip/,
  );
  // #540: паспорт — часть единого вида релиза; бета без него неполна.
  assert.throws(
    () => verifyReleaseProjection({
      ...release, assets: release.assets.filter((asset) => asset.name !== 'SHA256SUMS'),
    }, { tag }),
    /SHA256SUMS/,
  );
  const orchestrator = readFileSync(
    new URL('../scripts/release-prerelease.mjs', import.meta.url), 'utf8',
  );
  // #540: после публикации никто не ждёт независимых републикаторов — их нет.
  assert.ok(!/waitForReleaseWorkflows|release-zip\.yml|prereleaseWorkflowSucceeded/.test(orchestrator),
    'the local publisher no longer waits for release.yml/release-zip.yml to re-upload what it already verified');
  assert.match(orchestrator, /formatSums\(\{\n\s+'houseplan-card\.js': sha256Path\(bundlePath\),\n\s+'houseplan\.zip': sha256Path\(zipPath\),\n\s+\[MEMBERSHIP_FILE\]: sha256Path\(membershipPath\),/,
    'the passport is computed from the very files that are uploaded');
  assert.match(orchestrator, /'release', 'upload', tag, bundlePath, zipPath, membershipPath, sumsPath,/);
});

test('release ZIP inspection is portable and does not depend on tar', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), 'houseplan-zip-test-'));
  const zip = join(temp, 'houseplan.zip');
  try {
    const archived = spawnSync('git', [
      '-c', 'core.autocrlf=false', 'archive', '--format=zip', `--output=${zip}`,
      'HEAD:custom_components/houseplan',
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(archived.status, 0, archived.stderr || archived.stdout);
    const entries = readZipEntries(zip, ['manifest.json', 'frontend/houseplan-card.js']);
    assert.equal(typeof JSON.parse(entries.get('manifest.json').toString('utf8')).version, 'string');
    const entry = entries.get('frontend/houseplan-card.js');
    // #337 deliberately turns the public entry into a tiny bootstrap; the
    // manifest-driven verifier owns completeness of its hashed asset tree.
    assert.ok(entry.length > 100);
    assert.match(entry.toString('utf8'), /__HOUSEPLAN_BUILD_FINGERPRINT__/);
    const committedResult = spawnSync('git', ['show', 'HEAD:custom_components/houseplan/frontend/houseplan-card.js'], {
      cwd: root,
      // The production bundle is larger than Node's spawnSync default buffer.
      // A truncated stdout can still be non-empty and produce a misleading
      // hash mismatch, especially while the test runner executes in parallel.
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(committedResult.status, 0, committedResult.error?.message);
    const committed = committedResult.stdout;
    const hash = (contents) => createHash('sha256').update(contents).digest('hex');
    assert.equal(hash(entries.get('frontend/houseplan-card.js')), hash(committed));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('prerelease CLI reports malformed arguments without a raw stack trace', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const result = spawnSync(process.execPath, [
    'scripts/release-prerelease.mjs', tag, '--isues=63',
  ], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^prerelease publication failed: Unknown or malformed option:/);
  assert.doesNotMatch(result.stderr, /\n\s+at\s/);
});

test('prerelease CLI can buffer the committed release bundle', () => {
  const orchestrator = readFileSync(
    new URL('../scripts/release-prerelease.mjs', import.meta.url), 'utf8',
  );
  assert.match(orchestrator, /SUBPROCESS_MAX_BUFFER = 64 \* 1024 \* 1024/);
  assert.equal(
    [...orchestrator.matchAll(/maxBuffer: SUBPROCESS_MAX_BUFFER/g)].length,
    2,
    'both text and byte subprocess readers must override the Node default buffer',
  );
});

test('manual publish workflow is draft-first, exact-SHA gated and self-contained', () => {
  const workflow = readFileSync(new URL('../.github/workflows/publish-prerelease.yml', import.meta.url), 'utf8');
  for (const required of [
    'workflow_dispatch:',
    'node scripts/release-contract.mjs',
    'node scripts/workflow-pending.mjs',
    '--draft --prerelease',
    "'houseplan-card.js', 'houseplan.zip', 'RELEASE-MEMBERSHIP.json', 'SHA256SUMS'",
    'test -s dist/houseplan-panel.js',
    'node scripts/release-assets.mjs sums release-assets --include-membership',
    'node scripts/release-assets.mjs check public release-assets/SHA256SUMS',
    'git -c core.autocrlf=false archive --format=zip --output=houseplan.zip',
    '--draft=false --prerelease',
    'Verify HACS prerelease discovery order',
    'group: publish-prerelease-${{ inputs.tag }}',
    "if: ${{ needs.publish.outputs.newly_published == 'true' }}",
    'uses: ./.github/workflows/announce.yml',
  ]) assert.ok(workflow.includes(required), `missing workflow contract: ${required}`);
  assert.ok(workflow.includes('node scripts/release-membership.mjs create'));
  assert.ok(workflow.includes('node scripts/release-bookkeeping.mjs'));
  assert.ok(workflow.includes('release is already public and byte-identical; publication skipped'));
  assert.ok(!workflow.includes('--author Matysh'));
  const closeJob = workflow.slice(workflow.indexOf('  close-merged:'), workflow.indexOf('  announce:'));
  assert.ok(!closeJob.includes('newly_published'), 'verified retries must resume bookkeeping');
  assert.ok(!closeJob.includes('gh issue list'), 'closing is manifest-driven, never a fresh S8 snapshot');
  assert.ok(workflow.indexOf('gh release upload') < workflow.indexOf('--draft=false --prerelease'));

  const announce = readFileSync(new URL('../.github/workflows/announce.yml', import.meta.url), 'utf8');
  assert.ok(announce.includes('workflow_call:'));
  assert.ok(announce.includes('ref: ${{ inputs.ref || github.sha }}'));
  assert.ok(announce.includes('CALLED: ${{ inputs.reusable }}'));
  assert.ok(announce.includes('node scripts/telegram-release.mjs'));
  assert.ok(announce.includes('--data-binary'));
  assert.ok(!announce.includes('head -c'), 'authored Unicode and links must never be byte-truncated');
  // #538: условия на событие релиза больше нет и быть не должно — анонс
  // вызывается только после выкладки ассетов. Пинится обратное: ветка события
  // не вернулась.
  assert.ok(!announce.includes("github.event_name == 'release'"));
  assert.ok(announce.includes("github.event_name == 'workflow_call' && inputs.prerelease == false"));
  assert.ok(announce.includes('Prerelease Telegram announcement is disabled'));

  const local = readFileSync(new URL('../scripts/release-prerelease.mjs', import.meta.url), 'utf8');
  assert.ok(local.includes("'core.autocrlf=false', 'archive', '--format=zip'"));
  assert.ok(local.includes("'release', 'download'"));
  assert.ok(!local.includes("'release-zip.yml'"), '#540: no republisher to wait for');
  assert.ok(local.includes('Published release needs stale-asset recovery'));
  assert.ok(local.includes("['SIGINT'"));
  assert.ok(!local.includes("run('tar'"));
});

// #916: version-only promotion belongs to this existing release version-source
// fixture reader. The frozen monolith-reader inventory is unchanged.
{
const tag = 'v1.81.0', beta = `${tag}-beta.4`, version = tag.slice(1), testedSha = 'c'.repeat(40);
const decision = { schema: 1, tag, testedTag: beta, testedSha, issue: 916, productEquivalent: true };
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-promotion-916-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@test', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@test' };
  const git = args => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  const put = (path, value) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), value); };
  const commit = () => { git(['add', '.']); git(['commit', '-qm', 'fixture']); };
  const versions = value => {
    put('package.json', JSON.stringify({ version: value, dependencies: { unchanged: '1.0.0' } }));
    put('package-lock.json', JSON.stringify({ version: value, packages: { '': { version: value }, dep: { version: '1.0.0' } } }));
    put('custom_components/houseplan/manifest.json', JSON.stringify({ domain: 'houseplan', version: value }));
    put('custom_components/houseplan/const.py', `VERSION = '${value}'\nUNCHANGED = True\n`);
    put('src/houseplan-card.ts', `const CARD_VERSION = '${value}';\nexport const card = true;\n`);
    put('src/houseplan-editor-runtime.ts', `const CARD_VERSION = '${value}';\nexport const editor = true;\n`);
  };
  git(['init', '-q', '-b', 'dev']); versions(beta.slice(1));
  put('src/device.ts', 'export const device = true;');
  put('scripts/css-template-minifier.mjs', 'export const minifier = true;');
  commit(); const base = git(['rev-parse', 'HEAD']); git(['tag', beta]);
  versions(version);
  put(`docs/release-ledger/field-decisions/${tag}.json`, JSON.stringify({ ...decision, testedSha: base }));
  put('scripts/release-ledger.mjs', 'export const bookkeepingOnly = true;');
  commit();
  return { root, git, put, commit, base, read: () => readStableFieldDecision({ root, git, candidate: 'HEAD', version }) };
}

test('#916 promotion proves every product byte unchanged except the seven exact version values', t => {
  const f = fixture(t); const result = f.read();
  assert.equal(result.productEquivalent, true); assert.equal(result.testedSha, f.base);
  assert.ok(result.changes.includes('package-lock.json'));
  assert.equal(readStableFieldDecision({ root: f.root, git: f.git, candidate: 'HEAD', version: '1.81.1' }), null);
  assert.equal(readStableFieldDecision({ root: f.root, git: f.git, candidate: 'HEAD', version: '1.81.0-rc.1' }), null);
  f.git(['tag', '-f', beta]);
  assert.throws(f.read, /tag changed/);
});

for (const [path, value] of [
  ['src/device.ts', 'export const device = false;'],
  ['package.json', JSON.stringify({ version, dependencies: { unchanged: '2.0.0' } })],
  ['package-lock.json', JSON.stringify({ version, packages: { '': { version }, dep: { version: '2.0.0' } } })],
  ['custom_components/houseplan/manifest.json', JSON.stringify({ domain: 'other', version })],
  ['src/houseplan-card.ts', `const CARD_VERSION = '${version}';\nexport const card = false;\n`],
  ['custom_components/houseplan/const.py', `VERSION = '${version}'\nUNCHANGED = False\n`],
  ['scripts/css-template-minifier.mjs', 'export const minifier = false;'],
  ['scripts/unknown-builder.mjs', 'export const unknown = true;'],
  ['demo/golden/changed.mjs', 'export const capture = true;'],
  ['.nvmrc', '24.0.0'],
]) test(`#916 owner-tested promotion refuses changed product/dependency/build/capture input: ${path}`, t => {
  const f = fixture(t); f.put(path, value); f.commit();
  assert.throws(f.read, /Product changed|Unreviewed product\/build\/capture/);
});
}
