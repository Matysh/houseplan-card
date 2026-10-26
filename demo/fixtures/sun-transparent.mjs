import { readFileSync } from 'node:fs';
import { makeVisualMatrixFixture } from './visual-matrix.mjs';

const saved=JSON.parse(readFileSync(new URL('./sun-transparent.json',import.meta.url),'utf8'));

/** Saved canonical AC7 inputs, checked for materialization idempotence.
 * No default test-build import: parity jobs use an isolated compiler directory. */
export function sunTransparentConfig(sealed=false) {
  return structuredClone(sealed?saved.sealed:saved.open);
}

export function makeSunTransparentFixture({sealed=false}={}) {
  const sample=makeVisualMatrixFixture();
  sample.config=sunTransparentConfig(sealed);
  sample.devices={};sample.entities={};sample.areas={};sample.layout={};
  sample.states={'sun.sun':{entity_id:'sun.sun',state:'above_horizon',
    attributes:{azimuth:270,elevation:30,rising:false}}};
  return sample;
}
