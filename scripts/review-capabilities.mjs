// #1065: one declared capability set feeds the model and the dispatcher.
import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { canonicalCallJson } from './review-call-digest.mjs';

export const CAPABILITIES_SCHEMA = 'houseplan-review-capabilities/v1';
export const NATIVE_REVIEW_TOOLS = Object.freeze(['Read', 'Grep', 'Glob', 'Write', 'ToolSearch']);
export const REVIEW_MCP_SERVER_NAME = 'houseplan_review';
export const REVIEW_MCP_TOOL_NAME = 'run_check';
export const REVIEW_MCP_NATIVE_TOOL_NAME = 'mcp__houseplan_review__run_check';
export const capabilityDigest = value => createHash('sha256').update(canonicalCallJson(value)).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const pathInput = value => typeof value === 'string' && value.length > 0 && value.length <= 1024
  && !isAbsolute(value) && !/[\0\r\n\\]/.test(value) && !value.split('/').includes('..');
const outside = value => isAbsolute(value) || value === '..' || value.startsWith('..' + sep);
const staticChecks = Object.freeze({
  'ci-profiles': ['scripts/ci-profiles.mjs', '--check'],
  'ci-registry-inventory': ['scripts/ci-registry-inventory.mjs', '--check'],
  'status-snapshot': ['scripts/status-snapshot.mjs', '--check'],
  'check-inputs': ['scripts/check-inputs.mjs', '--coverage'],
  'mutation-registry': ['scripts/mutation-gate.mjs', '--check'],
  'bundle-budget': ['scripts/bundle-budget.mjs'],
  inventory: ['scripts/inventory.mjs'],
  'smoke-select': ['scripts/smoke-select.mjs'],
  'toolchain-pins': ['scripts/toolchain-pins.mjs', '--check'],
});

function validateMaterial(policy) {
  if (!policy || !sha(policy.sha) || !isAbsolute(policy.root || '') || realpathSync(policy.root) !== policy.root
    || !['task', 'ship', 'release'].includes(policy.kind) || !['spec', 'code', 'ship', 'release'].includes(policy.stage)
    || !Array.isArray(policy.files) || policy.files.length > 30000 || policy.files.some(p => !pathInput(p))
    || new Set(policy.files).size !== policy.files.length) throw Error('invalid capability material');
}

