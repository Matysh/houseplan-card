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
  const optimize = readFileSync(resolve(root, 'src/plan-optimize-write.ts'), 'utf8')
    .replaceAll('host.', 'this.');
  const frontend = `${card}\n${editor}\n${optimize}`;
  const copy = readFileSync(resolve(root, 'src/device-copy-editor.ts'), 'utf8');
  const copyWrites = occurrences(copy, "type: 'houseplan/marker/copy'");
  if (copyWrites.length !== 1) errors.push(`frontend marker copy writer inventory: ${copyWrites.length}`);
  for (const index of copyWrites) requireWindow(errors, copy, index,
    /const pos = canonicalizePosition\([\s\S]*position: pos, expected_config_rev: m\.cr, expected_layout_rev: m\.lr/,
    'frontend marker copy transaction', 150);

  const configWrites = occurrences(frontend, "type: 'houseplan/config/set'");
  if (configWrites.length !== 1) errors.push(`frontend config writer inventory: ${configWrites.length}`);
  for (const index of configWrites) requireWindow(
    errors, frontend, index,
    /const canonicalCandidate = canonicalizeConfigWrite\(candidate\);[\s\S]*const expectedRev = this\._cfgRev;[\s\S]*config: canonicalCandidate,[\s\S]*expected_rev: expectedRev/,
    'frontend config/set', 1500,
  );
  // #879 adds lifecycle metadata AFTER staging the canonical geometry.
  // Inventory this exact wrapper without accepting a new unregistered transport.
  // #1025 adds the existing caller's optional late-ACK fence, not a transport.
  const roomWrites = occurrences(frontend, '._sendConfigCandidate(discoveryWrite?.config || candidate,contactLayout,acknowledgementCurrent,roomLabels)');
  const ordinaryWrites = occurrences(frontend, '._sendConfigCandidate(candidate)');
  if (ordinaryWrites.length + roomWrites.length !== 2
      || occurrences(frontend, '._sendConfigCandidate(').length !== 2) {
    errors.push('frontend canonical config transport callers changed');
  }
  for (const index of roomWrites) requireWindow(errors, frontend, index,
    /this\._adoption\.stageConfigCandidate\(candidate\);\s*const discoveryWrite = this\.roomDeviceDiscovery\?\.prepare\(candidate\);/,
    'frontend room discovery config', 650);

  const contacts = readFileSync(resolve(root, 'src/device-contact-write.ts'), 'utf8');
  const groupWrites = occurrences(contacts, "type:'houseplan/layout/set'");
  if (groupWrites.length !== 1) errors.push(`frontend contact writer inventory: ${groupWrites.length}`);
  for (const index of groupWrites) requireWindow(errors, contacts, index,
    /const changes=\[state,[\s\S]*canonicalizePosition\(c\.placement\)[\s\S]*layout=applyDevicePlacement\(layout,c\.deviceId,c\.placement\);[\s\S]*expected_rev:snapshot\.rev,[\s\S]*expected_config_rev:configRevision/,
    'frontend contact layout/set', 2400);

  const positionWrites = occurrences(frontend, "type: 'houseplan/layout/update'");
  // #902: debounced label/position saves now reuse the marker point transport.
  // Keep an exact inventory, not a range permitting another unregistered writer.
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
    /const expectedConfigRev = guard\?\.source.configRev \?\? this\._cfgRev;[\s\S]*const expectedLayoutRev = guard\?\.source.layoutRev \?\? this\._layoutRev;[\s\S]*config,[\s\S]*layout,[\s\S]*expected_config_rev: expectedConfigRev,[\s\S]*expected_layout_rev: expectedLayoutRev/,
    'frontend Optimize transaction', 1300,
  );

  const componentRoot = resolve(root, 'custom_components/houseplan');
  const pythonFiles = readdirSync(componentRoot, { recursive: true })
    .filter((name) => name.endsWith('.py')).map(name => name.replaceAll('\\', '/')).sort();
  for (const name of pythonFiles) {
    const source = readFileSync(resolve(componentRoot, name), 'utf8');
    if (name === 'store.py') continue;
    if (name === 'trails.py') continue; // operational breadcrumb Store, not plan geometry
    if (/\b(?:runtime|rt)\.(?:config_store|store)\.async_save\s*\(/.test(source)) {
      errors.push(`backend direct plan Store writer: custom_components/houseplan/${name}`);
    }
  }
  const store = readFileSync(resolve(componentRoot, 'store.py'), 'utf8');
  if (!/out\["layout"\] = copy\.deepcopy\(layout\) if preserve_exact else canonicalize_layout_geometry\(layout\)/.test(store)) {
    errors.push('backend layout_store_payload bypasses lattice canonicalization');
  }
  if (!/canonical_config = canonicalize_config_geometry\(config\)/.test(store)) {
    errors.push('backend async_save_config_state bypasses lattice canonicalization');
  }
  // #1391 moved the two schema-validated writers into the common command core.
  // The HA adapter only forwards their explicit claim; it cannot invent one.
  const canonicalCallers = pythonFiles.filter((name) => name !== 'store.py'
    && /canonical=(?:True|not deleting)/.test(readFileSync(resolve(componentRoot, name), 'utf8')));
  if (canonicalCallers.join(',') !== 'core/plan_commands.py') {
    errors.push(`backend canonical=True writer inventory: ${canonicalCallers.join(',') || 'none'}`);
  }
  const commands = readFileSync(resolve(componentRoot, 'core/plan_commands.py'), 'utf8');
  const node = commands.slice(commands.indexOf('            def validate_node():'), commands.indexOf('            if not deleting:\n                transaction.cache.schema_clean_rev'));
  const ordinary = commands.slice(commands.indexOf('            def validate_config():'), commands.indexOf('            transaction.cache.junction_baseline = (new_rev, counts)', commands.indexOf('            def validate_config():')));
  if (occurrences(commands, 'canonical=True').length !== 1
      || occurrences(commands, 'canonical=not deleting').length !== 1
      || !/candidate = validate_scoped_candidate\(candidate, previous, scope\)/.test(node)
      || !/candidate, counts = await self\.cpu\.run\(validate_node\)/.test(node)
      || !/save_config\(candidate, new_rev, previous=data, canonical=not deleting/.test(node)
      || !/checked = validate_scoped_candidate\(source, previous, scope\)/.test(ordinary)
      || !/return checked, counts/.test(ordinary)
      || !/candidate, counts = await self\.cpu\.run\(validate_config\)/.test(ordinary)
      || !/save_config\(candidate, new_rev, previous=data, canonical=True/.test(ordinary)) {
    errors.push('backend canonical=True write is not the validated ordinary candidate');
  }
  const adapter = readFileSync(resolve(componentRoot, 'command_adapter.py'), 'utf8');
  if (!/previous=previous, canonical=canonical,/.test(adapter)
      || occurrences(adapter, 'canonical=canonical').length !== 1) {
    errors.push('backend canonical command adapter does not forward the validated claim');
  }
  // #1464 preserves the pre-existing target verbatim for an additive house
  // transaction. No ordinary writer may borrow that recovery-only exception.
  const api = readFileSync(resolve(componentRoot, 'websocket_api.py'), 'utf8');
  const houseFence = 'exact_house = pending.get("kind") in {"house_import", "house_import_rollback"} and "house_files" in pending';
  if (occurrences(store, houseFence).length !== 1 || occurrences(api, houseFence).length !== 1
      || occurrences(store, 'preserve_exact=exact_house').length !== 2
      || occurrences(api, 'preserve_exact=exact_house').length !== 2
      || occurrences(store, 'preserve_exact=preserve_exact').length !== 1
      || occurrences(store, 'canonical=exact_house').length !== 1) {
    errors.push('backend exact layout preservation escaped its typed house transaction');
  }
  for (const name of pythonFiles.filter(name => !['store.py', 'websocket_api.py'].includes(name))) {
    if (/\bpreserve_exact\s*=/.test(readFileSync(resolve(componentRoot, name), 'utf8'))) {
      errors.push(`backend unregistered exact layout writer: ${name}`);
    }
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
