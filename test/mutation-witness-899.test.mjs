import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUTANTS } from '../scripts/mutation-registry.mjs';

const definition = id => {
  const found = MUTANTS.filter(mutant => mutant.id === id);
  assert.equal(found.length, 1, `${id}: one declaration, no replacement of registry coverage`);
  return found[0];
};

test('#899 core growth definition exceeds the approved finite caps without changing them', () => {
  const source = readFileSync(new URL('./core-file-budget.test.mjs', import.meta.url), 'utf8');
  const capsBlock = source.match(/const CAPS = \{([\s\S]*?)\n\};/)[1];
  const caps = [...capsBlock.matchAll(/'src\/houseplan-(?:card|editor-runtime)\.ts': (\d+)/g)]
    .map(match => Number(match[1]));
  assert.equal(caps.length, 2);
  assert.ok(caps.every(cap => Number.isFinite(cap) && cap > 0));
  const band = Number(source.match(/export const CORE_BAND = (\d+);/)[1]);
  assert.equal(band, 50, 'the approved band is unchanged');
  const mutant = definition('core-budget-ignores-growth');
  assert.equal(mutant.guard, 'node --test test/core-file-budget.test.mjs');
  assert.equal(mutant.patches.length, 1);
  const [patch] = mutant.patches;
  assert.equal(patch.file, 'src/houseplan-card.ts');
  assert.ok(patch.replace.endsWith(patch.find));
  const growth = patch.replace.slice(0, -patch.find.length);
  assert.match(growth, /^\n+$/, 'only added lines, not a lowered budget');
  assert.ok(growth.length > Math.max(...caps) + band,
    `${growth.length} new lines exceed even cap+band from an empty core`);
});

test('#899 invalid nightly definitions retain runtime branches and pre-ES2022 indexing', () => {
  const alias = definition('signal-topology-entity-choice-follows-last-alias');
  assert.match(alias.patches[0].replace, /entities\[entities\.length - 1\]/);
  assert.doesNotMatch(alias.patches[0].replace, /\.at\(/);
  const roster = definition('signal-entity-reads-functional-roster-only');
  assert.match(roster.patches[0].replace, /String\(binding\.kind\)/);
  assert.doesNotMatch(roster.patches[0].replace, /^\s*return device\.entities;/);
  const ack = definition('new-device-ack-forgets-rejection-ownership');
  assert.equal(ack.patches.length, 2);
  assert.ok(ack.patches.every(patch => !/if\s*\(false\)/.test(patch.replace)));
  assert.match(ack.patches[1].replace, /String\(id\)/);
});

test('#899 dependency and late-entry definitions include each redundant protection', () => {
  const snapshot = definition('snapshot-battery-read-untracked');
  assert.equal(snapshot.patches.length, 2);
  assert.deepEqual(snapshot.patches.map(patch => patch.find.match(/const (\w+Context)/)[1]).sort(),
    ['batteryContext', 'signalContext']);
  assert.ok(snapshot.patches.every(patch => patch.file === 'src/render-snapshot-capture.ts'
    && patch.replace.includes('host._planHass')));
  const late = definition('view-edit-late-import-forgets-recheck');
  assert.deepEqual(late.patches.map(patch => patch.file).sort(),
    ['src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts']);
  assert.ok(late.patches.every(patch => patch.find.includes('deviceEditorAllowed')));
});

test('#899 LED definition models an unsafe touch release, not equivalent propagation routing', () => {
  const led = definition('led-pinch-calls-action');
  assert.equal(led.guard, 'node demo/smoke_led_strip_glow.mjs');
  assert.equal(led.patches.length, 1);
  assert.equal(led.patches[0].file, 'src/led-strip-runtime.ts');
  assert.match(led.patches[0].replace, /e\.pointerType === 'touch'/);
  assert.match(led.patches[0].replace, /host\._clickDevice\(e, d\)/);
  assert.doesNotMatch(led.patches[0].replace, /stopPropagation/);
});