function runtimePaths(root) {
  const node = realpathSync(process.execPath);
  const npmPath = process.platform === 'win32' ? join(dirname(node), 'node_modules/npm/bin/npm-cli.js') : join(dirname(node), 'npm');
  const npm = existsSync(npmPath) ? realpathSync(npmPath) : null;
  const pythonPath = join(root, '.venv-backend', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const pythonTarget = existsSync(pythonPath) ? realpathSync(pythonPath) : null;
  const python = pythonTarget && outside(relative(root, pythonTarget)) ? pythonPath : null;
  return { node, nodeVersion: process.versions.node,
    npm: npm && outside(relative(root, npm)) ? npm : null,
    python, pythonTarget: python ? pythonTarget : null };
}

function recipes(policy, runtime) {
  const files = new Set(policy.files), checks = [];
  const add = (id, description, kind, steps, timeoutMs = 120000) => {
    if (id.length > 256) id = kind + ':' + capabilityDigest(id);
    const entry = { id, description, kind, steps, timeoutMs };
    checks.push({ ...entry, recipeDigest: capabilityDigest(entry) });
  };
  const node = args => ({ bin: runtime.node, args });
  for (const file of [...files].sort()) {
    if (/^test\/.+\.test\.mjs$/.test(file))
      add('unit:' + file, 'Run unchanged Node unit file ' + file, 'node-unit', [node(['--test', file])]);
  }
  for (const [name, args] of Object.entries(staticChecks)) if (files.has(args[0]))
    add('static:' + name, 'Read-only/static check ' + name, 'static', [node(args)]);
  const base = sha(policy.base) ? policy.base : policy.sha;
  const git = args => ({ bin: 'git', args: ['-c', 'maintenance.auto=false', '-c', 'gc.auto=0', '--no-pager', ...args] });
  add('read:diff', 'Read the immutable base-to-candidate diff', 'read', [git(['diff', '--no-ext-diff', '--no-textconv', base, policy.sha])], 5000);
  add('read:log', 'Read commits in the immutable task range', 'read', [git(['log', '--oneline', base + '..' + policy.sha])], 5000);
  for (const file of [...new Set(policy.changedFiles || [])].sort()) if (pathInput(file) && files.has(file))
    add('read:base:' + file, 'Read base version of ' + file, 'read', [git(['show', '--no-ext-diff', '--no-textconv', base + ':' + file])], 5000);
  if (policy.stage !== 'spec') {
    if (files.has('tsconfig.test.json') && files.has('scripts/fix-test-build.mjs'))
      add('build:test', 'Prepare ordinary emitted test inputs before tests that import test-build', 'build',
        [node(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json']), node(['scripts/fix-test-build.mjs'])]);
    if (files.has('package.json') && runtime.npm) for (const target of ['build', 'typecheck', 'bundle:sync'])
      add('build:' + target, 'Run ordinary npm ' + target, 'build', [node([runtime.npm, 'run', target])]);
    for (const file of [...files].sort()) {
      if (/^demo\/smoke_[\w-]+\.mjs$/.test(file))
        add('smoke:' + file, 'Run unchanged targeted browser smoke ' + file, 'smoke', [node([file])], 180000);
      if (runtime.python && /^tests_backend\/test_[\w]+\.py$/.test(file))
        add('pytest:' + file, 'Run unchanged backend test file ' + file, 'pytest', [{ bin: runtime.python, args: ['-m', 'pytest', file, '-q'] }]);
    }
  }
  return checks.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function buildReviewCapabilities(policy) {
  validateMaterial(policy);
  const runtime = runtimePaths(policy.root);
  const value = { schema: CAPABILITIES_SCHEMA, materialSha: policy.sha, root: policy.root,
    stage: policy.stage, kind: policy.kind, nativeTools: [...NATIVE_REVIEW_TOOLS],
    serverName: REVIEW_MCP_SERVER_NAME, toolName: REVIEW_MCP_TOOL_NAME,
    runtime, checks: recipes(policy, runtime) };
  return { ...value, digest: capabilityDigest(value) };
}

export function readReviewCapabilities(policy) {
  validateMaterial(policy);
  const value = policy.capabilities;
  if (policy.schema !== 2 || !value || value.schema !== CAPABILITIES_SCHEMA
    || value.materialSha !== policy.sha || value.root !== policy.root || value.stage !== policy.stage || value.kind !== policy.kind
    || JSON.stringify(value.nativeTools) !== JSON.stringify(NATIVE_REVIEW_TOOLS)
    || value.serverName !== REVIEW_MCP_SERVER_NAME || value.toolName !== REVIEW_MCP_TOOL_NAME
    || value.runtime?.node !== realpathSync(process.execPath) || value.runtime.nodeVersion !== process.versions.node
    || !Array.isArray(value.checks) || value.checks.length > 6000) throw Error('invalid capability manifest');
  const { digest, ...payload } = value;
  const currentRuntime = runtimePaths(policy.root);
  if (canonicalCallJson(value.runtime) !== canonicalCallJson(currentRuntime))
    throw Error('capability runtime changed');
  if (digest !== capabilityDigest(payload)
    || canonicalCallJson(value.checks) !== canonicalCallJson(recipes(policy, value.runtime))) throw Error('capability manifest changed');
  return value;
}

export function reviewCheckToolDefinition(manifest) {
  return { name: REVIEW_MCP_TOOL_NAME, description: 'Run one declared unchanged check by its exact check_id from manifest ' + manifest.digest + '. Read the supplied check catalogue; no shell, executable, argv, env or cwd can be supplied. Failed/unavailable checks are not PASS.',
    inputSchema: { type: 'object', properties: { check_id: { type: 'string', minLength: 1, maxLength: 256 } }, required: ['check_id'], additionalProperties: false },
    annotations: { destructiveHint: false, openWorldHint: false },
  };
}

export function reviewChecksMarkdown(manifest) {
  return '# Declared review checks\n\nMaterial: ' + manifest.materialSha + '\nManifest SHA256: ' + manifest.digest
    + '\n\nUse run_check(check_id). No shell is available. Reuse compatible CI evidence; execute a check only for a concrete uncovered risk or invalidated proof. Tests importing test-build can use build:test first. A failed or unavailable check is not PASS.\n\n'
    + manifest.checks.map(c => '- `' + c.id + '` — ' + c.description + ' (' + c.timeoutMs + ' ms)').join('\n') + '\n';
}
