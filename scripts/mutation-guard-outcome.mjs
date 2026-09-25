/**
 * Honest outcome taxonomy for one mutation witness (#550).
 *
 * A shell command such as `tsc && fix-test-build && node --test` has two
 * different meanings: the prefix prepares the oracle, while only the last
 * command can prove the behavioural assertion.  Treating every non-zero exit
 * as "caught" turns a missing dependency or a mutant that no longer compiles
 * into false test evidence.  This module keeps that distinction pure and
 * fixture-testable; the worktree/build orchestration lives in
 * mutation-execution.mjs.
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

/**
 * Кому принадлежит отказ подготовки (#568).
 *
 * Свидетель, который не готовится к прогону, краснит гейт той задачи, чей дифф
 * его выбрал, — но причина может лежать в чужом коммите. Единственное честное
 * доказательство здесь — прогон ТОГО ЖЕ мутанта на дереве базы диапазона:
 * ложных срабатываний быть не может, потому что сравниваются два прогона одного
 * мутанта, а не код с ожиданием.
 *
 * `null` означает «сказать нечего»: базы нет либо прогон на ней сорвался. Тогда
 * поведение остаётся прежним — отказ считается отказом этой задачи, потому что
 * недоказанная невиновность не оправдание.
 */
export function setupFailureOwner(headOutcome, baseOutcome) {
  if (headOutcome?.kind !== MUTATION_OUTCOME.SETUP) return null;
  if (!baseOutcome) return null;
  if (baseOutcome.kind === MUTATION_OUTCOME.SETUP) return 'pre-existing';
  if (baseOutcome.kind === MUTATION_OUTCOME.INTERRUPTED) return null;
  return 'introduced';
}

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
const ASSERTION_EVIDENCE = /(?:ERR_ASSERTION|AssertionError|^FAILED\s+\S+|^# Subtest:|^✖\s+)/im;

/**
 * A `--test-name-pattern` that matches no test (#650).
 *
 * `node --test --test-name-pattern=X file` with no test named like X exits 0:
 * TAP reports only the file itself (`ok 1 - test/file.test.mjs`). On the clean
 * run that reads as a healthy witness and on the mutant as `survived`, although
 * no assertion executed either time — typically a task renamed the test. It is
 * a setup failure of the oracle, not a verdict about the code.
 */
const TEST_FILE = /\.(?:m|c)?[jt]s$/;
const looksLikePath = (name) => /^[\w@.~/\\:-]+$/.test(name) && TEST_FILE.test(name);

/** Shell-like words; quotes group and are removed, `\` escapes outside '...'. */
export function shellWords(command) {
  const words = [];
  let word = '';
  let quote = '';
  let active = false;
  const text = String(command || '');
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote) { quote = ''; continue; }
      // POSIX: inside "…" a backslash escapes only $ ` " \ and newline.
      if (char === '\\' && quote === '"' && /[$`"\\\n]/.test(text[index + 1] || '')) {
        word += text[++index];
        continue;
      }
      word += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; active = true; continue; }
    if (char === '\\' && index + 1 < text.length) { word += text[++index]; active = true; continue; }
    if (/\s/.test(char)) {
      if (active) words.push(word);
      word = ''; active = false;
      continue;
    }
    word += char; active = true;
  }
  if (active) words.push(word);
  return words;
}

/**
 * `{ patterns, files }` of one `node --test` command that filters by name, or
 * `null` when the command runs no name filter (nothing to prove empty).
 */
export function nodeTestSelection(command) {
  const words = shellWords(command);
  const node = words.findIndex((word, index) => /(?:^|\/)node(?:\.exe)?$/.test(word)
    && words[index + 1] === '--test');
  if (node < 0) return null;
  const patterns = [];
  const files = [];
  for (let index = node + 2; index < words.length; index++) {
    const word = words[index];
    if (word.startsWith('--test-name-pattern=')) { patterns.push(word.slice('--test-name-pattern='.length)); continue; }
    if (word === '--test-name-pattern' && index + 1 < words.length) { patterns.push(words[++index]); continue; }
    if (word.startsWith('-')) continue;
    if (TEST_FILE.test(word)) files.push(word);
  }
  return patterns.length ? { patterns, files } : null;
}

/** Node's pattern grammar: `/source/flags` or a plain RegExp source. */
export function testNamePatternRegExp(pattern) {
  const literal = /^\/(.*)\/([a-z]*)$/s.exec(pattern);
  return literal ? new RegExp(literal[1], literal[2]) : new RegExp(pattern);
}

/**
 * Names of tests the reporter says were executed (TAP and spec), excluding
 * the per-file wrapper and tests skipped by the pattern. `null` when the
 * output carries no reporter summary at all — then nothing can be judged.
 */
export function executedTestNames(output) {
  const text = String(output || '');
  if (!/^\s*(?:#|ℹ) tests \d+/m.test(text)) return null;
  const names = [];
  for (const match of text.matchAll(/^\s*(?:not )?ok \d+ - (.+?)\s*$/gm)) {
    const [name, directive = ''] = match[1].split(/\s+#\s+/);
    if (/^SKIP\b/i.test(directive)) continue;
    const plain = name.replace(/\\#/g, '#').trim();
    if (!looksLikePath(plain)) names.push(plain);
  }
  for (const match of text.matchAll(/^\s*[✔✖] (.+?) \(\d[\d.]*m?s\)\s*$/gm)) {
    const plain = match[1].trim();
    if (!looksLikePath(plain) && !names.includes(plain)) names.push(plain);
  }
  return names;
}

/** Diagnostic text when a name-filtered oracle executed no test; else `null`. */
export function emptyTestSelection(command, output) {
  const selection = nodeTestSelection(command);
  if (!selection) return null;
  const names = executedTestNames(output);
  if (names === null || names.length) return null;
  return `--test-name-pattern ${selection.patterns.map((p) => JSON.stringify(p)).join(', ')}`
    + ` не совпал ни с одним тестом в ${selection.files.join(' ') || 'выбранных файлах'}`
    + ' — свидетель не исполнил ни одного ассерта (#650)';
}

/**
 * Static test names of a test source: `test(`, `it(`, `describe(`, `suite(`
 * and `t.test(` with a literal first argument. A template literal with `${…}`
 * is dynamic: it cannot be proven absent.
 */
export function staticTestNames(source) {
  const names = [];
  let dynamic = false;
  const call = /(?:^|[^\w.$]|\bt\.)(?:test|it|describe|suite)(?:\.(?:only|skip|todo))?\(\s*(?:(['"])((?:\\.|(?!\1)[^\\\n])*)\1|`((?:\\.|[^\\`])*)`)/g;
  for (const match of String(source || '').matchAll(call)) {
    if (match[3] !== undefined) {
      if (/\$\{/.test(match[3])) { dynamic = true; continue; }
      names.push(match[3]);
    } else {
      names.push(match[2].replace(/\\(.)/g, '$1'));
    }
  }
  return { names, dynamic };
}

/**
 * Registry-time check of one guard: every name-filtered `node --test` must
 * match at least one static test name in its files. `read(file)` returns the
 * source or `null` for a missing file.
 */
export function staticTestSelectionProblems(guard, read) {
  const problems = [];
  for (const command of splitAndChain(guard)) {
    const selection = nodeTestSelection(command);
    if (!selection) continue;
    if (!selection.files.length || selection.files.some((file) => /[*?[]/.test(file))) continue;
    let regexps;
    try {
      regexps = selection.patterns.map(testNamePatternRegExp);
    } catch (error) {
      problems.push({ level: 'error', text: `--test-name-pattern не RegExp: ${error.message}` });
      continue;
    }
    const names = [];
    let dynamic = false;
    const missing = selection.files.filter((file) => read(file) == null);
    if (missing.length) {
      problems.push({ level: 'error', text: `нет файла ${missing.join(' ')}` });
      continue;
    }
    for (const file of selection.files) {
      const found = staticTestNames(read(file));
      names.push(...found.names);
      dynamic ||= found.dynamic;
    }
    if (names.some((name) => regexps.some((regexp) => regexp.test(name)))) continue;
    const text = `--test-name-pattern ${selection.patterns.map((p) => JSON.stringify(p)).join(', ')}`
      + ` не совпадает ни с одним тестом в ${selection.files.join(' ')} (#650)`;
    problems.push(dynamic
      ? { level: 'warn', text: `${text}; в файле есть имена с \${…} — проверить нельзя` }
      : { level: 'error', text });
  }
  return problems;
}

export function classifyCommandResult(result, { phase = 'oracle', proof = MUTATION_PROOF.ASSERTION } = {}) {
  const stopped = interruption(result);
  if (stopped) return { ...stopped, command: result?.command || '' };
  if (Number(result.status) === 0) {
    // #650: a green oracle that executed no named test proves nothing either way.
    const empty = phase === 'oracle' ? emptyTestSelection(result?.command, outputOf(result)) : null;
    if (empty) return { kind: MUTATION_OUTCOME.SETUP, detail: empty, command: result?.command || '' };
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
