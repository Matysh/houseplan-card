import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, posix, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUILD_FINGERPRINT_TOKEN = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const EDITOR_RETRY_ASSET_TOKEN = '__HOUSEPLAN_EDITOR_RETRY_ASSET__';
const ONBOARDING_RETRY_ASSET_TOKEN = '__HOUSEPLAN_ONBOARDING_RETRY_ASSET__';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const reachable = (entry, byPath, edge) => {
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    const file = byPath.get(path);
    if (!file) throw new Error(`bundle manifest references missing asset: ${path}`);
    seen.add(path);
    for (const child of file[edge] || []) visit(child);
  };
  visit(entry);
  return seen;
};

export function buildBundleManifest(bundle, fingerprint) {
  const files = Object.values(bundle)
    .filter((item) => item.type === 'chunk')
    .map((chunk) => {
      const contents = Buffer.from(chunk.code, 'utf8');
      return {
        path: chunk.fileName.replaceAll('\\', '/'),
        sha256: sha256(contents),
        rawBytes: contents.length,
        gzipBytes: gzipSync(contents, { level: 9 }).length,
        isEntry: chunk.isEntry,
        imports: [...chunk.imports].sort(),
        dynamicImports: [...chunk.dynamicImports].sort(),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  const entry = files.find((file) => file.isEntry)?.path;
  if (!entry) throw new Error('bundle manifest has no entry chunk');
  const byPath = new Map(files.map((file) => [file.path, file]));
  const initial = reachable(entry, byPath, 'imports');
  const dynamicRoots = [...initial]
    .flatMap((path) => byPath.get(path)?.dynamicImports || []);
  const lazy = new Set();
  for (const root of dynamicRoots) {
    for (const path of reachable(root, byPath, 'imports')) if (!initial.has(path)) lazy.add(path);
  }
  const onboardingRoots = dynamicRoots.filter((path) => path.includes('houseplan-onboarding-runtime-'));
  const editorRoots = dynamicRoots.filter((path) => !onboardingRoots.includes(path));
  const graphFrom = (roots) => {
    const graph = new Set();
    for (const root of roots) {
      for (const path of reachable(root, byPath, 'imports')) if (!initial.has(path)) graph.add(path);
    }
    return graph;
  };
  const lazyEditor = graphFrom(editorRoots);
  const lazyOnboarding = graphFrom(onboardingRoots);
  const sum = (paths) => [...paths]
    .reduce((total, path) => total + (byPath.get(path)?.gzipBytes || 0), 0);
  return {
    schema: 1,
    fingerprint,
    entry,
    initialViewFiles: [...initial].sort(),
    initialViewGzipBytes: sum(initial),
    lazyFiles: [...lazy].sort(),
    lazyGzipBytes: sum(lazy),
    lazyEditorFiles: [...lazyEditor].sort(),
    lazyEditorGzipBytes: sum(lazyEditor),
    lazyOnboardingFiles: [...lazyOnboarding].sort(),
    lazyOnboardingGzipBytes: sum(lazyOnboarding),
    files,
  };
}

export function bundleManifestPlugin(fingerprint) {
  return {
    name: 'houseplan-bundle-manifest',
    generateBundle(_options, bundle) {
      const manifest = buildBundleManifest(bundle, fingerprint);
      this.emitFile({
        type: 'asset',
        fileName: 'houseplan-assets.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
  };
}

/** Embed one immutable build id in both sides of the lazy handshake. */
export function buildFingerprintPlugin(fingerprint) {
  return {
    name: 'houseplan-build-fingerprint',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').includes('/src/')
          || !code.includes(BUILD_FINGERPRINT_TOKEN)) return null;
      return {
        code: code.replaceAll(BUILD_FINGERPRINT_TOKEN, fingerprint),
        map: null,
      };
    },
  };
}

/**
 * Point the second import attempt at the exact content-hashed editor chunk.
 * Rollup owns that filename, so the URL is injected only after chunk naming;
 * the first import remains a normal Rollup edge for graph accounting.
 */
export function editorRuntimeRetryUrlPlugin() {
  return {
    name: 'houseplan-editor-retry-url',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
      const editor = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/houseplan-editor-runtime.ts')));
      const onboarding = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/houseplan-onboarding-runtime.ts')));
      if (!editor) throw new Error('editor runtime chunk was not emitted');
      if (!onboarding) throw new Error('onboarding runtime chunk was not emitted');
      let editorReplacements = 0;
      let onboardingReplacements = 0;
      for (const chunk of chunks) {
        if (chunk.code.includes(EDITOR_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), editor.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          editorReplacements += chunk.code.split(EDITOR_RETRY_ASSET_TOKEN).length - 1;
          chunk.code = chunk.code.replaceAll(EDITOR_RETRY_ASSET_TOKEN, asset);
        }
        if (chunk.code.includes(ONBOARDING_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), onboarding.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          onboardingReplacements += chunk.code.split(ONBOARDING_RETRY_ASSET_TOKEN).length - 1;
          chunk.code = chunk.code.replaceAll(ONBOARDING_RETRY_ASSET_TOKEN, asset);
        }
      }
      if (editorReplacements !== 1 || onboardingReplacements !== 1) {
        throw new Error('lazy retry URL placeholder counts are '
          + `${editorReplacements}/${onboardingReplacements}, expected 1/1`);
      }
    },
  };
}

/** Remove only files named by the previous generated manifest. */
export function cleanBundleOutputPlugin(outputRoot = 'dist') {
  return {
    name: 'houseplan-clean-bundle-output',
    buildStart() {
      const root = resolve(outputRoot);
      const manifestPath = resolve(root, 'houseplan-assets.json');
      if (!existsSync(manifestPath)) return;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      for (const file of manifest?.files || []) {
        const path = resolve(root, String(file.path || ''));
        const rel = relative(root, path);
        if (!rel || rel.startsWith('..') || rel.includes(':')) {
          throw new Error(`previous bundle path escapes output root: ${file.path}`);
        }
        rmSync(path, { force: true });
      }
      rmSync(manifestPath, { force: true });
    },
  };
}
