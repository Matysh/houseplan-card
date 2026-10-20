#!/usr/bin/env node
// #982: one computed partition for CI and the local gate. No filename allowlist.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, posix } from 'node:path';
import { closure, trackedFiles, stripComments, referencesOf } from './check-inputs.mjs';
import { relativeDependencies, scanJavaScript } from './relative-dependencies.mjs';
import { portableCommand, isMainModule } from './spawn-portable.mjs';

export function unitGroups(root = process.cwd(), { tracked = trackedFiles(root), read = p => readFileSync(join(root, p), 'utf8'), tests = null } = {}) {
  tests = tests || readdirSync(join(root, 'test')).filter(f => f.endsWith('.test.mjs')).map(f => 'test/' + f).sort();
  const groups = { product: [], tooling: [] };
  const unclassified = [];
  const dependencies = {};
  const references = new Map(), source = new Map(), productInputs = new Map();
  const dynamicConsumers = new Set();
  const allTracked = [...new Set([...tracked, ...tests])];
  const readOnce = p => { if (!source.has(p)) source.set(p, read(p)); return source.get(p); };
  const isProductInput = p => {
    if (!productInputs.has(p)) {
      const product = /^(src|test-build|dist|custom_components)\//.test(p) || dynamicConsumers.has(p);
      productInputs.set(p, product);
    }
    return productInputs.get(p);
  };
  // Import closure, plus paths resolved against import.meta.url. Strings naming
  // files in a temporary repository are fixture data, not imports of the real
  // product. In particular a tooling module's root-relative input manifest must
  // not make all its callers product consumers.
  const dependencyReferences = p => {
    if (references.has(p)) return;
    const text = readOnce(p), code = stripComments(p, text);
    const { tokens } = scanJavaScript(text);
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].kind === 'identifier' && tokens[i].value === 'import' && tokens[i + 1]?.value === '('
        && tokens[i + 2]?.kind !== 'string') dynamicConsumers.add(p);
    }
    const paths = new Set(relativeDependencies(text));
    const urls = new Set();
    for (const m of code.matchAll(/new\s+URL\(\s*(['"`])([^'"`\n]+?)\1\s*,\s*import\.meta\.url\s*,?\s*\)/g)) urls.add(m[2]);
    const edges = new Set(), data = new Set();
    for (const path of new Set([...paths, ...urls])) {
      if (!path.startsWith('.')) continue;
      let rel = posix.normalize(posix.join(posix.dirname(p), path.split(/[?#]/)[0]));
      const dynamicAt = rel.indexOf('${');
      if (dynamicAt >= 0) rel = rel.slice(0, dynamicAt);
      if (!rel || rel === './' || rel === '.') continue;
      if (rel.startsWith('test-build/')) rel = rel.replace(/^test-build\//, 'src/').replace(/\.js$/, '.ts');
      const candidates = new Set([rel, `${rel}.mjs`, `${rel}.js`, `${rel}.ts`, `${rel}/index.mjs`]);
      for (const f of allTracked) if (candidates.has(f) || (rel.endsWith('/') && f.startsWith(rel))) (paths.has(path) ? edges : data).add(f);
    }
    if ([...edges, ...data].every(f => f === p)) {
      const fallback = referencesOf(p, text);
      for (const path of fallback.data) if (allTracked.includes(path)) data.add(path);
      for (const path of fallback.code) if (allTracked.includes(path)) edges.add(path);
      for (const m of code.matchAll(/join\(\s*\w+\s*,\s*['"](test|scripts|\.github|docs|src)['"]\s*\)/g)) {
        for (const f of allTracked) if (f.startsWith(`${m[1]}/`)) data.add(f);
      }
    }
    references.set(p, { code: [...edges], data: [...data] });
    for (const child of edges) if (/\.(mjs|js|cjs|ts)$/.test(child)) dependencyReferences(child);
  };
  for (const file of tests) {
    dependencyReferences(file);
    const inputs = closure(root, [file], { tracked: allTracked, read: readOnce, references });
    dependencies[file] = inputs;
    // A producer/bundle consumer is never run before build. Unreadable or
    // unresolved dynamic module dependencies are conservative product cases.
    const product = inputs.some(isProductInput);
    if (inputs.length === 1) unclassified.push(file);
    groups[product ? 'product' : 'tooling'].push(file);
  }
  if (unclassified.length) throw new Error(`unclassified tests without repository inputs: ${unclassified.join(', ')}`);
  return { ...groups, tests, dependencies };
}
export function groupsAffectedBy(files, grouping) {
  const result = new Set();
  for (const file of files) {
    if (/\.md$|^docs\//.test(file)) continue;
    if (/^(?:src|custom_components|demo|assets)\//.test(file)) { result.add('product'); continue; }
    if (/^(?:scripts|\.github|\.githooks)\//.test(file)) { result.add('tooling'); continue; }
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
      authority: 'computed required partition; unknown diff selects both groups' }, null, 2));
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
