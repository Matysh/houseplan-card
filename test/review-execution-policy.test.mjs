import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { bashProblem, literalArgv, reportProblems, toolProblem, traceProblems,
  REVIEW_CLI_VERSION, REVIEW_CLI_SHA256, HOOK_TIMEOUT_SECONDS, hookCommand, hookStartupAcceptsDeny, executionSettings,
  adapterProblems } from '../scripts/review-execution-policy.mjs';
import { buildReviewCapabilities, REVIEW_MCP_NATIVE_TOOL_NAME } from '../scripts/review-capabilities.mjs';
import { reviewResultProblems, sha256, PASSPORT_FIELDS } from '../scripts/review-result-gate.mjs';
import { NATIVE_CALL_DIGEST_ALGORITHM as CALL_DIGEST_ALGORITHM, nativeCallDigest as callDigest } from '../scripts/review-native-call-digest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputs = [join(tmpdir(), 'hp-policy-report.md')];
const policy = { schema: 2, sha: 'a'.repeat(40), base: 'b'.repeat(40), root: resolve(root), stage: 'code', kind: 'task', outputs,
  callDigestAlgorithm: CALL_DIGEST_ALGORITHM,
  files: ['PROCESS.md', 'AGENTS.md', 'test/review-result-gate.test.mjs', 'scripts/ci-profiles.mjs', 'scripts/mutation-gate.mjs', 'tsconfig.test.json'] };
policy.capabilities = buildReviewCapabilities(policy);
const bash = command => ({ tool_name: 'Bash', tool_input: { command } });
const call = (id, name, input) => ({ type: 'tool_use', id, name, input });
const report = call('report', 'Write', { file_path: outputs[0], content: '# Review\nOrdinary unchanged-input unit checks only.' });
const trace = calls => [{ type: 'assistant', message: { content: calls } },
  { type: 'user', message: { content: calls.map(c => ({ type: 'tool_result', tool_use_id: c.id, content: 'synthetic observed result' })) } },
  { type: 'result', subtype: 'success', is_error: false, permission_denials: [] }];
const journal = calls => calls.map(c => ({ id: c.id, callDigestAlgorithm: CALL_DIGEST_ALGORITHM,
  input: callDigest(c.name, c.input), denied: false }));

test('#1084 native Grep projection preserves exact audit identity and all refusal paths', () => {
  const grep = call('grep-alias', 'Grep', { pattern: 'needle', path: 'src', '-l': true });
  const calls = [grep, report], messages = trace(calls), rows = journal(calls);
  rows[0].input = callDigest('Grep', { pattern: 'needle', path: 'src', output_mode: 'files_with_matches' });
  assert.deepEqual(traceProblems(messages, rows, policy), []);
  for (const change of [{ input: 'different' }, { denied: true }, { callDigestAlgorithm: 'sha256/hp-json-keys-v1' },
    { callDigestAlgorithm: 'unknown' }]) assert.ok(traceProblems(messages, [{ ...rows[0], ...change }, rows[1]], policy).length);
  assert.ok(traceProblems(messages, rows.slice(1), policy).length);
  assert.ok(traceProblems(messages, [rows[0], ...rows], policy).length);
  for (const input of [{ ...grep.input, pattern: 'changed' }, { ...grep.input, path: 'other' },
    { ...grep.input, '-l': false }, { ...grep.input, unexpected: true }, { ...grep.input, output_mode: 'count' }])
    assert.ok(traceProblems(trace([{ ...grep, input }, report]), rows, policy).length);
  assert.ok(traceProblems(messages, rows, { ...policy, callDigestAlgorithm: 'sha256/hp-json-keys-v1' }).length);
});

test('#1065 native hook settings deny on startup/SDK timeout failures, before any execution', () => {
  const settings = executionSettings('unchanged handler');
  assert.equal(settings.disableAllHooks, false);
  const group = settings.hooks.PreToolUse[0];
  assert.equal(group.matcher, '.*');
  assert.equal(group.hooks[0].onFailure, 'block');
  assert.equal(group.hooks[0].timeout, HOOK_TIMEOUT_SECONDS);
  assert.equal(group.hooks[0].command, 'unchanged handler');
});

