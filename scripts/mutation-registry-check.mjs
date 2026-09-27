// Cheap structural validation for mutation declarations. Kept out of the CLI
// so adding registry policy does not grow the execution coordinator (#558).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BROWSER_GUARD_LIMIT, browserGuardPolicy, readDocumentedBrowserGuards,
} from './mutation-browser-policy.mjs';
import { staticTestSelectionProblems } from './mutation-guard-outcome.mjs';

export function checkMutationRegistry(selected, { allMutants, root, log = console.log }) {
  let stale = 0;
  let warned = 0;
  const readTest = (file) => {
    const path = join(root, file);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  };
  for (const mutant of selected) {
    try {
      if (/bundle:sync|bundle-sync\.mjs|rollup -c/.test(mutant.guard)) {
        throw new Error('гвард сам собирает бандл — сборку делает раннер (#499)');
      }
      for (const patch of mutant.patches) {
        const source = readFileSync(join(root, patch.file), 'utf8');
        const hits = source.split(patch.find).length - 1;
        if (hits !== 1) throw new Error(`якорь найден ${hits} раз(а)`);
      }
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
    const policy = browserGuardPolicy(allMutants, readDocumentedBrowserGuards(root));
    log(`browser guards: ${policy.count}/${BROWSER_GUARD_LIMIT}`);
    if (policy.overLimit) {
      log(`FAIL browser guards: лимит ${BROWSER_GUARD_LIMIT} превышен`);
      stale++;
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
  return stale ? 2 : 0;
}
