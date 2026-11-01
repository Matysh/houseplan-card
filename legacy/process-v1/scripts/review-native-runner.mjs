// #1065: direct pinned native transport; the execution policy remains the authority.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, mkdirSync, openSync, readSync, realpathSync,
  writeFileSync, writeSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './spawn-portable.mjs';
import { NATIVE_REVIEW_TOOLS, REVIEW_MCP_SERVER_NAME, REVIEW_MCP_NATIVE_TOOL_NAME } from './review-capabilities.mjs';

export const NATIVE_REVIEW_VERSION = '2.1.295';
export const NATIVE_REVIEW_SHA256 = '4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const cleanPath = value => typeof value === 'string' && isAbsolute(value) && !/[\r\n\0]/.test(value);
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_LINE = 8 * 1024 * 1024;
const outside = rel => isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep);

export function readBoundedReviewBytes(fd, limit, read = readSync) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('invalid input bound');
  const parts = [], chunk = Buffer.alloc(Math.min(64 * 1024, limit + 1));
  let total = 0;
  while (total <= limit) {
    const requested = Math.min(chunk.length, limit + 1 - total);
    const count = read(fd, chunk, 0, requested, null);
    if (!Number.isInteger(count) || count < 0 || count > requested) throw new Error('invalid input read');
    if (count === 0) break;
    total += count;
    if (total > limit) throw new Error('input grew beyond its bound');
    parts.push(Buffer.from(chunk.subarray(0, count)));
  }
  return Buffer.concat(parts, total);
}

function regularBytes(path, limit) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > limit || realpathSync(path) !== path) throw new Error('invalid input file');
    return readBoundedReviewBytes(fd, limit);
  } finally { closeSync(fd); }
}

export function prepareNativeReviewPrompt(path, text, materialRoot = process.cwd()) {
  if (!cleanPath(path) || typeof text !== 'string' || !text.length || text.includes('\0')
    || Buffer.byteLength(text) > 16 * 1024 * 1024) throw new Error('invalid review prompt');
  const rel = relative(realpathSync(materialRoot), path);
  if (!outside(rel)) throw new Error('prompt must be outside review material');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (realpathSync(dirname(path)) !== dirname(path)) throw new Error('prompt parent must be canonical');
  writeFileSync(path, text, { flag: 'wx', mode: 0o600 });
}

export function verifyNativeReviewBinary(path) {
  const bytes = regularBytes(path, 384 * 1024 * 1024);
  if (createHash('sha256').update(bytes).digest('hex') !== NATIVE_REVIEW_SHA256) throw new Error('native CLI identity mismatch');
}

export function nativeReviewConfig(env = process.env) {
  return { cliPath: env.REVIEW_CLI_PATH, policyPath: env.REVIEW_POLICY, promptPath: env.REVIEW_PROMPT,
    jsonSchema: env.REVIEW_JSON_SCHEMA, kind: env.REVIEW_KIND, maxTurns: Number(env.REVIEW_MAX_TURNS),
    executionDir: env.REVIEW_EXECUTION_DIR };
}

export function buildNativeReviewInvocation(config, policy, { tools = NATIVE_REVIEW_TOOLS,
  serverName = REVIEW_MCP_SERVER_NAME, serverPath = fileURLToPath(new URL('./review-check-server.mjs', import.meta.url)),
  nodePath = process.execPath } = {}) {
  if (![config.cliPath, config.policyPath, config.promptPath, config.executionDir, policy?.root, serverPath, nodePath].every(cleanPath)
    || !object(policy) || policy.schema !== 2 || !/^[a-f0-9]{40}$/.test(policy.sha ?? '')
    || policy.cliVersion !== NATIVE_REVIEW_VERSION || policy.cliSha256 !== NATIVE_REVIEW_SHA256
    || !['task', 'ship', 'release'].includes(config.kind) || config.kind !== policy.kind
    || !Number.isSafeInteger(config.maxTurns) || config.maxTurns < 1 || config.maxTurns > (config.kind === 'release' ? 200 : 150)
    || tools.length !== NATIVE_REVIEW_TOOLS.length || tools.some((name, i) => name !== NATIVE_REVIEW_TOOLS[i])
    || serverName !== REVIEW_MCP_SERVER_NAME) throw new Error('invalid native review configuration');
  const schema = JSON.parse(config.jsonSchema);
  if (!object(schema) || schema.type !== 'object') throw new Error('invalid structured output schema');
  const settingsPath = `${config.policyPath}.settings.json`, mcpPath = join(config.executionDir, 'native-mcp.json');
  return { file: config.cliPath, cwd: policy.root, settingsPath, mcpPath,
    args: ['--print', '--verbose', '--input-format', 'text', '--output-format', 'stream-json',
      '--model', 'claude-sonnet-5', '--effort', 'high', '--max-turns', String(config.maxTurns),
      '--setting-sources', '', '--settings', settingsPath, '--tools', tools.join(','),
      '--allowedTools', [...tools, REVIEW_MCP_NATIVE_TOOL_NAME].join(','),
      '--strict-mcp-config', '--mcp-config', mcpPath, '--json-schema', JSON.stringify(schema)],
    mcp: { mcpServers: { [serverName]: { command: nodePath, args: [serverPath, config.policyPath] } } },
  };
}

