// #1044: task families follow their real inputs; broad regression belongs to full.
// This runs before npm ci in the classifier, so it has no package dependencies.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKS, CHECK_NAMES, BUILD_OUTPUT, closure, globToRegExp, inputsOf,
  isDeclaredNotAnInput, isGuardedInput, trackedFiles } from './check-inputs.mjs';
import { profilesForFiles, readProfilePaths } from './ci-profile-paths.mjs';
import { CI_WORKFLOWS } from './ci-workflows.mjs';
import { toolingDependencies } from './tooling-dependencies.mjs';

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
  return toolingDependencies(tests, { tracked, read: file => {
    try { return read(file); } catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
  } });
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
