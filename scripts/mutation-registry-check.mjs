// Cheap structural validation for mutation declarations. Kept out of the CLI
// so adding registry policy does not grow the execution coordinator (#558).
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import {
  BROWSER_GUARD_INVENTORY, BROWSER_GUARD_LIMIT, browserGuardPolicy,
} from './mutation-browser-policy.mjs';
import { parseBrowserGuardInventory } from './mutation-browser-inventory.mjs';
import { guardPhases, shellWords, staticTestSelectionProblems } from './mutation-guard-outcome.mjs';
import { preparationProblems } from './mutation-preparation.mjs';
import { guardFiles, wrapperInputs } from './mutation-selection.mjs';

const safePath = (file) => typeof file === 'string' && /^[\w.-]+(?:\/[\w.-]+)*$/.test(file)
  && !file.split('/').some((part) => part === '..' || part === '.');

export function definitionProblems(mutant) {
  const errors = [];
  if (!mutant || typeof mutant !== 'object') return ['definition must be an object'];
  if (!/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/.test(mutant.id || '')) errors.push('invalid id');
  if (typeof mutant.because !== 'string' || !mutant.because.trim()) errors.push('missing because');
  if (typeof mutant.guard !== 'string' || !mutant.guard.trim()) errors.push('missing guard');
  else try { guardPhases(mutant.guard, mutant.oracle || 'assertion'); } catch (e) { errors.push(e.message); }
  if (!Array.isArray(mutant.patches) || !mutant.patches.length) errors.push('nonempty patches required');
  else for (const [index, patch] of mutant.patches.entries()) {
    if (!safePath(patch?.file)) errors.push(`patch ${index}: unsafe target path`);
    if (typeof patch?.find !== 'string' || !patch.find) errors.push(`patch ${index}: nonempty anchor required`);
    if (typeof patch?.replace !== 'string' || patch.replace === patch.find) errors.push(`patch ${index}: mutation must change text`);
  }
  return errors;
}

export function registryProblems(mutants) {
  if (!Array.isArray(mutants)) return ['registry must be an array'];
  const ids = new Set();
  return mutants.flatMap((mutant) => {
    const errors = definitionProblems(mutant);
    if (ids.has(mutant?.id)) errors.push('duplicate id');
    ids.add(mutant?.id);
    return errors.map((error) => `${mutant?.id || '?'}: ${error}`);
  });
}

export function checkMutationRegistry(selected, { allMutants = selected, root, log = console.log, read } = {}) {
  let stale = 0;
  let warned = 0;
  let reads = 0;
  const cache = new Map();
  const readTest = (file) => {
    if (!safePath(file)) throw new Error(`unsafe input path: ${file}`);
    if (cache.has(file)) return cache.get(file);
    reads++;
    let source;
    if (read) source = read(file);
    else {
      const path = join(root, file);
      if (!existsSync(path)) source = null;
      else {
        if (!realpathSync(path).startsWith(resolve(root) + sep)) throw new Error(`input escapes root: ${file}`);
        source = readFileSync(path, 'utf8');
      }
    }
    cache.set(file, source ?? null);
    return source ?? null;
  };
  for (const problem of registryProblems(allMutants)) { log(`FAIL ${problem}`); stale++; }
  if (stale) return 2; // Never continue selection/anchor logic with malformed definitions.
  for (const mutant of selected) {
    try {
      if (/bundle:sync|bundle-sync\.mjs|rollup -c/.test(mutant.guard)) {
        throw new Error('гвард сам собирает бандл — сборку делает раннер (#499)');
      }
      for (const patch of mutant.patches) {
        const source = readTest(patch.file);
        if (source === null) throw new Error(`target missing: ${patch.file}`);
        const hits = source.split(patch.find).length - 1;
        if (hits !== 1) throw new Error(`${patch.file}: якорь найден ${hits} раз(а)`);
      }
      for (const word of shellWords(mutant.guard).filter((word) => /\.(mjs|py)$/.test(word) && !word.startsWith('-'))) {
        if (readTest(word) === null) throw new Error(`guard file missing: ${word}`);
      }
      const entries = guardFiles(mutant.guard, (file) => readTest(file) !== null);
      const declared = entries.flatMap((file) => wrapperInputs(file, readTest));
      const preparation = preparationProblems(mutant.guard, readTest, [...entries, ...declared]);
      if (preparation.length) throw new Error(preparation.join('; '));
      const selection = staticTestSelectionProblems(mutant.guard, readTest);
      const error = selection.find((problem) => problem.level === 'error');
      if (error) throw new Error(error.text);
      for (const problem of selection) {
        log(`WARN ${mutant.id}: ${problem.text}`);
        warned++;
      }
      log(`ok   ${mutant.id}`);
    } catch (error) {
      log(`FAIL ${mutant.id}: ${error.message}`);
      stale++;
    }
  }
  try {
    const inventory = parseBrowserGuardInventory(readTest(BROWSER_GUARD_INVENTORY), {
      guideline: BROWSER_GUARD_LIMIT,
    });
    const policy = browserGuardPolicy(allMutants, inventory.documented);
    log(`browser guards: ${policy.count}/${BROWSER_GUARD_LIMIT}`);
    if (policy.overLimit) {
      // #699: ориентир, а не лимит — цена браузерных свидетелей растёт, но
      // удалять чужой мутант ради числа не нужно.
      log(`WARN browser guards: ${policy.count} при ориентире ${BROWSER_GUARD_LIMIT} — `
        + 'каждый сверх ориентира держится своей строкой обоснования в реестре');
      warned++;
    }
    for (const mutant of policy.missingReasons) {
      log(`WARN ${mutant.id}: browser guard не размечен — добавьте причину в `
        + '`docs/testing-notes/mutation-browser-guards.md` и конкретику в `because`');
      warned++;
    }
    for (const id of policy.staleReasons) {
      log(`WARN ${id}: browser-разметка устарела — такого browser guard больше нет`);
      warned++;
    }
  } catch (error) {
    log(`FAIL browser guard policy: ${error.message}`);
    stale++;
  }
  if (warned) log(`предупреждений mutation registry: ${warned}`);
  log(`static-readiness: definitions=${selected.length} unique-source-reads=${reads} execution=0 caught=unknown (nightly only)`);
  return stale ? 2 : 0;
}
