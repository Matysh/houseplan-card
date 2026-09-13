/**
 * Honest outcome taxonomy for one mutation witness (#550).
 *
 * A shell command such as `tsc && fix-test-build && node --test` has two
 * different meanings: the prefix prepares the oracle, while only the last
 * command can prove the behavioural assertion.  Treating every non-zero exit
 * as "caught" turns a missing dependency or a mutant that no longer compiles
 * into false test evidence.  This module keeps that distinction pure and
 * fixture-testable; the worktree/build orchestration remains in
 * mutation-gate.mjs.
 */

export const MUTATION_OUTCOME = Object.freeze({
  INVALID: 'invalid-mutation',
  SETUP: 'setup-failure',
  ASSERTION_KILLED: 'assertion-killed',
  COMPILE_KILLED: 'compile-killed',
  SURVIVED: 'survived',
  INTERRUPTED: 'infrastructure-interruption',
});

export const MUTATION_PROOF = Object.freeze({
  ASSERTION: 'assertion',
  COMPILE: 'compile',
});

const outputOf = (result = {}) => `${result.stdout || ''}\n${result.stderr || ''}`.trim();

/** Split `&&` only when it is a shell operator, not text inside quotes. */
export function splitAndChain(command) {
  const parts = [];
  let start = 0;
  let quote = '';
  let escaped = false;
  const text = String(command || '');
  for (let index = 0; index < text.length - 1; index++) {
    const char = text[index];
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === '&' && text[index + 1] === '&') {
      const part = text.slice(start, index).trim();
      if (part) parts.push(part);
      start = index + 2;
      index++;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

export function guardPhases(guard, proof = MUTATION_PROOF.ASSERTION) {
  if (!Object.values(MUTATION_PROOF).includes(proof)) {
    throw new Error(`unknown mutation oracle: ${proof}`);
  }
  const commands = splitAndChain(guard);
  if (!commands.length) throw new Error('empty mutation guard');
  // A compile-time witness is deliberately explicit. Its command is the
  // oracle itself; silently treating a prefix compile as evidence is forbidden.
  if (proof === MUTATION_PROOF.COMPILE) {
    if (commands.length !== 1) throw new Error('compile witness guard must be one command');
    return { setup: [], oracle: commands[0], proof };
  }
  return { setup: commands.slice(0, -1), oracle: commands.at(-1), proof };
}

function interruption(result = {}) {
  if (result.error || result.signal || result.status == null) {
    const code = result.error?.code || result.signal || 'no-exit-status';
    return { kind: MUTATION_OUTCOME.INTERRUPTED, detail: String(code), command: '' };
  }
  return null;
}

// These mean the declared oracle could not load/collect/start. Ordinary
// exceptions from product code are intentionally absent: a test that executes
// the mutated path and crashes has still exposed the regression.
const ORACLE_SETUP_FAILURE = new RegExp([
  'command not found', 'is not recognized as an internal or external command',
  'ENOENT', 'ERR_MODULE_NOT_FOUND', 'Cannot find (?:module|package)',
  'No module named', 'ImportError while (?:loading conftest|importing test module)',
  'ERROR collecting', 'collected 0 items', 'no tests ran',
].join('|'), 'i');

// Test frameworks include user/fixture text in failure diagnostics. A fixture
// may literally mention ERR_MODULE_NOT_FOUND, so a proven assertion failure
// must win over a setup-looking substring quoted inside that assertion.
const ASSERTION_EVIDENCE = /(?:ERR_ASSERTION|AssertionError|^FAILED\s+\S+)/im;

export function classifyCommandResult(result, { phase = 'oracle', proof = MUTATION_PROOF.ASSERTION } = {}) {
  const stopped = interruption(result);
  if (stopped) return { ...stopped, command: result?.command || '' };
  if (Number(result.status) === 0) {
    return { kind: MUTATION_OUTCOME.SURVIVED, detail: '', command: result?.command || '' };
  }
  const detail = outputOf(result).slice(-2000);
  if (phase === 'setup') {
    return { kind: MUTATION_OUTCOME.SETUP, detail, command: result?.command || '' };
  }
  if (proof !== MUTATION_PROOF.COMPILE && !ASSERTION_EVIDENCE.test(detail)
    && ORACLE_SETUP_FAILURE.test(detail)) {
    return { kind: MUTATION_OUTCOME.SETUP, detail, command: result?.command || '' };
  }
  return {
    kind: proof === MUTATION_PROOF.COMPILE
      ? MUTATION_OUTCOME.COMPILE_KILLED : MUTATION_OUTCOME.ASSERTION_KILLED,
    proof,
    detail,
    command: result?.command || '',
  };
}

/** Execute setup commands in order, then the one declared oracle. */
export function runGuardPhases(guard, {
  proof = MUTATION_PROOF.ASSERTION,
  execute,
} = {}) {
  if (typeof execute !== 'function') throw new Error('mutation guard executor is required');
  let phases;
  try {
    phases = guardPhases(guard, proof);
  } catch (error) {
    return { kind: MUTATION_OUTCOME.INVALID, detail: error.message, command: String(guard || '') };
  }
  for (const command of phases.setup) {
    const result = execute(command, 'setup') || {};
    const outcome = classifyCommandResult({ ...result, command }, { phase: 'setup', proof });
    if (outcome.kind !== MUTATION_OUTCOME.SURVIVED) return outcome;
  }
  const result = execute(phases.oracle, 'oracle') || {};
  return classifyCommandResult({ ...result, command: phases.oracle }, { phase: 'oracle', proof });
}

/** Keep patch/preparation exceptions distinct from a test verdict. */
export function runMutationLifecycle({ apply, prepare, guard, proof, execute }) {
  try { apply(); } catch (error) {
    return { kind: MUTATION_OUTCOME.INVALID, detail: error.message, command: '' };
  }
  try { prepare(); } catch (error) {
    return { kind: MUTATION_OUTCOME.SETUP, detail: error.message, command: '' };
  }
  return runGuardPhases(guard, { proof, execute });
}

export function isProofOutcome(outcome) {
  return (outcome?.kind === MUTATION_OUTCOME.ASSERTION_KILLED
      && outcome.proof === MUTATION_PROOF.ASSERTION)
    || (outcome?.kind === MUTATION_OUTCOME.COMPILE_KILLED
      && outcome.proof === MUTATION_PROOF.COMPILE);
}
