// #1065: the model supplies an opaque ID; accepted tooling owns every process.
import { appendFileSync, constants, closeSync, fstatSync, mkdirSync, openSync, readSync,
  realpathSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { delimiter, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { callDigest } from './review-call-digest.mjs';
import { capabilityDigest, readReviewCapabilities, REVIEW_MCP_NATIVE_TOOL_NAME } from './review-capabilities.mjs';

export const CHECK_RESULT_SCHEMA = 'houseplan-review-check-result/v1';
const OUTPUT_LIMIT = 16 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const outside = rel => isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep);
const git = (policy, args) => execFileSync('git', args, { cwd: policy.root, encoding: 'utf8', timeout: 5000,
  env: reviewCheckEnvironment(), maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function assertReviewMaterial(policy) {
  if (git(policy, ['rev-parse', 'HEAD']) !== policy.sha
    || git(policy, ['diff', '--no-ext-diff', '--no-textconv', '--name-only', 'HEAD'])) throw Error('review material changed');
}

export function reviewCheckEnvironment(source = process.env) {
  const keys = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR',
    'LANG', 'LC_ALL', 'TZ', 'CI', 'PLAYWRIGHT_BROWSERS_PATH'];
  const value = Object.fromEntries(keys.filter(k => typeof source[k] === 'string').map(k => [k, source[k]]));
  value.PATH = [dirname(process.execPath), source.PATH ?? source.Path ?? ''].filter(Boolean).join(delimiter);
  delete value.Path;
  // No GitHub/model tokens, NODE_OPTIONS, Git overrides or Actions output files.
  return { ...value, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', PAGER: 'cat', NO_COLOR: '1', FORCE_COLOR: '0',
    NPM_CONFIG_USERCONFIG: process.platform === 'win32' ? 'NUL' : '/dev/null',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false' };
}

function privateBytes(path, limit) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > limit || realpathSync(path) !== path) throw Error('invalid private review file');
    const bytes = Buffer.alloc(limit + 1); let total = 0, length;
    while (total < bytes.length && (length = readSync(fd, bytes, total, bytes.length - total, null))) total += length;
    if (total > limit) throw Error('private review input exceeds its bound');
    return bytes.subarray(0, total);
  } finally { closeSync(fd); }
}
const privatePolicy = path => JSON.parse(privateBytes(path, 4 * 1024 * 1024).toString('utf8'));

function outputDirectory(policy, policyPath) {
  const parent = dirname(policyPath);
  if (realpathSync(parent) !== parent || !outside(relative(policy.root, parent))
    || typeof policy.checksJournal !== 'string' || dirname(policy.checksJournal) !== parent
    || policy.outputs.includes(policy.checksJournal)) throw Error('invalid check output location');
  const directory = join(parent, 'review-check-output');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (realpathSync(directory) !== directory) throw Error('invalid check output directory');
  return directory;
}

