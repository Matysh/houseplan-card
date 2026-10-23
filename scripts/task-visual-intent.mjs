#!/usr/bin/env node
// #1044: task previews declare intent; only the beta gate accepts baselines.
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export function baselineIndexHash(root = process.cwd()) {
  return createHash('sha256').update(readFileSync(join(root, 'demo/golden/baselines/baselines-index.json'))).digest('hex');
}

export function validateVisualIntent(visual, issue) {
  if (visual?.schema !== 1 || !/^[a-f0-9]{64}$/.test(visual.baselineIndex || '')
    || !Array.isArray(visual.golden) || !Array.isArray(visual.smokes)) throw Error(`#${issue}: invalid visual intent`);
  const ids = new Set();
  for (const item of visual.golden) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(item?.id || '') || ids.has(item.id)
      || !['change', 'new'].includes(item.expectation) || typeof item.reason !== 'string' || !item.reason.trim())
      throw Error(`#${issue}: visual intent needs unique scene IDs, change/new and a reason`);
    ids.add(item.id);
  }
  if (new Set(visual.smokes).size !== visual.smokes.length
    || visual.smokes.some(id => typeof id !== 'string' || !/^smoke_[\w-]+\.mjs$/.test(id)))
    throw Error(`#${issue}: invalid visual intent smoke IDs`);
  return visual;
}

function cycleDirectory(root) {
  const cycle = JSON.parse(readFileSync(join(root, 'docs/release-ledger/cycle.json'), 'utf8'));
  if (!/^v\d+\.\d+\.\d+$/.test(cycle.baseStable || '')) throw Error('Invalid visual intent release cycle');
  return join(root, 'docs/release-ledger', cycle.baseStable);
}

export function readTaskVisualIntent({ root = process.cwd(), issue } = {}) {
  if (issue === undefined || issue === null) return null;
  if (!Number.isSafeInteger(Number(issue)) || Number(issue) <= 0) throw Error('Invalid task issue for visual intent');
  const path = join(cycleDirectory(root), `${Number(issue)}.json`);
  if (!existsSync(path)) return null;
  const entry = JSON.parse(readFileSync(path, 'utf8'));
  if (entry.issue !== Number(issue)) throw Error(`Visual intent issue mismatch: ${path}`);
  if (!entry.visual) return null;
  const visual = validateVisualIntent(entry.visual, issue);
  return visual.baselineIndex === baselineIndexHash(root) ? { ...visual, issue: Number(issue) } : null;
}

export function readPendingVisualIntents({ root = process.cwd() } = {}) {
  const directory = cycleDirectory(root), baselineIndex = baselineIndexHash(root);
  const entries = existsSync(directory) ? readdirSync(directory).filter(f => /^[1-9]\d*\.json$/.test(f)).sort() : [];
  const intents = [];
  for (const file of entries) {
    const entry = JSON.parse(readFileSync(join(directory, file), 'utf8'));
    if (!entry.visual) continue;
    const issue = Number(file.slice(0, -5));
    if (entry.issue !== issue) throw Error(`Visual intent issue mismatch: ${file}`);
    const visual = validateVisualIntent(entry.visual, issue);
    if (visual.baselineIndex === baselineIndex) intents.push({ ...visual, issue });
  }
  const golden = intents.flatMap(intent => intent.golden.map(item => ({ ...item, issue: intent.issue })));
  const expectations = new Map();
  for (const item of golden) {
    if (expectations.has(item.id) && expectations.get(item.id) !== item.expectation)
      throw Error(`Conflicting pending visual expectations for ${item.id}`);
    expectations.set(item.id, item.expectation);
  }
  return { schema: 1, baselineIndex, intents, golden,
    expectChange: [...expectations].filter(([, value]) => value === 'change').map(([id]) => id).sort(),
    expectNew: [...expectations].filter(([, value]) => value === 'new').map(([id]) => id).sort() };
}

export function acceptanceExpectations(pending, { change = '', added = '' } = {}) {
  const parse = value => String(value).split(',').map(id => id.trim()).filter(Boolean);
  const expectChange = [...new Set([...pending.expectChange, ...parse(change)])].sort();
  const expectNew = [...new Set([...pending.expectNew, ...parse(added)])].sort();
  for (const id of [...expectChange, ...expectNew]) if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
    throw Error(`Invalid acceptance scene ID: ${id}`);
  if (expectChange.some(id => expectNew.includes(id))) throw Error('Scene declared both changed and new');
  return { expectChange, expectNew };
}

if (isMainModule(import.meta.url)) {
  if (process.argv.includes('--baseline-index')) console.log(baselineIndexHash());
  else if (process.argv.includes('--acceptance')) {
    const pending = readPendingVisualIntents();
    const expected = acceptanceExpectations(pending, { change: process.env.EXPECT_CHANGE, added: process.env.EXPECT_NEW });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `expect_change=${expected.expectChange.join(',')}\nexpect_new=${expected.expectNew.join(',')}\n`);
    console.log(JSON.stringify({ ...expected, intents: pending.golden }, null, 2));
  }
  else console.log(JSON.stringify(readPendingVisualIntents(), null, 2));
}
