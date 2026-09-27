// Browser mutation witnesses are the expensive part of the registry. This
// module keeps the cap and the reviewed inventory independent from the CLI so
// inventory, --check and unit tests ask the same question (#659).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const BROWSER_GUARD_LIMIT = 200;
export const BROWSER_GUARD_INVENTORY = 'docs/testing-notes/mutation-browser-guards.md';

export const isBrowserGuard = (guard) => guard.includes('demo/') || guard.includes('bundle:sync');

export function documentedBrowserGuards(markdown) {
  return new Set([...markdown.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]));
}

export function readDocumentedBrowserGuards(root = process.cwd()) {
  return documentedBrowserGuards(readFileSync(join(root, BROWSER_GUARD_INVENTORY), 'utf8'));
}

export function browserGuardPolicy(mutants, documented) {
  const browser = mutants.filter((mutant) => isBrowserGuard(mutant.guard));
  const current = new Set(browser.map((mutant) => mutant.id));
  return {
    browser,
    count: browser.length,
    overLimit: browser.length > BROWSER_GUARD_LIMIT,
    missingReasons: browser.filter((mutant) => !documented.has(mutant.id)),
    staleReasons: [...documented].filter((id) => !current.has(id)),
  };
}
