import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SCHEMA_COMPAT_ALLOWLIST } from '../scripts/schema-compat-allowlist.mjs';
import { CONFIG_FIELD_REGISTRY } from '../scripts/config-field-registry.mjs';
import {
  DISPLAY_MODES, TAP_ACTIONS, SPACE_FILL_MODES, ROOM_FILL_MODES,
} from '../test-build/logic.js';
import {
  OPENING_TYPES, VACUUM_TRAIL_MODES, ZERO_WALL_STYLES,
} from '../test-build/types.js';
import { BG_MODES } from '../test-build/sun.js';

const manifest = JSON.parse(readFileSync(
  new URL('../scripts/config-schema.json', import.meta.url), 'utf8')).fields;

/** Enum values of a manifest entry: `enum` list or const-variants (null skipped). */
const backendValues = (path) => {
  const entry = manifest[path];
  assert.ok(entry, `manifest is missing ${path} — regenerate scripts/config-schema.json`);
  if (entry.enum) return [...entry.enum];
  if (entry.variants) {
    return entry.variants
      .filter((variant) => 'const' in variant)
      .map((variant) => variant.const);
  }
  assert.fail(`${path} carries neither enum nor const variants`);
  return [];
};

/** #33 AC2/AC3: every backend<->frontend enum pair, judged through the allow-list. */
const PAIRS = [
  { pair: 'space.fill_mode', path: 'config.spaces[].settings.fill_mode', front: SPACE_FILL_MODES },
  { pair: 'room.fill_mode', path: 'config.spaces[].rooms[].settings.fill_mode', front: ROOM_FILL_MODES },
  { pair: 'marker.display', path: 'config.markers[].display', front: DISPLAY_MODES },
  { pair: 'marker.tap_action', path: 'config.markers[].tap_action', front: TAP_ACTIONS },
  { pair: 'opening.type', path: 'config.spaces[].openings[].type', front: OPENING_TYPES },
  { pair: 'vacuum.trail_mode', path: 'config.markers[].vacuum.trail_mode', front: VACUUM_TRAIL_MODES },
  { pair: 'space.zero_wall_style', path: 'config.spaces[].zero_wall_style', front: ZERO_WALL_STYLES },
  { pair: 'settings.bg_mode', path: 'config.settings.bg_mode', front: BG_MODES },
];

test('#33 AC2: backend and frontend enums agree, divergences only via the allow-list', () => {
  const usedAllowEntries = new Set();
  for (const { pair, path, front } of PAIRS) {
    const backend = new Set(backendValues(path));
    const frontend = new Set(front);
    for (const value of backend) {
      if (frontend.has(value)) continue;
      const allowed = SCHEMA_COMPAT_ALLOWLIST.find((entry) =>
        entry.pair === pair && entry.side === 'backend-only' && entry.value === value);
      assert.ok(allowed,
        `${pair}: backend knows '${value}' but the frontend list does not — `
        + 'add the value or a schema-compat-allowlist entry with a reason');
      usedAllowEntries.add(allowed);
    }
    for (const value of frontend) {
      if (backend.has(value)) continue;
      const allowed = SCHEMA_COMPAT_ALLOWLIST.find((entry) =>
        entry.pair === pair && entry.side === 'frontend-only' && entry.value === value);
      assert.ok(allowed,
        `${pair}: frontend offers '${value}' but the backend schema rejects it — `
        + 'a write would fail validation');
      usedAllowEntries.add(allowed);
    }
  }
  // AC3: the allow-list cannot rot — every entry must justify a REAL divergence.
  for (const entry of SCHEMA_COMPAT_ALLOWLIST) {
    assert.ok(usedAllowEntries.has(entry),
      `allow-list entry ${entry.pair}/'${entry.value}' no longer matches a real `
      + 'divergence — the sides converged, remove the entry');
  }
});

/** #33 AC4: every registry decision must resolve against the schema reality. */
test('#33 AC4: every registry entry resolves to a manifest path or an explicit passport', () => {
  // Variant tags (<line>, <wall>...) are a manifest detail — registry
  // selectors are variant-agnostic, so both sides compare untagged.
  const untagged = new Set(Object.keys(manifest).map((key) => key.replace(/<[^>]+>/g, '')));
  for (const entry of CONFIG_FIELD_REGISTRY) {
    if (entry.schema === 'allow-extra' || entry.schema === 'lovelace-card') continue;
    const path = 'config.' + entry.selector.path
      .map((segment) => (segment === '*' ? '[]' : segment))
      .join('.')
      .replace(/\.\[\]/g, '[]');
    assert.ok(untagged.has(path),
      `registry entry '${entry.id}' points at '${path}' which is not in the schema `
      + 'manifest — dead decisions must not accumulate (fix the selector, add a '
      + "schema: 'allow-extra' passport, or drop the entry)");
  }
});

/** #33 AC7: the manifest is a build/test artefact — the bundle must not grow.
 * r1-M1: scan the WHOLE src tree and look for the CURRENT file name (the
 * original assertion kept checking the pre-rename string and could not fail). */
test('#33 AC7: no production source references the schema dump', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    return entry.isDirectory() ? walk(target)
      : /\.(ts|js|mjs|json)$/.test(entry.name) ? [target] : [];
  });
  for (const file of walk(new URL('../src/', import.meta.url))) {
    assert.ok(!readFileSync(file, 'utf8').includes('config-schema.json'),
      `${file.pathname} references the schema dump — it is test infrastructure, not runtime data`);
  }
});
