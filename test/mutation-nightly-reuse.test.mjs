// #620: ночной полный реестр не гоняется повторно на уже доказанном дереве.
// Решение — чистая функция; workflow-проводку держит test/mutation-gate.test.mjs.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  MAX_REUSE_AGE_DAYS, REUSE_MARKER_SCHEMA, decideNightlyReuse, main, reuseMarker,
} from '../scripts/mutation-nightly-reuse.mjs';

const TREE = 'a'.repeat(40);
const OTHER_TREE = 'b'.repeat(40);
const SHA = 'c'.repeat(40);
const WORKFLOW = 'd'.repeat(40);
const NOW = Date.parse('2026-09-24T01:05:00Z');
const DAY = 24 * 60 * 60 * 1000;

const marker = (overrides = {}) => ({
  ...reuseMarker({ tree: TREE, sha: SHA, workflowSha: WORKFLOW, runId: 1234, runAttempt: 1, event: 'schedule', now: NOW - DAY }),
  ...overrides,
});
const decide = (overrides = {}) => decideNightlyReuse({
  event: 'schedule', tree: TREE, workflowSha: WORKFLOW, marker: marker(), now: NOW, ...overrides,
});

test('#620 AC1: неизменённое дерево с зелёным маркером — прогон переиспользуется с номером', () => {
  assert.deepEqual(decide(), { reuse: true, reason: `tree ${TREE} already proved green`, runId: '1234' });
});

test('#620: маркер другого дерева не переиспользуется', () => {
  const result = decide({ marker: marker({ tree: OTHER_TREE }) });
  assert.equal(result.reuse, false);
  assert.match(result.reason, /another tree/);
  assert.equal(decide({ tree: OTHER_TREE }).reuse, false, 'дерево текущей ночи другое');
  assert.equal(decide({ tree: 'HEAD' }).reuse, false, 'tree не полный SHA');
});

test('#620: маркер другого workflow не переиспользуется', () => {
  assert.equal(decide({ workflowSha: 'e'.repeat(40) }).reuse, false);
  assert.equal(decide({ workflowSha: '' }).reuse, false);
});

test('#620: ручной dispatch гоняет реестр всегда', () => {
  const result = decide({ event: 'workflow_dispatch' });
  assert.equal(result.reuse, false);
  assert.match(result.reason, /manual dispatch/);
});

test('#620: без маркера, с чужой схемой или без номера прогона — полный прогон', () => {
  assert.equal(decide({ marker: null }).reuse, false);
  assert.equal(decide({ marker: marker({ schema: 'houseplan-mutation-green/v0' }) }).reuse, false);
  assert.equal(decide({ marker: marker({ runId: '' }) }).reuse, false);
  assert.equal(decide({ marker: marker({ runId: '0' }) }).reuse, false);
});

test(`#620: маркер старше ${MAX_REUSE_AGE_DAYS} суток или из будущего не принимается`, () => {
  const at = (ms) => marker({ provenAt: new Date(ms).toISOString() });
  assert.equal(decide({ marker: at(NOW - (MAX_REUSE_AGE_DAYS * DAY - 60_000)) }).reuse, true, 'в пределах недели');
  const stale = decide({ marker: at(NOW - (MAX_REUSE_AGE_DAYS * DAY + 60_000)) });
  assert.equal(stale.reuse, false);
  assert.match(stale.reason, /older than/);
  assert.equal(decide({ marker: at(NOW + DAY) }).reuse, false, 'из будущего');
  assert.equal(decide({ marker: marker({ provenAt: 'вчера' }) }).reuse, false, 'время не читается');
});

test('#620: маркер не пишется с неполной identity', () => {
  assert.equal(marker().schema, REUSE_MARKER_SCHEMA);
  assert.throws(() => reuseMarker({ tree: TREE, sha: SHA, workflowSha: WORKFLOW, runId: 1, runAttempt: 1 }), /identity/);
  assert.throws(() => reuseMarker({ tree: 'short', sha: SHA, workflowSha: WORKFLOW, runId: 1, runAttempt: 1, event: 'schedule' }), /identity/);
});

test('#620 AC1: CLI пишет маркер, решает по нему и оставляет «reused from run N» в сводке', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-620-'));
  try {
    const file = join(dir, 'green', 'marker.json');
    const summary = join(dir, 'summary.md');
    const quiet = () => {};
    assert.equal(main([`--write-marker=${file}`, `--tree=${TREE}`, `--sha=${SHA}`, `--workflow-sha=${WORKFLOW}`,
      '--run-id=777', '--run-attempt=2', '--event=schedule'], { now: NOW - DAY, warn: quiet }), 0);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).runId, '777');
    const out = [];
    assert.equal(main(['--decide', '--event=schedule', `--tree=${TREE}`, `--workflow-sha=${WORKFLOW}`,
      `--marker=${file}`, `--summary=${summary}`, '--run-url-base=https://example.test/runs'],
    { now: NOW, log: (line) => out.push(line), warn: quiet }), 0);
    assert.deepEqual(out, ['reuse=true', 'reused_run=777']);
    assert.match(readFileSync(summary, 'utf8'), /reused from run 777 \(https:\/\/example\.test\/runs\/777\)/);
    // Битый маркер — не доказательство.
    writeFileSync(file, '{');
    const broken = [];
    main(['--decide', '--event=schedule', `--tree=${TREE}`, `--workflow-sha=${WORKFLOW}`, `--marker=${file}`],
      { now: NOW, log: (line) => broken.push(line), warn: quiet });
    assert.deepEqual(broken, ['reuse=false']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
