// Document/registry ownership boundary, not just first-frame appearance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertStandaloneRegistry, STANDALONE_ELEMENTS, HA_BRANCH_ELEMENTS } from '../test-build/standalone-presentation-policy.js';
import { standaloneTheme } from '../test-build/standalone-theme.js';
import { STANDALONE_ICON_PATHS } from '../test-build/standalone-icons.generated.js';
import { renderStandaloneIcons } from '../scripts/standalone-icons.mjs';

const registry = definitions => ({ get: name => definitions.get(name) });
for (const name of [...STANDALONE_ELEMENTS, ...HA_BRANCH_ELEMENTS])
  test(`#1422 standalone registration rejects existing ${name} before defining anything`, () => {
    const foreign = class {}, definitions = new Map([[name, foreign]]);
    assert.throws(() => assertStandaloneRegistry(registry(definitions), false), /separate document/);
    assert.deepEqual([...definitions], [[name, foreign]]);
  });
test('#1422 empty document is allowed; a real HA root fails without definitions', () => {
  assert.doesNotThrow(() => assertStandaloneRegistry(registry(new Map()), false));
  assert.throws(() => assertStandaloneRegistry(registry(new Map()), true), /separate document/);
});
test('#1422 own definitions are idempotent but cannot whitelist an HA branch', () => {
  const own = new Map(STANDALONE_ELEMENTS.map(name => [name, class {}]));
  assert.doesNotThrow(() => assertStandaloneRegistry(registry(own), false, own));
  const mixed = new Map([...own, ['ha-dialog', class {}]]);
  assert.throws(() => assertStandaloneRegistry(registry(mixed), false, own), /separate document/);
});
test('#1422 theme inputs are finite immutable snapshots with aligned native color-scheme', () => {
  const light = standaloneTheme(false), dark = standaloneTheme(true);
  assert.equal(Object.isFrozen(light), true); assert.equal(Object.isFrozen(dark), true);
  assert.equal(light['color-scheme'], 'light'); assert.equal(dark['color-scheme'], 'dark');
  assert.equal(light['--primary-text-color'], '#212121'); assert.equal(dark['--primary-text-color'], '#e1e1e1');
  assert.deepEqual(Object.keys(light), Object.keys(dark));
  assert.notEqual(light['--card-background-color'], dark['--card-background-color']);
});
test('#1422 finite local icon inventory is reproducible without a runtime MDI lookup', () => {
  assert.equal(readFileSync(new URL('../src/standalone-icons.generated.ts', import.meta.url), 'utf8'), renderStandaloneIcons());
  const icons = Object.entries(STANDALONE_ICON_PATHS);
  assert.ok(icons.length > 100 && icons.length < 500);
  for (const [name, path] of icons) {
    assert.match(name, /^mdi:[a-z0-9-]+$/); assert.equal(typeof path, 'string');
    assert.ok(path.length > 10); assert.doesNotMatch(path, /[<>]|https?:|javascript:/i);
  }
  assert.ok(STANDALONE_ICON_PATHS['mdi:help-circle-outline']);
  assert.equal(Object.prototype.hasOwnProperty.call(STANDALONE_ICON_PATHS, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(STANDALONE_ICON_PATHS, '<svg onload=alert(1)>'), false);
});
