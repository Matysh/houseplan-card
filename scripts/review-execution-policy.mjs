// #1065: a tool-call policy, not an OS sandbox for reviewed child programs.
// Ordinary checks execute unchanged material; ad-hoc shell programs do not.
import { appendFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { isMainModule } from './spawn-portable.mjs';
import { reviewDecisionMetadata, reviewToolMetadata } from './review-tool-metadata.mjs';
import { CALL_DIGEST_ALGORITHM, callDigest } from './review-call-digest.mjs';
import { buildReviewCapabilities, readReviewCapabilities, reviewChecksMarkdown,
  NATIVE_REVIEW_TOOLS, REVIEW_MCP_NATIVE_TOOL_NAME } from './review-capabilities.mjs';
import { checkTraceProblems, readCheckExecutionEntries, verifyCheckExecutionFiles } from './review-approved-check.mjs';

export const REVIEW_CLI_VERSION = '2.1.295';
export const REVIEW_CLI_SHA256 = '4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358';
export const HOOK_TIMEOUT_SECONDS = 30;
const STARTUP_PROBE = { tool_use_id: 'startup-probe', tool_name: 'Bash', tool_input: {
  command: "sed -i 's/timeout-minutes: 35/timeout-minutes: 25/' .github/workflows/validate.yml" } };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', timeout: 5000, maxBuffer: 4 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const READ_GIT = new Set(['show', 'diff', 'log', 'status', 'rev-parse', 'rev-list', 'cat-file', 'blame', 'ls-files', 'ls-tree', 'merge-base']);
const FORBIDDEN_GIT_OPTIONS = ['--output', '--ext-diff', '--textconv', '--filters', '--open-files-in-pager'];
function forbiddenGitOption(arg) {
  const option = arg.split('=')[0];
  // Git parse-options can accept unique long-option prefixes. Refuse even an
  // ambiguous prefix; a later Git option table must not silently grant writes.
  return option.length > 2 && option.startsWith('--') && FORBIDDEN_GIT_OPTIONS.some(name => name.startsWith(option));
}
const CHECK_SCRIPTS = new Set([
  'bundle-budget.mjs', 'check-inputs.mjs', 'ci-profiles.mjs', 'ci-registry-inventory.mjs',
  'inventory.mjs', 'no-new-any.mjs', 'no-new-private-writes.mjs', 'no-render-layout-read.mjs',
  'process-gate.mjs', 'smoke-select.mjs', 'status-snapshot.mjs', 'toolchain-pins.mjs',
]);
// Native SDK ToolSearch reads a deferred catalog; discovered tool execution is
// a separate hook call and receives no permission from discovery.
const READ_TOOLS = new Set(NATIVE_REVIEW_TOOLS.filter(name => name !== 'Write'));
class PolicyRefusal extends Error {}

export function hookCommand({ executable = process.execPath, handler = fileURLToPath(import.meta.url), policyPath }) {
  const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
  return `timeout --kill-after=1s 12s ${quote(executable)} ${quote(handler)} hook ${quote(policyPath)} || exit 2`;
}

export function executionSettings(command) {
  return { disableAllHooks: false, hooks: { PreToolUse: [{ matcher: '.*', hooks: [{
    type: 'command', command, timeout: HOOK_TIMEOUT_SECONDS, onFailure: 'block',
  }] }] } };
}

// A denied JSON request probes the REAL unchanged hook before the model starts.
// This never dispatches or executes the proposed command, including on failure.
export function hookStartupAcceptsDeny(command, { cwd, env, expectedReason = 'command is outside the review check allowlist; use read tools or existing CI evidence' } = {}) {
  const result = spawnSync('/bin/sh', ['-c', command], { cwd, env, encoding: 'utf8', timeout: 20000, maxBuffer: 64 * 1024,
    input: JSON.stringify(STARTUP_PROBE) });
  try {
    const decision = JSON.parse(result.stdout).hookSpecificOutput;
    return !result.error && result.status === 0 && decision?.permissionDecision === 'deny'
      && decision.permissionDecisionReason === expectedReason;
  }
  catch { return false; }
}

// One literal argv only: no shell control flow, redirections, substitutions,
// environment prefixes or inline interpreter programs, even if later restored.
export function literalArgv(command) {
  if (typeof command !== 'string' || command.length > 16000 || /[\r\n\0]/.test(command)) return null;
  const words = []; let word = '', quote = '', started = false;
  for (const c of command) {
    if (quote) {
      if (c === quote) quote = '';
      else { if (quote === '"' && /[$`\\]/.test(c)) return null; word += c; }
    } else if (/\s/.test(c)) {
      if (started) { words.push(word); word = ''; started = false; }
    } else if (c === "'" || c === '"') { quote = c; started = true; }
    else { if (/[;&|<>$`\\(){}*?\[\]~]/.test(c)) return null; word += c; started = true; }
  }
  if (quote) return null;
  if (started) words.push(word);
  return words.length ? words : null;
}

function canonicalFile(path, policy) {
  if (typeof path !== 'string' || isAbsolute(path) || path.split(/[\\/]/).includes('..')) return false;
  const full = resolve(policy.root, path);
  try { return realpathSync(full) === full && policy.files.includes(relative(policy.root, full).replaceAll('\\', '/')); }
  catch { return false; }
}

// Legacy command grammar classifies refusals for diagnostics only. A null
// classification never grants Bash: toolProblem always denies that tool.
export function bashProblem(input, policy) {
  const args = literalArgv(input?.command);
  if (!args || input.run_in_background) return 'only one foreground literal command is permitted';
  const [bin, ...rest] = args;
  if (['pwd', 'ls', 'cat', 'head', 'tail', 'wc'].includes(bin)) return null;
  if (bin === 'rg' && !rest.some(a => /^--(?:pre|hostname-bin)(?:=|$)/.test(a))) return null;
  if (bin === 'sed' && rest.length >= 3 && rest[0] === '-n' && /^\d+(?:,\d+)?p$/.test(rest[1])
    && rest.slice(2).every(a => !a.startsWith('-') && canonicalFile(a, policy))) return null;
  if (bin === 'git' && READ_GIT.has(rest[0]) && !rest.some(forbiddenGitOption)) return null;
  if (bin === 'git' && rest.join(' ') === 'branch --show-current') return null;
  if (bin === 'node') {
    if (rest[0] === '--test' && rest.slice(1).some(a => /^test\/.+\.test\.mjs$/.test(a)) && rest.slice(1).every(a =>
      /^--test-(?:name-pattern|concurrency)=/.test(a) || /^test\/.+\.test\.mjs$/.test(a) && canonicalFile(a, policy))) return null;
    const path = rest[0];
    if (!canonicalFile(path, policy)) return 'Node entry must be an unchanged tracked file';
    if (rest.slice(1).some(a => /^(?:--(?:write|apply|fix|accept|execute-nightly|return|seal|publish|push|force)|-e)(?:=|$)/.test(a))) return 'write/execute override is forbidden';
    if (policy.stage !== 'spec' && (/^demo\/smoke_[\w-]+\.mjs$/.test(path)
      || path === 'demo/verify_ha_dialog_discard_recovery.mjs')) return null;
    if (policy.stage !== 'spec' && path === 'scripts/fix-test-build.mjs' && rest.length === 1) return null;
    if (path === 'scripts/mutation-gate.mjs') return rest.length === 2 && rest[1] === '--check' ? null : 'mutation execution is forbidden';
    if (path.startsWith('scripts/') && CHECK_SCRIPTS.has(path.slice(8))) return null;
  }
  if (policy.stage === 'spec') return 'spec feasibility checks do not build or launch browsers/backend';
  if (bin === 'npm' && rest[0] === 'run' && rest.length === 2 && ['build', 'typecheck', 'bundle:sync'].includes(rest[1])) return null;
  if (bin === 'npx' && rest[0] === '--no-install' && rest[1] === 'tsc' && rest[2] === '-p' && rest.length === 4
    && /^tsconfig[\w.-]*\.json$/.test(rest[3]) && canonicalFile(rest[3], policy)) return null;
  if (['python', 'python3'].includes(bin) && rest[0] === '-m' && rest[1] === 'pytest'
    && rest.slice(2).some(a => /^tests_backend\/test_[\w]+\.py$/.test(a))
    && rest.slice(2).every(a => /^tests_backend\/test_[\w]+\.py$/.test(a) && canonicalFile(a, policy) || ['-q', '-x', '--disable-warnings'].includes(a))) return null;
  return 'command is outside the review check allowlist; use read tools or existing CI evidence';
}

export function toolProblem(call, policy) {
  try { readReviewCapabilities(policy); } catch { return 'review capability manifest unavailable or changed'; }
  if (!call || typeof call.tool_name !== 'string') return 'malformed tool call';
  if (READ_TOOLS.has(call.tool_name)) return null;
  if (call.tool_name === 'StructuredOutput') return reportProblems(call.tool_input?.summary || '').length
    ? 'misleading ordinary mutation claim cannot be published' : null;
  if (call.tool_name === REVIEW_MCP_NATIVE_TOOL_NAME) {
    const input = call.tool_input;
    return !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1
      || typeof input.check_id !== 'string' || !input.check_id.length || input.check_id.length > 256
      ? 'run_check requires only a bounded check_id' : null;
  }
  if (call.tool_name === 'Write') {
    const path = call.tool_input?.file_path;
    if (typeof call.tool_input?.content !== 'string' || reportProblems(call.tool_input.content).length) return 'external report must be text without misleading ordinary mutation claims';
    if (typeof path !== 'string' || !policy.outputs.includes(resolve(path))) return 'Write is restricted to the external review report/findings';
    try {
      if (realpathSync(dirname(path)) !== dirname(path) || existsSync(path) && realpathSync(path) !== path) return 'symlink output is forbidden';
    } catch { return 'output parent is unavailable'; }
    return null;
  }
  if (call.tool_name === 'Bash') return bashProblem(call.tool_input, policy) || 'generic shell is not exposed; use declared run_check';
  return 'tool is not permitted by the review execution boundary';
}

// Deliberately narrow: reject the concrete misleading evidence class, not an
// arbitrary mention of mutation policy, historical quotes or a denied command.
export function reportProblems(text) {
  return String(text).split('\n').flatMap((line, index) => {
    if (/^\s*>/.test(line) || /historical|историческ|пример|запрещ|отказ|denied|не выполнял|не проверял/i.test(line)) return [];
    if (/\b(?:JSON|DATA)\b/i.test(line) && /hook|refus|\bdeny\b|отклон/i.test(line)) return [];
    const patch = /sed\s+-i|perl\s+-[\w]*i|(?:временн|temporary).{0,80}(?:патч|patch|подмен)|git\s+(?:checkout|restore)\s/i.test(line);
    const claimed = /ordinary|negative-input|обычн.{0,30}отрицател|мутант.{0,50}не исполнял/i.test(line);
    const run = /прогон|запуск|тест.{0,30}(?:красн|red|fail)|run|execut/i.test(line);
    return patch && claimed && run ? [`line ${index + 1}: a temporary patch/run/restore cannot be ordinary unchanged-input evidence`] : [];
  });
}

export function traceProblems(messages, entries, policy, { reportText, checkEntries = [] } = {}) {
  if (!Array.isArray(messages) || !Array.isArray(entries)) return ['execution trace or hook journal is unavailable'];
  if (policy?.callDigestAlgorithm !== CALL_DIGEST_ALGORITHM) return ['unsupported call digest algorithm'];
  try { readReviewCapabilities(policy); } catch { return ['review capability manifest unavailable or changed']; }
  if (!Array.isArray(checkEntries)) return ['check execution journal is unavailable'];
  const calls = messages.filter(m => m?.type === 'assistant').flatMap(m => m.message?.content || [])
    .filter(b => b?.type === 'tool_use');
  const results = messages.filter(m => m?.type === 'user').flatMap(m => m.message?.content || [])
    .filter(b => b?.type === 'tool_result');
  const problems = []; const ids = new Set(), receiptIds = new Set();
  const result = messages.findLast(m => m?.type === 'result');
  if (!result || messages.at(-1) !== result || messages.filter(m => m?.type === 'result').length !== 1
    || result.subtype !== 'success' || result.is_error !== false
    || !Array.isArray(result.permission_denials) || result.permission_denials.length
    || !calls.some(c => c.name === 'Write'
    && c.input?.file_path === policy.outputs[0])) problems.push('complete execution with external report Write is required');
  const written = calls.findLast(c => c.name === 'Write' && c.input?.file_path === policy.outputs[0]);
  if (reportText !== undefined && written?.input?.content !== reportText) problems.push('report bytes differ from the last external Write');
  for (const call of calls) {
    if (typeof call.id !== 'string' || ids.has(call.id)) { problems.push('invalid/duplicate tool id'); continue; }
    ids.add(call.id);
    const matching = entries.filter(e => e.id === call.id);
    const expected = toolProblem({ tool_name: call.name, tool_input: call.input }, policy);
    // SDK versions can expose the nonexecuting schema tool without a hook.
    // Only that exact channel, bound to the terminal output, is exempt. It
    // cannot turn an unjournalled Bash/Write/MCP call into admitted execution.
    const outputChannel = call.name === 'StructuredOutput' && isDeepStrictEqual(call.input, result?.structured_output);
    if (call.name === 'StructuredOutput' && !outputChannel) problems.push('structured output is not bound to terminal result');
    let inputDigest;
    try { inputDigest = callDigest(call.name, call.input); }
    catch { problems.push('invalid JSON tool call'); }
    if (!(outputChannel && matching.length === 0) && (matching.length !== 1
      || matching[0].callDigestAlgorithm !== CALL_DIGEST_ALGORITHM
      || !inputDigest || matching[0].input !== inputDigest
      || matching[0].denied !== Boolean(expected))) problems.push('tool call has no matching policy decision');
    const observed = results.filter(r => r.tool_use_id === call.id);
    if (observed.length !== 1) problems.push('tool result is missing or duplicated');
    if (call.name === REVIEW_MCP_NATIVE_TOOL_NAME) {
      const checked = checkTraceProblems(call, observed.length === 1 ? observed[0] : null, checkEntries, policy);
      problems.push(...checked.problems);
      if (checked.receiptId) {
        if (receiptIds.has(checked.receiptId)) problems.push('duplicate check execution receipt');
        receiptIds.add(checked.receiptId);
      }
    }
    // A denied call is not evidence that the tool executed. Do not publish a
    // successful policy audit when a forbidden action was even requested.
    if (expected) problems.push('review requested a forbidden tool call');
  }
  if (entries.some(e => !ids.has(e.id)) || results.some(r => !ids.has(r.tool_use_id))) problems.push('hook journal and execution trace differ');
  if (checkEntries.some(e => !receiptIds.has(e?.receiptId))) problems.push('orphan check execution receipt');
  return problems;
}

export function adapterProblems(adapter, { policy, messages, executionFile }) {
  return !adapter || adapter.schema !== 'houseplan-native-review/v1' || adapter.status !== 'success'
    || adapter.cliVersion !== REVIEW_CLI_VERSION || adapter.cliSha256 !== REVIEW_CLI_SHA256
    || adapter.materialSha !== policy.sha || adapter.exitCode !== 0 || adapter.exitSignal !== null
    || adapter.executionFile !== executionFile || adapter.messages !== messages.length
    ? ['native adapter evidence is missing, failed or inconsistent'] : [];
}

function unchanged(policy) {
  if (git('rev-parse', 'HEAD') !== policy.sha || git('diff', '--no-ext-diff', '--no-textconv', '--name-only', 'HEAD')) throw new PolicyRefusal('review material changed');
}

if (isMainModule(import.meta.url)) {
  const [mode, policyPath] = process.argv.slice(2);
  try {
    if (mode === 'version') console.log(REVIEW_CLI_VERSION);
    else if (mode === 'prepare') {
      if (process.platform !== 'linux' || process.env.REVIEW_CLAUDE_VERSION !== REVIEW_CLI_VERSION)
        throw new PolicyRefusal('verified Linux CLI with native onFailure:block is required');
      const root = realpathSync(process.cwd());
      const outputs = [process.env.REVIEW_DOC, process.env.REVIEW_FINDINGS].filter(Boolean).map(p => resolve(p));
      if (!outputs.length || outputs.some(p => {
        const rel = relative(root, p);
        return !(isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) || realpathSync(dirname(p)) !== dirname(p);
      })) throw new Error('reports must be outside material');
      const sha = git('rev-parse', 'HEAD');
      const base = git('rev-parse', `${process.env.REVIEW_BASE || sha}^{commit}`);
      const policy = { schema: 2, root, outputs, cliVersion: REVIEW_CLI_VERSION, cliSha256: REVIEW_CLI_SHA256,
        sha, base, changedFiles: git('diff', '--name-only', base, sha).split('\n').filter(Boolean), kind: process.env.REVIEW_KIND,
        callDigestAlgorithm: CALL_DIGEST_ALGORITHM,
        stage: process.env.REVIEW_STAGE || 'code', files: git('ls-files').split('\n'), journal: `${policyPath}.jsonl`, checksJournal: `${policyPath}.checks.jsonl` };
      unchanged(policy);
      policy.capabilities = buildReviewCapabilities(policy);
      writeFileSync(policyPath, JSON.stringify(policy)); writeFileSync(policy.journal, ''); writeFileSync(policy.checksJournal, '');
      writeFileSync(`${policyPath}.checks.md`, reviewChecksMarkdown(policy.capabilities));
      // Native SDK onFailure:block prevents execution on startup/outer timeout.
      // Inner deadline/exit 2 is additional protection, not a substitute for it.
      const command = hookCommand({ policyPath });
      writeFileSync(`${policyPath}.settings.json`, JSON.stringify(executionSettings(command)));
      if (!hookStartupAcceptsDeny(command, { expectedReason: toolProblem(STARTUP_PROBE, policy) }))
        throw new PolicyRefusal('prelaunch hook startup probe did not give the expected denial');
      const probe = readFileSync(policy.journal, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
      if (probe.length !== 1 || probe[0].id !== STARTUP_PROBE.tool_use_id || probe[0].denied !== true
        || probe[0].callDigestAlgorithm !== CALL_DIGEST_ALGORITHM
        || probe[0].input !== callDigest(STARTUP_PROBE.tool_name, STARTUP_PROBE.tool_input))
        throw new PolicyRefusal('prelaunch hook probe has no matching policy journal entry');
      writeFileSync(policy.journal, ''); // The probe is not part of a model trace.
    } else if (mode === 'hook') {
      // Every parse/runtime error denies before execution, without reflecting
      // untrusted command text or secrets into the CI log.
      const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
      const call = JSON.parse(readFileSync(0, 'utf8'));
      unchanged(policy);
      if (policy.callDigestAlgorithm !== CALL_DIGEST_ALGORITHM) throw new PolicyRefusal('unsupported call digest algorithm');
      const problem = toolProblem(call, policy);
      appendFileSync(policy.journal, JSON.stringify({ id: call.tool_use_id,
        callDigestAlgorithm: CALL_DIGEST_ALGORITHM, input: callDigest(call.tool_name, call.tool_input), denied: Boolean(problem),
        diagnostic: reviewToolMetadata(call.tool_name, call.tool_input, { files: policy.files, literalArgv }),
        diagnosticDecision: reviewDecisionMetadata(problem) }) + '\n');
      if (problem) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: problem } }));
    } else if (mode === 'audit') {
      const policy = JSON.parse(readFileSync(policyPath, 'utf8')); unchanged(policy);
      readReviewCapabilities(policy);
      const messages = JSON.parse(readFileSync(process.env.REVIEW_EXECUTION_FILE, 'utf8'));
      const entries = readFileSync(policy.journal, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
      const structured = JSON.parse(process.env.REVIEW_STRUCTURED_OUTPUT);
      if (typeof structured?.summary !== 'string') throw new PolicyRefusal('structured summary is missing');
      const final = messages.findLast(m => m?.type === 'result');
      if (!isDeepStrictEqual(final?.structured_output, structured)) throw new PolicyRefusal('structured output differs from the terminal SDK result');
      const reportText = readFileSync(process.env.REVIEW_DOC, 'utf8');
      const checkEntries = readCheckExecutionEntries(policy);
      const adapter = JSON.parse(readFileSync(resolve(dirname(process.env.REVIEW_EXECUTION_FILE), 'native-adapter.json'), 'utf8'));
      const problems = [...traceProblems(messages, entries, policy, { reportText, checkEntries }),
        ...verifyCheckExecutionFiles(checkEntries, policy, policyPath),
        ...adapterProblems(adapter, { policy, messages, executionFile: process.env.REVIEW_EXECUTION_FILE }), ...reportProblems(reportText),
        ...reportProblems(structured.summary)];
      if (problems.length) throw new PolicyRefusal([...new Set(problems)].join('; '));
      console.log(`review execution boundary: ${entries.length} tool calls verified; unchanged material; tool policy, not an OS sandbox`);
    } else throw new Error('unknown policy operation');
  } catch (error) {
    if (mode === 'hook') console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'review execution policy unavailable or material changed' } }));
    else { console.error('review execution boundary refused: ' + (error instanceof PolicyRefusal ? error.message : 'missing/inconsistent policy or execution evidence')); process.exitCode = 1; }
  }
}
