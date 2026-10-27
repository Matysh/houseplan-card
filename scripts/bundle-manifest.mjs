import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, posix, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { coverageMapsEnabled, editMappedSource, replacementEdits, replaceChunkSource, hashMapRecipe } from './coverage-maps.mjs';

const BUILD_FINGERPRINT_TOKEN = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const EDITOR_RETRY_ASSET_TOKEN = '__HOUSEPLAN_EDITOR_RETRY_ASSET__';
const ONBOARDING_RETRY_ASSET_TOKEN = '__HOUSEPLAN_ONBOARDING_RETRY_ASSET__';
const ISO_RETRY_ASSET_TOKEN = '__HOUSEPLAN_ISO_RETRY_ASSET__';
const DE_RETRY_ASSET_TOKEN = '__HOUSEPLAN_DE_RETRY_ASSET__';
const FR_RETRY_ASSET_TOKEN = '__HOUSEPLAN_FR_RETRY_ASSET__';
const FURNITURE_ART_RETRY_ASSET_TOKEN = '__HOUSEPLAN_FURNITURE_ART_RETRY_ASSET__';
const PDF_RETRY_ASSET_TOKEN = '__HOUSEPLAN_PDF_RETRY_ASSET__';
const MOON_RETRY_ASSET_TOKEN = '__HOUSEPLAN_MOON_RETRY_ASSET__';
const LED_RETRY_ASSET_TOKEN = '__HOUSEPLAN_LED_RETRY_ASSET__';
const LED_FIELD_RETRY_ASSET_TOKEN = '__HOUSEPLAN_LED_FIELD_RETRY_ASSET__';
const LED_EDITOR_RETRY_ASSET_TOKEN = '__HOUSEPLAN_LED_EDITOR_RETRY_ASSET__';
export const VIEW_RUNTIME_RETRY_CHUNKS = [
  { module: '/src/view-device-menu.ts', token: '__HOUSEPLAN_DEVICE_MENU_RETRY_ASSET__' },
  { module: '/src/live-interaction-runtime.ts', token: '__HOUSEPLAN_LIVE_RETRY_ASSET__' },
  { module: '/src/summary-panel-runtime-entry.ts', token: '__HOUSEPLAN_SUMMARY_RETRY_ASSET__' },
  { module: '/src/hp-zigbee-topology-overlay.ts', token: '__HOUSEPLAN_ZIGBEE_OVERLAY_RETRY_ASSET__' },
  { module: '/src/hp-plan-converter-info.ts', token: '__HOUSEPLAN_CONVERTER_INFO_RETRY_ASSET__' },
];

/**
 * #627: ru/de/fr of the three lazy dictionary namespaces are one chunk per
 * namespace × language. Their loader modules are the recognition marker for
 * the manifest graph and the target of each second-attempt retry token.
 */
export const NAMESPACE_LOCALE_CHUNKS = ['settings', 'support', 'topology', 'tools', 'led']
  .flatMap((namespace) => ['ru', 'de', 'fr'].map((language) => ({
    namespace,
    language,
    module: `/src/i18n/${namespace}/${namespace}-${language}.ts`,
    token: `__HOUSEPLAN_${namespace.toUpperCase()}_${language.toUpperCase()}_RETRY_ASSET__`,
  })));

const isNamespaceLocaleModule = (id) => NAMESPACE_LOCALE_CHUNKS
  .some((chunk) => id.endsWith(chunk.module));

export const CARD_ENTRY_FILE = 'houseplan-card.js';
export const PANEL_ENTRY_FILE = 'houseplan-panel.js';

