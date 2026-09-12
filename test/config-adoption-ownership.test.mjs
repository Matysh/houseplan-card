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
    'src/config-reload-authority.ts',
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

test('#520: the adoption bodies are not declared as Lit reactive properties', () => {
  // One owner of the reactivity, not two. Lit marks a declared property whose
  // prototype already has an accessor as `wrapped` and force-writes it into
  // `changedProperties` on the FIRST update with an `undefined` old value —
  // even when nobody assigned anything. That is harmless only by coincidence
  // (body and `_cfgEpochPreservedConfig` are both null at that moment); an
  // earlier config, such as the warm cache, turns it into a spurious epoch.
  // The bodies stay reactive through
  // `_adoption` → `onBodyReplaced` → `requestUpdate`, which needs no declaration.
  const card = readFileSync(join(repoRoot, 'src/houseplan-card.ts'), 'utf8');
  const block = card.slice(card.indexOf('static properties = {'));
  const declarations = block.slice(0, block.indexOf('\n  };'));
  for (const body of ['_serverCfg', '_layout']) {
    assert.ok(!new RegExp(`^\\s*${body}:`, 'm').test(declarations),
      `${body} must not be declared in static properties (#520)`);
  }
  // The delegates and the notification that replace the declaration are here.
  assert.match(card, /private get _serverCfg\(\)/);
  assert.match(card, /private get _layout\(\)/);
  assert.match(card, /\(field, previous\) => this\.requestUpdate\(field, previous\)/);
});

test('#520: the authoritative load keeps viewport, readiness and devices inside the adoption task', () => {
  // The cold-start regression of #520: `await this._adoptAuthoritative(...)`
  // hands control to Lit, which paints the adopted config; the device seeding
  // that follows writes the config back (new devices, hidden filter), so the
  // plan gets a second config epoch, a second model build and a second paint
  // — 18/3/3 update cycles, model builds and epochs became 19/4/4, ~550 ms of
  // the first stable frame. Everything that touches the adopted config must
  // therefore run in `afterAdopt`, which the sequence calls in its own task.
  const card = readFileSync(join(repoRoot, 'src/houseplan-card.ts'), 'utf8');
  const load = card.slice(card.indexOf('private async _loadFromServer('));
  const body = load.slice(0, load.indexOf('\n  /** Best-effort live sync'));
  const hook = body.indexOf('afterAdopt: () => {');
  const awaited = body.indexOf('await this._adoptAuthoritative(');
  assert.ok(awaited >= 0 && hook > awaited, '_loadFromServer adopts through the hook');
  const inHook = body.slice(hook, body.indexOf('\n      });', hook));
  assert.match(inHook, /this\._loadOk = true;/, 'readiness is set before the devices are seeded');
  assert.match(inHook, /rebuildDevices\(\);/);
  assert.match(inHook, /this\._restoreZoom\(\);/, 'the viewport is restored before the first paint');
  // Nothing may rebuild the devices after the await: the tail only covers the
  // attempts that never adopted.
  const afterHook = body.slice(body.indexOf('\n      });', hook));
  assert.doesNotMatch(afterHook, /^\s*this\._maybeRebuildDevices\(\);/m,
    'an unguarded rebuild after the await is the regression itself');
  assert.match(afterHook, /if \(!devicesRebuilt\) rebuildDevices\(\);/);
  // The config reload takes the same route.
  const reloadOwner = readFileSync(join(repoRoot, 'src/config-reload-authority.ts'), 'utf8');
  const reload = reloadOwner.slice(reloadOwner.indexOf('export async function reloadConfigOnly('));
  const reloadCall = reload.slice(reload.indexOf('await host._adoptAuthoritative('), reload.indexOf('if (adopted.status'));
  assert.match(reloadCall, /afterAdopt: \(\) => \{ host\._regSignature = ''; host\._maybeRebuildDevices\(\); \}/);
});

test('#520: the adoption sequence closes with the caller hook, synchronously', () => {
  const owner = readFileSync(join(repoRoot, OWNER), 'utf8');
  const gated = owner.slice(owner.indexOf('export async function adoptAuthoritativeGated('));
  const hook = gated.indexOf('input.afterAdopt?.();');
  const ret = gated.indexOf("return { status: 'adopted'");
  assert.ok(hook > 0 && ret > hook, 'afterAdopt runs last, before the promise resolves');
  assert.doesNotMatch(gated.slice(hook, ret), /await|then\(/, 'no await may separate the hook from the adoption');
});
