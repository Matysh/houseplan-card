// #1018: diagnostic provenance is intentionally separate from every CI proof.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { hashMapRecipe } from './coverage-maps.mjs';
import { TraceMap, decodedMappings } from '@jridgewell/trace-mapping';

export const COVERAGE_SCHEMA = 'houseplan-diagnostic-coverage/v1';
export const digestBytes = value => createHash('sha256').update(value).digest('hex');
export const slash = value => value.replaceAll('\\', '/');
export function inside(root, path) {
  const absolute = resolve(root, path), rel = relative(resolve(root), absolute);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error(`Diagnostic path escapes root: ${path}`);
  return absolute;
}
export function walkFiles(path) {
  return existsSync(path) ? readdirSync(path, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walkFiles(resolve(path, entry.name)) : entry.isFile() ? [resolve(path, entry.name)] : []) : [];
}
export function materialIdentity(root = process.cwd()) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const recipe = ['coverage-diagnostic', 'coverage-inventory', 'coverage-identity', 'coverage-maps', 'coverage-preload', 'coverage-report',
    'parallel-path-audit', 'bundle-manifest', 'css-template-minifier', 'fix-test-build'].map(name => `scripts/${name}.mjs`)
    .concat(['rollup.config.mjs', 'tsconfig.json', 'tsconfig.test.json', 'package-lock.json']);
  const recipeFiles = Object.fromEntries(recipe.map(path => [path, digestBytes(readFileSync(resolve(root, path)))]));
  return { sha: git(['rev-parse', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']),
    sourceFingerprint: sourceFingerprint(root), node: process.versions.node, mapRecipe: hashMapRecipe,
    recipeFiles, recipeHash: digestBytes(JSON.stringify(recipeFiles)) };
}

export function indexGeneratedFiles({ root = process.cwd(), paths, artifactDir, identity = materialIdentity(root), manifest } = {}) {
  const issues = [], files = [], manifestHash = manifest ? digestBytes(manifest) : null;
  const product = manifest ? JSON.parse(manifest).files : [];
  const allowed = new Map(product.map(file => [`dist/${file.path}`, file]));
  for (const rel of [...new Set(paths)].sort()) {
    const path = inside(root, rel), mapPath = `${path}.map`;
    if (!existsSync(path) || !existsSync(mapPath)) { issues.push({ path: rel, reason: 'missing-js-or-map' }); continue; }
    const js = readFileSync(path), rawMap = readFileSync(mapPath);
    let map;
    try { map = JSON.parse(rawMap); } catch { issues.push({ path: rel, reason: 'invalid-map-json' }); continue; }
    const jsHash = digestBytes(js), mapHash = digestBytes(rawMap);
    if (rel.startsWith('dist/') && (!allowed.has(rel) || allowed.get(rel).sha256 !== jsHash)) {
      issues.push({ path: rel, reason: 'foreign-product-manifest-bytes' }); continue;
    }
    if (map.version !== 3 || !Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)
      || map.sourcesContent.length !== map.sources.length || typeof map.mappings !== 'string') {
      issues.push({ path: rel, reason: 'incomplete-map' }); continue;
    }
    try {
      const generatedLines = js.toString().split('\n'), sourceLines = map.sourcesContent.map(content =>
        typeof content === 'string' ? content.split('\n') : []);
      decodedMappings(new TraceMap(map)).forEach((segments, line) => {
        let previous = -1;
        for (const segment of segments) {
          if (!Number.isSafeInteger(segment[0]) || segment[0] < previous || segment[0] > (generatedLines[line]?.length ?? -1)) throw Error('generated bounds');
          previous = segment[0];
          if (segment.length > 1 && (segment.length < 4 || !sourceLines[segment[1]]?.[segment[2]]
              && sourceLines[segment[1]]?.[segment[2]] !== '' || segment[3] < 0
              || segment[3] > (sourceLines[segment[1]]?.[segment[2]]?.length ?? -1))) throw Error('source bounds');
        }
      });
    } catch { issues.push({ path: rel, reason: 'invalid-map-mapping-bounds' }); continue; }
    const sources = [];
    for (let n = 0; n < map.sources.length; n++) {
      const source = map.sources[n], content = map.sourcesContent[n];
      let absolute;
      try { absolute = source.startsWith('file:') ? fileURLToPath(source) : resolve(dirname(mapPath), map.sourceRoot || '', source); }
      catch { issues.push({ path: rel, source, reason: 'invalid-source-url' }); continue; }
      const sourceRel = slash(relative(root, absolute));
      if (!sourceRel.startsWith('src/')) {
        sources.push({ index: n, source, path: sourceRel, product: false, contentHash: typeof content === 'string' ? digestBytes(content) : null });
        continue;
      }
      if (typeof content !== 'string' || !existsSync(absolute) || digestBytes(readFileSync(absolute)) !== digestBytes(content)) {
        issues.push({ path: rel, source, reason: 'foreign-or-missing-sourcesContent' }); continue;
      }
      sources.push({ index: n, source, path: sourceRel, product: true, contentHash: digestBytes(content) });
    }
    const generatedOnly = !map.sources.length;
    if (artifactDir) for (const source of [path, mapPath]) {
      const target = inside(artifactDir, `build/${slash(relative(root, source))}`);
      mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
    }
    files.push({ path: rel, jsHash, jsBytes: js.length, mapHash, mapBytes: rawMap.length, sources, generatedOnly });
  }
  return { schema: COVERAGE_SCHEMA, authority: 'diagnostic-only', semanticApproval: false, identity,
    productManifestHash: manifestHash, files, issues, valid: issues.length === 0 };
}

/** A URL/query alone never establishes identity; actual script bytes must match. */
export function identifyScript(index, { url, source }) {
  let path;
  try { path = decodeURIComponent(new URL(url).pathname); } catch { return { status: 'external', reason: 'non-url-script' }; }
  path = slash(path);
  const candidates = index.files.filter(file => {
    const suffix = file.path.startsWith('dist/') ? file.path.slice(5) : file.path;
    return path.endsWith(`/${suffix}`);
  });
  if (!candidates.length) return { status: 'external', reason: 'not-candidate-product-script' };
  if (typeof source !== 'string') return { status: 'unknown', reason: 'missing-actual-script-bytes', url };
  const hash = digestBytes(source), matches = candidates.filter(file => file.jsHash === hash);
  if (matches.length !== 1) return { status: 'unknown', reason: 'foreign-script-bytes', url, hash };
  return { status: 'verified', file: matches[0], hash, canonical: matches[0].path };
}
