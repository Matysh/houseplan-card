import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { sourceFingerprint } from './scripts/source-fingerprint.mjs';

const SOURCE_FINGERPRINT = sourceFingerprint();

export default {
  input: 'src/houseplan-card.ts',
  output: {
    file: 'dist/houseplan-card.js',
    format: 'es',
    sourcemap: false,
    // Tooling reads this before recording screenshots/performance. A committed
    // demo bundle built from older sources must fail closed, never produce a
    // plausible-looking but invalid baseline.
    intro: `globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__=${JSON.stringify(SOURCE_FINGERPRINT)};`,
  },
  plugins: [resolve(), json(), typescript(), terser({ format: { comments: false } })],
};
