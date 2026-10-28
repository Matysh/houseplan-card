// Task declarations are independent of Golden acceptance; its epoch is checked by the visual reader.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function validateVisualIntent(visual, issue) {
  if (![1, 2].includes(visual?.schema) || !/^[a-f0-9]{64}$/.test(visual.baselineIndex || '')
    || !Array.isArray(visual.golden) || !Array.isArray(visual.smokes)) throw Error(`#${issue}: invalid visual intent`);
  const ids = new Set();
  for (const item of visual.golden) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(item?.id || '') || ids.has(item.id)
      || !['change', 'new'].includes(item.expectation) || typeof item.reason !== 'string' || !item.reason.trim())
      throw Error(`#${issue}: visual intent needs unique scene IDs, change/new and a reason`);
    ids.add(item.id);
  }
  if (visual.goldenChecks !== undefined) {
    if (visual.schema !== 2) throw Error(`#${issue}: golden checks require visual schema 2`);
    if (!Array.isArray(visual.goldenChecks)) throw Error(`#${issue}: invalid golden checks`);
    for (const item of visual.goldenChecks) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(item?.id || '') || ids.has(item.id)
        || typeof item.reason !== 'string' || !item.reason.trim()
        || Object.prototype.hasOwnProperty.call(item, 'expectation'))
        throw Error(`#${issue}: golden checks need unique scene IDs, a reason and no delta expectation`);
      ids.add(item.id);
    }
  }
  if (new Set(visual.smokes).size !== visual.smokes.length
    || visual.smokes.some(id => typeof id !== 'string' || !/^smoke_[\w-]+\.mjs$/.test(id)))
    throw Error(`#${issue}: invalid visual intent smoke IDs`);
  return visual;
}

export function cycleDirectory(root) {
  const cycle = JSON.parse(readFileSync(join(root, 'docs/release-ledger/cycle.json'), 'utf8'));
  if (!/^v\d+\.\d+\.\d+$/.test(cycle.baseStable || '')) throw Error('Invalid visual intent release cycle');
  return join(root, 'docs/release-ledger', cycle.baseStable);
}

export function readTaskIntent({ root = process.cwd(), issue } = {}) {
  if (issue === undefined || issue === null) return null;
  if (!Number.isSafeInteger(Number(issue)) || Number(issue) <= 0) throw Error('Invalid task issue for visual intent');
  const path = join(cycleDirectory(root), `${Number(issue)}.json`);
  if (!existsSync(path)) return null;
  const entry = JSON.parse(readFileSync(path, 'utf8'));
  if (entry.issue !== Number(issue)) throw Error(`Visual intent issue mismatch: ${path}`);
  return entry.visual ? { ...validateVisualIntent(entry.visual, issue), issue: Number(issue) } : null;
}
