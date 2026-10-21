#!/usr/bin/env node
// Compute with the same manifest/partition as execution; reuse reads only JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inputReader } from './content-inputs.mjs';
import { inputsOf } from './check-inputs.mjs';
import { reusableFrontendInputs } from './frontend-units.mjs';
import { REGISTRY_JOBS, registryProtocolFiles } from './ci-registry-inputs.mjs';
import { isMainModule } from './spawn-portable.mjs';

export function registryInventory(root = process.cwd()) {
  const reader = inputReader(root);
  const jobs = Object.fromEntries(REGISTRY_JOBS.map(job => [job, job === 'frontend'
    ? reusableFrontendInputs(root, reader) : inputsOf(job, root, { tracked: reader.tracked, read: reader.text })]));
  return { schema: 1, jobs, protocol: registryProtocolFiles(reader) };
}
if (isMainModule(import.meta.url)) {
  const expected = JSON.stringify(registryInventory(), null, 2) + '\n', path = join(process.cwd(), 'scripts/ci-registry-inventory.json');
  if (process.argv.includes('--write')) writeFileSync(path, expected);
  else if (readFileSync(path, 'utf8').replace(/\r\n/g, '\n') !== expected) throw Error('stale registry inventory; node scripts/ci-registry-inventory.mjs --write');
}