test('#1065 native reads and opaque checks are allowed; generic shell is never exposed', () => {
  for (const command of ['git diff origin/dev...HEAD', 'git log --format=%H --max-count=1',
    'git diff --no-ext-diff --no-textconv origin/dev...HEAD', 'git diff --output-indicator-new=+ HEAD',
    'rg -n limit scripts', 'sed -n 30,50p PROCESS.md', 'sed -n 1p PROCESS.md AGENTS.md',
    'node --test test/review-result-gate.test.mjs', 'node --test --test-name-pattern="schema failure" test/review-result-gate.test.mjs',
    'node scripts/ci-profiles.mjs --check', 'node scripts/mutation-gate.mjs --check', 'npm run build']) {
    assert.ok(toolProblem(bash(command), policy), command);
  }
  for (const name of ['Read', 'Grep', 'Glob', 'ToolSearch'])
    assert.equal(toolProblem({ tool_name: name, tool_input: {} }, policy), null);
  for (const check_id of ['unit:test/review-result-gate.test.mjs', 'unknown opaque id'])
    assert.equal(toolProblem({ tool_name: REVIEW_MCP_NATIVE_TOOL_NAME, tool_input: { check_id } }, policy), null);
  for (const input of [{}, { check_id: '' }, { check_id: 'x'.repeat(257) }, { check_id: 3 },
    { check_id: 'known', command: 'ls' }, { check_id: 'known', env: {} }, { check_id: 'known', cwd: '/' }])
    assert.ok(toolProblem({ tool_name: REVIEW_MCP_NATIVE_TOOL_NAME, tool_input: input }, policy));
  assert.equal(toolProblem({ tool_name: 'Write', tool_input: report.input }, policy), null);
  assert.ok(toolProblem(bash('npm run build'), { ...policy, stage: 'spec' }));
  assert.ok(policy.capabilities.checks.some(check => check.id === 'unit:test/review-result-gate.test.mjs'),
    'ordinary unchanged unit capability remains available through fixed recipes');
});

// These strings are ordinary hook INPUTS. None is executed, nor is any
// canonical implementation/guard/bundle patched to obtain a negative result.
for (const command of [
  "sed -i 's/timeout-minutes: 35/timeout-minutes: 25/' .github/workflows/validate.yml",
  'sed -n 1p -i PROCESS.md', 'sed -n 1p --in-place PROCESS.md',
  "sed -n 1p -e '1e forbidden-action' PROCESS.md",
  "sed -n 1p --expression='1e forbidden-action' PROCESS.md",
  'sed -n 1p --file=/tmp/foreign-script PROCESS.md',
  'sed -n 1p PROCESS.md -i AGENTS.md', 'sed -n 1p /tmp/untracked-input',
  'git checkout -- .github/workflows/validate.yml', 'git restore test-build/guard.js',
  'node -e "require(\'fs\').writeFileSync(\'guard.js\', \'false\')"',
  'python -c "open(\'guard.py\',\'w\').write(\'false\')"', 'cp /tmp/patched.js test-build/guard.js',
  'node /tmp/patched-guard.mjs', 'node scripts/ci-profiles.mjs --write', 'node scripts/mutation-gate.mjs --execute-nightly',
  'npm run build; node --test test/review-result-gate.test.mjs', 'echo false > src/guard.ts',
  'node --test --import=/tmp/patch.mjs test/review-result-gate.test.mjs',
  'node --test --test-timeout=0 test/review-result-gate.test.mjs',
  'node --test --test-name-pattern=all', 'python -m pytest -q',
  'PATH=/tmp/bin node --test test/review-result-gate.test.mjs', 'rg --pre=patch.sh guard',
  'git diff --output=src/guard.ts', 'git -c alias.patch=whatever patch',
  'git diff --out=src/guard.ts', 'git diff --o=src/guard.ts', 'git diff --ext-dif',
  'git cat-file --textc HEAD:src/guard.ts', 'git cat-file --filt HEAD:src/guard.ts',
  'git log --open-files-in-p=whatever',
  'git cat-file --filters HEAD:src/guard.ts',
  'node scripts/ci-profiles.mjs --writ?',
  'node --test $(touch guard.js)', 'node --test `touch guard.js`',
]) test(`#1065 refuses unsafe requested argv as DATA: ${command.split(' ')[0]} ${command.length}`, () => {
  assert.ok(toolProblem(bash(command), policy), command);
});