const ENTRY_CONTRACTS = [
  {
    fileName: CARD_ENTRY_FILE,
    facade: 'src/houseplan-card.ts',
    element: 'houseplan-card',
    cardFallback: true,
  },
  {
    fileName: PANEL_ENTRY_FILE,
    facade: 'src/houseplan-panel.ts',
    element: 'houseplan-panel',
    cardFallback: false,
  },
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const normalizedId = (value) => String(value || '').replaceAll('\\', '/');

const hasExactFacade = (chunk, facade) => {
  const id = normalizedId(chunk.facadeModuleId);
  return id === facade || id.endsWith(`/${facade}`);
};

const exactEntryChunk = (bundle, contract) => {
  const matches = Object.values(bundle).filter((item) => item.type === 'chunk'
    && item.isEntry
    && normalizedId(item.fileName) === contract.fileName);
  if (matches.length !== 1) {
    throw new Error(
      `${contract.fileName} entry count is ${matches.length}, expected exactly 1`,
    );
  }
  if (!hasExactFacade(matches[0], contract.facade)) {
    throw new Error(
      `${contract.fileName} facade is ${normalizedId(matches[0].facadeModuleId) || 'missing'},`
        + ` expected ${contract.facade}`,
    );
  }
  return matches[0];
};

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
  const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
  const entries = chunks.filter((item) => item.isEntry);
  if (entries.length !== ENTRY_CONTRACTS.length) {
    throw new Error(`bundle entry count is ${entries.length}, expected ${ENTRY_CONTRACTS.length}`);
  }
  const cardEntry = exactEntryChunk(bundle, ENTRY_CONTRACTS[0]);
  const panelEntry = exactEntryChunk(bundle, ENTRY_CONTRACTS[1]);
  const files = chunks
    .map((chunk) => {
      const contents = Buffer.from(chunk.code, 'utf8');
      const modules = Object.keys(chunk.modules || {}).map((id) => id.replaceAll('\\', '/'));
      const role = modules.some((id) => id.endsWith('/src/i18n/de.ts') || id.endsWith('/src/i18n/fr.ts'))
        ? 'locale'
        : modules.some(isNamespaceLocaleModule)
          ? 'namespace-locale'
        : modules.some((id) => id.endsWith('/src/houseplan-onboarding-runtime.ts'))
          ? 'onboarding'
          : modules.some((id) => id.endsWith('/src/houseplan-editor-runtime.ts'))
            ? 'editor'
            : modules.some((id) => id.endsWith('/src/iso-scene-render.ts'))
              ? 'isometric'
              : modules.some((id) => id.endsWith('/src/pdf/pdf-export.ts'))
                ? 'pdf'
              // #661: the moon's math, art and template — loaded only at night.
              : modules.some((id) => id.endsWith('/src/moon-runtime.ts'))
                ? 'moon'
              // #780: LED strip geometry, light field and hit paths — loaded
              // only when a shown space has an active strip.
              : modules.some((id) => id.endsWith('/src/led-strip-runtime.ts'))
                ? 'led'
              // #780: the linear field, loaded by the LED runtime only when a
              // strip is on in a Glow room with a light scene.
              : modules.some((id) => id.endsWith('/src/led-strip-field.ts'))
                ? 'led-field'
              // #780: the Devices-editor LED tool, loaded by the editor runtime.
              : modules.some((id) => id.endsWith('/src/led-strip-editor.ts'))
                ? 'led-editor'
              // #474: designer furniture artwork — its own lazy chunk, shared by
              // the editor (static import) and the View runtime (dynamic).
              : modules.some((id) => id.endsWith('/src/furniture-plan-art.generated.ts'))
                ? 'furniture-art'
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
  const entry = normalizedId(cardEntry.fileName);
  const panelEntryPath = normalizedId(panelEntry.fileName);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const initial = reachable(entry, byPath, 'imports');
  const initialPanel = reachable(panelEntryPath, byPath, 'imports');
  const initialPanelOnly = new Set(
    [...initialPanel].filter((path) => !initial.has(path)),
  );
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
  const furnitureArtRoots = dynamicRoots.filter((path) => byPath.get(path)?._role === 'furniture-art');
  const pdfRoots = dynamicRoots.filter((path) => byPath.get(path)?._role === 'pdf'
    || path.includes('pdf-export-'));
  const moonRoots = dynamicRoots.filter((path) => byPath.get(path)?._role === 'moon'
    || path.includes('moon-runtime-'));
  // #780: the field chunk is a dynamic import of the LED chunk, not of the
  // initial graph, so it is found by its module, like namespace dictionaries.
  const ledRoots = [
    ...dynamicRoots.filter((path) => byPath.get(path)?._role === 'led'
      || path.includes('led-strip-runtime-')),
    ...files.filter((file) => file._role === 'led-field').map((file) => file.path),
  ];
  const ledEditorRoots = files.filter((file) => file._role === 'led-editor').map((file) => file.path);
  // #627: namespace dictionaries are dynamic imports of LAZY chunks, never of
  // the initial graph, so they are found by their module, not as a root.
  const namespaceLocaleRoots = files.filter((file) => file._role === 'namespace-locale')
    .map((file) => file.path);
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
  const lazyFurnitureArt = graphFrom(furnitureArtRoots);
  const lazyPdf = graphFrom(pdfRoots);
  const lazyMoon = graphFrom(moonRoots);
  const lazyLed = graphFrom(ledRoots);
  const lazyLedEditor = graphFrom(ledEditorRoots);
  const lazyNamespaceLocale = graphFrom(namespaceLocaleRoots);
  const sum = (paths) => [...paths]
    .reduce((total, path) => total + (byPath.get(path)?.gzipBytes || 0), 0);
  return {
    schema: 1,
    fingerprint,
    entry,
    panelEntry: panelEntryPath,
    initialViewFiles: [...initial].sort(),
    initialViewGzipBytes: sum(initial),
    initialPanelFiles: [...initialPanel].sort(),
    initialPanelGzipBytes: sum(initialPanel),
    initialPanelOnlyFiles: [...initialPanelOnly].sort(),
    initialPanelOnlyGzipBytes: sum(initialPanelOnly),
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
    lazyFurnitureArtFiles: [...lazyFurnitureArt].sort(),
    lazyFurnitureArtGzipBytes: sum(lazyFurnitureArt),
    lazyPdfFiles: [...lazyPdf].sort(),
    lazyPdfGzipBytes: sum(lazyPdf),
    lazyMoonFiles: [...lazyMoon].sort(),
    lazyMoonGzipBytes: sum(lazyMoon),
    lazyLedFiles: [...lazyLed].sort(),
    lazyLedGzipBytes: sum(lazyLed),
    lazyLedEditorFiles: [...lazyLedEditor].sort(),
    lazyLedEditorGzipBytes: sum(lazyLedEditor),
    lazyNamespaceLocaleFiles: [...lazyNamespaceLocale].sort(),
    lazyNamespaceLocaleGzipBytes: sum(lazyNamespaceLocale),
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
export function buildFingerprintPlugin(fingerprint, { coverage = coverageMapsEnabled() } = {}) {
  return {
    name: 'houseplan-build-fingerprint',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').includes('/src/')
          || !code.includes(BUILD_FINGERPRINT_TOKEN)) return null;
      if (coverage) return editMappedSource(code, replacementEdits(code, BUILD_FINGERPRINT_TOKEN, fingerprint, true).edits, { id });
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
export function editorRuntimeRetryUrlPlugin({ coverage = coverageMapsEnabled() } = {}) {
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
      const furnitureArt = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/furniture-plan-art.generated.ts')));
      const pdf = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/pdf/pdf-export.ts')));
      const moon = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/moon-runtime.ts')));
      if (!editor) throw new Error('editor runtime chunk was not emitted');
      // The nonce retry imports the raw URL, not Rollup's namespace wrapper.
      // A cross-chunk leaf can otherwise silently turn these into a/b/h.
      for (const name of ['EDITOR_RUNTIME_FINGERPRINT', 'EDITOR_LANGUAGE_RUNTIME', 'HouseplanEditorRuntime']) {
        if (!editor.exports?.includes(name)) throw new Error(`editor runtime raw-URL retry missing named export ${name}`);
      }
      if (!onboarding) throw new Error('onboarding runtime chunk was not emitted');
      if (!isometric) throw new Error('isometric runtime chunk was not emitted');
      if (!german) throw new Error('German locale chunk was not emitted');
      if (!french) throw new Error('French locale chunk was not emitted');
      if (!furnitureArt) throw new Error('furniture artwork chunk was not emitted');
      if (!pdf) throw new Error('PDF export runtime chunk was not emitted');
      if (!moon) throw new Error('moon runtime chunk was not emitted');
      const led = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/led-strip-runtime.ts')));
      if (!led) throw new Error('LED strip runtime chunk was not emitted');
      const ledField = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/led-strip-field.ts')));
      if (!ledField) throw new Error('LED strip field chunk was not emitted');
      const ledEditor = chunks.find((chunk) => Object.keys(chunk.modules)
        .some((id) => id.replaceAll('\\', '/').endsWith('/src/led-strip-editor.ts')));
      if (!ledEditor) throw new Error('LED strip editor chunk was not emitted');
      const namespaceLocales = NAMESPACE_LOCALE_CHUNKS.map((entry) => {
        const chunk = chunks.find((candidate) => Object.keys(candidate.modules)
          .some((id) => id.replaceAll('\\', '/').endsWith(entry.module)));
        if (!chunk) {
          throw new Error(`${entry.namespace} ${entry.language} locale chunk was not emitted`);
        }
        return { ...entry, chunk, replacements: 0 };
      });
      let furnitureArtReplacements = 0;
      let editorReplacements = 0;
      let onboardingReplacements = 0;
      let isometricReplacements = 0;
      let germanReplacements = 0;
      let frenchReplacements = 0;
      let pdfReplacements = 0;
      let moonReplacements = 0;
      let ledReplacements = 0;
      let ledFieldReplacements = 0;
      let ledEditorReplacements = 0;
      for (const chunk of chunks) {
        if (chunk.code.includes(EDITOR_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), editor.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          editorReplacements += chunk.code.split(EDITOR_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, EDITOR_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(ONBOARDING_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), onboarding.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          onboardingReplacements += chunk.code.split(ONBOARDING_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, ONBOARDING_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(ISO_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), isometric.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          isometricReplacements += chunk.code.split(ISO_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, ISO_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(DE_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), german.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          germanReplacements += chunk.code.split(DE_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, DE_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(FR_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), french.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          frenchReplacements += chunk.code.split(FR_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, FR_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(FURNITURE_ART_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), furnitureArt.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          furnitureArtReplacements += chunk.code.split(FURNITURE_ART_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, FURNITURE_ART_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(PDF_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), pdf.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          pdfReplacements += chunk.code.split(PDF_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, PDF_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(MOON_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), moon.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          moonReplacements += chunk.code.split(MOON_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, MOON_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(LED_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), led.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          ledReplacements += chunk.code.split(LED_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, LED_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(LED_EDITOR_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), ledEditor.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          ledEditorReplacements += chunk.code.split(LED_EDITOR_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, LED_EDITOR_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        if (chunk.code.includes(LED_FIELD_RETRY_ASSET_TOKEN)) {
          let asset = posix.relative(posix.dirname(chunk.fileName), ledField.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          ledFieldReplacements += chunk.code.split(LED_FIELD_RETRY_ASSET_TOKEN).length - 1;
          replaceChunkSource(chunk, LED_FIELD_RETRY_ASSET_TOKEN, asset, { all: true, coverage, bundle });
        }
        for (const entry of namespaceLocales) {
          if (!chunk.code.includes(entry.token)) continue;
          let asset = posix.relative(posix.dirname(chunk.fileName), entry.chunk.fileName);
          if (!asset.startsWith('.')) asset = `./${asset}`;
          entry.replacements += chunk.code.split(entry.token).length - 1;
          replaceChunkSource(chunk, entry.token, asset, { all: true, coverage, bundle });
        }
      }
      if (editorReplacements !== 1 || onboardingReplacements !== 1 || isometricReplacements !== 1
          || germanReplacements !== 1 || frenchReplacements !== 1 || furnitureArtReplacements !== 1
          || pdfReplacements !== 1 || moonReplacements !== 1 || ledReplacements !== 1
          || ledFieldReplacements !== 1 || ledEditorReplacements !== 1) {
        throw new Error('lazy retry URL placeholder counts are '
          + `${editorReplacements}/${onboardingReplacements}/${isometricReplacements}/${germanReplacements}/${frenchReplacements}/${furnitureArtReplacements}/${pdfReplacements}/${moonReplacements}/${ledReplacements}/${ledFieldReplacements}/${ledEditorReplacements}, expected 1/1/1/1/1/1/1/1/1/1/1`);
      }
      // #627: the same strict rule for every namespace × language token —
      // exactly one second-attempt URL each, never zero and never two.
      const namespaceMismatch = namespaceLocales.filter((entry) => entry.replacements !== 1);
      if (namespaceMismatch.length) {
        throw new Error('namespace locale retry URL placeholder counts are '
          + namespaceMismatch.map((entry) => `${entry.namespace}-${entry.language}=${entry.replacements}`).join(', ')
          + ', expected exactly 1 each');
      }
      // #848: roots keep their content-hashed build URL. The nonce changes
      // only the browser module-map key, never an entry or dependency hash.
      for (const entry of VIEW_RUNTIME_RETRY_CHUNKS) {
        const owners = chunks.filter(chunk => chunk.code.includes(entry.token));
        if (!owners.length) continue; // older/focused plugin fixtures have no View boundaries
        const count = owners.reduce((n, chunk) => n + chunk.code.split(entry.token).length - 1, 0);
        const target = chunks.find(chunk => Object.keys(chunk.modules)
          .some(id => normalizedId(id).endsWith(entry.module)));
        if (count !== 1 || !target) throw new Error(`invalid View retry root: ${entry.module} (${count})`);
        const owner = owners[0];
        let asset = posix.relative(posix.dirname(owner.fileName), target.fileName);
        if (!asset.startsWith('.')) asset = `./${asset}`;
        replaceChunkSource(owner, entry.token, asset, { all: true, coverage, bundle });
      }
    },
  };
}

/**
 * Rewrite both stable entry facades so a stale cached entry fails loudly
 * instead of killing the card or panel silently (#353 K3, #486). Rollup emits
 * the card facade as a STATIC re-export of a content-hashed implementation
 * chunk, while the panel entry statically imports that same shared chunk.
 * After an update a proxy-cached entry can point at a chunk the manifest-gated
 * server no longer serves, and a static import failure would abort the whole
 * module before any code runs.
 *
 * The rewrite keeps the happy path intact via top-level await: an importer's
 * `await import(entry)` does not resolve until the inner import settles, so
 * `customElements.define` of the real card still happens-before the importer
 * continues — demo, smokes and golden run unchanged. Only the failure branch
 * is new: it defines a minimal fallback element with a human message.
 *
 * Must run BEFORE bundleManifestPlugin so the manifest hashes the final code.
 *
 * #836: before anything loads, each facade records its own `import.meta.url`
 * in `globalThis[ENTRY_URL_SEAM]`; the first facade loaded in a document wins.
 * The card's code runs in a content-hashed chunk whose own URL has no query,
 * and only the facade's URL carries what the backend registered
 * (`?v=…&b=…&dev=…`): the console banner and «About» read the dev label there.
 */
export const ENTRY_URL_SEAM = '__HOUSEPLAN_ENTRY_URL__';

export function entryFallbackPlugin({ coverage = coverageMapsEnabled() } = {}) {
  // #803: manual chunking can add eager side-effect edges to either facade.
  // They must settle before the implementation, as static imports did, but
  // inside the same catch boundary so a missing extra chunk cannot bypass it.
  const hoistSideEffectAssets = (entry, implementation, bundle) => {
    const pattern = /\bimport(["'])(\.\/houseplan-assets\/[^"']+\.js)\1;?/g;
    const assets = [...new Set([...entry.code.matchAll(pattern)]
      .map((match) => match[2]).filter((asset) => asset !== implementation))];
    replaceChunkSource(entry, pattern, (match, _quote, asset) => (
      asset === implementation ? match : ''
    ), { coverage, bundle });
    return assets;
  };
  const awaitAssets = (assets) => assets.map((asset) => `await import("${asset}");`).join('');
  const recordEntryUrl = `globalThis.${ENTRY_URL_SEAM}??=import.meta.url;`;
  const fallbackDefinition = (contract) => `if(!customElements.get("${contract.element}")){`
    + 'const l=String(navigator.language||"en").toLowerCase();'
    + 'const m=l.startsWith("ru")'
    + '?"House Plan обновился — перезагрузите страницу (Ctrl+F5)."'
    + ':l.startsWith("de")'
    + '?"House Plan wurde aktualisiert — bitte laden Sie die Seite neu (Strg+F5)."'
    + ':l.startsWith("fr")'
    + '?"House Plan a été mis à jour — veuillez recharger la page (Ctrl+F5)."'
    + ':"House Plan was updated — please reload the page (Ctrl+F5).";'
    + `customElements.define("${contract.element}",class extends HTMLElement{`
    + (contract.cardFallback ? 'setConfig(){}getCardSize(){return 1}' : '')
    + 'connectedCallback(){'
    + 'this.style.cssText="display:block;box-sizing:border-box;padding:16px;'
    + (contract.cardFallback
      ? 'border:1px solid var(--divider-color,#e0e0e0);border-radius:var(--ha-card-border-radius,12px);'
      : 'min-height:100%;')
    + 'background:var(--card-background-color,#fff);color:var(--primary-text-color,#212121);'
    + 'font:14px/1.4 var(--paper-font-body1_-_font-family,sans-serif)";'
    + 'this.textContent=m}})}';
  return {
    name: 'houseplan-entry-fallback',
    generateBundle(_options, bundle) {
      const cardContract = ENTRY_CONTRACTS[0];
      const cardEntry = exactEntryChunk(bundle, cardContract);
      const cardPattern = /export\{[^}]*\}from(["'])(\.\/houseplan-assets\/[^"']+\.js)\1;?/g;
      const cardMatches = [...cardEntry.code.matchAll(cardPattern)];
      if (cardMatches.length !== 1) {
        throw new Error(
          `${cardContract.fileName} facade re-export count is ${cardMatches.length}, expected 1`,
        );
      }
      const cardAsset = cardMatches[0][2];
      const cardSideEffects = hoistSideEffectAssets(cardEntry, cardAsset, bundle);
      replaceChunkSource(cardEntry, cardPattern,
        `${recordEntryUrl}try{${awaitAssets(cardSideEffects)}await import("${cardAsset}")}`
          + `catch(e){${fallbackDefinition(cardContract)}`
          + 'console.error("[houseplan] stale houseplan-card.js: the implementation chunk is unavailable",e)}',
        { coverage, bundle },
      );

      // Rollup folds the small panel shell into its stable entry and points its
      // side-effect import directly at the shared card implementation. Keep that
      // edge (#535). Routing it through the stable card facade instead used to
      // look harmless — the chunk is the same URL either way, so no second copy
      // arises — but the facade is the ONE address in the distribution with no
      // version in it: a dashboard reaches the same file through the Lovelace
      // resource's `?v=`, while a relative specifier cannot inherit that query.
      // Entries are served without Cache-Control (only ETag/Last-Modified), so
      // a browser may keep its copy for hours; a stale panel entry then pulled
      // a stale chunk — both cached — and silently ran a previous card against
      // the current backend, with nothing but the version banner to show for it.
      // The hashed name changes with the content, so now either the matching
      // implementation arrives or the panel's own fallback says so out loud.
      const panelContract = ENTRY_CONTRACTS[1];
      const panelEntry = exactEntryChunk(bundle, panelContract);
      const panelPattern = new RegExp(
        `import(["'])${cardAsset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1;?`,
        'g',
      );
      const panelMatches = [...panelEntry.code.matchAll(panelPattern)];
      if (panelMatches.length !== 1) {
        throw new Error(
          `${panelContract.fileName} card import count is ${panelMatches.length}, expected 1`,
        );
      }
      const panelSideEffects = hoistSideEffectAssets(panelEntry, cardAsset, bundle);
      replaceChunkSource(panelEntry, panelPattern,
        `${recordEntryUrl}try{${awaitAssets(panelSideEffects)}await import("${cardAsset}")}`
          + `catch(e){${fallbackDefinition(panelContract)}`
          + 'console.error("[houseplan] stale houseplan-panel.js: the card implementation '
          + 'chunk is unavailable",e)}',
        { coverage, bundle },
      );
      panelEntry.imports = [cardAsset, ...panelSideEffects].map((asset) => asset.replace(/^\.\//, ''));
    },
  };
}

/** Remove inventoried output and recognizable orphaned House Plan chunks (#1016). */
export function cleanBundleOutputPlugin(outputRoot = 'dist') {
  // Load the parser only for cleanup, not for callers of manifest/payload helpers.
  const require = createRequire(import.meta.url);
  const ownsBuildSignature = (name, code) => {
    if (!code.includes('__HOUSEPLAN_BUILD_FINGERPRINT__')) return false;
    const ts = require('typescript');
    const ownsAssignment = expression => {
      if (!ts.isBinaryExpression(expression)) return false;
      if (expression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return ownsAssignment(expression.left) || ownsAssignment(expression.right);
      }
      const left = expression.left;
      return expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(left) && ts.isIdentifier(left.expression)
        && left.expression.text === 'globalThis' && left.name.text === '__HOUSEPLAN_BUILD_FINGERPRINT__'
        && ts.isStringLiteral(expression.right) && /^[a-f0-9]{64}$/.test(expression.right.text);
    };
    const ast = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    return ast.statements.some(statement => ts.isExpressionStatement(statement) && ownsAssignment(statement.expression));
  };
  return {
    name: 'houseplan-clean-bundle-output',
    buildStart() {
      const root = resolve(outputRoot);
      if (!existsSync(root)) return;
      if (lstatSync(root).isSymbolicLink()) throw new Error('bundle output root is a symlink');
      const manifestPath = resolve(root, 'houseplan-assets.json');
      const assetsRoot = resolve(root, 'houseplan-assets');
      if (existsSync(assetsRoot) && lstatSync(assetsRoot).isSymbolicLink()) {
        throw new Error('bundle assets directory is a symlink');
      }
      const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
      const managed = new Set();
      for (const file of manifest?.files || []) {
        const path = resolve(root, String(file.path || ''));
        const rel = relative(root, path);
        if (!rel || rel.startsWith('..') || rel.includes(':')) {
          throw new Error(`previous bundle path escapes output root: ${file.path}`);
        }
        managed.add(path);
        const mapPath = `${path}.map`;
        if (existsSync(mapPath) && !lstatSync(mapPath).isSymbolicLink()) {
          const map = JSON.parse(readFileSync(mapPath, 'utf8'));
          if (map.x_houseplan_coverage_recipe === hashMapRecipe) managed.add(mapPath);
        }
      }
      // Crossing old tracked-dist history can overwrite/remove the manifest
      // without removing ignored chunks. Recover only our flat hashed output
      // with its emitted build signature; unknown files remain fail-closed.
      for (const entry of existsSync(assetsRoot) ? readdirSync(assetsRoot, { withFileTypes: true }) : []) {
        if (!entry.isFile() || !/^[\w][\w.-]*-[\w-]{8}\.js$/.test(entry.name)) continue;
        const path = resolve(assetsRoot, entry.name);
        if (ownsBuildSignature(entry.name, readFileSync(path, 'utf8'))) {
          managed.add(path);
        }
      }
      for (const path of managed) rmSync(path, { force: true });
      rmSync(manifestPath, { force: true });
    },
  };
}
