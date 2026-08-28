import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  assertReleaseContract,
  changelogContainsVersion,
  parseVersionSources,
  validateReleaseNotes,
  validateVersionSources,
  versionFromTag,
} from '../scripts/release-contract.mjs';
import {
  assertHacsDiscoverableTag, parseIssueList, parsePrereleaseArgs, prereleaseWorkflowSucceeded,
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
  const result = assertReleaseContract({ tag, repo, requirePrerelease: packageIsPrerelease });
  assert.equal(result.version, packageVersion);
  assert.equal(result.prerelease, packageIsPrerelease);
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
    assets: [{ name: 'houseplan-card.js', size: 10 }, { name: 'houseplan.zip', size: 20 }],
  };
  assert.equal(verifyReleaseProjection(release, { tag }), release);
  assert.throws(
    () => verifyReleaseProjection({ ...release, isDraft: true }, { tag }),
    /still a draft/,
  );
  assert.throws(
    () => verifyReleaseProjection({ ...release, assets: release.assets.slice(0, 1) }, { tag }),
    /houseplan\.zip/,
  );
  assert.equal(prereleaseWorkflowSucceeded('Release', 'success'), true);
  assert.equal(prereleaseWorkflowSucceeded('Announce release', 'skipped'), true);
  assert.equal(prereleaseWorkflowSucceeded('Release', 'skipped'), false);
  assert.equal(prereleaseWorkflowSucceeded('Announce release', 'failure'), false);
  const orchestrator = readFileSync(
    new URL('../scripts/release-prerelease.mjs', import.meta.url), 'utf8',
  );
  assert.match(
    orchestrator,
    /if \(!prereleaseWorkflowSucceeded\(label, row\.conclusion\)\)/,
    'the workflow waiter must use the prerelease-aware conclusion policy',
  );
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
    const committedResult = spawnSync('git', ['show', 'HEAD:dist/houseplan-card.js'], {
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
    'node scripts/release-gate.mjs',
    '--draft --prerelease',
    "'houseplan-card.js', 'houseplan.zip'",
    '--draft=false --prerelease',
    'Verify HACS prerelease discovery order',
    'group: publish-prerelease-${{ inputs.tag }}',
    "if: ${{ needs.publish.outputs.newly_published == 'true' }}",
    'uses: ./.github/workflows/announce.yml',
  ]) assert.ok(workflow.includes(required), `missing workflow contract: ${required}`);
  assert.ok(workflow.indexOf('gh release upload') < workflow.indexOf('--draft=false --prerelease'));

  const announce = readFileSync(new URL('../.github/workflows/announce.yml', import.meta.url), 'utf8');
  assert.ok(announce.includes('workflow_call:'));
  assert.ok(announce.includes('if: ${{ inputs.reusable == true }}'));
  assert.ok(announce.includes('CALLED: ${{ inputs.reusable }}'));
  assert.ok(announce.includes('BODY=$(cat docs/RELEASE-NOTES.md)'));
  assert.ok(announce.includes("github.event_name == 'release' && github.event.release.prerelease == false"));
  assert.ok(announce.includes("github.event_name == 'workflow_call' && inputs.prerelease == false"));
  assert.ok(announce.includes('Prerelease Telegram announcement is disabled'));

  const local = readFileSync(new URL('../scripts/release-prerelease.mjs', import.meta.url), 'utf8');
  assert.ok(local.includes("'core.autocrlf=false', 'archive', '--format=zip'"));
  assert.ok(local.includes("'release', 'download'"));
  assert.ok(local.includes("'release-zip.yml'"));
  assert.ok(local.includes('Published release needs stale-asset recovery'));
  assert.ok(local.includes("['SIGINT'"));
  assert.ok(!local.includes("run('tar'"));
});