test('#1065 Write/Edit/generated-guard and outside-script paths cannot change implementation', () => {
  for (const path of ['src/guard.ts', 'test-build/guard.js', '.github/workflows/validate.yml', '.claude/settings.json',
    join(tmpdir(), 'patched.js'), join(tmpdir(), 'review-execution-policy.json')]) {
    assert.ok(toolProblem({ tool_name: 'Write', tool_input: { file_path: resolve(root, path), content: 'x' } }, policy));
  }
  assert.ok(toolProblem({ tool_name: 'Edit', tool_input: report.input }, policy));
  assert.ok(toolProblem({ tool_name: 'Agent', tool_input: {} }, policy));
  assert.ok(toolProblem({ tool_name: 'mcp__github__issue_write' }, { ...policy, kind: 'ship' }));
  assert.equal(toolProblem({ tool_name: 'Read', tool_input: {} }, policy), null);
  assert.ok(toolProblem({ tool_name: 'WebFetch', tool_input: {} }, policy));
  for (const name of ['WebSearch', 'TodoWrite', 'mcp__github__issue_read', 'mcp__github__add_issue_comment'])
    assert.ok(toolProblem({ tool_name: name, tool_input: {} }, policy));
  assert.ok(toolProblem({ tool_name: 'Write', tool_input: { file_path: outputs[0],
    content: 'Ordinary negative-input: temporary patch and test run, then git checkout -- guard.mjs.' } }, policy));
  assert.ok(toolProblem({ tool_name: 'mcp__github__add_issue_comment', tool_input: {
    body: 'Ordinary negative-input: temporary patch and test run, then git checkout -- guard.mjs.' } }, policy));
  assert.equal(literalArgv('node --test "unfinished'), null);
  assert.ok(bashProblem({ command: 'npm run build', run_in_background: true }, policy));
});

test('#1065 journal binds every call and refuses missing, duplicate, forbidden and incomplete traces', () => {
  const check = call('check', 'Read', { file_path: 'test/review-result-gate.test.mjs' });
  const calls = [check, report];
  assert.deepEqual(traceProblems(trace(calls), journal(calls), policy), []);
  assert.ok(traceProblems(trace(calls), journal(calls), policy, { reportText: 'foreign report' }).length);
  assert.ok(traceProblems(trace(calls).filter(m => m.type !== 'user'), journal(calls), policy).length,
    'a request/approval alone does not prove an observed tool result');
  for (const [messages, entries] of [[null, []], [[], []], [trace(calls), []],
    [trace([check, check, report]), journal(calls)], [trace(calls), [...journal(calls), journal(calls)[0]]],
    [trace(calls), journal(calls).map(e => ({ ...e, input: 'foreign' }))]]) {
    assert.ok(traceProblems(messages, entries, policy).length);
  }
  const forbidden = call('patch', 'Bash', { command: 'sed -i x guard.js' });
  assert.ok(traceProblems(trace([forbidden, report]), [{ ...journal([forbidden])[0], denied: true }, ...journal([report])], policy)
    .includes('review requested a forbidden tool call'));
  const output = { summary: 'unchanged ordinary checks', high: 0, medium: 0 };
  const channel = call('schema', 'StructuredOutput', output);
  const sdk = trace([...calls, channel]); sdk.at(-1).structured_output = output;
  assert.equal(toolProblem({ tool_name: 'StructuredOutput', tool_input: output }, policy), null);
  assert.deepEqual(traceProblems(sdk, journal(calls), policy), [], 'SDK output may have no hook because it executes nothing');
  assert.deepEqual(traceProblems(sdk, journal([...calls, channel]), policy), [], 'a native hook event is also checked when present');
  assert.ok(traceProblems(sdk.map(m => m.type === 'result' ? { ...m, structured_output: { summary: 'foreign' } } : m), journal(calls), policy).length);
  assert.ok(traceProblems(sdk, journal([report]), policy).length, 'an executable call never inherits the schema-channel exemption');
});

