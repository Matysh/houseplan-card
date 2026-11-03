/**
 * The product's declared DOM test contract (houseplan-card#489, #1011) at
 * run time: selector construction validated against the vendored copy, and
 * gating by what the installed product itself declares.
 *
 * The vendored copy (`contract/data-hp-contract.json`, `npm run
 * contract:sync`) is the newest contract the scenarios are written against.
 * The product under test may be older — the nightly runs the latest release,
 * the upgrade suite the previous stable, a 1.82.x hotfix gate a candidate
 * without the 1.83 hooks. The installer stores the contract of the installed
 * ref next to it (`run/.e2e-contract.json`); a scenario whose hooks that
 * contract does not declare is skipped with the reason in the report — never
 * run against a build that cannot satisfy it, never silently passed. Gating
 * by the contract and not by version strings matters: a `dev` snapshot carries
 * the previous release's version (houseplan-card#1010).
 */
import { existsSync, readFileSync } from 'node:fs';
import { compareTags } from '../../scripts/tags.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTRACT = JSON.parse(readFileSync(resolve(ROOT, 'contract/data-hp-contract.json'), 'utf8'));

const runDir = () => process.env.E2E_RUN_DIR || resolve(ROOT, 'run');

/**
 * The installed product's contract and run record; null when unknown (a
 * foreign HA_URL without a run directory) — then nothing is skipped.
 */
