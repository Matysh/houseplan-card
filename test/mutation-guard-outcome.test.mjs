import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  MUTATION_OUTCOME, guardPhases, isProofOutcome, runGuardPhases, setupFailureOwner,
  runMutationLifecycle, splitAndChain,
} from '../scripts/mutation-guard-outcome.mjs';
import { attributeSetupFailure } from '../scripts/mutation-attribution.mjs';

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

// #568: отказ подготовки краснил гейт той задачи, чей дифф выбрал свидетеля,
// даже когда причина лежала в чужом коммите — на этом я потерял два круга по
// #566. Атрибуция доказывает принадлежность прогоном ТОГО ЖЕ мутанта на базе.
const setup = { kind: MUTATION_OUTCOME.SETUP, command: 'tsc', detail: 'TS18047' };

test('#568: не готовится и на базе — отказ предсуществующий', () => {
  assert.equal(setupFailureOwner(setup, { kind: MUTATION_OUTCOME.SETUP }), 'pre-existing');
});

test('#568: на базе тот же мутант готовится — отказ внесён диффом', () => {
  for (const kind of [MUTATION_OUTCOME.ASSERTION_KILLED, MUTATION_OUTCOME.COMPILE_KILLED,
    MUTATION_OUTCOME.SURVIVED, MUTATION_OUTCOME.INVALID]) {
    assert.equal(setupFailureOwner(setup, { kind }), 'introduced', kind);
  }
});

test('#568: недоказанная невиновность оправданием не считается', () => {
  // Базы нет, прогон на ней сорвался или голова упала не на подготовке —
  // молчим, и отказ остаётся отказом этой задачи. Иначе прерывание
  // инфраструктуры превращалось бы в индульгенцию.
  assert.equal(setupFailureOwner(setup, null), null);
  assert.equal(setupFailureOwner(setup, { kind: MUTATION_OUTCOME.INTERRUPTED }), null);
  assert.equal(setupFailureOwner({ kind: MUTATION_OUTCOME.SURVIVED }, { kind: MUTATION_OUTCOME.SETUP }), null);
});

test('#568: атрибуция судит определение базы, а не головы', async () => {
  // Проверка исполнением, а не regexp по исходнику: подменяются реестр базы и
  // запуск, и видно, ЧЬЁ определение пошло на прогон. Первая версия брала
  // определение из головы — и своя же сломанная правка реестра выглядела
  // предсуществующей; поймал это демонстрацией на себе.
  const head = { id: 'w', guard: 'g', patches: [{ file: 'f', find: 'a', replace: 'HEAD' }] };
  const base = { id: 'w', guard: 'g', patches: [{ file: 'f', find: 'a', replace: 'BASE' }] };
  const ran = [];
  const verdict = await attributeSetupFailure(head, setup, 'base-sha', {
    registryOf: async () => [base],
    run: (mutant) => { ran.push(mutant.patches[0].replace); return { kind: MUTATION_OUTCOME.ASSERTION_KILLED }; },
    log: () => {},
  });
  assert.deepEqual(ran, ['BASE'], 'на базе прогоняется определение базы');
  assert.equal(verdict, 'introduced');
});

test('#568: не готовится и на базе — предсуществующий; нового свидетеля оправдывать нечем', async () => {
  const mutant = { id: 'w', guard: 'g', patches: [] };
  assert.equal(await attributeSetupFailure(mutant, setup, 'base-sha', {
    registryOf: async () => [mutant],
    run: () => ({ kind: MUTATION_OUTCOME.SETUP }),
    log: () => {},
  }), 'pre-existing');
  // Мутанта, которого в базе нет, оправдывать нечем по построению.
  assert.equal(await attributeSetupFailure(mutant, setup, 'base-sha', {
    registryOf: async () => [],
    run: () => { throw new Error('прогон не должен случиться'); },
    log: () => {},
  }), 'introduced');
});

