#!/usr/bin/env node
// #954: only closed, side-effect-free product units may cross a Git commit.
// Git/FS/process/dynamic consumers always run fresh, including process guards.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unitGroups } from './unit-groups.mjs';
import { stripComments, BUILD_INPUTS, globToRegExp, closure } from './check-inputs.mjs';
import { isMainModule } from './spawn-portable.mjs';

export function frontendUnitPlan(root = process.cwd(), options = {}) {
  const reader = options.reader;
  const grouping = options.grouping || unitGroups(root, reader ? { tracked: reader.tracked, read: reader.text,
    tests: reader.tracked.filter(p => /^test\/[^/]+\.test\.mjs$/.test(p)).sort() } : {});
  const read = options.read || reader?.text || (p => readFileSync(join(root, p), 'utf8'));
  const reusable = [], fresh = [], unsafeInputs = new Map();
  const unsafeInput = path => {
    if (unsafeInputs.has(path)) return unsafeInputs.get(path);
    let unsafe = false;
    if (/\.(mjs|js|cjs|ts)$/.test(path)) {
      try {
        const code = stripComments(path, read(path));
        if (/(?:node:)?(?:fs(?:\/promises)?|child_process|worker_threads)['"]|\bprocess\s*[.[]|\b(?:readFileSync|execFileSync|spawnSync)\b|import\(\s*[^'"`\s]/.test(code)) unsafe = true;
        for (const match of code.matchAll(/import\(([^)]*)\)/g)) {
          if (!/^\s*(['"])(?:\.{1,2}\/|node:(?:assert|test))[^'"\n]+\1\s*$/.test(match[1])) unsafe = true;
        }
      } catch { unsafe = true; }
    }
    unsafeInputs.set(path, unsafe);
    return unsafe;
  };
  for (const file of grouping.tests) {
    let pure = grouping.product.includes(file);
    if ((grouping.dependencies[file] || []).some(unsafeInput)) pure = false;
    (pure ? reusable : fresh).push(file);
  }
  return { reusable, fresh };
}

export function reusableFrontendInputs(root, reader) {
  const tests = reader.tracked.filter(p => /^test\/[^/]+\.test\.mjs$/.test(p)).sort();
  const grouping = unitGroups(root, { tracked: reader.tracked, read: reader.text, tests });
  const plan = frontendUnitPlan(root, { grouping, read: reader.text });
  const roots = [...BUILD_INPUTS, 'assets/**', 'demo/fixtures/**', 'demo/golden/*.mjs', 'demo/docs/*.mjs',
    'tsconfig*.json', '.nvmrc', '.python-version', '.github/workflows/validate.yml',
    'scripts/frontend-proof.mjs', 'scripts/frontend-units.mjs', 'scripts/content-inputs.mjs',
    'scripts/check-inputs.mjs', 'scripts/relative-dependencies.mjs', 'scripts/unit-groups.mjs', 'scripts/fix-test-build.mjs'];
  const matchers = roots.map(globToRegExp);
  const files = reader.tracked.filter(p => matchers.some(re => re.test(p)));
  const reached = closure(root, files.filter(p => /\.(mjs|ts)$/.test(p) && !p.startsWith('demo/')), { tracked: reader.tracked, read: reader.text });
  return [...new Set([...files, ...reached, ...plan.reusable.flatMap(p => grouping.dependencies[p] || [p])])].sort();
}

if (isMainModule(import.meta.url)) {
  const plan = frontendUnitPlan();
  const group = process.argv.find(a => a.startsWith('--group='))?.slice(8);
  if (process.argv.includes('--plan')) console.log(JSON.stringify(plan, null, 2));
  else if (!['fresh', 'reusable'].includes(group)) { console.error('frontend-units --group=fresh|reusable | --plan'); process.exitCode = 2; }
  else if (plan[group].length) {
    const result = spawnSync(process.execPath, ['--test', ...plan[group]], { stdio: 'inherit' });
    process.exitCode = result.status ?? 1;
  }
}
