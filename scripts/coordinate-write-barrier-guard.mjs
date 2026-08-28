#!/usr/bin/env node
/** Executable inventory of every persisted config/layout coordinate writer (#291). */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('..', import.meta.url));

const occurrences = (source, needle) => {
  const out = [];
  let from = 0;
  while (true) {
    const index = source.indexOf(needle, from);
    if (index < 0) return out;
    out.push(index);
    from = index + needle.length;
  }
};

const requireWindow = (errors, source, index, pattern, label, before = 650) => {
  const window = source.slice(Math.max(0, index - before), index + 260);
  if (!pattern.test(window)) errors.push(`${label} bypasses the canonical boundary`);
};

export function checkCoordinateWriteBarriers(root = defaultRoot) {
  const errors = [];
  // The editor implementation is a lazy chunk, but the persisted-coordinate
  // inventory remains one logical frontend. Normalize the typed host port so
  // the existing boundary windows keep describing the production call sites.
  const card = readFileSync(resolve(root, 'src/houseplan-card.ts'), 'utf8');
  const editor = readFileSync(resolve(root, 'src/houseplan-editor-runtime.ts'), 'utf8')
    .replaceAll('this.host.', 'this.');
  const frontend = `${card}\n${editor}`;

  const configWrites = occurrences(frontend, "type: 'houseplan/config/set'");
  if (configWrites.length !== 1) errors.push(`frontend config writer inventory: ${configWrites.length}`);
  for (const index of configWrites) requireWindow(
    errors, frontend, index,
    /const canonicalCandidate = canonicalizeConfigGeometry\(candidate\);[\s\S]*config: canonicalCandidate,[\s\S]*expected_rev: this\._cfgRev/,
    'frontend config/set', 600,
  );
  if (occurrences(frontend, '._sendConfigCandidate(candidate)').length !== 2) {
    errors.push('frontend canonical config transport callers changed');
  }

  const positionWrites = occurrences(frontend, "type: 'houseplan/layout/update'");
  if (positionWrites.length !== 2) errors.push(`frontend position writer inventory: ${positionWrites.length}`);
  for (const [ordinal, index] of positionWrites.entries()) requireWindow(
    errors, frontend, index,
    /const pos = canonicalizePosition\([^)]+\);[\s\S]*pos(?:[,\s}])/,
    `frontend layout/update #${ordinal + 1}`,
  );

  const localWrites = occurrences(frontend, 'localStorage.setItem(LS_KEY');
  if (localWrites.length !== 1) errors.push(`frontend local layout writer inventory: ${localWrites.length}`);
  for (const index of localWrites) requireWindow(
    errors, frontend, index,
    /this\._layout = canonicalizeLayoutGeometry\(this\._layout\);/,
    'frontend localStorage layout', 350,
  );

  const optimizeWrites = occurrences(frontend, "type: 'houseplan/plan/optimize'");
  if (optimizeWrites.length !== 1) errors.push(`frontend Optimize writer inventory: ${optimizeWrites.length}`);
  for (const index of optimizeWrites) requireWindow(
    errors, frontend, index,
    /config: d\.config,[\s\S]*layout: d\.layout/,
    'frontend Optimize transaction', 300,
  );

  const componentRoot = resolve(root, 'custom_components/houseplan');
  const pythonFiles = readdirSync(componentRoot)
    .filter((name) => name.endsWith('.py'));
  for (const name of pythonFiles) {
    const source = readFileSync(resolve(componentRoot, name), 'utf8');
    if (name === 'store.py') continue;
    if (name === 'trails.py') continue; // operational breadcrumb Store, not plan geometry
    if (/\b(?:runtime|rt)\.(?:config_store|store)\.async_save\s*\(/.test(source)) {
      errors.push(`backend direct plan Store writer: custom_components/houseplan/${name}`);
    }
  }
  const store = readFileSync(resolve(componentRoot, 'store.py'), 'utf8');
  if (!/out\["layout"\] = canonicalize_layout_geometry\(layout\)/.test(store)) {
    errors.push('backend layout_store_payload bypasses lattice canonicalization');
  }
  if (!/canonical_config = canonicalize_config_geometry\(config\)/.test(store)) {
    errors.push('backend async_save_config_state bypasses lattice canonicalization');
  }
  if (occurrences(store, 'runtime.store.async_save(').length !== 1
    || occurrences(store, 'runtime.config_store.async_save(').length !== 1) {
    errors.push('backend central Store writer inventory changed');
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkCoordinateWriteBarriers();
  if (errors.length) {
    for (const error of errors) console.error(`coordinate write barrier: ${error}`);
    process.exitCode = 1;
  } else {
    console.log('coordinate write barrier: OK');
  }
}
