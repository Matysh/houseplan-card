#!/usr/bin/env node
// #982: one computed partition for CI and the local gate. No filename allowlist.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, posix } from 'node:path';
import { closure, trackedFiles, referencesOf, LEAF_FILES } from './check-inputs.mjs';
import { relativeDependencies } from './relative-dependencies.mjs';
import ts from 'typescript';
import { portableCommand, isMainModule } from './spawn-portable.mjs';

export function unitGroups(root = process.cwd(), { tracked = trackedFiles(root), read = p => readFileSync(join(root, p), 'utf8'), tests = null } = {}) {
  tests = tests || readdirSync(join(root, 'test')).filter(f => f.endsWith('.test.mjs')).map(f => 'test/' + f).sort();
  const groups = { product: [], tooling: [] };
  const unclassified = [];
  const dependencies = {};
  const ownership = {};
  const references = new Map(), source = new Map(), productInputs = new Map();
  const dynamicConsumers = new Set();
  const allTracked = [...new Set([...tracked, ...tests])];
  const trackedSet = new Set(allTracked);
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
    if (LEAF_FILES.has(p)) { references.set(p, { code: [], data: [] }); return; }
    const text = readOnce(p);
    const paths = new Set(relativeDependencies(text));
    const urls = new Set();
    const joinedRoots = new Set();
    const literals = new Set(), processEntries = new Set();
    let computedScriptEntry = false;
    const ast = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, false,
      p.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    const literal = node => node && (ts.isStringLiteralLike(node) ? node.text
      : ts.isTemplateExpression(node) ? node.head.text : null);
    const visit = node => {
      if (ts.isStringLiteralLike(node)) literals.add(node.text);
      if (ts.isTemplateExpression(node) && node.head.text === 'scripts/'
        && node.templateSpans.length === 1 && node.templateSpans[0].literal.text === '.mjs') computedScriptEntry = true;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && !ts.isStringLiteralLike(node.arguments[0])) dynamicConsumers.add(p);
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
        && node.arguments?.[1]?.getText(ast).replace(/\s+/g, '') === 'import.meta.url') {
        const value = literal(node.arguments[0]);
        if (value !== null) urls.add(value);
      }
      if (ts.isCallExpression(node) && (ts.isIdentifier(node.expression) && node.expression.text === 'join'
        || ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join')) {
        const value = literal(node.arguments[1]);
        if (['test', 'scripts', '.github', 'docs', 'src'].includes(value)) joinedRoots.add(value);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    // A test's literal CLI table is executable input too: runNode([`scripts/
    // ${name}.mjs`]) can import emitted production even without a JS import in
    // the test. Resolve known names without running the CLI or guessing a test.
    if (p.startsWith('test/') && /['"]node:child_process['"]/.test(text)) {
      for (const value of literals) {
        if (/^scripts\/[\w/-]+\.mjs$/.test(value) && trackedSet.has(value)) processEntries.add(value);
        if (computedScriptEntry && /^[\w-]+$/.test(value) && trackedSet.has(`scripts/${value}.mjs`)) processEntries.add(`scripts/${value}.mjs`);
      }
    }
    const edges = new Set(processEntries), data = new Set();
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
      for (const directory of joinedRoots) {
        for (const f of allTracked) if (f.startsWith(`${directory}/`)) data.add(f);
      }
    }
    references.set(p, { code: [...edges], data: [...data] });
    for (const child of edges) if (/\.(mjs|js|cjs|ts)$/.test(child)) dependencyReferences(child);
  };
  for (const file of tests) {
    dependencyReferences(file);
    const inputs = closure(root, [file], { tracked: allTracked, read: readOnce, references });
    dependencies[file] = inputs;
    // A tool may inspect product files as its dataset without importing the
    // product. Follow code edges for ownership; direct test/helper source reads
    // still protect real source contracts. Opaque imports require the producer.
    const codeInputs = new Set(), queue = [file];
    while (queue.length) {
      const entry = queue.pop();
      if (codeInputs.has(entry)) continue;
      codeInputs.add(entry);
      queue.push(...(references.get(entry)?.code || []));
    }
    const codeReasons = [...codeInputs].filter(entry => /^(src|test-build|dist|custom_components)\//.test(entry)
      || entry.startsWith('test/') && dynamicConsumers.has(entry));
    const readReasons = [...codeInputs].filter(entry => entry.startsWith('test/'))
      .flatMap(entry => (references.get(entry)?.data || []).filter(isProductInput));
    const toolConsumer = [...codeInputs].some(entry => /^(scripts|\.github)\//.test(entry));
    const product = codeReasons.length > 0 || !toolConsumer && readReasons.length > 0;
    ownership[file] = { code: codeReasons, reads: [...new Set(readReasons)] };
    if (inputs.length === 1) unclassified.push(file);
    groups[product ? 'product' : 'tooling'].push(file);
  }
  if (unclassified.length) throw new Error(`unclassified tests without repository inputs: ${unclassified.join(', ')}`);
  return { ...groups, tests, dependencies, ownership };
}
export function groupsAffectedBy(files, grouping) {
  const result = new Set();
  for (const file of files) {
    if (/\.md$|^docs\//.test(file)) continue;
    if (/^(?:src|custom_components|demo|assets)\//.test(file)) { result.add('product'); continue; }
    // Tool paths can also be runtime inputs of product tests. The computed
    // consumers decide their required groups; an unowned tool fails closed.
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
