import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MUTANTS } from '../scripts/mutation-registry.mjs';
import { shardMutants } from '../scripts/mutation-selection.mjs';
import {
  mutationGateReport, mutationShardEvidence, validateMutationShardEvidence,
} from '../scripts/mutation-gate-report.mjs';
import { decideNightlyReuse, reuseMarker } from '../scripts/mutation-nightly-reuse.mjs';

// Pure planning/evidence witnesses: no patched source, guard or build executes.
const SHARDS = Array.from({ length: 20 }, (_, index) => index + 1);
const ids = (rows) => rows.map(({ id }) => id).sort();
const workflow = readFileSync(new URL('../.github/workflows/_mutation-gate.yml', import.meta.url), 'utf8');
const expected = {
  materialSha: 'a'.repeat(40), materialTree: 'b'.repeat(40), workflowSha: 'c'.repeat(40),
  runId: 899, runAttempt: 2, shardCount: SHARDS.length,
};
const evidenceRows = () => SHARDS.map((shard) => ({
  file: `synthetic/shard-${shard}/evidence.json`,
  evidence: mutationShardEvidence({ ...expected, shard, outcome: 'success' }),
}));
const logs = () => SHARDS.map((shard) => ({
  shard, outcome: 'success', text: 'поймано 1 из 1\n',
}));
const report = (inputLogs, evidenceErrors = []) => mutationGateReport({
  logs: inputLogs, evidenceErrors, guards: {}, ref: 'synthetic', sha: expected.materialSha,
  date: '2026-10-15', runUrl: 'https://example.invalid/runs/899',
});

test('#899: twenty shards partition every actual definition exactly once without changing its guard', () => {
  const original = new Map(MUTANTS.map((mutant) => [mutant.id, mutant]));
  assert.equal(original.size, MUTANTS.length, 'duplicate registry IDs cannot be hidden by a set');
  const scheduled = SHARDS.flatMap((shard) => shardMutants(MUTANTS, shard, SHARDS.length));
  assert.deepEqual(ids(scheduled), ids(MUTANTS), 'multiset equality, not just the number of definitions');
  for (const mutant of scheduled) assert.equal(mutant, original.get(mutant.id), `${mutant.id}: definition/guard replaced`);
  for (const shard of SHARDS) {
    assert.deepEqual(shardMutants([...MUTANTS].reverse(), shard, SHARDS.length),
      shardMutants(MUTANTS, shard, SHARDS.length), 'input order cannot change the partition');
  }
});

test('#899: each former i/10 shard is exactly the union of i/20 and (i+10)/20', () => {
  for (let shard = 1; shard <= 10; shard++) {
    const former = shardMutants(MUTANTS, shard, 10);
    const first = shardMutants(MUTANTS, shard, 20);
    const second = shardMutants(MUTANTS, shard + 10, 20);
    assert.deepEqual(ids([...first, ...second]), ids(former), `former shard ${shard}: missing or repeated definition`);
    assert.ok(Math.abs(first.length - second.length) <= 1, `former shard ${shard}: not split in half`);
  }
});

test('#899: shard capacity changes neither the one-hour deadline nor full-green reuse authority', () => {
  const mutants = workflow.slice(workflow.indexOf('  mutants:'), workflow.indexOf('  evidence:'));
  assert.match(mutants, /^    timeout-minutes: 60$/m);
  assert.match(mutants, /fail-fast: false/);
  assert.match(mutants, /if: needs\.material\.outputs\.reuse != 'true'/);
  const command = mutants.split('\n').find((line) => line.includes('node scripts/mutation-gate.mjs --shard='));
  assert.match(command, /--shard=\$\{\{ matrix\.shard \}\}\/20 --execute-nightly 2>&1 \| tee /);
  assert.doesNotMatch(command, /--(?:id|changed|limit)=/, 'the full nightly registry cannot be narrowed');
  const marker = workflow.slice(workflow.indexOf('  green_marker:'), workflow.indexOf('  report:'));
  assert.match(marker, /needs: \[material, mutants, evidence\]/);
  assert.match(marker, /needs\.mutants\.result == 'success' && needs\.evidence\.result == 'success'/);
  const now = Date.parse('2026-10-15T07:00:00Z');
  const oldMarker = reuseMarker({ tree: expected.materialTree, sha: expected.materialSha,
    workflowSha: 'd'.repeat(40), runId: 898, runAttempt: 1, event: 'schedule', now });
  assert.equal(decideNightlyReuse({ event: 'schedule', tree: expected.materialTree,
    workflowSha: expected.workflowSha, marker: oldMarker, now }).reuse, false,
  'a marker from the former workflow cannot prove the new partition');
});

