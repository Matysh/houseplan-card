#!/usr/bin/env node
// Resolve the complete push/PR range; never HEAD~1 for a multi-commit push.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { profilesForFiles } from './ci-profile-paths.mjs';
import { isMainModule } from './spawn-portable.mjs';

export function eventFiles({ before, base, head = 'HEAD', event = 'push' }, run = execFileSync) {
  const start = event === 'pull_request' ? base : before;
  if (!/^[a-f0-9]{40}$/.test(start || '') || /^0+$/.test(start)) throw Error('unproven event base');
  return run('git', ['diff', '--no-renames', '--name-only', '-z', start, head], { encoding: 'utf8' }).split('\0').filter(Boolean);
}
export function eventProfilePlan(input, run = execFileSync) {
  try {
    const files = eventFiles(input, run);
    return { profiles: profilesForFiles(files), integration: files.some(f => f.startsWith('.github/')), files, proven: true };
  } catch { return { profiles: ['product', 'tooling', 'docs'], integration: true, files: [], proven: false }; }
}
// A product workflow that actually ran supplies product authority even when a
// rebased candidate range now contains only tooling/docs. Companion obligations
// still come from that complete range; no consumer rule is relaxed (#1060).
export function producerProfilePlan(plan, producer) {
  return producer === 'product' ? { ...plan, profiles: ['product', ...plan.profiles.filter(p => p !== 'product')] } : plan;
}
if (isMainModule(import.meta.url)) {
  let before = process.env.BEFORE_SHA, base = process.env.BASE_SHA;
  if (process.argv.includes('--candidate') && /^issue\//.test(process.env.GITHUB_REF_NAME || '')) {
    try { before = base = execFileSync('git', ['merge-base', 'origin/dev', 'HEAD'], { encoding: 'utf8' }).trim(); }
    catch { before = base = ''; }
  }
  const plan = producerProfilePlan(eventProfilePlan({ before, base,
    head: process.env.HEAD_SHA || 'HEAD', event: process.env.EVENT_NAME }),
  process.argv.includes('--producer=product') ? 'product' : null);
  const output = `profiles=${JSON.stringify(plan.profiles)}\nintegration=${plan.integration}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  console.log(output.trim());
}
