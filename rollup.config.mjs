import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { sourceFingerprint } from './scripts/source-fingerprint.mjs';
import { cssTemplateMinifier } from './scripts/css-template-minifier.mjs';
import { coverageMapsEnabled, coverageTypeScriptOptions, diagnosticMapAssetsPlugin } from './scripts/coverage-maps.mjs';
import {
  buildFingerprintPlugin,
  bundleManifestPlugin,
  cleanBundleOutputPlugin,
  editorRuntimeRetryUrlPlugin,
  entryFallbackPlugin,
} from './scripts/bundle-manifest.mjs';

const SOURCE_FINGERPRINT = sourceFingerprint();
const DIAGNOSTIC_COVERAGE = coverageMapsEnabled();

export default {
  input: {
    'houseplan-card': 'src/houseplan-card.ts',
    'houseplan-panel': 'src/houseplan-panel.ts',
  },
  output: {
    dir: 'dist',
    entryFileNames: '[name].js',
    chunkFileNames: 'houseplan-assets/[name]-[hash].js',
    // #803: the nested Select chunk shares these helpers with the editor.
    // Keep them outside the runtime entry so Rollup can preserve its named
    // exports, also used by the immutable-URL network retry (not a Rollup edge).
    // #885: the wall-end alignment magnet is shared the same way (no Select→runtime edge).
    onlyExplicitManualChunks: true,
    manualChunks(id) {
      const path = id.replaceAll('\\', '/');
      // #1166: Optimize now shares the structural sweep with the editor.
      // Keep that leaf outside the immutable-URL editor facade's named ABI.
      if (path.endsWith('/src/wall-face-graph.ts')) return 'wall-face-graph';
      // #848: these leaves are also used by the nested summary editor. Keep
      // them out of its View root, whose named exports are consumed by the
      // immutable-URL retry as well as Rollup's literal dynamic import.
      if (['/src/summary-panel-picker.ts', '/src/summary-panel-icons.ts']
        .some((suffix) => path.endsWith(suffix))) return 'summary-shared';
      // #866: the newly lazy Optimize boundary must not statically import
      // leaves housed in the runtime facade: that mangles its raw-URL ABI.
      if (['/src/pointer-move-queue.ts', '/src/live-editor.ts', '/src/i18n/tools.ts', '/src/wall-segment-model.ts',
        '/src/wall-end-align.ts', '/src/wall-merge.ts', '/src/coincident-partitions.ts',
        '/src/device-contact-collision.ts', '/src/device-inbox-i18n.ts',
        '/src/prior-config-write.ts'].some((suffix) => path.endsWith(suffix))) return 'editor-shared';
      // #1147: View also uses this presentation. Its chunk must not bring the
      // editor commands or tools dictionary into the cold View graph.
      if (path.endsWith('/src/editor-context-menu.ts')) return 'context-menu';
    },
    format: 'es',
    sourcemap: DIAGNOSTIC_COVERAGE ? 'hidden' : false,
    // Tooling reads this before recording screenshots/performance. A committed
    // demo bundle built from older sources must fail closed, never produce a
    // plausible-looking but invalid baseline.
    intro: `globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__=${JSON.stringify(SOURCE_FINGERPRINT)};`,
  },
  plugins: [
    cleanBundleOutputPlugin(),
    buildFingerprintPlugin(SOURCE_FINGERPRINT),
    cssTemplateMinifier(),
    resolve(),
    json(),
    typescript({ compilerOptions: { outDir: 'dist/.ts',
      ...(DIAGNOSTIC_COVERAGE ? coverageTypeScriptOptions() : {}) } }),
    terser({ format: { comments: false } }),
    editorRuntimeRetryUrlPlugin(),
    entryFallbackPlugin(),
    ...(DIAGNOSTIC_COVERAGE ? [diagnosticMapAssetsPlugin()] : []),
    bundleManifestPlugin(SOURCE_FINGERPRINT),
  ],
};