test('#899: all twenty identities are required; foreign, duplicate or interrupted evidence stays red', () => {
  const valid = validateMutationShardEvidence(evidenceRows(), expected);
  assert.equal(valid.ok, true);
  assert.equal(valid.selected.length, 20);
  assert.equal(report(logs(), valid.errors).failed, false);
  for (const [field, value] of [
    ['materialSha', 'd'.repeat(40)], ['materialTree', 'd'.repeat(40)],
    ['workflowSha', 'd'.repeat(40)], ['runId', 900], ['runAttempt', 3], ['shardCount', 40],
    ['outcome', 'cancelled'], ['outcome', 'skipped'],
  ]) {
    const rows = evidenceRows();
    rows[19].evidence[field] = value;
    const invalid = validateMutationShardEvidence(rows, expected);
    assert.equal(invalid.ok, false, `shard 20: ${field}=${value} was accepted`);
    assert.equal(report(logs(), invalid.errors).failed, true, 'apparently complete logs cannot mask invalid identity');
  }
  assert.equal(validateMutationShardEvidence(evidenceRows().slice(0, 19), expected).ok, false);
  const duplicate = evidenceRows();
  duplicate.push(duplicate[0]);
  assert.equal(validateMutationShardEvidence(duplicate, expected).ok, false);
});

test('#899: a terminal summary cannot hide failure/cancellation and no summary cannot count as success', () => {
  for (const [outcome, text] of [
    ['cancelled', 'поймано 1 из 1\n'], ['failure', 'поймано 1 из 1\n'],
    ['success', 'ok   an unfinished shard\n'], ['success', null],
  ]) {
    const incomplete = logs();
    incomplete[19] = { shard: 20, outcome, text };
    assert.equal(report(incomplete).failed, true, `shard 20: ${outcome}/${text} became full-green`);
  }
});

test('#899: the ordinary report CLI defaults to twenty; historical ten needs an explicit count', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'hp-899-report-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const script = fileURLToPath(new URL('../scripts/mutation-gate-report.mjs', import.meta.url));
  const identity = [`--sha=${expected.materialSha}`, `--tree=${expected.materialTree}`,
    `--workflow-sha=${expected.workflowSha}`, `--run-id=${expected.runId}`, `--run-attempt=${expected.runAttempt}`];
  const run = (...args) => spawnSync(process.execPath, [script, ...identity, ...args], { encoding: 'utf8' });
  const seed = (dir, count) => {
    for (let shard = 1; shard <= count; shard++) {
      const path = join(dir, `mutation-shard-${shard}`);
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, 'evidence.json'), JSON.stringify(mutationShardEvidence({
        ...expected, shardCount: count, shard, outcome: 'success',
      })));
      writeFileSync(join(path, `mutation-shard-${shard}.log`), 'поймано 1 из 1\n');
    }
  };
  const current = join(root, 'current');
  seed(current, 20);
  const complete = run(`--logs=${current}`, '--verify-only');
  assert.equal(complete.status, 0, complete.stderr);
  assert.match(complete.stdout, /verified=true/);
  unlinkSync(join(current, 'mutation-shard-20', 'evidence.json'));
  const missing = run(`--logs=${current}`, '--verify-only');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /shard 20: evidence is missing/);
  assert.match(missing.stdout, /verified=false/);
  const historical = join(root, 'historical');
  seed(historical, 10);
  const old = run(`--logs=${historical}`, '--verify-only', '--shards=10');
  assert.equal(old.status, 0, old.stderr);
  assert.match(old.stdout, /verified=true/);
  const path = join(root, 'written', 'evidence.json');
  const written = run(`--write-evidence=${path}`, '--shard=20', '--outcome=success');
  assert.equal(written.status, 0, written.stderr);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).shardCount, 20);
});
