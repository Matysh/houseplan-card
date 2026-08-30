import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { auditConfig } from '../scripts/config-audit.mjs';

test('config audit finds registered compatibility fields without changing input', () => {
  const config = {
    settings: { show_all: true, weather_entity: 'weather.home' },
    markers: [{
      id: 'm1', binding: 'virtual', display: 'ripple',
      vacuum: { trail: true, room_highlight: false },
    }],
    spaces: [{
      id: 's1', plan_scale: 1.2, segments: [],
      rooms: [{ id: 'r1', name: 'R', area: null, open_to: ['r2'] }],
      decor: [
        { id: 'd1', kind: 'line', width: 2 },
        { id: 'd2', kind: 'text', text: '{}', size: 'm', entity: 'sensor.demo' },
      ],
    }],
  };
  const before = JSON.stringify(config);
  const findings = auditConfig({ config });
  const ids = new Set(findings.map((finding) => finding.id));

  for (const id of [
    'settings.show_all', 'settings.weather_entity', 'markers[].display=ripple',
    'markers[].vacuum.trail', 'markers[].vacuum.room_highlight', 'spaces[].segments',
    'spaces[].plan_scale', 'spaces[].rooms[].open_to', 'spaces[].decor[].width',
    'spaces[].decor[text].size', 'spaces[].decor[text].entity',
  ]) assert.equal(ids.has(id), true, id);
  assert.equal(JSON.stringify(config), before);
});

test('config audit is silent for a canonical minimal config', () => {
  assert.deepEqual(auditConfig({ spaces: [], markers: [], settings: {} }), []);
});

test('config audit rejects --json without an input file concisely', () => {
  const result = spawnSync(process.execPath, ['scripts/config-audit.mjs', '--json'], {
    cwd: resolve('.'), encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--json requires/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test('config audit reports malformed JSON without a raw stack trace', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-config-audit-'));
  const file = resolve(directory, 'broken.json');
  try {
    writeFileSync(file, '{broken', 'utf8');
    const result = spawnSync(process.execPath, ['scripts/config-audit.mjs', file], {
      cwd: resolve('.'), encoding: 'utf8',
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^config-audit:/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// #33 AC6: the CLI exit-code contract — 0 clean, 3 migration available,
// 2 invalid input — proven on the lifecycle fixtures.
test('#33 config audit exit codes distinguish clean, migration and invalid', () => {
  const run = (file) => spawnSync(process.execPath, ['scripts/config-audit.mjs', file], {
    cwd: resolve('.'), encoding: 'utf8',
  });
  const clean = run('test/fixtures/config-lifecycle/current.json');
  assert.equal(clean.status, 0,
    `the current fixture must be clean, got ${clean.status}: ${clean.stdout}`);
  const legacy = run('test/fixtures/config-lifecycle/oldest-supported.json');
  assert.equal(legacy.status, 3,
    'show_all/weather_entity/ripple in the oldest fixture must report "migration available"');
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-audit-codes-'));
  const broken = resolve(directory, 'broken.json');
  try {
    writeFileSync(broken, '{nope', 'utf8');
    assert.equal(run(broken).status, 2, 'invalid input keeps the existing code 2');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
