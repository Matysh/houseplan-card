// Diagnostic orchestration only. Never a CODE verdict or CI-proof producer.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const HEX = /^[a-f0-9]{64}$/;
const NATIVE_HASH = '4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358';
const MODEL = 'claude-sonnet-5';
const SERVER = 'houseplan_review', MCP = 'mcp__houseplan_review__run_check';
const NATIVE = ['Read', 'Grep', 'Glob', 'Write', 'ToolSearch'];
const KNOWN = new Set([...NATIVE, 'StructuredOutput', MCP, 'Bash', 'Edit', 'MultiEdit', 'Agent', 'Task',
  'WebFetch', 'WebSearch', 'TodoWrite', 'Skill', 'ExitPlanMode', 'EnterPlanMode']);
const ALLOWED = new Set([...NATIVE, 'StructuredOutput', MCP]);
const CHECKS = ['read:diff', 'unit:test/native-probe.test.mjs'];
const SCHEMA = { type: 'object', additionalProperties: false, properties: {
  status: { type: 'string', enum: ['complete', 'incomplete'] }, summary: { type: 'string', maxLength: 2000 },
}, required: ['status', 'summary'] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, value) => writeFileSync(path, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const git = (cwd, args, encoding = 'utf8') => execFileSync('git', ['-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args],
  { cwd, encoding, maxBuffer: 32 * 1024 * 1024, timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
const gitText = (cwd, args) => git(cwd, args).trim();
const toolName = name => KNOWN.has(name) ? { name } : { name: 'unknown', sha256: hash(String(name)) };
const status = value => ['connected', 'failed', 'pending', 'needs-auth', 'disabled'].includes(value) ? value : 'unknown';
const privateRun = (file, args, options) => {
  const result = spawnSync(file, args, { ...options, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 45000, windowsHide: true });
  return { code: result.status, signal: result.signal, error: Boolean(result.error), stdout: result.stdout || '', stderr: result.stderr || '' };
};
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(?:GIT_|GH_TOKEN$|GITHUB_TOKEN$|ANTHROPIC_API_KEY$|CLAUDE_CODE_OAUTH_TOKEN$|NODE_OPTIONS$)/i.test(key)));

function scriptBindings(source, sha, toolkit) {
  const names = gitText(source, ['ls-tree', '-r', '--name-only', sha, 'scripts']).split('\n').filter(Boolean);
  const entries = names.map(path => {
    const expected = hash(git(source, ['show', sha + ':' + path], null));
    if (hash(readFileSync(join(toolkit, path))) !== expected) throw Error('toolkit differs from source');
    return { path, sha256: expected };
  });
  return { files: entries.length, sha256: hash(JSON.stringify(entries)) };
}

function launchFacts(env, sourceSha) {
  const branch = 'refs/heads/codex/archive/1065-native-probe';
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REPOSITORY !== 'Matysh/houseplan-card'
    || env.GITHUB_REF !== branch || env.GITHUB_RUN_ATTEMPT !== '1'
    || env.GITHUB_WORKFLOW_REF !== 'Matysh/houseplan-card/.github/workflows/docs-screenshots.yml@' + branch
    || !SHA.test(env.GITHUB_SHA || '') || !SHA.test(sourceSha)) throw Error('diagnostic launch identity refused');
  return { trigger: 'workflow_dispatch', sourceSha, carrierSha: env.GITHUB_SHA,
    run: /^\d+$/.test(env.GITHUB_RUN_ID || '') ? env.GITHUB_RUN_ID : null, attempt: '1' };
}

function prepare({ source, sourceSha, work }) {
  const launch = launchFacts(process.env, sourceSha);
  if (!isAbsolute(source) || !isAbsolute(work) || gitText(source, ['rev-parse', 'HEAD']) !== sourceSha
    || gitText(source, ['status', '--porcelain'])) throw Error('source material is not exact and clean');
  mkdirSync(work, { mode: 0o700 });
  const toolkit = join(work, 'toolkit'), fixture = join(work, 'fixture');
  mkdirSync(toolkit); mkdirSync(fixture); mkdirSync(join(fixture, 'test'));
  const archive = join(work, 'scripts.tar');
  write(archive, git(source, ['archive', '--format=tar', sourceSha, 'scripts'], null));
  execFileSync('tar', ['-xf', archive, '-C', toolkit], { timeout: 20000 });
  const bindings = scriptBindings(source, sourceSha, toolkit);
  const env = { ...cleanEnv(), GIT_AUTHOR_NAME: 'Synthetic probe', GIT_AUTHOR_EMAIL: 'probe@example.invalid',
    GIT_COMMITTER_NAME: 'Synthetic probe', GIT_COMMITTER_EMAIL: 'probe@example.invalid' };
  const commit = message => {
    execFileSync('git', ['add', '--all'], { cwd: fixture, env });
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', 'commit', '-qm', message], { cwd: fixture, env });
  };
  execFileSync('git', ['init', '-q'], { cwd: fixture, env });
  write(join(fixture, 'README.md'), '# Synthetic native compatibility probe\n\nNo product material or CODE review authority.\n');
  commit('Synthetic baseline');
  const base = gitText(fixture, ['rev-parse', 'HEAD']);
  write(join(fixture, 'test/native-probe.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('fixed check excludes ambient credentials', () => {\n  for (const key of ['CLAUDE_CODE_OAUTH_TOKEN','ANTHROPIC_API_KEY','GITHUB_TOKEN','GH_TOKEN','HP_NATIVE_PROBE_SECRET'])\n    assert.equal(typeof process.env[key], 'undefined', key + ' must be absent');\n});\n");
  commit('Synthetic ordinary test input');
  const fixtureSha = gitText(fixture, ['rev-parse', 'HEAD']);
  const policy = join(work, 'policy.json'), report = join(work, 'report.md');
  const prepared = privateRun(process.execPath, [join(toolkit, 'scripts/review-execution-policy.mjs'), 'prepare', policy],
    { cwd: fixture, env: { ...cleanEnv(), REVIEW_KIND: 'task', REVIEW_STAGE: 'code', REVIEW_BASE: base,
      REVIEW_CLAUDE_VERSION: '2.1.295', REVIEW_DOC: report } });
  write(join(work, 'prepare-private.json'), prepared);
  if (prepared.code !== 0 || prepared.error || prepared.signal) throw Error('unchanged policy preparation refused');
  const inputs = [policy, policy + '.settings.json', policy + '.checks.md'].map(path => ({ path, sha256: hash(readFileSync(path)) }));
  const prompt = join(work, 'prompt.txt');
  write(prompt, `This is ONE synthetic native compatibility diagnostic, never CODE review or acceptance.\nUse only the supplied closed tools. Do not explore the host, credentials, settings or environment.\nRead ${join(fixture, 'README.md')} and ${policy}.checks.md.\nCall mcp__houseplan_review__run_check exactly once for each ID: read:diff and unit:test/native-probe.test.mjs.\nUse Read to read the stdoutPath of each actual receipt. Then Write a short diagnostic report to ${report}.\nNo Bash/Edit/Agent/other MCP. Do not change any source. Do not simulate a check. An error/unavailable receipt means incomplete.\nFinally return the required structured status complete or incomplete and a short summary. No verdict/high/medium/route fields.\n`);
  inputs.push({ path: prompt, sha256: hash(readFileSync(prompt)) });
  write(join(work, 'state.json'), { launch, source, toolkit, fixture, fixtureSha, base, policy, prompt, report, inputs, bindings });
}

async function run({ work, native }) {
  const state = json(join(work, 'state.json'));
  const { runNativeReview, verifyNativeReviewBinary } = await import(pathToFileURL(join(state.toolkit, 'scripts/review-native-runner.mjs')));
  verifyNativeReviewBinary(native);
  const result = await runNativeReview({ cliPath: realpathSync(native), policyPath: state.policy, promptPath: state.prompt,
    jsonSchema: JSON.stringify(SCHEMA), kind: 'task', maxTurns: 16, executionDir: join(work, 'execution') },
  { timeoutMs: 7 * 60 * 1000, env: { ...process.env, HP_NATIVE_PROBE_SECRET: randomUUID() } });
  write(join(work, 'run-private.json'), result);
  if (!result.success) process.exitCode = 1;
}

// Pure projection: missing/unknown observations are failures, never inferred success.
export function summarizeProbe({ messages = [], checks = [], nativeHash, sourceSha, bindingOkay = false,
  auditOkay = false, runOkay = false, rawHash = null, adapterHash = null }) {
  const init = messages.filter(row => row?.type === 'system' && row.subtype === 'init');
  const row = init.length === 1 ? init[0] : null;
  const catalogue = Array.isArray(row?.tools) && row.tools.every(name => typeof name === 'string') ? row.tools : null;
  const servers = Array.isArray(row?.mcp_servers) ? row.mcp_servers : null;
  const calls = messages.filter(row => row?.type === 'assistant').flatMap(row => Array.isArray(row.message?.content) ? row.message.content : [])
    .filter(block => block?.type === 'tool_use');
  const names = [...new Set(calls.map(call => call.name))].sort();
  const checkCalls = calls.filter(call => call.name === MCP);
  const results = messages.filter(message => message?.type === 'result'), final = results.length === 1 ? results[0] : null;
  const issues = [];
  if (!catalogue || NATIVE.some(name => !catalogue.includes(name)) || new Set(catalogue).size !== catalogue.length)
    issues.push('catalogue-missing-or-incomplete');
  if (catalogue?.some(name => !ALLOWED.has(name)) || names.some(name => !ALLOWED.has(name))) issues.push('unexpected-tool');
  if (!servers || servers.length !== 1 || servers[0]?.name !== SERVER || servers[0]?.status !== 'connected') issues.push('server-not-exact-connected');
  if (row?.model !== MODEL) issues.push('observed-model-unknown-or-different');
  if (checkCalls.length !== CHECKS.length || CHECKS.some(id => checkCalls.filter(call => call.input?.check_id === id).length !== 1)
    || checks.length !== CHECKS.length || CHECKS.some(id => checks.filter(check => check.checkId === id).length !== 1)) issues.push('required-checks-missing-or-repeated');
  if (checks.some(check => check.status !== 'passed' || check.executed !== true || check.exitCode !== 0)) issues.push('required-check-not-passed');
  const reads = new Set(calls.filter(call => call.name === 'Read').map(call => call.input?.file_path));
  if (checks.some(check => !Array.isArray(check.steps) || check.steps.some(step => !reads.has(step.stdoutPath)))) issues.push('check-output-not-read');
  if (!final || final.subtype !== 'success' || final.is_error !== false || !Array.isArray(final.permission_denials)
    || final.permission_denials.length || final.structured_output?.status !== 'complete'
    || typeof final.structured_output?.summary !== 'string' || final.structured_output.summary.length > 2000
    || Object.keys(final.structured_output).some(key => !['status', 'summary'].includes(key))) issues.push('terminal-not-complete');
  if (nativeHash !== NATIVE_HASH || !SHA.test(sourceSha || '') || !bindingOkay || !auditOkay || !runOkay) issues.push('binding-audit-or-runtime-refused');
  if (!HEX.test(rawHash || '') || !HEX.test(adapterHash || '')) issues.push('trace-provenance-missing');
  return { schema: 'houseplan-native-compatibility-probe/v1', diagnosticOnly: true, verdictAuthority: false,
    status: issues.length ? 'refused-or-unknown' : 'observed-compatible', issues,
    sourceSha: SHA.test(sourceSha || '') ? sourceSha : null, nativeSha256: nativeHash === NATIVE_HASH ? nativeHash : null,
    requestedModel: MODEL, requestedEffort: 'high', maxTurns: 16, observedModelMatches: row?.model === MODEL,
    catalogue: { observed: Boolean(catalogue), tools: (catalogue || []).map(toolName) },
    servers: (servers || []).map(server => ({ name: server?.name === SERVER ? SERVER : 'unknown', status: status(server?.status) })),
    calls: { count: calls.length, names: names.map(toolName), byName: names.map(name => ({ ...toolName(name), count: calls.filter(call => call.name === name).length })) },
    checks: checks.map(check => ({ checkId: CHECKS.includes(check.checkId) ? check.checkId : 'unknown',
      status: ['passed', 'failed', 'unavailable', 'timeout', 'cancelled', 'output-limit', 'launch-error', 'material-changed'].includes(check.status) ? check.status : 'unknown',
      executed: check.executed === true, exitCode: Number.isSafeInteger(check.exitCode) ? check.exitCode : null,
      sha256: hash(JSON.stringify(check)) })),
    bindings: { unchanged: bindingOkay, auditOkay, runOkay, rawSha256: HEX.test(rawHash || '') ? rawHash : null,
      adapterSha256: HEX.test(adapterHash || '') ? adapterHash : null },
    limitations: ['Diagnostic only; no CODE, acceptance, release or CI-proof authority.',
      'Raw trace, report, argv, prompts and credentials are private and are not uploaded.',
      'Unknown catalogue/server fields refuse compatibility; no fallback or retry.'] };
}

async function finish({ work, native }) {
  let summary = summarizeProbe({});
  try {
    const state = json(join(work, 'state.json')), outcome = json(join(work, 'run-private.json'));
    const messages = json(outcome.outputs.execution_file), policy = json(state.policy);
    const checks = readFileSync(policy.checksJournal, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    const bindingOkay = gitText(state.source, ['rev-parse', 'HEAD']) === state.launch.sourceSha
      && gitText(state.source, ['status', '--porcelain']) === ''
      && gitText(state.fixture, ['rev-parse', 'HEAD']) === state.fixtureSha && gitText(state.fixture, ['diff', '--name-only', 'HEAD']) === ''
      && state.inputs.every(input => hash(readFileSync(input.path)) === input.sha256)
      && JSON.stringify(scriptBindings(state.source, state.launch.sourceSha, state.toolkit)) === JSON.stringify(state.bindings);
    const audit = privateRun(process.execPath, [join(state.toolkit, 'scripts/review-execution-policy.mjs'), 'audit', state.policy],
      { cwd: state.fixture, env: { ...cleanEnv(), REVIEW_EXECUTION_FILE: outcome.outputs.execution_file,
        REVIEW_STRUCTURED_OUTPUT: outcome.outputs.structured_output || '{}', REVIEW_DOC: state.report } });
    write(join(work, 'audit-private.json'), audit);
    summary = summarizeProbe({ messages, checks, nativeHash: hash(readFileSync(native)), sourceSha: state.launch.sourceSha,
      bindingOkay, auditOkay: audit.code === 0 && !audit.error && !audit.signal, runOkay: outcome.success === true,
      rawHash: hash(readFileSync(join(work, 'execution/native-raw.jsonl'))),
      adapterHash: hash(readFileSync(join(work, 'execution/native-adapter.json'))) });
    summary.launch = state.launch;
    summary.toolkit = state.bindings;
  } catch { summary.issues.push('private-evidence-unavailable'); }
  mkdirSync(join(work, 'public'), { recursive: true, mode: 0o700 });
  write(join(work, 'public/summary.json'), summary);
  if (summary.status !== 'observed-compatible') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...args] = process.argv.slice(2), options = {};
  try {
    for (const arg of args) {
      const match = /^--(source|source-sha|work|native)=(.+)$/.exec(arg);
      if (!match) throw Error('unknown option');
      options[match[1] === 'source-sha' ? 'sourceSha' : match[1]] = match[2];
    }
    if (mode === 'prepare') prepare(options);
    else if (mode === 'run') await run(options);
    else if (mode === 'finish') await finish(options);
    else throw Error('unknown operation');
  } catch { console.error('Native compatibility diagnostic refused; no raw evidence is printed.'); process.exitCode = 1; }
}
