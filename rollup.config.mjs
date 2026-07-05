import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/houseplan-card.ts',
  output: {
    file: 'dist/houseplan-card.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [resolve(), json(), typescript(), terser({ format: { comments: false } })],
};