/** Keep every parsed message; a broken/oversize stream can never become a complete result. */
export function createNativeReviewCollector({ maxBytes = MAX_BYTES, maxLineBytes = MAX_LINE } = {}) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', bytes = 0, problem = null;
  const messages = [];
  const line = value => {
    if (!value.trim()) return;
    if (Buffer.byteLength(value) > maxLineBytes) throw new Error('stream-line-limit');
    const item = JSON.parse(value);
    if (!object(item) || typeof item.type !== 'string') throw new Error('stream-message-shape');
    if (messages.length >= 100000) throw new Error('stream-message-limit');
    messages.push(item);
  };
  return {
    messages,
    get problem() { return problem; },
    add(chunk) {
      if (problem) return;
      try {
        bytes += chunk.length;
        if (bytes > maxBytes) throw new Error('stream-total-limit');
        text += decoder.decode(chunk, { stream: true });
        let end;
        while ((end = text.indexOf('\n')) !== -1) { line(text.slice(0, end)); text = text.slice(end + 1); }
        if (Buffer.byteLength(text) > maxLineBytes) throw new Error('stream-line-limit');
      } catch { problem = 'invalid-or-oversize-native-stream'; }
    },
    end() {
      if (problem) return;
      try { text += decoder.decode(); if (text.length) line(text); text = ''; }
      catch { problem = 'invalid-or-truncated-native-stream'; }
    },
  };
}

export function nativeReviewResult(messages, maxTurns) {
  const results = messages.filter(message => message.type === 'result');
  const result = results[0];
  if (results.length !== 1 || messages.at(-1) !== result || result.subtype !== 'success' || result.is_error !== false
    || !Number.isSafeInteger(result.num_turns) || result.num_turns < 1 || result.num_turns > maxTurns
    || !Array.isArray(result.permission_denials) || result.permission_denials.length
    || !object(result.structured_output) || typeof result.session_id !== 'string' || !result.session_id.length)
    throw new Error('native review did not produce a complete successful result');
  return result;
}

