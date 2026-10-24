#!/usr/bin/env node
// One historical repair, not a fresh capture: preserve a34f bytes and rebind
// only the TS producer's demonstrated outDir/sourceRoot error, with Git proof.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digestBytes, indexGeneratedFiles, inside, slash, walkFiles } from './coverage-identity.mjs';
import { buildCoverageReport, coverageMarkdown } from './coverage-report.mjs';

const BEFORE = 'a34f5806c5dbbfbe72fc6909915e35c0a67f47de';
const BEFORE_RECIPE = '55cb5c5097631e0f13be18e5b0018e96c1b22af7c91ff103e0472e76faa77f92';
const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const root = process.cwd(), source = inside(root, arg('source') || 'artifacts/coverage-before-1018-a34f-WSL');
const out = inside(root, arg('out') || 'artifacts/coverage-before-1018-a34f-reprojected');
if (!slash(relative(root, out)).startsWith('artifacts/') || existsSync(out)) throw Error('Use a fresh ignored artifacts/ output');
const git = (args, extra = {}) => execFileSync('git', args, { cwd: root, maxBuffer: 100 * 1024 ** 2, ...extra });
if (git(['status', '--porcelain', '--untracked-files=normal']).toString().trim()) throw Error('Commit the projector recipe first');
const read = name => JSON.parse(readFileSync(resolve(source, name), 'utf8'));
const run = read('run.json'), original = read('build-index.json'), inventory = read('inventory.json');
if (run.identity.sha !== BEFORE || run.identity.recipeHash !== BEFORE_RECIPE || !run.ended
    || original.identity.sha !== BEFORE || !run.normalRestored) throw Error('Unsupported or unfinished historical material');

// Read exact tracked source blobs once, including duplicate blob identities.
const paths = git(['ls-tree', '-r', '-z', BEFORE, '--', 'src']).toString('utf8').split('\0').filter(Boolean)
  .map(row => { const match = row.match(/^\d+ blob ([a-f0-9]{40})\t(.+)$/s); if (!match) throw Error('Unexpected source tree row'); return { blob: match[1], path: match[2] }; });
const packed = git(['cat-file', '--batch'], { input: paths.map(row => row.blob).join('\n') + '\n' });
let cursor = 0;
const blobs = new Map();
for (const item of paths) {
  const end = packed.indexOf(10, cursor), header = packed.subarray(cursor, end).toString();
  const match = header.match(/^([a-f0-9]{40}) blob (\d+)$/); if (!match || match[1] !== item.blob) throw Error('Invalid Git blob receipt');
  cursor = end + 1; const bytes = packed.subarray(cursor, cursor + Number(match[2])); cursor += bytes.length + 1;
  blobs.set(item.path, { ...item, bytes, sha256: digestBytes(bytes) });
  if (!existsSync(resolve(root, item.path)) || !readFileSync(resolve(root, item.path)).equals(bytes)) throw Error(`Current AST differs from frozen Git source: ${item.path}`);
}
if (cursor !== packed.length) throw Error('Trailing Git blob payload');
const rawReceipts = read('raw-receipts.json');
const actualRawPaths = walkFiles(resolve(source, 'cases')).filter(path => path.endsWith('.gz')).map(path => slash(relative(source, path))).sort();
if (JSON.stringify(actualRawPaths) !== JSON.stringify(rawReceipts.map(row => row.path).sort())) throw Error('Raw receipt inventory changed');
for (const receipt of rawReceipts) {
  const bytes = readFileSync(inside(source, receipt.path));
  if (bytes.length !== receipt.bytes || digestBytes(bytes) !== receipt.sha256) throw Error(`Changed raw payload: ${receipt.path}`);
}
mkdirSync(resolve(out, 'build'), { recursive: true });
const save = (name, value) => writeFileSync(inside(out, name), JSON.stringify(value, null, 2));
const bindings = [], mapReceipts = [];
for (const file of original.files) {
  const jsPath = inside(source, `build/${file.path}`), oldMapPath = `${jsPath}.map`;
  const js = readFileSync(jsPath), rawMap = readFileSync(oldMapPath);
  if (digestBytes(js) !== file.jsHash || digestBytes(rawMap) !== file.mapHash) throw Error(`Changed captured bytes: ${file.path}`);
  const map = JSON.parse(rawMap);
  if (map.sources.length !== file.sources.length) throw Error('Changed captured source inventory');
  const oldSources = [...map.sources];
  map.sources = oldSources.map((declared, n) => {
    const actual = declared.startsWith('file:') ? fileURLToPath(declared) : resolve(dirname(resolve(root, file.path)), map.sourceRoot || '', declared);
    const originalPath = slash(relative(root, actual)), indexed = file.sources[n];
    const sourceHash = typeof map.sourcesContent[n] === 'string' ? digestBytes(map.sourcesContent[n]) : null;
    if (originalPath !== indexed.path || declared !== indexed.source || sourceHash !== indexed.contentHash) throw Error('Captured source/index disagreement');
    let target = originalPath, repaired = false;
    if (originalPath.startsWith('../src/')) {
      if (!file.path.startsWith('dist/')) throw Error('Only demonstrated TS Rollup output is eligible');
      // This relation follows the reproduced compiler commonSourceDirectory
      // error. It is insufficient by itself: exact tracked path AND Git bytes
      // below are mandatory; no arbitrary suffix or content-only matching.
      target = slash(relative(dirname(root), actual)); repaired = true;
    }
    if (target.startsWith('src/')) {
      const blob = blobs.get(target);
      if (!blob || !blob.bytes.equals(Buffer.from(map.sourcesContent[n]))) throw Error(`No exact frozen Git path/content proof: ${target}`);
      bindings.push({ generated: file.path, sourceIndex: n, declared, originalPath, target,
        repaired, gitBlob: blob.blob, sourceSha256: blob.sha256 });
      return pathToFileURL(resolve(root, target)).href;
    }
    if (originalPath.startsWith('../')) throw Error(`Unknown escaping source remains: ${declared}`);
    return pathToFileURL(actual).href; // dependency mappings stay non-product
  });
  delete map.sourceRoot;
  const derivedMap = JSON.stringify(map);
  // Only map path metadata changes; native offsets, names, mappings and source
  // contents are byte-for-byte equal to the captured representation's values.
  const normalize = value => { const { sources, sourceRoot, ...rest } = value; return rest; };
  if (JSON.stringify(normalize(map)) !== JSON.stringify(normalize(JSON.parse(rawMap)))) throw Error('Unexpected mapping/content change');
  const destination = inside(out, `build/${file.path}`); mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(jsPath, destination); writeFileSync(`${destination}.map`, derivedMap);
  mapReceipts.push({ path: file.path, jsSha256: file.jsHash, originalMapSha256: file.mapHash, derivedMapSha256: digestBytes(derivedMap) });
}
if (!bindings.some(binding => binding.repaired)) throw Error('No demonstrated historical producer error found');
const recipeFiles = Object.fromEntries(['scripts/coverage-reproject-1018.mjs', 'scripts/coverage-identity.mjs', 'scripts/coverage-report.mjs']
  .map(path => [path, digestBytes(readFileSync(resolve(root, path)))]));
