import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { baselineIndexHash, readTaskVisualIntent, readPendingVisualIntents, validateVisualIntent } from '../scripts/task-visual-intent.mjs';
import { preserveSelectedGolden } from '../scripts/browser-selected.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-visual-intent-1044-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = join(root, 'docs/release-ledger/v1.0.0'), baselines = join(root, 'demo/golden/baselines');
  mkdirSync(ledger, { recursive: true }); mkdirSync(baselines, { recursive: true });
  writeFileSync(join(root, 'docs/release-ledger/cycle.json'), JSON.stringify({ baseStable: 'v1.0.0' }));
  writeFileSync(join(baselines, 'baselines-index.json'), '{"scenarios":{}}\n');
  const visual = { schema: 1, baselineIndex: baselineIndexHash(root),
    golden: [{ id: 'geometry-view-dark-fit', expectation: 'change', reason: 'Correct opening depth' }], smokes: [] };
  const put = (issue, value = visual) => writeFileSync(join(ledger, `${issue}.json`), JSON.stringify({ issue, visual: value }));
  return { root, baselines, visual, put };
}

test('#1044 accumulates current-cycle visual intents and expires them after canonical acceptance', t => {
  const { root, baselines, visual, put } = fixture(t);
  put(1043); put(1044, { ...visual, golden: [{ id: 'new-scene', expectation: 'new', reason: 'New opening fixture' }] });
  put(1042, { ...visual, baselineIndex: '0'.repeat(64) });
  assert.equal(readTaskVisualIntent({ root, issue: 1043 }).issue, 1043);
  assert.equal(readTaskVisualIntent({ root, issue: 1042 }), null);
  const pending = readPendingVisualIntents({ root });
  assert.deepEqual(pending.expectChange, ['geometry-view-dark-fit']); assert.deepEqual(pending.expectNew, ['new-scene']);
  assert.deepEqual(pending.golden.map(item => item.issue), [1043, 1044]);
  writeFileSync(join(baselines, 'baselines-index.json'), '{"scenarios":{},"accepted":"beta"}\n');
  assert.deepEqual(readPendingVisualIntents({ root }).golden, []);
  assert.equal(readTaskVisualIntent({ root, issue: 1043 }), null);
});

test('#1044 rejects contradictory, malformed or path-like visual intent', t => {
  const { root, visual, put } = fixture(t);
  put(1043); put(1044, { ...visual, golden: [{ ...visual.golden[0], expectation: 'new' }] });
  assert.throws(() => readPendingVisualIntents({ root }), /Conflicting/);
  for (const item of [{ ...visual.golden[0], id: '../other' }, { ...visual.golden[0], reason: ' ' },
    { ...visual.golden[0], expectation: 'anything' }]) {
    assert.throws(() => validateVisualIntent({ ...visual, golden: [item] }, 1044), /unique scene/);
  }
  assert.throws(() => validateVisualIntent({ ...visual, smokes: ['../other.mjs'] }, 1044), /smoke IDs/);
  assert.throws(() => readTaskVisualIntent({ root, issue: '../4' }), /Invalid task issue/);
});

test('#1044 selected artifacts retain exact current frames and refuse changed bytes without touching baselines', t => {
  const { root, baselines } = fixture(t), id = 'geometry-view-dark-fit';
  const actual = join(root, 'artifacts/golden/actual'); mkdirSync(actual, { recursive: true });
  const bytes = Buffer.from('fixture png bytes'), actualSha256 = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(actual, `${id}.png`), bytes);
  const before = readFileSync(join(baselines, 'baselines-index.json'));
  const report = { results: [{ id, actualSha256 }] };
  preserveSelectedGolden(root, id, report);
  assert.deepEqual(readFileSync(join(root, 'artifacts/browser-selected/golden/actual', `${id}.png`)), bytes);
  assert.deepEqual(readFileSync(join(baselines, 'baselines-index.json')), before);
  writeFileSync(join(actual, `${id}.png`), 'different bytes');
  assert.throws(() => preserveSelectedGolden(root, id, report), /artifact changed/);
});