test('#1065 repair: reordered equal JSON hook input must bind without weakening semantic changes', () => {
  const observed = call('ordered', 'Read', { file_path: 'fixture', offset: 1, limit: 10 });
  const hook = { ...observed, input: { limit: 10, offset: 1, file_path: 'fixture' } };
  assert.deepEqual(traceProblems(trace([observed, report]), journal([hook, report]), policy), []);
});

test('#1065 repair: builtin ToolSearch discovers a catalog, actual unsafe tools still refuse', () => {
  assert.equal(toolProblem({ tool_name: 'ToolSearch', tool_input: { query: 'select:mcp__example__unsafe' } }, policy), null);
  assert.ok(toolProblem({ tool_name: 'mcp__example__unsafe', tool_input: {} }, policy));
});

test('#1065 current audit refuses missing, mixed and unknown policy/journal digest markers', () => {
  const calls = [report], records = journal(calls);
  for (const marker of [undefined, 'unknown', 'sha256/json-stringify-v1']) {
    assert.ok(traceProblems(trace(calls), records, { ...policy, callDigestAlgorithm: marker }).length);
    assert.ok(traceProblems(trace(calls), records.map(row => ({ ...row, callDigestAlgorithm: marker })), policy).length);
  }
  const changed = { ...report, input: { ...report.input, content: report.input.content + ' ' } };
  assert.ok(traceProblems(trace([changed]), records, policy).length, 'exact report content remains bound');
  assert.ok(traceProblems(trace([{ ...report, name: 'Read' }]), records, policy).length, 'call name remains bound');
  for (const altered of [{ ...policy, schema: 1 }, { ...policy, capabilities: null },
    { ...policy, capabilities: { ...policy.capabilities, digest: '0'.repeat(64) } }])
    assert.ok(traceProblems(trace(calls), records, altered).length, 'current audit requires exact current capabilities');
});

test('#1065 parsed native adapter failure cannot become a valid audit from a terminal-looking partial trace', () => {
  const messages = trace([report]), executionFile = '/tmp/native-messages.json';
  const adapter = { schema: 'houseplan-native-review/v1', status: 'success', cliVersion: REVIEW_CLI_VERSION,
    cliSha256: REVIEW_CLI_SHA256, materialSha: policy.sha, exitCode: 0, exitSignal: null,
    executionFile, messages: messages.length };
  assert.deepEqual(adapterProblems(adapter, { policy, messages, executionFile }), []);
  for (const change of [{ status: 'invalid-or-truncated-native-stream' }, { exitCode: 1 }, { exitSignal: 'SIGTERM' },
    { materialSha: 'c'.repeat(40) }, { messages: 99 }, { executionFile: '/other' }, { cliSha256: '0'.repeat(64) }])
    assert.ok(adapterProblems({ ...adapter, ...change }, { policy, messages, executionFile }).length);
  const denied = trace([report]); denied.at(-1).permission_denials.push({ tool_name: 'Bash' });
  assert.ok(traceProblems(denied, journal([report]), policy).length);
});

test('#1065 check receipts bind opaque IDs and unique ledger entries without inventing PASS for failure/unavailable', () => {
  for (const [checkId, status] of [['unit:test/review-result-gate.test.mjs', 'failed'], ['unknown id', 'unavailable']]) {
    const requested = call('check', REVIEW_MCP_NATIVE_TOOL_NAME, { check_id: checkId });
    const recipe = policy.capabilities.checks.find(entry => entry.id === checkId);
    const receipt = { schema: 'houseplan-review-check-result/v1', receiptId: '11111111-1111-1111-1111-111111111111',
      checkId, materialSha: policy.sha, manifestDigest: policy.capabilities.digest, recipeDigest: recipe?.recipeDigest ?? null,
      callDigest: callDigest(requested.name, requested.input), materialUnchanged: true,
      executed: Boolean(recipe), status, exitCode: recipe ? 1 : null, steps: recipe ? [{ exitCode: 1 }] : [] };
    const messages = trace([requested, report]);
    messages[1].message.content[0].content = JSON.stringify(receipt);
    assert.deepEqual(traceProblems(messages, journal([requested, report]), policy, { checkEntries: [receipt] }), []);
    assert.ok(traceProblems(messages, journal([requested, report]), policy, { checkEntries: [] }).length);
    assert.ok(traceProblems(messages, journal([requested, report]), policy, { checkEntries: [receipt, receipt] }).length);
    assert.ok(traceProblems(messages, journal([requested, report]), policy,
      { checkEntries: [{ ...receipt, checkId: 'other' }] }).length);
    const phantom = trace([report]);
    assert.ok(traceProblems(phantom, journal([report]), policy, { checkEntries: [receipt] }).includes('orphan check execution receipt'));
  }
});

