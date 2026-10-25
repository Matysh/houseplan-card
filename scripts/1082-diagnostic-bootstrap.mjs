// One author diagnostic, not an official review or an admission/publishing path.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { isMainModule } from './spawn-portable.mjs';

export const MATERIAL = '98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f';
export const TOOLS = '5892911a8863249e5649bcc452668d7525d03244';
export const NATIVE = '4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358';
export const BRANCH = 'issue/1082-diagnostic-bootstrap';
export const CALLER = 'Matysh/houseplan-card/.github/workflows/docs-screenshots.yml@refs/heads/' + BRANCH;
export const OVERLAY = ['review-failure-diagnostics.mjs', 'review-tool-metadata.mjs'];
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 24 * 1024 * 1024, timeout: 20000 });
const textGit = (...args) => git(...args).toString('utf8').trim();
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const bool = value => typeof value === 'boolean' ? value : null;
const words = value => value.split(' ');
const fixed = (value, values) => values.includes(value) ? value : 'unknown';
const TOOLS_NAMES = words('Read Write Edit MultiEdit Grep Glob Bash TodoWrite ToolSearch StructuredOutput EndConversation Task Agent WebFetch WebSearch Skill ExitPlanMode EnterPlanMode mcp__github__add_issue_comment mcp__github__issue_write mcp__github__issue_read other');
const KEYS = words('command description timeout run_in_background file_path content old_string new_string replace_all edits pattern path glob type output_mode head_limit offset limit multiline case_insensitive query url prompt owner repo issue_number body comment method perPage page tool_name tool_use_id tool_input');
const FIELDS = words('offset limit head_limit timeout run_in_background replace_all multiline case_insensitive');
const TYPES = words('undefined null array object string boolean number unknown');
const BINS = words('node git rg sed npm npx python python3 pwd ls cat head tail wc other unknown');
const FLAGS = words('--test --check --write --fix --apply --accept --execute-nightly --return --seal --publish --push --force -e -i --eval --expression --file --output --output-indicator-new --ext-diff --textconv --filters --open-files-in-pager --test-name-pattern --test-concurrency --report --no-install --no-ext-diff --no-textconv -n -p -m -q -x');
const CATEGORIES = words('allowed other-policy-refusal policy-unavailable policy-evaluation-unavailable nonliteral-or-background untracked-node-entry write-or-execute-override mutation-execution command-not-allowlisted spec-execution-boundary tool-not-allowlisted malformed-tool write-target write-symlink write-parent report-claim-or-type report-claim');
const PROBLEMS = words('malformed-tool missing-journal duplicate-journal input-digest-mismatch decision-mismatch forbidden-request missing-result duplicate-result duplicate-tool-id');
const OUTCOMES = words('success failure cancelled skipped');
const rows = (value, max) => Array.isArray(value) ? value.slice(0, max) : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function input(value) {
  const v = object(value), command = object(v.command);
  return { keys: rows(v.keys, KEYS.length).filter(key => KEYS.includes(key)),
    orderedKeyDigests: rows(v.orderedKeyDigests, 48).map(hex), omittedKeys: count(v.omittedKeys),
    otherKeyCount: count(v.otherKeyCount), digest: hex(v.digest ?? v.inputDigest), type: fixed(v.type ?? v.inputType, TYPES),
    fields: rows(v.fields, FIELDS.length).filter(row => FIELDS.includes(row?.key)).map(row => ({
      key: row.key, type: fixed(row.type, TYPES),
      ...(typeof row.value === 'boolean' && row.type === 'boolean' || typeof row.value === 'number'
        && row.type === 'number' && Number.isFinite(row.value) && Math.abs(row.value) <= 1e9 ? { value: row.value } : {}),
    })), command: v.command === null || !v.command ? null : {
      literal: bool(command.literal), bytes: count(command.bytes), binary: fixed(command.binary, BINS),
      argumentCount: count(command.argumentCount), flags: rows(command.flags, FLAGS.length).filter(flag => FLAGS.includes(flag)),
      trackedOperands: count(command.trackedOperands), background: bool(command.background),
    } };
}
const decision = value => value ? { category: fixed(value.category, CATEGORIES), reasonDigest: hex(value.reasonDigest) } : null;
const metadata = value => value ? { tool: fixed(value.tool, TOOLS_NAMES), toolNameDigest: hex(value.toolNameDigest), ...input(value) } : null;

