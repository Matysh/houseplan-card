import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MUTATION_OUTCOME, guardPhases, isProofOutcome, runGuardPhases,
  runMutationLifecycle, splitAndChain,
} from '../scripts/mutation-guard-outcome.mjs';

const result = (status, output = '') => ({ status, stdout: output, stderr: '' });

test('#550: shell chain is split only on real && operators', () => {
  assert.deepEqual(splitAndChain('tsc && fix && node --test test/x.test.mjs'),
    ['tsc', 'fix', 'node --test test/x.test.mjs']);
  assert.deepEqual(splitAndChain('node --test --test-name-pattern="a && b" test/x.test.mjs'),
    ['node --test --test-name-pattern="a && b" test/x.test.mjs']);
  assert.deepEqual(guardPhases('tsc && fix && node --test test/x.test.mjs'), {
    setup: ['tsc', 'fix'], oracle: 'node --test test/x.test.mjs', proof: 'assertion',
  });
});

test('#550 fixture: clean setup failure never starts the named assertion', () => {
  const called = [];
  const outcome = runGuardPhases('prepare && node --test named.test.mjs', {
    execute: (command) => {
      called.push(command);
      return result(1, 'command not found: prepare');
    },
  });
  assert.equal(outcome.kind, MUTATION_OUTCOME.SETUP);
  assert.deepEqual(called, ['prepare']);
  assert.equal(isProofOutcome(outcome), false);
});

test('#550 fixture: mutant-induced compile failure is setup, not a killed assertion', () => {
  const called = [];
  const outcome = runGuardPhases('npx tsc -p tsconfig.test.json && node --test named.test.mjs', {
    execute: (command) => {
      called.push(command);
      return result(2, 'error TS2322: mutant does not type-check');
    },
  });
  assert.equal(outcome.kind, MUTATION_OUTCOME.SETUP);
  assert.deepEqual(called, ['npx tsc -p tsconfig.test.json']);
  assert.equal(isProofOutcome(outcome), false);
});

test('#550 fixture: real named assertion failure is reusable proof', () => {
  const outcome = runGuardPhases('prepare && node --test named.test.mjs', {
    execute: (command) => command === 'prepare'
      ? result(0) : result(1, 'not ok 1 - named assertion\ncode: ERR_ASSERTION'),
  });
  assert.deepEqual({ kind: outcome.kind, proof: outcome.proof }, {
    kind: MUTATION_OUTCOME.ASSERTION_KILLED, proof: 'assertion',
  });
  assert.equal(isProofOutcome(outcome), true);
  assert.equal(isProofOutcome({ ...outcome, proof: 'setup' }), false,
    'поддельный proof не переносит killed outcome в ledger');
  const quotedFixture = runGuardPhases('node --test classifier.test.mjs', {
    execute: () => result(1,
      "AssertionError: expected setup-failure, got ERR_MODULE_NOT_FOUND\ncode: 'ERR_ASSERTION'"),
  });
  assert.equal(quotedFixture.kind, MUTATION_OUTCOME.ASSERTION_KILLED,
    'слово из fixture внутри AssertionError не маскирует реальное падение теста');
  const runtimeEnoent = runGuardPhases('node --test ledger.test.mjs', {
    execute: () => result(1, [
      '# Subtest: ledger writes immediately',
      'not ok 1 - ledger writes immediately',
      "error: ENOENT: no such file or directory, open 'ledger.json'",
    ].join('\n')),
  });
  assert.equal(runtimeEnoent.kind, MUTATION_OUTCOME.ASSERTION_KILLED,
    'ошибка поведения внутри исполнившегося subtest не становится setup failure');
  const specReporter = runGuardPhases('node --test ledger.test.mjs', {
    execute: () => result(1, [
      '✖ ledger writes immediately (2ms)',
      "Error: ENOENT: no such file or directory, open 'ledger.json'",
    ].join('\n')),
  });
  assert.equal(specReporter.kind, MUTATION_OUTCOME.ASSERTION_KILLED,
    'node spec reporter также доказывает, что именованный test исполнился');
});

test('#550 fixture: green named assertion means the mutant survived', () => {
  const outcome = runGuardPhases('node --test named.test.mjs', {
    execute: () => result(0, 'ok 1 - named assertion'),
  });
  assert.equal(outcome.kind, MUTATION_OUTCOME.SURVIVED);
  assert.equal(isProofOutcome(outcome), false);
});

test('#550 fixture: oracle load/collection errors are setup failures', () => {
  for (const output of [
    'Error [ERR_MODULE_NOT_FOUND]: Cannot find package x',
    'ERROR collecting tests_backend/test_x.py',
    'collected 0 items',
  ]) {
    const outcome = runGuardPhases('node --test named.test.mjs', {
      execute: () => result(1, output),
    });
    assert.equal(outcome.kind, MUTATION_OUTCOME.SETUP, output);
  }
});

test('#550 fixture: timeout and cancellation are infrastructure interruptions', () => {
  const timeout = runGuardPhases('node --test named.test.mjs', {
    execute: () => ({ status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' } }),
  });
  const cancelled = runGuardPhases('node --test named.test.mjs', {
    execute: () => ({ status: null, signal: 'SIGINT' }),
  });
  assert.equal(timeout.kind, MUTATION_OUTCOME.INTERRUPTED);
  assert.equal(timeout.detail, 'ETIMEDOUT');
  assert.equal(cancelled.kind, MUTATION_OUTCOME.INTERRUPTED);
});

test('#550 fixture: invalid patch and preparation exception are different outcomes', () => {
  const invalid = runMutationLifecycle({
    apply: () => { throw new Error('anchor found 0 times'); },
    prepare: () => assert.fail('prepare must not run'),
    guard: 'node --test named.test.mjs',
    execute: () => assert.fail('oracle must not run'),
  });
  const setup = runMutationLifecycle({
    apply: () => {},
    prepare: () => { throw new Error('rollup failed'); },
    guard: 'node --test named.test.mjs',
    execute: () => assert.fail('oracle must not run'),
  });
  assert.equal(invalid.kind, MUTATION_OUTCOME.INVALID);
  assert.equal(setup.kind, MUTATION_OUTCOME.SETUP);
});

test('#550: compile-time proof is explicit and cannot hide in an assertion chain', () => {
  const compile = runGuardPhases('npx tsc -p tsconfig.type-witness.json', {
    proof: 'compile', execute: () => result(2, 'expected type error'),
  });
  assert.deepEqual({ kind: compile.kind, proof: compile.proof }, {
    kind: MUTATION_OUTCOME.COMPILE_KILLED, proof: 'compile',
  });
  assert.equal(isProofOutcome(compile), true);
  assert.throws(() => guardPhases('prepare && tsc', 'compile'), /one command/);
});
