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
} from './scripts/bundle-manifest.mjs';

const SOURCE_FINGERPRINT = sourceFingerprint();

export default {
  input: 'src/houseplan-card.ts',
  output: {
    dir: 'dist',
    entryFileNames: 'houseplan-card.js',
    chunkFileNames: 'houseplan-assets/[name]-[hash].js',
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
    bundleManifestPlugin(SOURCE_FINGERPRINT),
  ],
};