// A second fixed projection is intentionally smaller than the candidate certificate.
// Never upload the model's file or trust an arbitrary collector object as a verdict.
export function projectCertificate(value) {
  if (value?.schema !== 'houseplan-review-failure/v1' || value.diagnosticOnly !== true || value.verdictAuthority !== false)
    throw new Error('invalid diagnostic schema');
  const s = object(value.summary), inputs = object(value.inputs);
  return { schema: 'houseplan-1082-bootstrap-diagnostic/v1', diagnosticOnly: true, verdictAuthority: false,
    inputs: Object.fromEntries(['policy', 'trace', 'journal'].map(key => { const v = object(inputs[key]); return [key, {
      status: fixed(v.status, words('missing symlink-refused not-regular oversize truncated read invalid-json unreadable-or-missing')),
      sha256: hex(v.sha256), omitted: count(v.omitted), shape: fixed(v.shape, words('expected wrong unavailable')),
    }]; })),
    summary: { ...Object.fromEntries(words('traceMessages toolCalls journalRows malformedJournalRows orphanJournalRows orphanResults permissionDenials metadataBlocks')
      .map(key => [key, count(s[key])])), terminalResult: bool(s.terminalResult), terminalError: bool(s.terminalError),
    terminalSubtype: fixed(s.terminalSubtype, words('success error_max_turns error_during_execution error_max_budget_usd error_max_structured_output_retries')),
    terminalStructuredOutputDigest: hex(s.terminalStructuredOutputDigest) },
    calls: rows(value.calls, 256).map(row => { const r = object(row), j = object(r.journal); return {
      tool: fixed(r.tool, TOOLS_NAMES), toolUseIdDigest: hex(r.toolUseIdDigest), toolNameDigest: hex(r.toolNameDigest),
      input: input(r.input), expected: { denied: bool(r.expected?.denied), ...decision(r.expected) },
      journal: { count: count(j.count), inputDigestMatches: bool(j.inputDigestMatches), denied: bool(j.denied),
        reasonAvailable: bool(j.reasonAvailable), decision: decision(j.decision), metadata: metadata(j.metadata),
        decisionAgreesWithTrace: bool(j.decisionAgreesWithTrace), metadataAgreesWithTrace: bool(j.metadataAgreesWithTrace) },
      terminalSchemaChannel: bool(r.terminalSchemaChannel), resultCount: count(r.resultCount),
      problems: rows(r.problems, PROBLEMS.length).filter(p => PROBLEMS.includes(p)),
    }; }),
    denials: rows(value.denials, 64).map(r => ({ tool: fixed(r?.tool, TOOLS_NAMES), toolUseIdDigest: hex(r?.toolUseIdDigest),
      toolNameDigest: hex(r?.toolNameDigest), input: input(r?.input) })),
    metadataChannels: rows(value.metadataChannels, 64).map(r => ({ type: fixed(r?.type, ['server_tool_use', 'tool_reference']),
      tool: fixed(r?.tool, TOOLS_NAMES), toolNameDigest: hex(r?.toolNameDigest), toolUseIdDigest: hex(r?.toolUseIdDigest), input: input(r?.input) })),
    limits: { sourceCertificateBytes: 256 * 1024, certificateBytes: 256 * 1024, calls: 256, denials: 64, metadataChannels: 64 },
    omitted: Object.fromEntries([['calls', 256], ['denials', 64], ['metadataChannels', 64]].map(([key, max]) => [key,
      (count(value.omitted?.[key]) ?? 0) + Math.max(0, (Array.isArray(value[key]) ? value[key].length : 0) - max)])),
    limitations: ['Diagnostic only; no review, execution permission, CI proof or acceptance authority.',
      'Missing hook evidence does not identify the cause or prove execution.',
      'Hashes and bounded fixed vocabulary only; no raw arguments, paths, prompts, outputs or journal.',
      'Old accepted hook has no optional shape metadata; its absence remains unknown.',
      'Same-UID model code is not isolated by an OS sandbox; forced runner termination can prevent retention.'],
  };
}