test('#568: сказать нечего — отказ остаётся отказом этой задачи', async () => {
  const mutant = { id: 'w', guard: 'g', patches: [] };
  const quiet = { log: () => {}, run: () => ({ kind: MUTATION_OUTCOME.SETUP }) };
  assert.equal(await attributeSetupFailure(mutant, setup, '', { ...quiet, registryOf: async () => [mutant] }), null,
    'базы нет');
  assert.equal(await attributeSetupFailure(mutant, setup, 'base-sha', { ...quiet, registryOf: async () => null }), null,
    'реестр базы не прочитан');
  assert.equal(await attributeSetupFailure(mutant, setup, 'base-sha', {
    ...quiet, registryOf: async () => { throw new Error('git сломался'); },
  }), null, 'чтение реестра бросило');
});

test('#568: раннер не красит гейт предсуществующим отказом', () => {
  const source = readFileSync(new URL('../scripts/mutation-gate.mjs', import.meta.url), 'utf8');
  assert.match(source, /await attributeSetupFailure\(entry\.mutant, outcome, rangeBase\)/,
    'раннер зовёт атрибуцию на исходе подготовки');
  assert.match(source, /preExisting\.push\(entry\.mutant\.id\);/);
  // Итог считается без предсуществующих, иначе «не красим» осталось бы словами.
  assert.match(source, /return caught === toRun\.length - preExisting\.length \? 0 : 1;/);
  assert.match(source, /pre-existing-setup-failures=/,
    'список назван машиночитаемой строкой: его читает человек и CI');
});

// ---- #650: a name filter that matches no test is a setup failure ----------
import { mkdtempSync, rmSync, writeFileSync as writeFixture } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  emptyTestSelection, executedTestNames, nodeTestSelection, shellWords,
  staticTestNames, staticTestSelectionProblems,
} from '../scripts/mutation-guard-outcome.mjs';
import { MUTANTS } from '../scripts/mutation-registry.mjs';

const EMPTY_TAP = 'TAP version 13\n# Subtest: test/x.test.mjs\nok 1 - test/x.test.mjs\n  ---\n'
  + '  duration_ms: 40\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n';
const NAMED_TAP = 'TAP version 13\n# Subtest: \\#650 named\nok 1 - \\#650 named\n  ---\n  ...\n'
  + '1..1\n# tests 1\n# pass 1\n# fail 0\n';

test('#650 selection: patterns and files of a name-filtered node --test, POSIX quoting', () => {
  assert.deepEqual(nodeTestSelection('node --test --test-name-pattern="#518 AC1/AC2 \\(отбор\\)" test/a.test.mjs'),
    { patterns: ['#518 AC1/AC2 \\(отбор\\)'], files: ['test/a.test.mjs'] },
    'inside "…" a backslash before ( stays: it is part of the RegExp');
  assert.deepEqual(nodeTestSelection("node --test --test-name-pattern 'a|b' --test-name-pattern=c x.test.mjs y.test.mjs"),
    { patterns: ['a|b', 'c'], files: ['x.test.mjs', 'y.test.mjs'] });
  assert.equal(nodeTestSelection('node --test test/a.test.mjs'), null, 'no filter — nothing to prove empty');
  assert.equal(nodeTestSelection('node demo/smoke_x.mjs'), null);
  assert.deepEqual(shellWords('a "b \\" c" d\\ e'), ['a', 'b " c', 'd e']);
});