export function installedContract() {
  const file = resolve(runDir(), '.e2e-contract.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function installedRecord() {
  const file = resolve(runDir(), '.e2e-houseplan.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/** Does `contract` declare `name` (and, with `name@attr`, that attribute)? */
export function declares(contract, spec) {
  const [name, attr] = spec.split('@');
  const hook = contract?.hooks?.[name];
  if (!hook) return false;
  return !attr || !!(hook.attributes?.[attr] || hook.attributeMetadata?.[attr]);
}

/** Does `contract` list `value` among the values of `hook@attr` (an action id, say)? */
export function declaresValue(contract, spec, value) {
  const [name, attr] = spec.split('@');
  const values = contract?.hooks?.[name]?.attributes?.[attr];
  return Array.isArray(values) && values.includes(value);
}

/**
 * houseplan-card#1033: the installed product repairs an opening off its wall
 * on import (and lists the repaired ones under `backup-openings-details`), and
 * packs backdrops under the backdrop rule — an SVG with `<text>` travels in
 * the full ZIP. One product change brings both, so its declared action id
 * gates both. Unknown installed contract (a foreign HA_URL): the newest.
 */
export function repairsBackups(installed = installedContract()) {
  if (!declaresValue(CONTRACT, 'action@data-action', 'backup-openings-details')) {
    throw new Error('backup-openings-details is not declared in the vendored contract');
  }
  return !installed || declaresValue(installed, 'action@data-action', 'backup-openings-details');
}

/**
 * houseplan-card#1046, released in v1.83.0-beta.2: a decorative Line is drawn
 * by clean clicks, like a Walls chain — the first click anchors it, the next
 * stores one segment, Esc ends the chain; a drag draws nothing any more. The
 * product declares no hook or value for the gesture, so this one gate reads
 * the version string. It holds where the contract rule above warns against
 * it: every `dev` snapshot since that release carries 1.83.0-beta.2 or later,
 * and a 1.82.x hotfix candidate keeps the drag. Unknown product (a foreign
 * HA_URL): the newest.
 */
export const LINE_BY_CLICKS = 'v1.83.0-beta.2';

export function drawsLinesByClicks(version = installedRecord()?.version) {
  return !version || compareTags(`v${version}`, LINE_BY_CLICKS) >= 0;
}

/** Specs (`hook` or `hook@data-attr`) the installed product does not declare. */
export function missingHooks(specs, installed = installedContract()) {
  for (const spec of specs) {
    if (!declares(CONTRACT, spec)) throw new Error(`${spec} is not declared in the vendored contract`);
  }
  if (!installed) return [];
  return specs.filter((spec) => !declares(installed, spec));
}

/**
 * The version the vendored contract says a hook first shipped in; for
 * `hook@attr`, the attribute's own `since` only. An attribute without one
 * (a closed value list declared later on an old hook, e.g. `decor@data-kind`
 * by #1011) is of unknown age: never called a regression.
 */
export function sinceOf(spec, contract = CONTRACT) {
  const [name, attr] = spec.split('@');
  const hook = contract?.hooks?.[name];
  return (attr ? hook?.attributeMetadata?.[attr]?.since : hook?.since) || null;
}

/**
 * Hooks the installed product lacks, split by why: `newer` ones shipped after
 * the installed version (an older release under test — skip), `lost` ones
 * should be there by its version (removed or renamed — a regression, fail).
 */
export function gate(specs, installed = installedContract(), version = installedRecord()?.version) {
  const missing = missingHooks(specs, installed);
  const lost = version
    ? missing.filter((spec) => { const since = sinceOf(spec); return since && compareTags(`v${version}`, `v${since}`) >= 0; })
    : [];
  return { newer: missing.filter((spec) => !lost.includes(spec)), lost };
}

/**
 * Skip the current file/describe/test when the installed House Plan is older
 * than a hook it relies on; fail it when a hook its version should have is
 * gone. Call at the top of a file or a describe, or inside a test. A lost hook
 * fails the journeys of that file, never the loading of the whole suite.
 */
export function requireHooks(test, ...specs) {
  const record = installedRecord();
  const { newer, lost } = gate(specs);
  const product = `House Plan ${record?.version ?? '?'} (${record?.installed ?? 'unknown ref'})`;
  if (lost.length) {
    const error = new Error(`${product} should declare ${lost.join(', ')} by its version, but its contract does not: a removed or renamed hook`);
    let running = true;
    try { test.info(); } catch { running = false; }
    if (running) throw error;
    test.beforeEach(() => { throw error; });
    return;
  }
  test.skip(newer.length > 0, `${product} predates ${newer.join(', ')}`);
}

const attrName = (key) => (key.startsWith('data-') ? key : `data-${key}`);
/**
 * The identity every plan object carries (docs/STYLING-HOOKS.md §2): open
 * values, valid on any hook. A closed `data-kind` list, where the JSON has
 * one, is still enforced.
 */
const IDENTITY = new Set(['data-id', 'data-kind', 'data-entity', 'data-area']);

/** Historical selector for explicit absence checks and older-product branches.
 * Ordinary hp()/requireHooks() stay strict: retirement is not a live hook. */
export function historicalHp(name, contract = CONTRACT) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('invalid historical hook name');
  const retired = contract.retiredHooks?.[name];
  if (!contract.hooks?.[name] && !(typeof retired?.retired === 'string' && retired.retired)) {
    throw new Error(`historical hook ${name} is not declared or retired in the contract`);
  }
  return `[data-hp="${name}"]`;
}

/**
 * `[data-hp="name"][data-…="…"]`, checked against the contract when the
 * selector is built: an undeclared hook, attribute or closed-enum value throws
 * at once instead of waiting out a locator timeout on a real HA. `true` asks
 * for presence only (`[data-hp-device-contact]`-style attributes).
 */
export function hp(name, attrs = {}) {
  const hook = CONTRACT.hooks[name];
  if (!hook) throw new Error(`data-hp="${name}" is not declared in the contract`);
  let selector = `[data-hp="${name}"]`;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    const attr = attrName(key);
    const closed = hook.attributes?.[attr];
    const open = hook.attributeMetadata?.[attr];
    if (!closed && !open && !IDENTITY.has(attr)) throw new Error(`${attr} is not declared on data-hp="${name}"`);
    if (value === true) {
      selector += `[${attr}]`;
      continue;
    }
    const text = String(value);
    if (closed && !closed.includes(text)) {
      throw new Error(`${attr}="${text}" is not a declared value of data-hp="${name}" (${closed.join(', ')})`);
    }
    selector += `[${attr}="${text.replace(/"/g, '\\"')}"]`;
  }
  return selector;
}

/** Root attributes on the card's ha-card (`data-hp-mode`, `data-hp-state`). */
export function root(attr, value) {
  const declared = CONTRACT.rootAttributes?.[attr];
  if (!declared) throw new Error(`${attr} is not a declared root attribute`);
  if (!declared.values.includes(value)) throw new Error(`${attr}="${value}" is not declared`);
  return `${declared.element}[${attr}="${value}"]`;
}
