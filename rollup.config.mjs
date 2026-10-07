import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { sourceFingerprint } from './scripts/source-fingerprint.mjs';
import { cssTemplateMinifier } from './scripts/css-template-minifier.mjs';
import {
  buildFingerprintPlugin,
  bundleManifestPlugin,
  cleanBundleOutputPlugin,
  editorRuntimeRetryUrlPlugin,
  entryFallbackPlugin,
} from './scripts/bundle-manifest.mjs';

const SOURCE_FINGERPRINT = sourceFingerprint();

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
    onlyExplicitManualChunks: true,
    manualChunks(id) {
      const path = id.replaceAll('\\', '/');
      if (['/src/pointer-move-queue.ts', '/src/live-editor.ts', '/src/i18n/tools.ts', '/src/wall-segment-model.ts']
        .some((suffix) => path.endsWith(suffix))) return 'editor-shared';
    },
    format: 'es',
    sourcemap: false,
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
    typescript({ compilerOptions: { outDir: 'dist/.ts' } }),
    terser({ format: { comments: false } }),
    editorRuntimeRetryUrlPlugin(),
    entryFallbackPlugin(),
    bundleManifestPlugin(SOURCE_FINGERPRINT),
  ],
};