export function regular(path, max) {
  let fd;
  try {
    if (realpathSync(path) !== resolve(path)) throw new Error('symlink evidence refused');
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > max) throw new Error('nonregular or oversized evidence');
    const chunks = []; let length = 0, size;
    // Limit the actual FD reads even if an input grows after fstat. No unbounded readFile.
    while (length <= max) {
      const chunk = Buffer.alloc(Math.min(1024 * 1024, max + 1 - length));
      size = readSync(fd, chunk, 0, chunk.length, null);
      if (!size) return Buffer.concat(chunks, length);
      length += size; chunks.push(chunk.subarray(0, size));
    }
    throw new Error('evidence grew beyond bound');
  } finally { if (fd !== undefined) closeSync(fd); }
}
function writePrivate(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  if (realpathSync(dirname(path)) !== resolve(dirname(path))) throw new Error('symlink output parent refused');
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  if (bytes.length > 256 * 1024) throw new Error('bounded output exceeded');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
}
function emit(name, value) {
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: 'a' });
}
function material() {
  if (textGit('rev-parse', 'HEAD') !== MATERIAL || textGit('diff', '--no-ext-diff', '--no-textconv', '--name-only', 'HEAD'))
    throw new Error('immutable material changed');
  git('merge-base', '--is-ancestor', TOOLS, MATERIAL);
}
const modules = ['review-execution-policy.mjs', 'spawn-portable.mjs', 'model-usage.mjs'];
function assertToolkit(tools, withOverlay = false) {
  const entries = git('ls-tree', '-r', '-z', `${TOOLS}:scripts`).toString('utf8').split('\0').filter(Boolean).map(row => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
    if (!match) throw new Error('nonregular accepted toolkit entry');
    return { name: match[3], blob: match[2] };
  });
  const expected = entries.map(row => row.name);
  const walk = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(join(dir, entry.name), prefix + entry.name + '/') : [prefix + entry.name]).sort();
  if (JSON.stringify(walk(join(tools, 'scripts'))) !== JSON.stringify([...expected, ...(withOverlay ? OVERLAY : [])].sort()))
    throw new Error('accepted toolkit file set changed');
  for (const { name, blob } of entries) {
    const bytes = regular(join(tools, 'scripts', name), 4 * 1024 * 1024);
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (actual !== blob)
      throw new Error('accepted toolkit bytes changed');
  }
  return Object.fromEntries(modules.map(name => [name, hash(regular(join(tools, 'scripts', name), 4 * 1024 * 1024))]));
}
export function boundInputs(dir) {
  return Object.fromEntries([['context.json', 256 * 1024], ['diff.patch', 4 * 1024 * 1024],
    ['policy.json', 4 * 1024 * 1024], ['policy.json.settings.json', 4 * 1024 * 1024]]
    .map(([name, max]) => [name, hash(regular(join(dir, name), max))]));
}
export function launchContext(env) {
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== `refs/heads/${BRANCH}`
    || env.GITHUB_WORKFLOW_REF !== CALLER || env.GITHUB_RUN_ATTEMPT !== '1' || !sha(env.GITHUB_SHA))
    throw new Error('unsupported authentic launch context');
  return { actualTrigger: 'workflow_dispatch', callerWorkflow: CALLER, workflowSha: env.GITHUB_SHA };
}
function launchBindings() {
  return { ...launchContext(process.env),
    callerSha256: hash(git('show', `${process.env.GITHUB_SHA}:.github/workflows/docs-screenshots.yml`)),
    bodySha256: hash(git('show', `${process.env.GITHUB_SHA}:.github/workflows/1082-diagnostic-bootstrap.yml`)) };
}
function attest(dir, tools, native) {
  material(); const accepted = assertToolkit(tools);
  const nativeSha256 = hash(regular(native, 512 * 1024 * 1024));
  if (nativeSha256 !== NATIVE) throw new Error('native pin differs');
  const before = { launch: launchBindings(), inputs: boundInputs(dir), acceptedModules: accepted, nativeSha256,
    materialTree: textGit('rev-parse', `${MATERIAL}^{tree}`), toolsTree: textGit('rev-parse', `${TOOLS}:scripts`) };
  const path = join(dir, 'before-model.json'); writePrivate(path, before); emit('digest', hash(regular(path, 64 * 1024)));
}
async function api(path) {
  const response = await fetch(`https://api.github.com/repos/Matysh/houseplan-card/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(20000), redirect: 'error',
  });
  if (!response.ok) throw new Error('read-only GitHub snapshot unavailable');
  const reader = response.body.getReader(), buffers = []; let size = 0;
  try { while (true) { const r = await reader.read(); if (r.done) break; size += r.value.length;
    if (size > 512 * 1024) throw new Error('GitHub snapshot page exceeded bound'); buffers.push(Buffer.from(r.value)); } }
  finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(buffers).toString('utf8'));
}
export function snapshotIssue(issue, comments) {
  if (issue?.number !== 1082 || typeof issue.body !== 'string' || !Array.isArray(comments)) throw new Error('unexpected issue snapshot');
  const snapshot = { number: 1082, url: issue.html_url, title: issue.title, body: issue.body, updatedAt: issue.updated_at,
    comments: comments.map(row => ({ id: row.id, url: row.html_url, author: row.user?.login, createdAt: row.created_at,
      updatedAt: row.updated_at, body: row.body })) };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 256 * 1024) throw new Error('issue snapshot exceeded bound');
  return snapshot;
}

async function prepare(dir, tools) {
  material();
  mkdirSync(tools, { recursive: true });
  const extracted = spawnSync('tar', ['-x', '-C', tools], { input: git('archive', '--format=tar', TOOLS, 'scripts'), timeout: 20000 });
  if (extracted.status !== 0 || extracted.error) throw new Error('accepted toolkit extraction failed');
  assertToolkit(tools);
  const issue = await api('issues/1082'), comments = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(`issues/1082/comments?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('invalid comments snapshot');
    comments.push(...batch); if (batch.length < 100) break;
    if (page === 10) throw new Error('comments snapshot incomplete');
  }
  const context = { diagnosticOnly: true, verdictAuthority: false, material: MATERIAL, tools: TOOLS,
    issue: snapshotIssue(issue, comments), changedFiles: textGit('diff', '--name-only', TOOLS, MATERIAL).split('\n'),
    diffPath: join(dir, 'diff.patch'), canonicalSources: ['docs/SCOPE.md', 'AGENTS.md', 'docs/process/REVIEWER.md', 'PROCESS.md',
      'docs/ARCHITECTURE.md', 'docs/DEVELOPMENT.md', 'docs/TESTING.md'],
    reusedAuthorEvidence: { canonicalValidate: '40199442844', windows: '81 PASS / 3 POSIX SKIP', linux: '60 PASS',
      static: '1910 definitions / 1039 reads / execution 0; caught unknown', source: MATERIAL },
    boundary: 'One author diagnostic. Not official CODE. No verdict, seal, publication, issue writes or CI authority.' };
  writePrivate(join(dir, 'context.json'), context);
  writeFileSync(join(dir, 'diff.patch'), git('diff', '--no-ext-diff', '--no-textconv', TOOLS, MATERIAL), { flag: 'wx', mode: 0o600 });
}

