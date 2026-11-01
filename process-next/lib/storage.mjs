import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function defaultStateDir(root) {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return join(realpathSync(resolve(root, common)), 'process-next');
  } catch { return join(resolve(root), 'process-next', '.state'); }
}
export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); renameSync(temporary, path); }
  finally { rmSync(temporary, { force: true }); }
}
export function within(root, name) {
  const path = resolve(root, name), rel = relative(resolve(root), path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Path leaves root: ${name}`);
  // A missing output can still have a symlinked parent that leaves the checkout.
  let ancestor = path;
  while (!lstatSync(ancestor, { throwIfNoEntry: false }) && ancestor !== dirname(ancestor)) ancestor = dirname(ancestor);
  const real = realpathSync(ancestor), realRoot = realpathSync(root), inside = relative(realRoot, real);
  if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error(`Symlink leaves root: ${name}`);
  return path;
}
export function walk(root, directory = root) {
  if (!existsSync(directory)) return [];
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.state', '__pycache__', '.pytest_cache', '.venv'].includes(entry.name)) continue;
    const path = within(root, relative(root, join(directory, entry.name)));
    if (entry.isDirectory()) found.push(...walk(root, path));
    else if (entry.isFile() || entry.isSymbolicLink() && statSync(path).isFile()) found.push(relative(root, path).split(sep).join('/'));
  }
  return found.sort();
}
function globExpression(pattern) {
  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      i++;
      if (pattern[i + 1] === '/') { i++; out += '(?:.*/)?'; } else out += '.*';
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[\\^$+?.()|{}\[\]]/g, '\\$&');
  }
  return new RegExp(out + '$');
}
export function matchesInputs(name, inputs) {
  return (inputs ?? []).some(raw => {
    const pattern = raw.replaceAll('\\', '/');
    return /[?*]/.test(pattern) ? globExpression(pattern).test(name) : name === pattern || name.startsWith(pattern.replace(/\/$/, '') + '/');
  });
}
export function expandInputs(root, patterns) {
  const result = new Set();
  for (const raw of patterns ?? []) {
    const pattern = raw.split('\\').join('/');
    within(root, pattern);
    if (!/[?*]/.test(pattern)) {
      const path = within(root, pattern);
      if (existsSync(path) && statSync(path).isDirectory()) for (const file of walk(root, path)) result.add(file);
      else result.add(pattern);
      continue;
    }
    const first = pattern.search(/[?*]/), prefix = pattern.slice(0, first), slash = prefix.lastIndexOf('/');
    const directory = within(root, slash < 0 ? '.' : prefix.slice(0, slash));
    const matcher = globExpression(pattern);
    for (const file of walk(root, directory)) if (matcher.test(file)) result.add(file);
    // Missing patterns also affect identity: creating the first matching file invalidates reuse.
    result.add(`@pattern:${pattern}`);
  }
  return [...result].sort();
}
// Only release labels are ignored for behavioral checks. Dependency versions,
// source code and build/package outputs always retain their ordinary identity.
function behavioralBytes(name, bytes) {
  if (['package.json', 'package-lock.json', 'custom_components/houseplan/manifest.json'].includes(name)) {
    const value = JSON.parse(bytes);
    if (Object.hasOwn(value, 'version')) value.version = '<release-version>';
    if (name === 'package-lock.json' && value.packages?.['']?.version) value.packages[''].version = '<release-version>';
    return JSON.stringify(value);
  }
  if (['src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts'].includes(name))
    return bytes.toString().replace(/^(const CARD_VERSION = )(['"])[^'"\r\n]+\2;/m, "$1'<release-version>';");
  if (name === 'custom_components/houseplan/const.py')
    return bytes.toString().replace(/^(VERSION = )(['"])[^'"\r\n]+\2/m, '$1"<release-version>"');
  return bytes;
}
export function inputIdentity(root, inputs, { behavior = false } = {}) {
  const files = expandInputs(root, inputs).map(name => {
    if (name.startsWith('@pattern:')) return [name, 'pattern'];
    const path = within(root, name);
    return [name, existsSync(path) ? digest(behavior ? behavioralBytes(name, readFileSync(path)) : readFileSync(path)) : 'missing'];
  });
  return { hash: digest(JSON.stringify(files)), files };
}
export function stepIdentity(root, step, environment = {}, dependencies = []) {
  const inputs = inputIdentity(root, step.inputs, { behavior: step.reuseReleaseVersion === true && step.cwd !== 'e2e' });
  const command = step.reuseReleaseVersion && step.cwd === 'e2e' ? step.command?.map((arg, index) => {
    if (/^--(?:expected-version|target-ref)=/.test(arg)) return arg.split('=')[0] + '=<release-version>';
    if (/^--(?:candidate-root|work-root|e2e-root)=/.test(arg)) return arg.split('=')[0] + '=<isolated-path>';
    if (index === 1) return 'process-next/lib/e2e.mjs';
    return arg;
  }) : step.command;
  return { ...inputs, hash: digest(JSON.stringify({ id: step.id, inputs: inputs.hash, command, cwd: step.cwd, env: step.env, expectedNonempty: step.expectedNonempty, preparations: step.preparationCommands, environment, dependencies })) };
}
export function outputIdentity(root, outputs = []) {
  if (!outputs.length) return { hash: null, complete: true };
  const complete = outputs.every(pattern => {
    const entries = expandInputs(root, [pattern]).filter(x => !x.startsWith('@pattern:'));
    return entries.length > 0 && entries.every(name => existsSync(within(root, name)));
  });
  return { hash: inputIdentity(root, outputs).hash, complete };
}
export class ResultStore {
  constructor(directory) { this.directory = resolve(directory); }
  find(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) return null;
    try {
      const result = readJson(join(this.directory, 'cache', `${key}.json`));
      return result?.fingerprint === key && result.status === 'passed' ? result : null;
    } catch { return null; } // A damaged optional cache reruns the check, not the process.
  }
  remember(result, { root, step } = {}) {
    if (result.status !== 'passed') return;
    const cached = { ...result };
    try {
      if (step?.reusableReports?.length && outputIdentity(root, step.outputs).hash === result.cacheOutputHash) {
        cached.reportArtifacts = Object.fromEntries(step.reusableReports.map(name => {
          const bytes = readFileSync(within(root, name));
          return [name, { sha256: digest(bytes), data: bytes.toString('base64') }];
        }));
      }
    } catch { /* Unavailable optional report snapshots simply prevent later reuse. */ }
    writeJson(join(this.directory, 'cache', `${result.fingerprint}.json`), cached);
  }
  restoreReports(result, root, reports = []) {
    if (!reports.length || !result?.reportArtifacts) return false;
    try {
      // Reports are the sole opted-in outputs. Build/package outputs are never restored.
      const names = [...reports].sort();
      if (JSON.stringify(Object.keys(result.reportArtifacts).sort()) !== JSON.stringify(names)) return false;
      const files = names.map(name => {
        const artifact = result.reportArtifacts[name], target = within(root, name);
        if (typeof artifact?.data !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) throw Error('Invalid cached report');
        const bytes = Buffer.from(artifact.data, 'base64');
        if (digest(bytes) !== artifact.sha256) throw Error('Cached report bytes differ');
        if (existsSync(target) && (!statSync(target).isFile() || digest(readFileSync(target)) !== artifact.sha256)) throw Error('Existing output differs');
        return { name, target, bytes, sha256: artifact.sha256 };
      });
      if (digest(JSON.stringify(files.map(file => [file.name, file.sha256]))) !== result.cacheOutputHash) return false;
      for (const file of files) if (!existsSync(file.target)) {
        mkdirSync(dirname(file.target), { recursive: true });
        writeFileSync(file.target, file.bytes, { flag: 'wx', mode: 0o600 });
      }
      return true;
    } catch { return false; }
  }
  save(report) { writeJson(join(this.directory, 'runs', report.id, 'report.json'), report); }
  report(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid run id');
    return readJson(join(this.directory, 'runs', id, 'report.json'));
  }
}