function executeStep(step, { cwd, env, remaining, signal }) {
  return new Promise(resolve => {
    const started = Date.now(), stdout = [], stderr = [];
    let bytes = 0, timedOut = false, aborted = false, overflow = false, failed = false, settled = false, escalation;
    const child = spawn(step.bin, step.args, { cwd, env, shell: false, windowsHide: true,
      detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const kill = force => {
      if (!child.pid) return;
      // Native model execution is Linux-only. Windows supports local protocol
      // fixtures, not isolation/termination of a descendant process tree.
      try { if (process.platform !== 'win32') process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
        else child.kill(force ? 'SIGKILL' : 'SIGTERM'); } catch { /* Only this owned process group is addressed. */ }
    };
    const stop = () => { kill(false); escalation ??= setTimeout(() => kill(true), 1000); };
    const accept = list => chunk => {
      if (overflow) return;
      if (bytes + chunk.length > OUTPUT_LIMIT) { overflow = true; stop(); return; }
      bytes += chunk.length; list.push(chunk);
    };
    child.stdout.on('data', accept(stdout)); child.stderr.on('data', accept(stderr));
    const abort = () => { aborted = true; stop(); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => { timedOut = true; stop(); }, Math.max(1, remaining));
    const finish = (exitCode, exitSignal) => {
      if (settled) return; settled = true; clearTimeout(timer); clearTimeout(escalation);
      signal?.removeEventListener('abort', abort);
      resolve({ exitCode, signal: exitSignal, elapsedMs: Date.now() - started, timedOut, aborted, overflow, failed,
        stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    };
    child.on('error', () => { failed = true; finish(null, null); });
    child.on('close', finish);
  });
}

export async function runApprovedCheck({ policyPath, checkId, signal }) {
  if (typeof checkId !== 'string' || !checkId.length || checkId.length > 256) throw Error('invalid check identifier');
  const policy = privatePolicy(policyPath), manifest = readReviewCapabilities(policy);
  assertReviewMaterial(policy);
  const directory = outputDirectory(policy, policyPath), entry = manifest.checks.find(c => c.id === checkId);
  const receiptId = randomUUID(), startedAt = new Date().toISOString(), started = Date.now();
  const steps = [];
  if (entry && !signal?.aborted) for (const step of entry.steps) {
    const remaining = entry.timeoutMs - (Date.now() - started);
    if (remaining <= 0) break;
    const result = await executeStep(step, { cwd: policy.root, env: reviewCheckEnvironment(), remaining, signal });
    const prefix = join(directory, receiptId + '-' + steps.length);
    writeFileSync(prefix + '.stdout', result.stdout, { flag: 'wx', mode: 0o600 });
    writeFileSync(prefix + '.stderr', result.stderr, { flag: 'wx', mode: 0o600 });
    const { stdout, stderr, ...metadata } = result;
    steps.push({ ...metadata, stdoutPath: prefix + '.stdout', stdoutSha256: hash(stdout), stdoutBytes: stdout.length,
      stderrPath: prefix + '.stderr', stderrSha256: hash(stderr), stderrBytes: stderr.length });
    if (result.exitCode !== 0 || result.failed || result.timedOut || result.aborted || result.overflow) break;
  }
  let materialUnchanged = true;
  try { assertReviewMaterial(policy); } catch { materialUnchanged = false; }
  const last = steps.at(-1), complete = Boolean(entry && steps.length === entry.steps.length);
  const status = !materialUnchanged ? 'material-changed' : !entry ? 'unavailable'
    : signal?.aborted || last?.aborted ? 'cancelled' : last?.overflow ? 'output-limit'
      : last?.failed ? 'launch-error' : last?.timedOut ? 'timeout'
        : last && last.exitCode !== 0 ? 'failed' : !complete ? 'timeout' : 'passed';
  const receipt = { schema: CHECK_RESULT_SCHEMA, receiptId, checkId, materialSha: policy.sha,
    manifestDigest: manifest.digest, recipeDigest: entry?.recipeDigest ?? null,
    callDigest: callDigest(REVIEW_MCP_NATIVE_TOOL_NAME, { check_id: checkId }),
    executed: steps.length > 0, status, exitCode: ['passed', 'failed'].includes(status) ? last.exitCode : null,
    materialUnchanged, startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - started, steps };
  appendFileSync(policy.checksJournal, JSON.stringify(receipt) + '\n', { mode: 0o600 });
  return receipt;
}

export function checkReceiptFromResult(content) {
  const blocks = typeof content === 'string' ? [content] : Array.isArray(content)
    ? content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text) : [];
  const values = blocks.flatMap(text => { try { const value = JSON.parse(text);
    return value?.schema === CHECK_RESULT_SCHEMA ? [value] : []; } catch { return []; } });
  const unique = new Map(values.map(value => [capabilityReceiptDigest(value), value]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
export const capabilityReceiptDigest = value => capabilityDigest(value);

export function readCheckExecutionEntries(policy) {
  return privateBytes(policy.checksJournal, 2 * 1024 * 1024).toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}

export function checkTraceProblems(call, result, entries, policy) {
  const problems = [], receipt = checkReceiptFromResult(result?.content);
  if (!receipt) return { problems: ['approved check has no result receipt'], receiptId: null };
  let manifest;
  try { manifest = readReviewCapabilities(policy); } catch { return { problems: ['approved check policy is unavailable'], receiptId: receipt.receiptId }; }
  const matches = entries.filter(row => row?.receiptId === receipt.receiptId);
  const steps = Array.isArray(receipt.steps) ? receipt.steps : [];
  const entry = manifest.checks.find(row => row.id === call?.input?.check_id);
  if (!/^[a-f0-9-]{36}$/.test(receipt.receiptId || '') || matches.length !== 1
    || capabilityReceiptDigest(matches[0]) !== capabilityReceiptDigest(receipt)) problems.push('approved check result and execution ledger differ');
  if (receipt.checkId !== call?.input?.check_id || receipt.materialSha !== policy.sha
    || receipt.manifestDigest !== manifest.digest || receipt.recipeDigest !== (entry?.recipeDigest ?? null)
    || receipt.callDigest !== callDigest(REVIEW_MCP_NATIVE_TOOL_NAME, call.input)
    || receipt.materialUnchanged !== true) problems.push('approved check identity or material differs');
  if (!Array.isArray(receipt.steps) || receipt.executed !== (steps.length > 0)
    || entry && steps.length > entry.steps.length
    || !entry && (receipt.executed || receipt.status !== 'unavailable' || steps.length || receipt.exitCode !== null))
    problems.push('approved check execution shape differs');
  if (!['passed', 'failed', 'timeout', 'cancelled', 'output-limit', 'launch-error', 'unavailable'].includes(receipt.status))
    problems.push('approved check outcome is unavailable');
  if (receipt.status === 'passed' && (!entry || !receipt.executed || receipt.exitCode !== 0
    || steps.length !== entry.steps.length || steps.some(s => !s || s.exitCode !== 0 || s.failed || s.timedOut || s.aborted || s.overflow)))
    problems.push('approved check falsely claims PASS');
  return { problems, receiptId: receipt.receiptId };
}

export function verifyCheckExecutionFiles(entries, policy, policyPath) {
  const problems = [], directory = outputDirectory(policy, policyPath);
  for (const entry of entries) {
    if (!entry || !/^[a-f0-9-]{36}$/.test(entry.receiptId || '') || !Array.isArray(entry.steps)) {
      problems.push('invalid approved check ledger'); continue;
    }
    entry.steps.forEach((step, index) => {
      for (const channel of ['stdout', 'stderr']) try {
        const expected = join(directory, entry.receiptId + '-' + index + '.' + channel);
        if (step[channel + 'Path'] !== expected) throw Error('unexpected output path');
        const bytes = privateBytes(expected, OUTPUT_LIMIT);
        if (bytes.length !== step[channel + 'Bytes'] || hash(bytes) !== step[channel + 'Sha256']) throw Error('output bytes differ');
      } catch { problems.push('approved check output file is missing or differs'); }
    });
  }
  return problems;
}