async function finish(dir, tools, native) {
  const env = process.env, output = join(dir, 'public'); mkdirSync(output, { recursive: true });
  const provenance = { schema: 'houseplan-1082-bootstrap-provenance/v1', diagnosticOnly: true, verdictAuthority: false,
    run: /^\d+$/.test(env.GITHUB_RUN_ID ?? '') ? env.GITHUB_RUN_ID : null, attempt: env.GITHUB_RUN_ATTEMPT === '1' ? '1' : null,
    workflowSha: sha(env.GITHUB_SHA), actualTrigger: fixed(env.GITHUB_EVENT_NAME, ['workflow_dispatch']),
    callerWorkflow: env.GITHUB_WORKFLOW_REF === CALLER ? CALLER : 'unknown',
    materialSha: MATERIAL, toolsSha: TOOLS, branch: BRANCH,
    reviewOutcome: fixed(env.REVIEW_OUTCOME, OUTCOMES), auditOutcome: fixed(env.AUDIT_OUTCOME, OUTCOMES),
    collectorOutcome: 'failure', evidenceUnavailable: true, failurePhase: 'run-provenance',
    materialUnchanged: null, toolsUnchanged: null, nativeSha256: null,
    cliVersion: '2.1.295', materialTree: null, toolsTree: null, orchestrationModules: null,
    preModelBindings: null, bindingsUnchanged: null, acceptedModules: null, overlayModules: null, certificateSha256: null };
  let failed = false;
  try {
    if (!provenance.run || !provenance.attempt || !provenance.workflowSha) throw new Error('invalid run provenance');
    provenance.failurePhase = 'orchestration-integrity';
    const thisScript = regular(fileURLToPath(import.meta.url), 256 * 1024);
    const scriptFromCommit = git('show', `${provenance.workflowSha}:scripts/1082-diagnostic-bootstrap.mjs`);
    if (hash(thisScript) !== hash(scriptFromCommit)) throw new Error('orchestration source changed');
    const launch = launchBindings();
    provenance.orchestrationModules = { scriptSha256: hash(thisScript), callerSha256: launch.callerSha256,
      workflowSha256: hash(git('show', `${provenance.workflowSha}:.github/workflows/1082-diagnostic-bootstrap.yml`)) };
    provenance.failurePhase = 'material'; material();
    provenance.materialTree = textGit('rev-parse', `${MATERIAL}^{tree}`); provenance.toolsTree = textGit('rev-parse', `${TOOLS}:scripts`);
    provenance.failurePhase = 'accepted-tools'; provenance.acceptedModules = assertToolkit(tools);
    provenance.failurePhase = 'pre-model-binding';
    const beforeBytes = regular(join(dir, 'before-model.json'), 64 * 1024), before = JSON.parse(beforeBytes);
    if (!hex(env.BEFORE_MODEL_DIGEST) || hash(beforeBytes) !== env.BEFORE_MODEL_DIGEST) throw new Error('pre-model bindings changed');
    const inputs = boundInputs(dir);
    if (!isDeepStrictEqual(before.launch, launch) || !isDeepStrictEqual(before.inputs, inputs) || !isDeepStrictEqual(before.acceptedModules, provenance.acceptedModules)
      || before.materialTree !== provenance.materialTree || before.toolsTree !== provenance.toolsTree || before.nativeSha256 !== NATIVE)
      throw new Error('model input bindings changed');
    provenance.preModelBindings = inputs; provenance.bindingsUnchanged = true;
    provenance.failurePhase = 'native-pin'; const nativeHash = hash(regular(native, 512 * 1024 * 1024));
    if (nativeHash !== NATIVE) throw new Error('native bytes changed'); provenance.nativeSha256 = nativeHash;
    provenance.overlayModules = {};
    provenance.failurePhase = 'collector-overlay';
    // AFTER the model/audit only. No candidate policy/hook/prepare is copied.
    for (const name of OVERLAY) { const bytes = git('show', `${MATERIAL}:scripts/${name}`);
      writeFileSync(join(tools, 'scripts', name), bytes, { flag: 'wx', mode: 0o600 }); provenance.overlayModules[name] = hash(bytes); }
    const { collectFailureCertificate } = await import(pathToFileURL(join(tools, 'scripts/review-failure-diagnostics.mjs')));
    provenance.failurePhase = 'collector-read';
    const rawPath = collectFailureCertificate({ policyPath: join(dir, 'policy.json'),
      tracePath: env.REVIEW_EXECUTION_FILE || join(env.RUNNER_TEMP, 'claude-execution-output.json'),
      output: join(dir, 'unpublished', 'certificate.json'), provenance: { run: provenance.run, attempt: '1', issue: '1082',
        kind: 'task', stage: 'code', materialSha: MATERIAL, toolsSha: TOOLS } });
    provenance.failurePhase = 'projection'; const certificate = projectCertificate(JSON.parse(regular(rawPath, 256 * 1024)));
    // The candidate collector is read-only by contract; verify its final effects too.
    provenance.failurePhase = 'final-check'; material(); assertToolkit(tools, true);
    if (!isDeepStrictEqual(boundInputs(dir), inputs)) throw new Error('collector changed model inputs');
    for (const name of OVERLAY) if (hash(regular(join(tools, 'scripts', name), 256 * 1024)) !== provenance.overlayModules[name])
      throw new Error('collector overlay changed');
    provenance.materialUnchanged = true; provenance.toolsUnchanged = true;
    const path = join(output, 'certificate.json'); writePrivate(path, certificate);
    provenance.certificateSha256 = hash(regular(path, 256 * 1024)); provenance.collectorOutcome = 'success';
    provenance.evidenceUnavailable = false; provenance.failurePhase = 'none'; emit('certificate', path);
  } catch { failed = true; }
  const path = join(output, 'provenance.json'); writePrivate(path, provenance); emit('provenance', path);
  if (failed) throw new Error('diagnostic unavailable; safe provenance retained without verdict authority');
}

if (isMainModule(import.meta.url)) {
  try {
    const [mode, directory, tools, native] = process.argv.slice(2);
    if (!['prepare', 'attest', 'finish'].includes(mode) || !directory || !tools) throw new Error('invalid operation');
    if (mode === 'prepare') await prepare(resolve(directory), resolve(tools));
    else if (mode === 'attest') attest(resolve(directory), resolve(tools), resolve(native));
    else await finish(resolve(directory), resolve(tools), resolve(native));
  } catch { console.error('1082 diagnostic bootstrap refused; no acceptance or retry authority.'); process.exitCode = 1; }
}
