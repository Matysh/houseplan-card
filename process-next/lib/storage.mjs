import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
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
  if (existsSync(path)) {
    const real = realpathSync(path), realRoot = realpathSync(root), inside = relative(realRoot, real);
    if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error(`Symlink leaves root: ${name}`);
  }
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
export function inputIdentity(root, inputs) {
  const files = expandInputs(root, inputs).map(name => {
    if (name.startsWith('@pattern:')) return [name, 'pattern'];
    const path = within(root, name);
    return [name, existsSync(path) ? digest(readFileSync(path)) : 'missing'];
  });
  return { hash: digest(JSON.stringify(files)), files };
}
export function stepIdentity(root, step, environment = {}, dependencies = []) {
  const inputs = inputIdentity(root, step.inputs);
  return { ...inputs, hash: digest(JSON.stringify({ id: step.id, inputs: inputs.hash, command: step.command, cwd: step.cwd, env: step.env, expectedNonempty: step.expectedNonempty, environment, dependencies })) };
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
  find(key) { return readJson(join(this.directory, 'cache', `${key}.json`)); }
  remember(result) { if (result.status === 'passed') writeJson(join(this.directory, 'cache', `${result.fingerprint}.json`), result); }
  save(report) { writeJson(join(this.directory, 'runs', report.id, 'report.json'), report); }
  report(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid run id');
    return readJson(join(this.directory, 'runs', id, 'report.json'));
  }
}
