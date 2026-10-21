// Independent Git-object equivalence. Neither index JSON nor producer claims
// select which changed runtime/trust bytes may be ignored.
import { CHECKS, globToRegExp } from './check-inputs.mjs';
import { profilePaths } from './ci-profile-paths.mjs';
import { jobRecipe, versionNormalizer } from './ci-registry-inputs.mjs';
import { sameRecord } from './ci-registry-verify.mjs';

export const VERSION_PATHS = Object.freeze(['package.json', 'package-lock.json',
  'custom_components/houseplan/manifest.json', 'custom_components/houseplan/const.py',
  'src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts']);
export const RECIPE_PATHS = Object.freeze(['.github/workflows/validate.yml', '.github/workflows/validate-product.yml']);
const compiledMatch = patterns => {
  const rules = patterns.map(pattern => ({ exclude: pattern.startsWith('!'),
    regexp: globToRegExp(pattern.startsWith('!') ? pattern.slice(1) : pattern) }));
  return path => { let value = false; for (const rule of rules) if (rule.regexp.test(path)) value = !rule.exclude; return value; };
};
export function snapshotEntries(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.type === 'tree') continue;
    if (map.has(row.path)) throw Error('duplicate Git path');
    map.set(row.path, { oid: row.oid || row.sha, mode: row.mode });
  }
  return map;
}
function assertFile(snapshot, path) {
  const entry = snapshot.entries.get(path);
  if (!entry || !['100644', '100755'].includes(entry.mode) || !/^[a-f0-9]{40}$/.test(entry.oid))
    throw Error('missing/unsafe source Git input: ' + path);
  return entry;
}
function equalOid(candidate, source, path) {
  const a = assertFile(candidate, path), b = assertFile(source, path);
  return a.oid === b.oid && a.mode === b.mode;
}
function assertPaths(candidate, source, paths, mode) {
  const versionDifferences = [];
  for (const path of paths) {
    if (equalOid(candidate, source, path)) continue;
    if (mode === 'candidate' && VERSION_PATHS.includes(path)
      && candidate.entries.get(path).mode === source.entries.get(path).mode) versionDifferences.push(path);
    else throw Error('different actual Git input: ' + path);
  }
  return versionDifferences;
}
export function validateSnapshotPolicy(candidate) {
  const table = candidate.domains, tooling = table?.tooling;
  if (!Array.isArray(tooling)) throw Error('missing path policy');
  const tests = tooling.filter(path => /^test\/[^/]+\.test\.mjs$/.test(path));
  if (!sameRecord(table, profilePaths(tests))) throw Error('unrecognized product path exclusions');
  const inventory = candidate.inventory;
  if (inventory?.schema !== 1 || !Array.isArray(inventory.protocol) || !inventory.protocol.length
    || Object.values(inventory.jobs || {}).some(paths => !Array.isArray(paths) || !paths.length))
    throw Error('unknown computed input inventory');
}
async function normalizedVersions(snapshot) {
  const rows = await Promise.all(VERSION_PATHS.map(async path => [path, await snapshot.read(path)]));
  const files = new Map(rows.map(([path, value]) => [path, Buffer.isBuffer(value) ? value : Buffer.from(value)]));
  return versionNormalizer({ read: path => files.get(path), text: path => files.get(path).toString('utf8') });
}
/** Shared once per immutable source/candidate pair, including beta version bytes. */
export async function sourceEquivalenceCommon(candidate, source, mode) {
  validateSnapshotPolicy(candidate);
  if (!['exact', 'candidate'].includes(mode)) throw Error('unknown equivalence mode');
  const product = compiledMatch(candidate.domains.product);
  const paths = new Set([...candidate.entries.keys(), ...source.entries.keys()].filter(product));
  const versions = assertPaths(candidate, source, paths, mode);
  // Equal metadata plus byte-identical transitive trust code cannot hide a
  // different input closure behind a forged producer key or an edited JSON list.
  assertPaths(candidate, source, ['scripts/ci-registry-inventory.json', ...candidate.inventory.protocol], 'exact');
  if (mode === 'candidate') {
    const current = await normalizedVersions(candidate);
    const previous = versions.length ? await normalizedVersions(source) : current;
    for (const path of VERSION_PATHS) if (!current.read(path).equals(previous.read(path)))
      throw Error('non-version candidate bytes differ: ' + path);
  }
  return { mode };
}
/** Job roots preserve additions/deletions that an old explicit closure lacks. */
export async function sourceEquivalenceJob(candidate, source, record, common) {
  const { job } = record, inputs = candidate.inventory.jobs[job];
  if (!inputs?.length || !CHECKS[job]) throw Error('unknown job input inventory');
  const paths = new Set(inputs.filter(path => !path.startsWith('.github/workflows/')));
  if (job !== 'frontend') {
    const roots = compiledMatch([...CHECKS[job].roots, ...CHECKS[job].entries].filter(path => !path.startsWith('.github/')));
    for (const path of new Set([...candidate.entries.keys(), ...source.entries.keys()])) if (roots(path)) paths.add(path);
  }
  assertPaths(candidate, source, paths, common.mode);
  const actual = {}, candidateTexts = {};
  await Promise.all(RECIPE_PATHS.map(async path => {
    assertFile(candidate, path); assertFile(source, path);
    const nowText = (await candidate.read(path)).toString('utf8');
    candidateTexts[path] = nowText;
    const sourceText = equalOid(candidate, source, path) ? nowText : (await source.read(path)).toString('utf8');
    const expected = jobRecipe({ text: () => nowText }, job, path);
    const have = jobRecipe({ text: () => sourceText }, job, path);
    if (expected !== have) throw Error('different actual workflow recipe: ' + path + '/' + job);
    actual[path] = have;
  }));
  const runtime = await Promise.all(RECIPE_PATHS.map(async path => jobRecipe({ text: () => candidateTexts[path] },
    job, path, { authority: false })));
  if (runtime[0] !== runtime[1]) throw Error('registered product execution differs from the canonical recipe');
  if (!actual[record.workflow]) throw Error('foreign executing workflow');
  return { sourceEquivalent: true, actualWorkflowRecipe: actual[record.workflow] };
}