test('#1065 published historical claim is rejected as report DATA, not reenacted', () => {
  // Claim from accepted 0908d904 CODE-REVIEW-1064-r1.md:72. Copy only its
  // evidence sentence as inert DATA, so a later stable review archive does not
  // make an old document path a new runtime dependency.
  const old = 'Обычный negative-input case: временный sed -i 35→25 в validate.yml, прогон тех же двух тестов, немедленный git checkout -- (мутант не регистрировался, вне ночного workflow не исполнялся); оба теста красные.';
  assert.ok(reportProblems(old).some(p => p.startsWith('line 1:')));
  assert.deepEqual(reportProblems('Historical quoted claim: sed -i x; ordinary negative-input run was not valid evidence.\n> sed -i x ordinary run\nStatic --check; mutant registered, not executed.'), []);
  assert.deepEqual(reportProblems('Ordinary negative-input: sed -i command submitted as JSON DATA; hook returns deny, no execution.'), [],
    'a refused data request is not confused with execution of that command');
  const expected = Object.fromEntries(PASSPORT_FIELDS.map(f => [f, '']));
  const data = { 'review-document.md': old, 'verdict.json': JSON.stringify({ verdict: 'green', high: 0, medium: 0, summary: 'ok' }),
    'prepared.json': JSON.stringify({ schema: 1, ...expected }) };
  data['manifest.sha256'] = Object.entries(data).map(([name, value]) => `${sha256(value)}  ${name}`).join('\n');
  assert.ok(reviewResultProblems({ files: Object.keys(data), read: n => data[n], expected }).some(p => /temporary patch/.test(p)));
});

