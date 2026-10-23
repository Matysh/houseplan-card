// #1044: task families follow their real inputs; broad regression belongs to full.
// This runs before npm ci in the classifier, so it has no package dependencies.
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { CHECKS, CHECK_NAMES, BUILD_OUTPUT, LEAF_FILES, closure, globToRegExp, inputsOf,
  isDeclaredNotAnInput, isGuardedInput, trackedFiles } from './check-inputs.mjs';
import { profilesForFiles, readProfilePaths } from './ci-profile-paths.mjs';
import { CI_WORKFLOWS } from './ci-workflows.mjs';
import { relativeDependencies, scanJavaScript } from './relative-dependencies.mjs';

const orchestration = new Set(['scripts/gate-reuse.mjs', 'scripts/check-inputs.mjs', 'scripts/ci-proof.mjs',
  ...Object.keys(CI_WORKFLOWS).map(name => `.github/workflows/${name}`)]);
const matches = (file, patterns) => patterns.some(pattern => globToRegExp(pattern).test(file));
const buildOutput = file => matches(file, BUILD_OUTPUT);
const normalizeFiles = files => {
  if (!Array.isArray(files) && typeof files !== 'string')
    throw Error('Task check scope needs a proven changed-file list; resolve the Git base and retry.');
  const list = Array.isArray(files) ? files : files.split('\n');
  if (list.some(file => typeof file !== 'string')) throw Error('Task changed-file list contains a non-path value.');
  return [...new Set(list.map(file => file.trim().replaceAll('\\', '/')).filter(Boolean))].sort();
};

/**
 * Positive tooling triggers, shared by generated push filters and task scope.
 * Follow executable imports and exact filesystem reads, not arbitrary path
 * strings inside synthetic repositories or the manifest under test. Those
 * strings would otherwise make virtually every product edit select tooling.
 */
export function toolingDependencyPaths(tests, root = process.cwd(), {
  tracked = trackedFiles(root), read = file => readFileSync(join(root, file), 'utf8'),
} = {}) {
  const files = new Set([...tracked, ...tests]), seen = new Set(), traversed = new Set(), queue = [...tests];
  const resolve = (from, spec) => {
    let path = posix.normalize(posix.join(posix.dirname(from), spec.split(/[?#]/)[0]));
    if (path.startsWith('test-build/')) path = path.replace(/^test-build\//, 'src/').replace(/\.js$/, '.ts');
    return [path, `${path}.mjs`, `${path}.js`, `${path}.ts`, `${path}/index.mjs`, `${path}/index.js`]
      .filter(file => files.has(file));
  };
  while (queue.length) {
    const file = queue.pop();
    if (traversed.has(file)) continue;
    seen.add(file);
    traversed.add(file);
    if (LEAF_FILES.has(file) || !/\.(?:mjs|cjs|js|ts)$/.test(file)) continue;
    let text;
    try { text = read(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const scanned = scanJavaScript(text), { tokens } = scanned;
    const code = relativeDependencies(text, scanned).flatMap(spec => resolve(file, spec));
    for (let i = 0; i < tokens.length; i++) {
      const tail = tokens[i].value === 'new' ? tokens.slice(i, i + 12) : [];
      // An exact import.meta.url path is a real input even when it is JSON,
      // an HTML fixture or a source-contract file rather than imported code.
      if (tail[0]?.value === 'new' && tail[1]?.value === 'URL' && tail[2]?.value === '('
        && tail[3]?.kind === 'string'
        && tail.slice(4, 11).map(token => token.value).join(' ') === ', import . meta . url )') {
        for (const input of resolve(file, tail[3].value)) seen.add(input);
      }
      if (!['readFile', 'readFileSync'].includes(tokens[i].value) || tokens[i + 1]?.value !== '(') continue;
      // Exact root-relative paths passed to a read (including join/resolve)
      // are data inputs. A directory name alone does not imply every file.
      let depth = 1;
      for (let j = i + 2; j < tokens.length && depth; j++) {
        const token = tokens[j];
        if (token.value === '(') depth++;
        if (token.value === ')') depth--;
        if (token.kind === 'string' && files.has(token.value)) seen.add(token.value);
      }
    }
    for (const input of code) if (!traversed.has(input)) queue.push(input);
  }
  // Generated bundles retain their existing non-input contract. Documentation
  // edits have task preflight; their broad unit contracts run at the full beta
  // boundary, so adding a review index never repeats the tooling partition.
  return [...seen].filter(file => !buildOutput(file) && !/^docs\//.test(file) && !/\.md$/i.test(file)).sort();
}

/**
 * Keep the canonical input manifest, including cross-runtime JS/JSON reads.
 * Protocol/workflow roots alone do not demand the HA harness or parity runner;
 * an actual test-entry dependency on the same path still does.
 */
export function taskCheckScope({ files, full = false, unknown = false } = {}, options = {}) {
  if (unknown) throw Error('Task diff is unproven; fetch/resolve its Git base and retry instead of silently skipping checks.');
  if (full) return { product: true, tooling: true, backend: true, geometry_parity: true, unknown: [] };
  const list = normalizeFiles(files);
  if (!list.length) return { product: false, tooling: false, backend: false, geometry_parity: false, unknown: [] };
  const root = typeof options === 'string' ? options : options.root || process.cwd();
  const opts = typeof options === 'string' ? {} : options;
  // Include new/deleted paths in root matching. Missing deleted files are read
  // as empty by closure; their declared family must still be selected.
  const tracked = [...new Set([...(opts.tracked || trackedFiles(root)), ...list])];
  const readOptions = { tracked, ...(opts.read ? { read: opts.read } : {}) };
  const manifest = { ...opts.manifest };
  const inputs = name => manifest[name] || (manifest[name] = new Set(inputsOf(name, root, readOptions)));
  // Most product paths already have explicit ownership. Resolve the broader
  // closure only for paths whose owner cannot be established from those roots.
  const declared = file => !buildOutput(file) && CHECK_NAMES.some(name =>
    matches(file, [...CHECKS[name].entries, ...CHECKS[name].roots]));
  const unowned = list.filter(file => isGuardedInput(file) && !isDeclaredNotAnInput(file)
    && !declared(file) && !CHECK_NAMES.some(name => inputs(name).has(file)));
  const profiles = profilesForFiles(list, opts.profilePaths || readProfilePaths(root));
  const scope = { product: profiles.includes('product') || unowned.length > 0,
    tooling: profiles.includes('tooling') || unowned.length > 0, backend: false, geometry_parity: false, unknown: unowned };
  for (const family of ['backend', 'geometry_parity']) {
    const spec = CHECKS[family];
    const entries = tracked.filter(file => matches(file, spec.entries));
    const actual = new Set(closure(root, entries, { ...readOptions, stopAt: buildOutput }));
    scope[family] = list.some(file => !buildOutput(file) && (actual.has(file)
      || !orchestration.has(file) && (matches(file, [...spec.entries, ...spec.roots]) || inputs(family).has(file))));
  }
  // A genuinely unowned file in a backend namespace widens that family, not
  // the unrelated browser, performance or geometry matrix.
  if (unowned.some(file => /^(?:custom_components|tests_backend|scripts\/(?:support-relay|sh3d-convert))\//.test(file))) scope.backend = true;
  return scope;
}