test('#650 clean run: zero executed tests under a name filter is setup, not a healthy witness', () => {
  const guard = 'node --test --test-name-pattern="renamed test" test/x.test.mjs';
  const outcome = runGuardPhases(guard, { execute: () => result(0, EMPTY_TAP) });
  assert.equal(outcome.kind, MUTATION_OUTCOME.SETUP);
  assert.match(outcome.detail, /не совпал ни с одним тестом в test\/x\.test\.mjs/);
  assert.equal(isProofOutcome(outcome), false);
  assert.equal(runGuardPhases(guard, { execute: () => result(0, NAMED_TAP) }).kind,
    MUTATION_OUTCOME.SURVIVED, 'a matched green test is an honest survivor');
  assert.equal(runGuardPhases('node --test test/x.test.mjs', { execute: () => result(0, EMPTY_TAP) }).kind,
    MUTATION_OUTCOME.SURVIVED, 'without a filter an empty file is not this rule');
  assert.equal(emptyTestSelection(guard, 'no reporter output'), null, 'no summary — nothing to judge');
  assert.deepEqual(executedTestNames(NAMED_TAP), ['#650 named']);
  assert.deepEqual(executedTestNames('ok 1 - t # SKIP test name does not match\n# tests 1\n'), []);
});

test('#650 mutant run: an empty selection on the head, healthy on the base, is introduced by the diff', () => {
  const guard = 'node --test --test-name-pattern="renamed test" test/x.test.mjs';
  const head = runGuardPhases(guard, { execute: () => result(0, EMPTY_TAP) });
  const base = runGuardPhases(guard, { execute: () => result(1, 'not ok 1 - renamed test\ncode: ERR_ASSERTION') });
  assert.equal(head.kind, MUTATION_OUTCOME.SETUP);
  assert.equal(setupFailureOwner(head, base), 'introduced');
  assert.equal(setupFailureOwner(head, runGuardPhases(guard, { execute: () => result(0, EMPTY_TAP) })),
    'pre-existing');
});

test('#650 the installed node really reports an unmatched filter as the file alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-650-'));
  try {
    const file = join(dir, 'x.test.mjs');
    writeFixture(file, "import test from 'node:test';\ntest('real name', () => {});\n");
    const run = (pattern) => {
      const command = `node --test --test-name-pattern=${JSON.stringify(pattern)} ${JSON.stringify(file)}`;
      // Outside a test runner, as the gate runs guards: NODE_TEST_CONTEXT would
      // switch the child to the parent's serialized protocol.
      const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
      const r = spawnSync(command, { shell: true, encoding: 'utf8', env });
      return runGuardPhases(command, { execute: () => r });
    };
    assert.equal(run('no such name').kind, MUTATION_OUTCOME.SETUP);
    assert.equal(run('real name').kind, MUTATION_OUTCOME.SURVIVED);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#650 static check: names, regex escapes, dynamic names only warn', () => {
  const source = "test('#518 AC1/AC2 (отбор): x', () => {});\nt.test(\"inner\", () => {});\n"
    + 'test(`dyn ${n}`, () => {});\n';
  assert.deepEqual(staticTestNames(source), { names: ['#518 AC1/AC2 (отбор): x', 'inner'], dynamic: true });
  const read = (file) => (file === 'a.test.mjs' ? source : file === 'b.test.mjs' ? "test('b', () => {});" : null);
  assert.deepEqual(staticTestSelectionProblems('node --test --test-name-pattern="AC2 \\(отбор\\)" a.test.mjs', read), []);
  assert.deepEqual(staticTestSelectionProblems('tsc && node --test --test-name-pattern="nope" b.test.mjs', read)
    .map((p) => p.level), ['error']);
  assert.deepEqual(staticTestSelectionProblems('node --test --test-name-pattern="nope" a.test.mjs', read)
    .map((p) => p.level), ['warn'], 'a ${…} name could match at run time');
  assert.deepEqual(staticTestSelectionProblems('node --test --test-name-pattern="x" gone.test.mjs', read)
    .map((p) => p.level), ['error']);
});

test('#650 registry: every name-filtered guard matches a static test name', () => {
  const read = (file) => {
    try { return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'); } catch { return null; }
  };
  const errors = MUTANTS.flatMap((m) => staticTestSelectionProblems(m.guard, read)
    .filter((p) => p.level === 'error').map((p) => `${m.id}: ${p.text}`));
  assert.deepEqual(errors, []);
});
