import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { TraceMap, decodedMappings } from '@jridgewell/trace-mapping';
import ts from 'typescript';
import { identifyScript, walkFiles, COVERAGE_SCHEMA, digestBytes } from './coverage-identity.mjs';
import { lineOffsets } from './coverage-maps.mjs';

const json = path => JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path, 'utf8'));
export function diagnosticCompleteness(inventory, invocations, index) {
  const reasons = [...index.issues];
  const byId = new Map(invocations.map(c => [c.id, c]));
  for (const expected of inventory.cases) {
    const actual = byId.get(expected.id);
    if (!actual || actual.status !== 'completed') reasons.push({ case: expected.id, reason: actual?.status || 'not-executed' });
    if (actual?.issues?.length) reasons.push(...actual.issues.map(issue => ({ ...issue, case: actual.id })));
  }
  if (byId.size !== inventory.cases.length || invocations.length !== byId.size) reasons.push({ reason: 'inventory-mismatch' });
  return { complete: reasons.length === 0, reasons };
}

/** Preserve native V8 function/block semantics; source-map points are witnesses,
 * not guessed TS execution. Unmapped/generated spans stay unknown. */
export function buildCoverageReport({ root = process.cwd(), artifactDir, rawRoot = artifactDir, inventory, invocations, index }) {
  const rows = new Map(), issues = [], actualScripts = [], cache = new Map(), observedScripts = new Map(), staleSources = new Set();
  for (const file of index.files) for (const source of file.sources.filter(source => source.product)) {
    const path = resolve(root, source.path);
    try { if (digestBytes(readFileSync(path)) !== source.contentHash) staleSources.add(source.path); }
    catch { staleSources.add(source.path); }
  }
  for (const path of staleSources) issues.push({ reason: 'current-source-differs-from-captured-candidate', path });
  const read = path => { try { return json(path); } catch (error) {
    issues.push({ reason: 'unreadable-raw-payload', path, detail: String(error) }); return {};
  } };
  const mapped = file => {
    if (cache.has(file.path)) return cache.get(file.path);
    const js = readFileSync(resolve(artifactDir, 'build', file.path), 'utf8');
    const raw = readFileSync(resolve(artifactDir, 'build', `${file.path}.map`), 'utf8');
    if (digestBytes(js) !== file.jsHash || digestBytes(raw) !== file.mapHash) throw Error(`Changed captured build: ${file.path}`);
    const map = new TraceMap(JSON.parse(raw)), starts = lineOffsets(js), points = [];
    decodedMappings(map).forEach((segments, line) => segments.forEach(s => {
      const source = file.sources.find(source => source.index === s[1]);
      if (s.length >= 4 && source?.product) points.push({ offset: starts[line] + s[0], path: source.path, line: s[2] + 1, column: s[3] });
    }));
    cache.set(file.path, points); return points;
  };
  const observe = (script, source, family, owner) => {
    const identity = identifyScript(index, { url: script.url, source });
    const hash = identity.hash || (typeof source === 'string' ? digestBytes(source) : null);
    const observedKey = `${family}:${script.url}:${identity.status}:${hash || ''}`;
    if (!observedScripts.has(observedKey)) observedScripts.set(observedKey, {
      family, url: script.url, status: identity.status, reason: identity.reason, actualSourceHash: hash, samples: 0, owners: [],
    });
    const observed = observedScripts.get(observedKey); observed.samples++;
    if (observed.owners.length < 12 && !observed.owners.includes(owner)) observed.owners.push(owner);
    if (identity.status === 'external') return;
    if (identity.status !== 'verified') { issues.push({ ...identity, owner }); return; }
    actualScripts.push({ owner, family, url: script.url, path: identity.canonical, jsHash: identity.hash });
    let points;
    try { points = mapped(identity.file); } catch (error) {
      issues.push({ reason: 'invalid-captured-map', path: identity.file.path, detail: String(error) }); return;
    }
    for (const fn of script.functions || []) {
      if (!Array.isArray(fn.ranges) || !fn.ranges.length) { issues.push({ reason: 'missing-native-ranges', owner }); continue; }
      fn.ranges.forEach((range, n) => {
        const witness = points.filter(p => p.offset >= range.startOffset && p.offset < range.endOffset);
        if (!witness.length) return; // Generated facades and dependency-only functions have no src witness.
        const first = witness[0], last = witness.findLast(p => p.path === first.path);
        const kind = n === 0 ? (range.startOffset === 0 && range.endOffset === source.length ? 'script' : 'function') : 'branch';
        const key = `${first.path}:${first.line}:${first.column}:${last.line}:${last.column}:${kind}:${fn.functionName || ''}`;
        if (!rows.has(key)) rows.set(key, { path: first.path, line: first.line, column: first.column,
          endLine: last.line, endColumn: last.column, kind, name: fn.functionName || '(anonymous)',
          unit: null, smoke: null, golden: null, witnesses: [] });
        const row = rows.get(key);
        row[family] = Math.max(row[family] ?? 0, range.count);
        if (row.witnesses.length < 12) row.witnesses.push({ owner, jsHash: identity.hash,
          startOffset: range.startOffset, endOffset: range.endOffset, blockCoverage: fn.isBlockCoverage === true });
      });
    }
  };
  for (const invocation of invocations) {
    if (!invocation.directory) continue;
    invocation.pages = []; invocation.browsers = [];
    const dir = resolve(rawRoot, invocation.directory), files = walkFiles(dir);
    const sources = new Map();
    for (const path of files.filter(p => /node-sources-.*\.json(?:\.gz)?$/.test(p))) {
      const parsed = read(path); sources.set(`${parsed.pid}-${parsed.threadId}`, parsed.sources || {});
    }
    const recorders = files.filter(p => /recorder-.*\.json(?:\.gz)?$/.test(p)).map(read);
    if (!recorders.length) invocation.issues.push({ reason: 'missing-recorder' });
    for (const meta of recorders) {
      invocation.issues.push(...(meta.issues || []));
      invocation.pages.push(...(meta.pages || []).map(page => ({ ...page, pid: meta.pid, threadId: meta.threadId })));
      invocation.browsers.push(...(meta.browsers || []));
      if (!meta.ended || meta.exitCode !== 0) invocation.issues.push({ reason: 'recorder-not-finalized', pid: meta.pid });
      for (const page of meta.pages || []) {
        if (!page.early || !page.saved || page.error || !page.raw?.length
          || page.raw.some(name => !files.some(path => path.endsWith(`/${name}`) || path.endsWith(`\\${name}`)
            || path.endsWith(`/${name}.gz`) || path.endsWith(`\\${name}.gz`)))) {
          invocation.issues.push({ reason: 'incomplete-page-payload', page: page.id });
        }
      }
    }
    for (const path of files.filter(p => /(?:^|[/\\])coverage-(\d+)-(\d+)-(\d+)\.json(?:\.gz)?$/.test(p))) {
      const [, pid, , thread] = path.match(/coverage-(\d+)-(\d+)-(\d+)\.json/);
      const source = sources.get(`${pid}-${thread}`) || {};
      for (const script of read(path).result || []) observe(script, source[script.scriptId]?.source, invocation.family, invocation.id);
    }
    for (const path of files.filter(p => /browser-.*\.json(?:\.gz)?$/.test(p))) {
      for (const script of read(path).entries || []) observe(script, script.source, invocation.family, invocation.id);
    }
  }
  const completeness = diagnosticCompleteness(inventory, invocations, { ...index, issues: [...index.issues, ...issues] });
  const observed = [...rows.values()].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column);
  // A separate TS function inventory exposes unloaded modules as unknown. It
  // never manufactures a zero by seeing another file or a parent's script range.
  const functions = [];
  for (const path of walkFiles(resolve(root, 'src')).filter(p => p.endsWith('.ts'))) {
    const text = readFileSync(path, 'utf8'), ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const definitions = [], rel = path.slice(resolve(root).length + 1).replaceAll('\\', '/');
    const visit = node => {
      if (ts.isFunctionLike(node) && node.body) {
        const start = ast.getLineAndCharacterOfPosition(node.getStart(ast)), end = ast.getLineAndCharacterOfPosition(node.end);
        definitions.push({ path: rel, line: start.line + 1, column: start.character, endLine: end.line + 1,
          name: node.name?.getText(ast) || '(anonymous)', start: node.getStart(ast), end: node.end, witnesses: [] });
      }
      ts.forEachChild(node, visit);
    }; visit(ast);
    const starts = lineOffsets(text);
    for (const row of observed.filter(r => r.path === rel && r.kind === 'function')) {
      const at = starts[row.line - 1] + row.column;
      const owner = definitions.filter(d => d.start <= at && at < d.end).sort((a, b) => a.end - a.start - (b.end - b.start))[0];
      owner?.witnesses.push(row);
    }
    for (const definition of definitions) {
      const { start, end, witnesses, ...location } = definition;
      const field = family => staleSources.has(rel) ? 'unknown' : witnesses.some(r => r[family] > 0) ? 'observed'
        : completeness.complete && witnesses.some(r => r[family] === 0) ? 'zero-observed' : 'unknown';
      functions.push({ ...location, unit: field('unit'), smoke: field('smoke'), golden: field('golden') });
    }
  }
  for (const row of observed) for (const family of ['unit', 'smoke', 'golden']) {
    row[family] = row[family] > 0 ? { status: 'observed', maxCount: row[family] }
      : row[family] === 0 && completeness.complete ? { status: 'zero-observed', maxCount: 0 } : { status: 'unknown' };
  }
  return { schema: COVERAGE_SCHEMA, authority: 'diagnostic-only', semanticApproval: false,
    identity: index.identity, inventoryDigest: inventory.digest, completeness, actualScripts, observedScripts: [...observedScripts.values()],
    functions, nativeMappedRanges: observed, invocations,
    files: walkFiles(resolve(root, 'src')).filter(path => path.endsWith('.ts')).map(path => path.slice(resolve(root).length + 1).replaceAll('\\', '/')).map(path => ({ path,
      functions: functions.filter(f => f.path === path).length,
      mappedBranches: observed.filter(r => r.path === path && r.kind === 'branch').length,
      unit: functions.some(f => f.path === path && f.unit === 'observed') ? 'observed' : 'unknown',
      smoke: functions.some(f => f.path === path && f.smoke === 'observed') ? 'observed' : 'unknown',
      golden: functions.some(f => f.path === path && f.golden === 'observed') ? 'observed' : 'unknown',
      mappedScriptsLoaded: ['unit', 'smoke', 'golden'].filter(family => actualScripts.some(script => script.family === family
        && index.files.find(file => file.path === script.path)?.sources.some(source => source.path === path))) })),
    interpretation: 'Native V8 functions and block ranges mapped to src; counts are maximum witnesses, not summed call counts. Unknown is never dead code. Zero is conditional on complete inventory and provenance; neither is removal approval.' };
}

export function coverageMarkdown(report) {
  const head = `# Diagnostic coverage\n\nSHA: ${report.identity.sha}\n\nCompleteness: **${report.completeness.complete ? 'complete' : 'incomplete / unknown'}**. Diagnostic only; no gate, CI proof, release verdict or removal approval.\n\n${report.interpretation}\n\n`;
  return head + '| src function | unit | smoke | golden |\n|---|---|---|---|\n'
    + report.functions.map(row => `| ${row.path}:${row.line} ${row.name.replaceAll('|', '\\|')} | ${row.unit} | ${row.smoke} | ${row.golden} |`).join('\n')
    + '\n\nMachine-readable native function/branch ranges, actual script identities, invocation outcomes and incomplete reasons are in report.json.\n';
}
