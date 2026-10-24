// #981: one committed content snapshot, independent of commit ancestry.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { BUILD_OUTPUT } from './check-inputs.mjs';
import { matchesPaths, pathMatcher } from './ci-profile-paths.mjs';
import { relativeDependencies } from './relative-dependencies.mjs';

export const REGISTRY_JOBS = Object.freeze(['frontend', 'backend', 'geometry_parity', 'smoke', 'golden', 'performance_smoke']);
export const digest = value => createHash('sha256').update(value).digest('hex');
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
export const canonical = value => JSON.stringify(ordered(value));
const normalize = raw => raw.includes(0) ? raw : Buffer.from(raw.toString('utf8').replace(/\r\n?/g, '\n'));
const git = (root, args, options = {}) => execFileSync('git', ['-C', root, ...args],
  { maxBuffer: 192 * 1024 * 1024, ...options });

/** Trust code is transitive executable input, not a hand-maintained checksum. */
export function registryProtocolFiles(reader) {
  const tracked = new Set(reader.tracked), reached = new Set();
  const pending = reader.tracked.filter(p => /^scripts\/(?:ci-proof(?:-registry)?|ci-registry-[\w-]+|ci-profile[\w-]*|artifact-inventory)\.mjs$/.test(p));
  while (pending.length) {
    const path = pending.pop(); if (reached.has(path)) continue; reached.add(path);
    for (const rel of relativeDependencies(reader.text(path))) {
      if (!rel.startsWith('.')) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), rel.split(/[?#]/)[0]));
      if (!tracked.has(target)) throw Error('unresolved registry protocol import: ' + target);
      pending.push(target);
    }
  }
  if (!reached.size) throw Error('missing registry protocol');
  return [...reached].sort();
}

/** Bulk-read control files once; ordinary input identity uses Git blob content IDs. */
export function registryReader(root, ref = 'HEAD') {
  const rows = git(root, ['ls-tree', '-rz', '--full-tree', ref]).toString('utf8').split('\0').filter(Boolean)
    .map(row => { const m = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(row); if (!m) throw Error('unsupported input tree'); return { mode: m[1], oid: m[2], path: m[3] }; });
  const tracked = rows.map(r => r.path), byPath = new Map(rows.map(r => [r.path, r]));
  const controls = /^(?:scripts\/|\.github\/workflows\/|(?:package(?:-lock)?\.json|\.python-version|\.nvmrc|pyproject\.toml)$)/;
  const textObjects = [...new Set(rows.filter(r => controls.test(r.path)).map(r => r.oid))];
  const data = git(root, ['cat-file', '--batch'], { input: textObjects.join('\n') + '\n' });
  const objects = new Map(); let offset = 0;
  for (const oid of textObjects) {
    const end = data.indexOf(10, offset), header = data.subarray(offset, end).toString('utf8').split(' ');
    const size = Number(header[2]);
    if (header[0] !== oid || header[1] !== 'blob' || !Number.isInteger(size)) throw Error('bad bulk input object');
    objects.set(oid, data.subarray(end + 1, end + 1 + size)); offset = end + size + 2;
  }
  const readMany = paths => {
    const entries = paths.map(path => {
      const row = byPath.get(path);
      if (!row || row.mode !== '100644' && row.mode !== '100755') throw Error('missing/symbolic input: ' + path);
      return row;
    });
    const missing = [...new Set(entries.map(row => row.oid).filter(oid => !objects.has(oid)))];
    if (missing.length) {
      const bytes = git(root, ['cat-file', '--batch'], { input: missing.join('\n') + '\n' });
      let at = 0;
      for (const oid of missing) {
        const end = bytes.indexOf(10, at), header = bytes.subarray(at, end).toString('utf8').split(' ');
        const size = Number(header[2]);
        if (header[0] !== oid || header[1] !== 'blob' || !Number.isInteger(size)) throw Error('bad bulk input object');
        objects.set(oid, bytes.subarray(end + 1, end + 1 + size)); at = end + size + 2;
      }
    }
    return entries.map(row => objects.get(row.oid));
  };
  const read = path => {
    const row = byPath.get(path);
    if (!row || row.mode !== '100644' && row.mode !== '100755') throw Error('missing/symbolic input: ' + path);
    if (!objects.has(row.oid)) objects.set(row.oid, git(root, ['cat-file', 'blob', row.oid]));
    return objects.get(row.oid);
  };
  return { tracked, read, readMany, text: p => read(p).toString('utf8'), rows };
}

// Parse scalar spans, preserving every byte outside the named version fields.
export function maskJsonScalars(text, pointers, version) {
  JSON.parse(text); const spans = new Map(); let at = 0;
  const white = () => { while (/\s/.test(text[at] || '') && at < text.length) at++; };
  const string = () => { const start = at++; while (at < text.length) { if (text[at++] === '"') return [start, at]; if (text[at - 1] === '\\') at++; } throw Error('unterminated JSON string'); };
  const walk = path => {
    white();
    if (text[at] === '{') {
      at++; white(); const seen = new Set();
      while (text[at] !== '}') {
        const pair = string(), name = JSON.parse(text.slice(...pair));
        if (seen.has(name)) throw Error('duplicate JSON member'); seen.add(name);
        white(); if (text[at++] !== ':') throw Error('bad JSON member');
        walk([...path, name]); white(); if (text[at] !== ',') break; at++; white();
      }
      if (text[at++] !== '}') throw Error('bad JSON object');
    } else if (text[at] === '[') {
      at++; white(); let index = 0;
      while (text[at] !== ']') { walk([...path, String(index++)]); white(); if (text[at] !== ',') break; at++; }
      if (text[at++] !== ']') throw Error('bad JSON array');
    } else {
      const start = at;
      if (text[at] === '"') string(); else while (at < text.length && !/[\s,\]}]/.test(text[at])) at++;
      spans.set(JSON.stringify(path), [start, at]);
    }
  };
  walk([]); const replacements = pointers.map(path => {
    const span = spans.get(JSON.stringify(path));
    if (!span || JSON.parse(text.slice(...span)) !== version) throw Error('unsynchronized version mirror');
    return span;
  }).sort((a, b) => b[0] - a[0]);
  for (const [start, end] of replacements) text = text.slice(0, start) + '"<release-version>"' + text.slice(end);
  return text;
}

