import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const OWNER = 'src/config-adoption.ts';

/**
 * #500 — one owner for config/layout identity.
 *
 * Revision and fingerprint of the server config and of the device layout are
 * written by `ConfigAdoption` and nowhere else: a revision taken apart from
 * the body it belongs to is how #490 F1 lost a concurrent edit. Bodies may
 * still be staged locally before a write (`_serverCfg = candidate`,
 * `_layout = { ...pos }`) — that is the editor's job — but only in the files
 * pinned below, and the counts are a ratchet: they may go down, never up.
 */

const tsFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return tsFiles(path);
  return name.endsWith('.ts') ? [path] : [];
});
const sources = tsFiles(join(repoRoot, 'src'))
  .map((path) => ({ file: relative(repoRoot, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }))
  .filter(({ file }) => file !== OWNER);

const IDENTITY_WRITE = /\b(?:_cfgRev|_layoutRev|_cfgContentFingerprint|_layoutContentFingerprint)\s*(?:=(?!=)|\+\+|--|\+=|-=)/g;
const BODY_WRITE = {
  _serverCfg: /\b_serverCfg\s*=(?!=)/g,
  _layout: /\b_layout\s*=(?!=)/g,
};

/**
 * Local staging of bodies before a write. Reading these numbers: the editor
 * replaces the working config for settings dialogs and marker saves; the card
 * stages device positions (`applyDevicePlacement`). Lowering a count is a
 * win to record here; raising one is a review finding.
 */
const BODY_STAGING_ALLOWLIST = {
  'src/houseplan-editor-runtime.ts': { _serverCfg: 5, _layout: 5 },
  'src/houseplan-card.ts': { _serverCfg: 3, _layout: 9 },
};

const count = (text, re) => (text.match(re) || []).length;

test('AC1: revision and fingerprint identity is written only by the owner', () => {
  const offenders = sources
    .flatMap(({ file, text }) => (text.match(IDENTITY_WRITE) || []).map((hit) => `${file}: ${hit.trim()}`));
  assert.deepEqual(offenders, [], 'a revision belongs to the body it came with — go through ConfigAdoption');
});

test('AC1: body staging outside the owner stays within the pinned files and counts (ratchet)', () => {
  const problems = [];
  for (const { file, text } of sources) {
    const pinned = BODY_STAGING_ALLOWLIST[file];
    for (const [field, re] of Object.entries(BODY_WRITE)) {
      const actual = count(text, re);
      const allowed = pinned?.[field] ?? 0;
      if (actual > allowed) problems.push(`${file}: ${field} assigned ${actual}×, allowed ${allowed}`);
      else if (actual < allowed) problems.push(`${file}: ${field} assigned ${actual}×, pin ${allowed} — lower the pin, keep the win`);
    }
  }
  assert.deepEqual(problems, []);
});

test('AC1: the harness seam `seedIdentity` is reachable only through the card delegate setters', () => {
  const callers = sources.filter(({ text }) => text.includes('seedIdentity('));
  assert.deepEqual(callers.map(({ file }) => file), ['src/houseplan-card.ts']);
  const lines = callers[0].text.split('\n').filter((line) => line.includes('seedIdentity('));
  assert.equal(lines.length, 4);
  for (const line of lines) assert.match(line.trim(), /^private set _(?:cfgRev|layoutRev|cfgContentFingerprint|layoutContentFingerprint)\(/);
});

test('AC2: the former host seam is gone and every module adopts through the one gated entry', () => {
  const seam = sources.filter(({ text }) => /\b_adoptStructuralResponses\b/.test(text)).map(({ file }) => file);
  assert.deepEqual(seam, [], '_adoptStructuralResponses must not come back as a host method');
  const adopters = sources.filter(({ text }) => /_adoptAuthoritative\(\{/.test(text)).map(({ file }) => file).sort();
  assert.deepEqual(adopters, [
    'src/houseplan-card.ts',
    'src/houseplan-editor-runtime.ts',
    'src/houseplan-onboarding-runtime.ts',
    'src/summary-panel-runtime-loaded.ts',
  ]);
  const owner = readFileSync(join(repoRoot, OWNER), 'utf8');
  for (const reason of ['structural-response', 'config-reload', 'summary-recovery', 'space-delete', 'optimize-undo', 'import-apply']) {
    assert.ok(owner.includes(`'${reason}'`), `${reason} is a declared adoption reason`);
    assert.ok(sources.some(({ text }) => text.includes(`reason: '${reason}'`)), `${reason} has a caller`);
  }
});

test('AC2: feature-runtime host contracts expose one adoption method, not its eight steps', () => {
  const summaryHost = readFileSync(join(repoRoot, 'src/summary-panel-host.ts'), 'utf8');
  for (const step of [
    '_beginContinuityCandidate', '_syncDecorAssets', '_adoptInitialSpace', '_resumePendingNavMode',
    '_candidateBackdrop', '_scheduleLoadRetry', '_signer', '_continuity', '_cfgContentFingerprint',
  ]) {
    assert.ok(!summaryHost.includes(step), `SummaryPanelHost must not expose ${step}`);
  }
  assert.match(summaryHost, /_adoptAuthoritative\(input: GatedAdoptionInput\)/);
  const editorPort = readFileSync(join(repoRoot, 'src/houseplan-editor-runtime.ts'), 'utf8');
  assert.match(editorPort, /readonly _cfgRev: number;/);
  assert.match(editorPort, /readonly _layoutRev: number;/);
  assert.match(editorPort, /readonly _adoption: ConfigAdoption;/);
  const rollbackCallers = sources.filter(({ text }) => /(?<![_\w])rollbackOptimistic\(/.test(text)).map(({ file }) => file).sort();
  assert.deepEqual(rollbackCallers, ['src/houseplan-card.ts'], 'only the host wrapper reaches the owner\'s rollback');
});