const projection = { authority: 'diagnostic-only', freshCapture: false, beforeSha: BEFORE,
  projectorSha: git(['rev-parse', 'HEAD']).toString().trim(), recipeFiles,
  recipeHash: digestBytes(JSON.stringify(recipeFiles)), frozenGitSources: paths.length,
  repairedSourceBindings: bindings.filter(binding => binding.repaired).length,
  originalIndexSha256: digestBytes(readFileSync(resolve(source, 'build-index.json'))),
  originalReportSha256: digestBytes(readFileSync(resolve(source, 'report.json'))),
  rawReceiptListSha256: digestBytes(JSON.stringify(rawReceipts)), verifiedRawFiles: rawReceipts.length,
  verifiedRawBytes: rawReceipts.reduce((sum, row) => sum + row.bytes, 0),
  interpretation: 'A separate Git-verified source-path reprojection of immutable a34f JS/native samples/maps. No new invocation, map-position edit, threshold change or successful-completeness claim.' };
const manifest = readFileSync(resolve(source, 'normal-product-manifest.json'));
const index = indexGeneratedFiles({ root, buildRoot: resolve(out, 'build'), paths: original.files.map(file => file.path),
  identity: { ...original.identity, projection }, manifest });
if (!index.valid) throw Error(`Derived strict index invalid: ${JSON.stringify(index.issues.slice(0, 5))}`);
save('projection.json', { ...projection, bindings, mapReceipts }); save('build-index.json', index); save('inventory.json', inventory);
copyFileSync(resolve(source, 'normal-product-manifest.json'), resolve(out, 'normal-product-manifest.json'));
// The saved run already contains merger-added recorder issues. Re-read those
// from immutable raw metadata once, preserving only collector-owned issues.
const collectorReasons = new Set(['spawn-failed', 'golden-scenario-not-completed', 'missing-golden-report', 'oversized-raw-payload', 'artifact-capacity', 'bounded-run-exhausted']);
const invocations = run.invocations.map(value => ({ ...value, issues: value.issues.filter(issue => collectorReasons.has(issue.reason)) }));
const report = buildCoverageReport({ root, artifactDir: out, rawRoot: source, inventory, invocations, index });
save('report.json', report); writeFileSync(resolve(out, 'report.md'), coverageMarkdown(report));
save('run.json', { ...run, identity: index.identity, projection, invocations, completeness: report.completeness });
console.log(JSON.stringify({ out, projection, indexFiles: index.files.length, files: report.files.length,
  functions: report.functions.length, nativeRanges: report.nativeMappedRanges.length, actualScripts: report.actualScripts.length,
  complete: report.completeness.complete, reasons: report.completeness.reasons.length }));
