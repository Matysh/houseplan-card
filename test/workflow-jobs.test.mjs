// #622: контракт имён job validate.yml с потребителями (ci-proof, validate-gate).
// Имена job — единственное, по чему ревью, слияние и релиз узнают исполненную
// проверку; расхождение с файлом давало «claimed execution is absent» без
// единого красного теста. Здесь файл читается как есть и сверяется в обе
// стороны.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  jobInstanceNames, parseWorkflowJobs, staticNamePrefix, validateJobs, VALIDATE_WORKFLOW_PATH,
} from '../scripts/workflow-jobs.mjs';
import { JOB_RULES, MUTANT_JOB_PREFIX, UNCONSUMED_JOBS, jobContractProblems, resolveJobRules } from '../scripts/ci-proof.mjs';
import { MUTANT_JOB_PREFIX as GATE_MUTANT_PREFIX } from '../scripts/validate-gate.mjs';

const TEXT = readFileSync(VALIDATE_WORKFLOW_PATH, 'utf8').replace(/\r\n/g, '\n');
const JOBS = validateJobs();

test('#622: parser reads job ids, names and inline matrices of the structure validate.yml uses', () => {
  const jobs = parseWorkflowJobs([
    'name: top', 'on: push', 'jobs:',
    '  # comment', '  plain:', '    name: Просто имя # хвост', '    runs-on: ubuntu-latest',
    '    steps:', '      - name: не имя job', '        run: |', '          name: и не это',
    '  quoted:', '    needs: plain', '    name: "Шард ${{ matrix.shard }}/${{ matrix.os }} #1"',
    '    strategy:', '      fail-fast: false', '      matrix:', '        shard: [1, 2, 3]', "        os: ['a', b]",
    '    runs-on: x',
    'env:', '  name: not-a-job',
  ].join('\n'));
  assert.deepEqual([...jobs.keys()], ['plain', 'quoted']);
  assert.equal(jobs.get('plain').name, 'Просто имя');
  assert.equal(jobs.get('plain').size, 1);
  assert.equal(jobs.get('quoted').name, 'Шард ${{ matrix.shard }}/${{ matrix.os }} #1');
  assert.equal(jobs.get('quoted').size, 6);
  assert.equal(staticNamePrefix(jobs.get('quoted').name), 'Шард ');
  assert.deepEqual(jobInstanceNames(jobs.get('quoted')).slice(0, 3), ["Шард 1/'a' #1", 'Шард 1/b #1', "Шард 2/'a' #1"]);
});

test('#622: forms the parser does not understand fail loudly instead of guessing', () => {
  const job = (...lines) => ['jobs:', '  j:', '    name: J', ...lines].join('\n');
  assert.throws(() => parseWorkflowJobs(job('    strategy:', '      matrix:', '        include:', '          - a: 1')), /include is not supported/);
  assert.throws(() => parseWorkflowJobs(job('    strategy:', '      matrix: ${{ fromJSON(x) }}')), /matrix expressions are not supported/);
  assert.throws(() => parseWorkflowJobs(job('    strategy:', '      matrix:', '        shard:', '          - 1')), /only inline lists/);
  assert.throws(() => parseWorkflowJobs('jobs:\n  j:\n    runs-on: x\n'), /job j has no name/);
  assert.throws(() => parseWorkflowJobs('jobs:\n  j:\n    name: A\n  j:\n    name: B\n'), /duplicate job id j/);
  assert.throws(() => parseWorkflowJobs('on: push\n'), /no top-level "jobs:"/);
  assert.throws(() => jobInstanceNames(parseWorkflowJobs('jobs:\n  j:\n    name: "A ${{ inputs.x }}"\n').get('j')), /not a declared matrix axis/);
});

test('#622 AC1: every job of validate.yml is declared in ci-proof with its current name, and every declaration exists', () => {
  assert.deepEqual(jobContractProblems(JOBS), []);
  assert.doesNotThrow(() => resolveJobRules(JOBS));
  const declared = [...Object.values(JOB_RULES).flat().map((rule) => rule.job), ...Object.keys(UNCONSUMED_JOBS)];
  assert.deepEqual([...declared].sort(), [...JOBS.keys()].sort());
});

test('#622 AC1: renaming ANY job name in validate.yml without touching the rules turns the contract red', () => {
  const nameLines = [...TEXT.matchAll(/^ {4}name: .+$/gm)].map((m) => m[0]);
  assert.equal(nameLines.length, JOBS.size, 'one job-level name line per job');
  for (const line of nameLines) {
    const renamed = TEXT.replace(line, line.replace(/name: ("?)/, 'name: $1Переименовано '));
    const problems = jobContractProblems(parseWorkflowJobs(renamed, 'validate.yml (renamed)'));
    assert.equal(problems.length, 1, `${line.trim()} → ${JSON.stringify(problems)}`);
    assert.match(problems[0], /validate\.yml names it/);
  }
  const extra = TEXT.replace('\n  proof:\n', '\n  extra_job:\n    name: Новая job\n    runs-on: ubuntu-latest\n  proof:\n');
  assert.match(jobContractProblems(parseWorkflowJobs(extra)).join('\n'), /extra_job: validate\.yml job is in neither/);
});

test('#622: consumed rules resolve to the exact instance names GitHub reports, within the 100-byte API limit', () => {
  const rules = resolveJobRules(JOBS);
  for (const [id, list] of Object.entries(rules)) {
    for (const rule of list) {
      assert.equal(rule.names.length, JOBS.get(rule.job).size, `${id}/${rule.job}: one name per matrix instance`);
      for (const name of rule.names) {
        assert.ok(Buffer.byteLength(name, 'utf8') <= 100, `${name}: GitHub Jobs API truncates names longer than 100 UTF-8 bytes`);
        assert.doesNotMatch(name, /\$\{\{/, `${name}: unexpanded expression`);
      }
    }
  }
  const all = [...JOBS.values()].flatMap(jobInstanceNames);
  assert.equal(new Set(all).size, all.length, 'job instance names are unique across the workflow');
});

test('#622: the mutant prefix of validate-gate is the ci-proof contract and matches only changed_mutants', () => {
  assert.equal(GATE_MUTANT_PREFIX, MUTANT_JOB_PREFIX);
  for (const job of JOBS.values()) {
    const hits = jobInstanceNames(job).filter((name) => name.startsWith(MUTANT_JOB_PREFIX));
    assert.equal(hits.length, job.id === 'changed_mutants' ? job.size : 0, job.id);
  }
});

test('#622 AC2: shard totals written in names and scripts of a sharded job equal its matrix size', () => {
  for (const job of JOBS.values()) {
    if (!job.matrix?.shard) continue;
    const start = TEXT.indexOf(`\n  ${job.id}:\n`);
    const next = TEXT.slice(start + 1).search(/\n {2}[A-Za-z0-9_-]+:\n/);
    const body = TEXT.slice(start, next < 0 ? undefined : start + 1 + next);
    const totals = [
      ...body.matchAll(/matrix\.shard \}\}(?:\/| из )(\d+)/g),
      ...body.matchAll(/\$SHARD\/(\d+)/g),
      ...body.matchAll(/SHARDS: '?(\d+)'?/g),
    ].map((m) => Number(m[1]));
    assert.ok(totals.length > 0, `${job.id}: shard total is written somewhere`);
    for (const total of totals) assert.equal(total, job.size, `${job.id}: literal shard total ${total} vs matrix of ${job.size}`);
  }
});
