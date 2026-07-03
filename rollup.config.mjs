import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/houseplan-card.ts',
  output: {
    file: 'dist/houseplan-card.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [resolve(), typescript(), terser({ format: { comments: false } })],
};
