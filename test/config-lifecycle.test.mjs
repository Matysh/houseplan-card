import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG_FIELD_REGISTRY } from '../scripts/config-field-registry.mjs';
import { COMPATIBILITY_BRANCHES, PUBLISHED_STABLES, publishedStableSequence, sunsetUntil } from '../scripts/config-compatibility-catalog.mjs';
import { lifecycleState, lifecycleWarnings, validateLifecycle, verifyAnchors } from '../scripts/config-lifecycle.mjs';
import { checkInventory, matchesDigest, scanCompatibility } from '../scripts/config-compatibility-inventory.mjs';
import { buildPacket, renderPacket } from '../scripts/task-packet.mjs';

test('#1015 every field and actual branch has a typed since/until/provenance and real source anchors', () => {
  assert.deepEqual(validateLifecycle(), []);
  assert.deepEqual(verifyAnchors(new URL('../', import.meta.url)), []);
  assert.ok(CONFIG_FIELD_REGISTRY.every((entry) => entry.lifecycle.until));
  for (const property of ['since', 'until', 'provenance']) {
    const entries = structuredClone(CONFIG_FIELD_REGISTRY);
    delete entries[0].lifecycle[property];
    assert.ok(validateLifecycle(entries).some((item) => item.includes('missing lifecycle')));
  }
});

test('#1015 expiry follows two subsequent published stables, including patches and skipped version numbers', () => {
  const input = [
    { tagName: 'v2.1.0', publishedAt: '2026-01-01' },
    { tagName: 'v2.9.0-beta.1', publishedAt: '2026-01-02' },
    { tagName: 'v2.4.0', publishedAt: '2026-01-03', isDraft: true },
    { tagName: 'v2.1.1', publishedAt: '2026-01-04' },
    { tagName: 'v2.8.0', publishedAt: '2026-01-05' },
  ];
  const sequence = publishedStableSequence(input);
  assert.deepEqual(sequence, ['v2.1.0', 'v2.1.1', 'v2.8.0']);
  const since = { kind: 'stable', release: 'v2.1.0' };
  assert.deepEqual(sunsetUntil(since, sequence.slice(0, 2)), { kind: 'pending', after: 'v2.1.0', count: 2, remaining: 1 });
  assert.equal(sunsetUntil(since, sequence).release, 'v2.8.0');
  const branch = { since, decision: { kind: 'remove' }, proof: ['executed'], allInputsCanonical: true };
  assert.equal(lifecycleState(branch, sequence, 'v2.8.0').eligible, false, 'support lasts through the second stable');
  assert.equal(lifecycleState(branch, [...sequence, 'v2.9.0']).eligible, true);
  assert.equal(lifecycleState(branch, sequence, 'v2.9.0-beta.1').reached, false);
});

test('#1015 real stable deadlines warn only affected branches and never turn keep into removal authority', () => {
  assert.equal(PUBLISHED_STABLES.at(-1), 'v1.82.0');
  const warnings = lifecycleWarnings(['src/vacuum.ts']);
  assert.deepEqual(warnings.map((item) => [item.id, item.until, item.eligible]), [['vacuum-trail', 'v1.54.2', false]]);
  assert.deepEqual(lifecycleWarnings(['src/houseplan-header.ts']), []);
  assert.deepEqual(COMPATIBILITY_BRANCHES.filter((branch) => lifecycleState(branch).eligible).map((branch) => branch.id), ['weather-option']);
  assert.equal(lifecycleWarnings(['src/houseplan-editor-runtime.ts']).find((item) => item.id === 'weather-option').eligible, true);
  const invalid = structuredClone(COMPATIBILITY_BRANCHES);
  invalid[0].until.release = 'v1.82.0';
  assert.ok(validateLifecycle(CONFIG_FIELD_REGISTRY, invalid).some((item) => item.includes('invalid two-stable until')));
});

test('#1015 only proven redundant runtime writers are retired; old-backend readers stay', () => {
  const runtime = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
  const cleanup = readFileSync(new URL('../src/geometry-cleanup.ts', import.meta.url), 'utf8');
  const logic = readFileSync(new URL('../src/logic.ts', import.meta.url), 'utf8');
  assert.ok(!runtime.includes('settings.weather_entity'));
  assert.ok(!cleanup.includes("marker.display === 'ripple'"));
  assert.ok(logic.includes("value === 'ripple'"));
});

test('#1015 current source inventory is complete and orphan/missing/duplicate records fail closed', () => {
  const inventory = JSON.parse(readFileSync(new URL('../scripts/config-compatibility-inventory.json', import.meta.url)));
  const hits = scanCompatibility();
  assert.deepEqual(checkInventory(hits, inventory), []);
  assert.ok(hits.length > 500, 'historical223 is not silently reused');
  assert.ok(checkInventory(hits, { ...inventory, hits: inventory.hits.slice(1) }).some((item) => item.includes('orphan source hit')));
  assert.ok(checkInventory(hits, { ...inventory, hits: [...inventory.hits, inventory.hits[0]] }).some((item) => item.includes('duplicate')));
  const missing = [...hits, { id: 'new-hit', path: 'src/new.ts', line: 1, text: 'legacy persisted field', occurrence: 1 }];
  assert.ok(checkInventory(missing, inventory).some((item) => item.includes('orphan source hit')));
  assert.notEqual(matchesDigest(missing), inventory.matchesSha256);
});

test('#1015 task-packet adds scoped lifecycle evidence without changing status/track', () => {
  const packet = buildPacket({ issue: { number: 1015, title: 'Lifecycle', state: 'OPEN', body: '## ТЗ\nAC1: test' },
    labels: ['S6-in-progress', 'track:ask'], branch: { name: 'issue/1015-test', tip: 'a'.repeat(40), base: 'b'.repeat(40),
      changedFiles: ['src/vacuum.ts'], commits: [], ahead: 1, behind: 0, diff: '' } });
  assert.equal(packet.status, 'S6-in-progress');
  assert.equal(packet.trackDetail.track, 'ask');
  assert.equal(packet.configLifecycleWarnings[0].id, 'vacuum-trail');
  assert.match(renderPacket(packet), /reached-until v1\.54\.2/);
});