test('#1065 real hook refuses an unsafe request before any protected write or test execution', { skip: process.platform !== 'linux' }, t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-1065-policy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const repo = join(dir, 'repo'); mkdirSync(repo); mkdirSync(join(repo, 'test'));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', REVIEW_CLAUDE_VERSION: REVIEW_CLI_VERSION,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    REVIEW_KIND: 'task', REVIEW_DOC: join(dir, 'report.md') };
  const runGit = (...args) => execFileSync('git', ['-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args], { cwd: repo, env, stdio: 'pipe' });
  runGit('init', '-q');
  const guard = join(repo, 'guard.mjs'); writeFileSync(guard, 'export const limit = 35;\n');
  writeFileSync(join(repo, 'test', 'probe.test.mjs'), 'import "node:test";\n');
  runGit('add', '.'); runGit('commit', '-qm', 'synthetic immutable implementation');
  const script = fileURLToPath(new URL('../scripts/review-execution-policy.mjs', import.meta.url));
  const path = join(dir, 'policy.json');
  const invoke = (mode, input) => spawnSync(process.execPath, [script, mode, path], { cwd: repo, env, input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(invoke('prepare').status, 0);
  const externalReport = env.REVIEW_DOC;
  mkdirSync(join(repo, '..reports'));
  env.REVIEW_DOC = join(repo, '..reports', 'inside.md');
  assert.equal(invoke('prepare').status, 1, 'a name beginning with dots is still inside the reviewed material');
  env.REVIEW_DOC = externalReport;
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).callDigestAlgorithm, CALL_DIGEST_ALGORITHM);
  const settings = JSON.parse(readFileSync(`${path}.settings.json`, 'utf8'));
  assert.equal(settings.hooks.PreToolUse[0].hooks[0].onFailure, 'block');
  assert.equal(settings.hooks.PreToolUse[0].hooks[0].timeout, HOOK_TIMEOUT_SECONDS);
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /review-execution-policy\.mjs.*hook/);
  const before = readFileSync(guard, 'utf8');
  const response = invoke('hook', { tool_use_id: 'unsafe', ...bash('sed -i s/35/25/ guard.mjs') });
  assert.equal(response.status, 0);
  assert.equal(JSON.parse(response.stdout).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(readFileSync(guard, 'utf8'), before, 'ordinary hook input did not patch or execute the guard');
  const accepted = invoke('hook', { tool_use_id: 'safe', tool_name: REVIEW_MCP_NATIVE_TOOL_NAME,
    tool_input: { check_id: 'unit:test/probe.test.mjs' } });
  assert.equal(accepted.status, 0); assert.equal(accepted.stdout, '', 'normal permissions apply to allowed checks');
  assert.equal(JSON.parse(readFileSync(`${path}.jsonl`, 'utf8').split('\n')[0]).denied, true);
  const recorded = JSON.parse(readFileSync(`${path}.jsonl`, 'utf8').split('\n')[0]);
  assert.equal(recorded.callDigestAlgorithm, CALL_DIGEST_ALGORITHM);
  assert.equal(recorded.diagnostic.schema, 1, 'actual hook keeps optional safe shape metadata');
  assert.equal(recorded.diagnosticDecision.category, 'command-not-allowlisted');
  assert.equal(invoke('hook', { tool_use_id: 'catalog', tool_name: 'ToolSearch', tool_input: { query: 'select:mcp__example__unsafe' } }).stdout, '');
  const actualTool = invoke('hook', { tool_use_id: 'actual', tool_name: 'mcp__example__unsafe', tool_input: {} });
  assert.equal(JSON.parse(actualTool.stdout).hookSpecificOutput.permissionDecision, 'deny', 'catalog discovery never grants execution');
  assert.equal(invoke('audit').status, 1, 'missing execution/report cannot mint PASS');
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /^timeout --kill-after=1s 12s .+ \|\| exit 2$/,
    'handler launch/crash/inner deadline refuses before the longer outer hook deadline');

  // Fresh synthetic session: only input records/report DATA; the fixture never
  // runs a patched guard, a mutation CLI or even the proposed test command.
  assert.equal(invoke('prepare').status, 0);
  const commands = [call('ordinary', 'Read', { file_path: 'test/probe.test.mjs', offset: 1, limit: 10 }),
    call('catalog-only', 'ToolSearch', { query: 'select:mcp__example__unsafe' }),
    call('report', 'Write', { file_path: env.REVIEW_DOC, content: '# Ordinary unchanged-input review' })];
  for (const c of commands) {
    const input = c.name === 'Read' ? { file_path: c.input.file_path, limit: 10, offset: 1 } : c.input;
    assert.equal(invoke('hook', { tool_use_id: c.id, tool_name: c.name, tool_input: input }).stdout, '');
  }
  writeFileSync(env.REVIEW_DOC, commands.find(c => c.name === 'Write').input.content);
  const execution = join(dir, 'execution.json'); env.REVIEW_EXECUTION_FILE = execution;
  env.REVIEW_STRUCTURED_OUTPUT = JSON.stringify({ summary: 'ordinary immutable input checks' });
  const complete = trace(commands); complete.at(-1).structured_output = JSON.parse(env.REVIEW_STRUCTURED_OUTPUT);
  writeFileSync(execution, JSON.stringify(complete));
  const actualPolicy = JSON.parse(readFileSync(path));
  writeFileSync(join(dir, 'native-adapter.json'), JSON.stringify({ schema: 'houseplan-native-review/v1', status: 'success',
    cliVersion: REVIEW_CLI_VERSION, cliSha256: REVIEW_CLI_SHA256, materialSha: actualPolicy.sha,
    exitCode: 0, exitSignal: null, messages: trace(commands).length, executionFile: execution }));
  assert.equal(invoke('audit').status, 0, 'complete matching ordinary input session is accepted');
  writeFileSync(execution, JSON.stringify(complete.slice(0, 1)));
  assert.equal(invoke('audit').status, 1, 'truncated execution is not proof');
  writeFileSync(execution, JSON.stringify(complete));
  writeFileSync(env.REVIEW_DOC, 'Ordinary negative-input: temporary patch and test run, then git checkout -- guard.mjs.');
  assert.equal(invoke('audit').status, 1, 'false ordinary claim refuses publication');
  assert.equal(readFileSync(guard, 'utf8'), before);
  rmSync(`${path}.jsonl`);
  assert.equal(invoke('audit').status, 1, 'missing journal is a publication refusal, not prevention evidence');
  assert.equal(hookStartupAcceptsDeny(hookCommand({ policyPath: path }), { cwd: repo, env }), true);
});

