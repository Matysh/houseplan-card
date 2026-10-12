#!/usr/bin/env node
// #856: optional local loops. Neither subset is a substitute for gate:small.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { closure, trackedFiles, stripComments } from './check-inputs.mjs';
import { portableCommand, isMainModule } from './spawn-portable.mjs';

export function unitGroups(root = process.cwd(), { tracked = trackedFiles(root), read = p => readFileSync(join(root, p), 'utf8') } = {}) {
  const tests = readdirSync(join(root, 'test')).filter(f => f.endsWith('.test.mjs')).map(f => 'test/' + f).sort();
  const groups = { product: [], tooling: [] };
  const dependencies = {};
  const references = new Map(), source = new Map();
  const readOnce = p => { if (!source.has(p)) source.set(p, read(p)); return source.get(p); };
  for (const file of tests) {
    const inputs = closure(root, [file], { tracked: [...new Set([...tracked, ...tests])], read: readOnce, references });
    dependencies[file] = inputs;
    // A producer/bundle consumer is never run before build. Unreadable or
    // unresolved dynamic module dependencies are conservative product cases.
    const product = inputs.some(p => {
      if (/^(src|test-build|dist)\//.test(p)) return true;
      if (!/\.(mjs|js|cjs|ts)$/.test(p)) return false;
      try {
        const code = stripComments(p, readOnce(p));
        return /(?:test-build|\bdist)(?:\/|['"])/.test(code) || /import\(\s*[^'"`\s]/.test(code);
      } catch { return true; }
    });
    groups[product ? 'product' : 'tooling'].push(file);
  }
  return { ...groups, tests, dependencies };
}
export function groupsAffectedBy(files, grouping) {
  const result = new Set();
  for (const file of files) {
    const tests = grouping.tests.filter(t => grouping.dependencies[t]?.includes(file));
    if (!tests.length && !/^(?:docs\/|README|PROCESS\.md|AGENTS\.md)/.test(file)) return ['product', 'tooling'];
    for (const t of tests) result.add(grouping.product.includes(t) ? 'product' : 'tooling');
  }
  return [...result].sort();
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const group = arg('group');
  const grouping = unitGroups();
  if (process.argv.includes('--plan')) {
    const base = arg('base') || 'origin/dev';
    const files = execFileSync('git', ['diff', '--name-only', base], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    files.push(...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean));
    console.log(JSON.stringify({ base, files, suggested: groupsAffectedBy(files, grouping),
      product: grouping.product.length, tooling: grouping.tooling.length,
      authority: 'local diagnostic only; full required union is gate:small' }, null, 2));
  } else if (process.argv.includes('--list')) console.log(JSON.stringify(grouping, null, 2));
  else if (!['product', 'tooling'].includes(group)) { console.error('unit-groups --group=product|tooling | --plan [--base=ref]'); process.exitCode = 2; }
  else {
    const steps = group === 'product' ? [['npx', ['tsc', '-p', 'tsconfig.test.json']],
      [process.execPath, ['scripts/fix-test-build.mjs']]] : [];
    if (grouping[group].length) steps.push([process.execPath, ['--test', ...grouping[group]]]);
    for (const [command, args] of steps) {
      const { cmd, shell } = portableCommand(command);
      const r = spawnSync(cmd, args, { shell, stdio: 'inherit' });
      if (r.status !== 0 || r.error) { process.exitCode = r.status || 1; break; }
    }
  }
}