/** Canonical release mirrors only, with their complete values synchronized. */
export function versionNormalizer(reader) {
  const version = JSON.parse(reader.text('package.json')).version;
  if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version || '')) throw Error('candidate reuse requires synchronized beta sources');
  const json = new Map([
    ['package.json', [['version']]],
    ['package-lock.json', [['version'], ['packages', '', 'version']]],
    ['custom_components/houseplan/manifest.json', [['version']]],
  ]);
  const literals = new Map([
    ['custom_components/houseplan/const.py', /^VERSION\s*=\s*(["'])([^"']+)\1/gm],
    ['src/houseplan-card.ts', /\bCARD_VERSION\s*=\s*(["'])([^"']+)\1/g],
    ['src/houseplan-editor-runtime.ts', /\bCARD_VERSION\s*=\s*(["'])([^"']+)\1/g],
  ]);
  const masked = new Map();
  for (const [path, pointers] of json) masked.set(path, Buffer.from(maskJsonScalars(reader.text(path).replace(/\r\n?/g, '\n'), pointers, version)));
  for (const [path, pattern] of literals) {
    const text = reader.text(path).replace(/\r\n?/g, '\n'), all = [...text.matchAll(pattern)];
    if (all.length !== 1 || all[0][2] !== version) throw Error('unsynchronized literal version mirror');
    masked.set(path, Buffer.from(text.replace(pattern, match => match.replace(version, '<release-version>'))));
  }
  return { version, maskedPaths: new Set(masked.keys()), read: path => masked.get(path) || normalize(reader.read(path)) };
}

export function executionHeader(text) {
  const header = text.slice(0, text.indexOf('\njobs:')), marks = [...header.matchAll(/^([\w-]+):/gm)];
  return marks.filter(mark => ['env', 'defaults', 'permissions'].includes(mark[1]))
    .map(mark => { const i = marks.indexOf(mark); return header.slice(mark.index, marks[i + 1]?.index).trimEnd(); }).join('\n') + '\n';
}
export function jobRecipe(reader, job, workflow = '.github/workflows/validate.yml', { authority = true } = {}) {
  const text = reader.text(workflow).replace(/\r\n?/g, '\n');
  const marks = [...text.matchAll(/^  ([\w-]+):\s*$/gm)], jobs = new Map();
  for (let i = 0; i < marks.length; i++) jobs.set(marks[i][1], text.slice(marks[i].index, marks[i + 1]?.index));
  const ids = [job, ...(authority ? ['reuse', 'proof'] : []), 'product_guards', ...(job === 'smoke' ? ['smoke_done'] : []), 'bundle'];
  if (ids.some(id => !jobs.has(id))) throw Error('missing execution recipe');
  return digest('job-recipe/v1\0' + executionHeader(text) + '\0' + ids.map(id => jobs.get(id)).join('\0'));
}

export function registryToolchain(reader, { node = process.versions.node, platform = process.platform, arch = process.arch, python = null } = {}) {
  const read = path => reader.text(path).replace(/\r\n?/g, '\n');
  const lock = read('package-lock.json'), version = JSON.parse(lock).version;
  const pins = maskJsonScalars(lock, [['version'], ['packages', '', 'version']], version);
  python = python || execFileSync('python', ['-c', 'import platform; print(platform.python_version())'], { encoding: 'utf8' }).trim();
  const format = new Intl.DateTimeFormat().resolvedOptions();
  return { node, platform, arch, python, pythonPin: read('.python-version').trim(),
    nodeFlags: process.execArgv, nodeOptions: process.env.NODE_OPTIONS || null, nodeEnv: process.env.NODE_ENV || null,
    locale: format.locale, timezone: format.timeZone,
    pins: digest(pins + read('.nvmrc') + read('.python-version') + read('pyproject.toml')) };
}

export function registryInputs(root, { ref = 'HEAD', toolchain = null, mode = 'exact', reader = registryReader(root, ref), perfSet = 'glow-iso-interaction' } = {}) {
  const environment = toolchain || registryToolchain(reader);
  const normalizer = mode === 'candidate' ? versionNormalizer(reader) : null;
  const inventory = JSON.parse(reader.text('scripts/ci-registry-inventory.json'));
  if (inventory.schema !== 1) throw Error('unknown input inventory');
  const domains = JSON.parse(reader.text('scripts/ci-profile-paths.json'));
  const productFiles = reader.tracked.filter(pathMatcher(domains.product));
  const entriesByPath = new Map(reader.rows.map(row => [row.path, row]));
  const hashFiles = files => {
    const hash = createHash('sha256');
    for (const path of [...new Set(files)].sort()) {
      const entry = entriesByPath.get(path);
      if (!entry || !['100644', '100755'].includes(entry.mode)) throw Error('missing/symbolic input: ' + path);
      // A Git blob OID names bytes, never a commit or its ancestry. Only beta
      // scalar masks require reading source bytes; all other bytes stay exact.
      const content = normalizer?.maskedPaths.has(path) ? 'masked:' + digest(normalizer.read(path)) : 'git-blob:' + entry.oid;
      hash.update(path + '\0' + entry.mode + '\0' + content + '\0');
    }
    return hash.digest('hex');
  };
  const treeId = hashFiles(productFiles), keys = {}, recipes = {}, inventories = {};
  const workflowRecipes = { 'validate.yml': {}, 'validate-product.yml': {} };
  const protocol = registryProtocolFiles(reader);
  for (const job of REGISTRY_JOBS) {
    let files = inventory.jobs[job];
    if (!Array.isArray(files) || !files.length || files.some(p => !reader.tracked.includes(p))) throw Error('missing job inputs');
    // Workflow job bodies are hashed separately. Unrelated docs/tooling recipe
    // changes must not invalidate unchanged product execution.
    files = files.filter(p => !p.startsWith('.github/workflows/'));
    files.push(...protocol);
    inventories[job] = [...new Set(files)].sort();
    for (const workflow of Object.keys(workflowRecipes)) workflowRecipes[workflow][job] = jobRecipe(reader, job, '.github/workflows/' + workflow);
    if (jobRecipe(reader, job, '.github/workflows/validate.yml', { authority: false })
      !== jobRecipe(reader, job, '.github/workflows/validate-product.yml', { authority: false }))
      throw Error('registered product execution differs from the canonical recipe');
    recipes[job] = digest(canonical(Object.fromEntries(Object.entries(workflowRecipes).map(([workflow, values]) => [workflow, values[job]]))));
    keys[job] = digest(canonical({ schema: 1, job, treeId, inputs: hashFiles(files),
      toolchain: environment, workflow_sha: recipes[job], ...(job === 'performance_smoke' ? { perfSet } : {}) }));
  }
  const plan = { schema: 1, mode, treeId, keys, recipes, workflowRecipes, toolchain: environment, perfSet, inventories };
  const entries = new Map(reader.rows.map(row => [row.path, { oid: row.oid, mode: row.mode }]));
  Object.defineProperty(plan, '_snapshot', { value: { entries, read: reader.read, readMany: reader.readMany, inventory, domains } });
  return plan;
}

/** A local pre-push cannot substitute committed keys for dirty executable input. */
export function cleanRegistryInputs(root, plan) {
  const owned = new Set(Object.values(plan.inventories).flat());
  const dirty = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).toString('utf8').split('\0').filter(Boolean);
  return dirty.every(row => {
    const path = row.slice(3);
    if (BUILD_OUTPUT.some(glob => matchesPaths(path, [glob]))) return true;
    return !owned.has(path) && /^(?:docs\/|[^/]+\.md$)/.test(path);
  });
}