/** Dependency hooks are for inert transport tests, never accepted from CLI/env. */
export async function runNativeReview(config, { spawnNative = spawn, verifyBinary = verifyNativeReviewBinary,
  platform = process.platform, timeoutMs = 45 * 60 * 1000, terminateGraceMs = 1000, stdioGraceMs = 1000,
  maxBytes = MAX_BYTES, maxLineBytes = MAX_LINE, env = process.env, capabilities: injectedCapabilities } = {}) {
  let status = 'configuration-refused', outputs = {}, child, rawFd, stderrFd;
  const started = Date.now();
  const policy = JSON.parse(regularBytes(config.policyPath, 4 * 1024 * 1024).toString('utf8'));
  const capabilities = injectedCapabilities ?? await import('./review-capabilities.mjs');
  const manifest = capabilities.readReviewCapabilities(policy);
  const invocation = buildNativeReviewInvocation(config, policy, { tools: manifest.nativeTools,
    serverName: manifest.serverName });
  if (platform !== 'linux' || realpathSync(policy.root) !== policy.root) throw new Error('native review requires the pinned Linux environment');
  verifyBinary(config.cliPath);
  const prompt = regularBytes(config.promptPath, 16 * 1024 * 1024);
  regularBytes(invocation.settingsPath, 4 * 1024 * 1024);
  const rel = relative(policy.root, config.executionDir);
  if (!outside(rel)) throw new Error('execution evidence must be outside review material');
  mkdirSync(config.executionDir, { recursive: true, mode: 0o700 });
  if (realpathSync(config.executionDir) !== config.executionDir) throw new Error('execution directory must be canonical');
  const create = (name, content) => {
    const path = join(config.executionDir, name);
    writeFileSync(path, content, { flag: 'wx', mode: 0o600 }); return path;
  };
  const rawPath = join(config.executionDir, 'native-raw.jsonl'), stderrPath = join(config.executionDir, 'native-stderr.log');
  const messagesPath = join(config.executionDir, 'native-messages.json');
  create('native-mcp.json', JSON.stringify(invocation.mcp));
  const collector = createNativeReviewCollector({ maxBytes, maxLineBytes });
  let stderrBytes = 0, rawBytes = 0, transportProblem = null, exitCode = null, exitSignal = null;
  const ownsProcessGroup = process.platform === 'linux';
  let timeout, killTimer, drainTimer, finalizeTimer, waitResolve, waitSettled = false;
  const signalOwned = signal => {
    if (!child?.pid) return;
    try {
      if (ownsProcessGroup) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch { /* Only this launch's process/group is addressed; never a global process search. */ }
  };
  const terminate = () => {
    if (!child || waitSettled || finalizeTimer) return;
    // The leader may have exited while a descendant still owns a pipe.
    signalOwned('SIGTERM');
    killTimer = setTimeout(() => signalOwned('SIGKILL'), terminateGraceMs);
    finalizeTimer = setTimeout(() => {
      if (waitSettled) return;
      transportProblem ??= 'native-stdio-timeout';
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      child.unref(); exitSignal = child.signalCode;
      waitResolve(child.exitCode);
    }, terminateGraceMs + stdioGraceMs);
  };
  try {
    rawFd = openSync(rawPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    stderrFd = openSync(stderrPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    child = spawnNative(invocation.file, invocation.args, { cwd: invocation.cwd, env: { ...env },
      shell: false, windowsHide: true, detached: ownsProcessGroup, stdio: ['pipe', 'pipe', 'pipe'] });
    exitCode = await new Promise(resolve => {
      waitResolve = code => { if (!waitSettled) { waitSettled = true; resolve(code); } };
      child.on('error', () => { transportProblem = 'native-spawn-failed'; });
      child.stdout.on('data', chunk => {
        const value = Buffer.from(chunk);
        try {
          const take = Math.max(0, Math.min(value.length, maxBytes - rawBytes));
          if (take) { writeSync(rawFd, value.subarray(0, take)); rawBytes += take; }
          collector.add(value);
          if (collector.problem) { transportProblem = collector.problem; terminate(); }
        } catch { transportProblem = 'native-evidence-write-failed'; terminate(); }
      });
      child.stderr.on('data', chunk => {
        const value = Buffer.from(chunk);
        try {
          const take = Math.max(0, Math.min(value.length, maxBytes - stderrBytes));
          if (take) { writeSync(stderrFd, value.subarray(0, take)); stderrBytes += take; }
          if (take !== value.length) { transportProblem = 'native-stderr-limit'; terminate(); }
        } catch { transportProblem = 'native-evidence-write-failed'; terminate(); }
      });
      child.stdin.on('error', () => { transportProblem ??= 'native-input-failed'; terminate(); });
      for (const stream of [child.stdout, child.stderr]) stream.on('error', () => {
        transportProblem ??= 'native-output-failed'; terminate();
      });
      child.on('exit', () => {
        if (!waitSettled) drainTimer = setTimeout(() => {
          transportProblem ??= 'native-stdio-timeout'; terminate();
        }, stdioGraceMs);
      });
      child.on('close', (code, signal) => { exitSignal = signal; waitResolve(code); });
      timeout = setTimeout(() => { transportProblem = 'native-timeout'; terminate(); }, timeoutMs);
      child.stdin.end(prompt);
    });
    collector.end();
    create('native-messages.json', JSON.stringify(collector.messages));
    outputs = { execution_file: messagesPath };
    if (transportProblem || collector.problem || exitCode !== 0 || exitSignal) throw new Error('native transport failed');
    const result = nativeReviewResult(collector.messages, config.maxTurns);
    outputs = { ...outputs, structured_output: JSON.stringify(result.structured_output), session_id: result.session_id };
    status = 'success';
  } catch {
    status = transportProblem || collector.problem || 'native-result-refused';
    if (!outputs.execution_file) { create('native-messages.json', JSON.stringify(collector.messages)); outputs.execution_file = messagesPath; }
  } finally {
    clearTimeout(timeout); clearTimeout(killTimer); clearTimeout(drainTimer); clearTimeout(finalizeTimer);
    if (rawFd !== undefined) closeSync(rawFd);
    if (stderrFd !== undefined) closeSync(stderrFd);
    create('native-adapter.json', JSON.stringify({ schema: 'houseplan-native-review/v1', status,
      cliVersion: NATIVE_REVIEW_VERSION, cliSha256: NATIVE_REVIEW_SHA256, materialSha: policy.sha,
      exitCode, exitSignal, durationMs: Date.now() - started, messages: collector.messages.length,
      rawBytes, stderrBytes, rawPath, stderrPath, executionFile: outputs.execution_file }));
  }
  return { success: status === 'success', status, outputs };
}

export function writeNativeReviewOutputs(outputs, path) {
  if (!path) return;
  for (const [name, value] of Object.entries(outputs)) {
    if (!['execution_file', 'structured_output', 'session_id', 'conclusion'].includes(name)
      || typeof value !== 'string' || /[\r\n\0]/.test(value)) throw new Error('invalid workflow output');
  }
  writeFileSync(path, Object.entries(outputs).map(([name, value]) => `${name}=${value}\n`).join(''), { flag: 'a' });
}

if (isMainModule(import.meta.url)) {
  try {
    if (process.argv[2] === 'prepare-prompt' && process.argv.length === 3) {
      prepareNativeReviewPrompt(process.env.REVIEW_PROMPT, process.env.REVIEW_PROMPT_TEXT);
      console.log('native review prompt prepared');
    } else {
      if (process.argv.length !== 2) throw new Error('unknown runner operation');
      const result = await runNativeReview(nativeReviewConfig());
      writeNativeReviewOutputs({ ...result.outputs, conclusion: result.success ? 'success' : 'failure' }, process.env.GITHUB_OUTPUT);
      console.log(`native review transport: ${result.success ? 'complete' : 'refused'}`);
      if (!result.success) process.exitCode = 1;
    }
  } catch { console.error('native review transport unavailable'); process.exitCode = 1; }
}