test('#1065 unchanged launcher fails closed for unavailable and hanging dependencies', { skip: process.platform !== 'linux' }, t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-1065-launch-'));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const missing = hookCommand({ handler: join(dir, 'not-installed.mjs'), policyPath: join(dir, 'data.json') });
  assert.equal(spawnSync('/bin/sh', ['-c', missing], { encoding: 'utf8' }).status, 2);
  assert.equal(hookStartupAcceptsDeny(missing), false, 'a failed startup cannot start the model');
  // Inert external dependency DATA for the unchanged launcher. It has no
  // guard implementation, input dispatch or filesystem write, only a wait.
  const idle = join(dir, 'idle.mjs'); writeFileSync(idle, 'setInterval(() => {}, 1000);\n');
  const started = Date.now();
  const result = spawnSync('/bin/sh', ['-c', hookCommand({ handler: idle, policyPath: join(dir, 'data.json') })], {
    encoding: 'utf8', timeout: 25000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2, 'inner unchanged deadline yields blocking exit 2');
  assert.ok(Date.now() - started < HOOK_TIMEOUT_SECONDS * 1000);
});

for (const name of ['_process.yml', '_ship-review.yml', 'release-review.yml']) {
  test(`#1065 ${name} applies hook settings and mandatory trace/report audit before sealing`, () => {
    const workflow = parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'));
    const steps = workflow.jobs.model_review.steps;
    const index = label => steps.findIndex(s => s.name === label);
    const setup = index('Ограничить инструменты ревью (#1065)'), review = index('Review'),
      audit = index('Проверить execution boundary (#1065)'), seal = index('Запечатать результат модели');
    assert.ok(setup >= 0 && setup < review && review < audit && audit < seal);
    assert.match(steps[review].run, /review-native-runner\.mjs/);
    assert.equal(steps[review].env.REVIEW_POLICY, '${{ runner.temp }}/review-execution-policy.json');
    assert.equal(steps[review].with, undefined, 'pinned native launcher owns exact catalogue and empty settings argv');
    const prompt = steps.find(step => step.name === 'Подготовить native review prompt').env.REVIEW_PROMPT_TEXT;
    for (const [key, value] of Object.entries(steps[setup].env).filter(([key]) => ['REVIEW_DOC', 'REVIEW_FINDINGS'].includes(key)))
      assert.ok(prompt.includes(`${key}: ${value}`), `${key}: literal paths need no forbidden env expansion`);
    assert.match(prompt, /mcp__houseplan_review__run_check/);
    assert.match(steps[setup].run, /review-execution-policy\.mjs.*prepare/);
    assert.equal(steps[setup].env.REVIEW_CLAUDE_VERSION, '${{ steps.claude_bin.outputs.version }}');
    const bootstrap = steps.find(s => s.id === 'claude_bin');
    assert.match(bootstrap.run, /review-execution-policy\.mjs.*version/);
    assert.match(bootstrap.run, /test "\$\{actual%% \*\}" = "\$ver"/);
    assert.doesNotMatch(bootstrap.run, /claudeCodeVersion|ver="\$\{ver:-/);
    assert.match(steps[audit].run, /review-execution-policy\.mjs.*audit/);
    assert.equal(steps[audit]['continue-on-error'], undefined);
    assert.equal(steps[audit].env.REVIEW_EXECUTION_FILE, '${{ steps.review.outputs.execution_file }}');
    assert.equal(steps[audit].env.REVIEW_STRUCTURED_OUTPUT, '${{ steps.review.outputs.structured_output }}');
    assert.doesNotMatch(prompt, /git checkout -- \. && git clean -fd/);
  });
}
