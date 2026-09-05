import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, posix, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUILD_FINGERPRINT_TOKEN = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const EDITOR_RETRY_ASSET_TOKEN = '__HOUSEPLAN_EDITOR_RETRY_ASSET__';
const ONBOARDING_RETRY_ASSET_TOKEN = '__HOUSEPLAN_ONBOARDING_RETRY_ASSET__';
const ISO_RETRY_ASSET_TOKEN = '__HOUSEPLAN_ISO_RETRY_ASSET__';
const DE_RETRY_ASSET_TOKEN = '__HOUSEPLAN_DE_RETRY_ASSET__';
const FR_RETRY_ASSET_TOKEN = '__HOUSEPLAN_FR_RETRY_ASSET__';

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
      const modules = Object.keys(chunk.modules || {}).map((id) => id.replaceAll('\\', '/'));
      const role = modules.some((id) => id.endsWith('/src/i18n/de.ts') || id.endsWith('/src/i18n/fr.ts'))
        ? 'locale'
        : modules.some((id) => id.endsWith('/src/houseplan-onboarding-runtime.ts'))
          ? 'onboarding'
          : modules.some((id) => id.endsWith('/src/houseplan-editor-runtime.ts'))
            ? 'editor'
            : modules.some((id) => id.endsWith('/src/iso-scene-render.ts'))
              ? 'isometric'
              : undefined;
      return {
        path: chunk.fileName.replaceAll('\\', '/'),
        sha256: sha256(contents),
        rawBytes: contents.length,
        gzipBytes: gzipSync(contents, { level: 9 }).length,
        isEntry: chunk.isEntry,
        imports: [...chunk.imports].sort(),
        dynamicImports: [...chunk.dynamicImports].sort(),
        _role: role,
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
  const localeRoots = dynamicRoots.filter((path) => byPath.get(path)?._role === 'locale'
    || /(?:^|\/)(?:de|fr)-[^/]+\.js$/.test(path));
  const onboardingRoots = dynamicRoots.filter((path) => byPath.get(path)?._role === 'onboarding'
    || path.includes('houseplan-onboarding-runtime-'));
  const editorRoots = dynamicRoots.filter((path) => (byPath.get(path)?._role === 'editor'
    || /(?:^|\/)editor(?:-[^/]+)?\.js$/.test(path))
    && !localeRoots.includes(path) && !onboardingRoots.includes(path));
  const isometricRoots = dynamicRoots.filter((path) => byPath.get(path)?._role === 'isometric'
    || path.includes('iso-scene-render-'));
  const graphFrom = (roots) => {
    const graph = new Set();
    for (const root of roots) {
      for (const path of reachable(root, byPath, 'imports')) if (!initial.has(path)) graph.add(path);
    }
    return graph;
  };
  const lazyEditor = graphFrom(editorRoots);
  const lazyOnboarding = graphFrom(onboardingRoots);
  const lazyLocale = graphFrom(localeRoots);
  const lazyIsometric = graphFrom(isometricRoots);
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
    lazyLocaleFiles: [...lazyLocale].sort(),
    lazyLocaleGzipBytes: sum(lazyLocale),
    lazyIsometricFiles: [...lazyIsometric].sort(),
    lazyIsometricGzipBytes: sum(lazyIsometric),
    files: files.map(({ _role, ...file }) => file),
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
      const isometric = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/iso-scene-render.ts')));
      const german = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/i18n/de.ts')));
      const french = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/i18n/fr.ts')));
      if (!editor) throw new Error('editor runtime chunk was not emitted');
      if (!onboarding) throw new Error('onboarding runtime chunk was not emitted');
      if (!isometric) throw new Error('isometric runtime chunk was not emitted');
      if (!german) throw new Error('German locale chunk was not emitted');
      if (!french) throw new Error('French locale chunk was not emitted');
      let editorReplacements = 0;
      let onboardingReplacements = 0;
      let isometricReplacements = 0;
      let germanReplacements = 0;
      let frenchReplacements = 0;
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
        if (chunk.code.includes(ISO_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), isometric.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          isometricReplacements += chunk.code.split(ISO_RETRY_ASSET_TOKEN).length - 1;
          chunk.code = chunk.code.replaceAll(ISO_RETRY_ASSET_TOKEN, asset);
        }
        if (chunk.code.includes(DE_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), german.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          germanReplacements += chunk.code.split(DE_RETRY_ASSET_TOKEN).length - 1;
          chunk.code = chunk.code.replaceAll(DE_RETRY_ASSET_TOKEN, asset);
        }
        if (chunk.code.includes(FR_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), french.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          frenchReplacements += chunk.code.split(FR_RETRY_ASSET_TOKEN).length - 1;
          chunk.code = chunk.code.replaceAll(FR_RETRY_ASSET_TOKEN, asset);
        }
      }
      if (editorReplacements !== 1 || onboardingReplacements !== 1 || isometricReplacements !== 1
          || germanReplacements !== 1 || frenchReplacements !== 1) {
        throw new Error('lazy retry URL placeholder counts are '
          + `${editorReplacements}/${onboardingReplacements}/${isometricReplacements}/${germanReplacements}/${frenchReplacements}, expected 1/1/1/1/1`);
      }
    },
  };
}

/**
 * Rewrite the entry facade so a stale cached `houseplan-card.js` fails loudly
 * instead of killing the card silently (#353 К3). Rollup emits the facade as a
 * STATIC re-export of the content-hashed main chunk; after an update a proxy-
 * cached facade points at a chunk the manifest-gated server no longer serves,
 * and a static import failure aborts the whole module before any code runs.
 *
 * The rewrite keeps the happy path intact via top-level await: an importer's
 * `await import(entry)` does not resolve until the inner import settles, so
 * `customElements.define` of the real card still happens-before the importer
 * continues — demo, smokes and golden run unchanged. Only the failure branch
 * is new: it defines a minimal fallback element with a human message.
 *
 * Must run BEFORE bundleManifestPlugin so the manifest hashes the final code.
 */
export function entryFallbackPlugin() {
  return {
    name: 'houseplan-entry-fallback',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle)
        .find((item) => item.type === 'chunk' && item.isEntry);
      if (!entry) throw new Error('entry chunk was not emitted');
      const pattern = /export\{[^}]*\}from(["'])(\.\/houseplan-assets\/[^"']+\.js)\1;?/g;
      const matches = [...entry.code.matchAll(pattern)];
      if (matches.length !== 1) {
        throw new Error(`entry facade re-export count is ${matches.length}, expected 1`);
      }
      const asset = matches[0][2];
      const fallback = 'try{await import("' + asset + '")}'
        + 'catch(e){if(!customElements.get("houseplan-card")){'
        + 'const l=String(navigator.language||"en").toLowerCase();'
        + 'const m=l.startsWith("ru")'
        + '?"House Plan обновился — перезагрузите страницу (Ctrl+F5)."'
        + ':l.startsWith("de")'
        + '?"House Plan wurde aktualisiert — bitte laden Sie die Seite neu (Strg+F5)."'
        + ':l.startsWith("fr")'
        + '?"House Plan a été mis à jour — veuillez recharger la page (Ctrl+F5)."'
        + ':"House Plan was updated — please reload the page (Ctrl+F5).";'
        + 'customElements.define("houseplan-card",class extends HTMLElement{'
        + 'setConfig(){}getCardSize(){return 1}connectedCallback(){'
        + 'this.style.cssText="display:block;box-sizing:border-box;padding:16px;'
        + 'border:1px solid var(--divider-color,#e0e0e0);border-radius:var(--ha-card-border-radius,12px);'
        + 'background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);'
        + 'font:14px/1.4 var(--paper-font-body1_-_font-family,sans-serif)";'
        + 'this.textContent=m}})}'
        + 'console.error("[houseplan] stale entry: the main chunk is unavailable",e)}';
      entry.code = entry.code.replace(pattern, fallback);
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
