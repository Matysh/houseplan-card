// #1018: diagnostic maps follow the final bytes. Inserted text has no source.
import { GenMapping, addSegment, setSourceContent, toEncodedMap } from '@jridgewell/gen-mapping';
import { TraceMap, decodedMappings, originalPositionFor } from '@jridgewell/trace-mapping';
import { resolve } from 'node:path';

export const coverageMapsEnabled = () => process.env.HP_DIAGNOSTIC_COVERAGE === '1';
export const hashMapRecipe = 'houseplan-coverage-maps/v1';
// The TS plugin loads emitted maps against the original TS module, rather than
// its outDir/.ts location. An explicit root avoids that extra relative parent.
export const coverageTypeScriptOptions = (root = process.cwd()) => ({
  sourceMap: true, inlineSources: true, sourceRoot: resolve(root, 'src'),
});
export function lineOffsets(code) {
  const starts = [0];
  for (let n = 0; n < code.length; n++) if (code[n] === '\n') starts.push(n + 1);
  return starts;
}
export function positionAt(offset, starts) {
  let lo = 0, hi = starts.length;
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= offset) lo = mid; else hi = mid; }
  return { line: lo, column: offset - starts[lo] };
}
const jsonMap = map => map ? typeof map === 'string' ? JSON.parse(map) : JSON.parse(JSON.stringify(map)) : null;
export function rollupMap(map) {
  Object.defineProperty(map, 'toString', { value: () => JSON.stringify(map), configurable: true });
  return map;
}

/** Rewrite non-overlapping original offsets and compose an existing map. */
export function editMappedSource(code, edits, { id = '<source>', previous = null, generated = false } = {}) {
  const ordered = edits.filter(e => code.slice(e.start, e.end) !== e.text).sort((a, b) => a.start - b.start);
  let cursor = 0, output = '';
  for (const edit of ordered) {
    if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end) || edit.start < cursor
      || edit.end < edit.start || edit.end > code.length || typeof edit.text !== 'string') throw Error('Invalid source-map edit');
    output += code.slice(cursor, edit.start) + edit.text; cursor = edit.end;
  }
  output += code.slice(cursor);
  const oldStarts = lineOffsets(code), newStarts = lineOffsets(output), prior = jsonMap(previous);
  const trace = prior ? new TraceMap(prior) : null;
  const map = new GenMapping({ file: prior?.file || id, ...(prior?.sourceRoot ? { sourceRoot: prior.sourceRoot } : {}) });
  if (prior) prior.sources.forEach((source, i) => setSourceContent(map, source, prior.sourcesContent?.[i] ?? null));
  else if (!generated) setSourceContent(map, id, code);
  const points = new Map();
  const translate = offset => {
    let shift = 0;
    for (const edit of ordered) {
      if (offset < edit.start) break;
      if (offset < edit.end) return null;
      shift += edit.text.length - (edit.end - edit.start);
    }
    return offset + shift;
  };
  if (trace) {
    decodedMappings(trace).forEach((segments, line) => {
      for (const s of segments) {
        const oldOffset = oldStarts[line] + s[0], target = translate(oldOffset);
        if (target === null) continue;
        points.set(target, s.length < 4 ? null : { source: prior.sources[s[1]], line: s[2], column: s[3], name: prior.names?.[s[4]] });
      }
    });
  } else if (!generated) {
    // Initial TS transforms need identity at each copied UTF-16 position.
    for (let offset = 0, line = 0; offset <= code.length; offset++) {
      while (line + 1 < oldStarts.length && oldStarts[line + 1] <= offset) line++;
      const target = translate(offset);
      if (target !== null) points.set(target, { source: id, line, column: offset - oldStarts[line] });
    }
  }
  let shift = 0;
  for (const edit of ordered) {
    const start = edit.start + shift, end = start + edit.text.length;
    if (edit.text) points.set(start, null);
    const old = positionAt(edit.end, oldStarts);
    if (trace) {
      const original = originalPositionFor(trace, { line: old.line + 1, column: old.column });
      // TraceMap resolvedSources includes sourceRoot; retain the original source spelling.
      const sourceIndex = trace.resolvedSources.indexOf(original.source);
      if (!points.has(end)) points.set(end, sourceIndex < 0 ? null : {
        source: prior.sources[sourceIndex], line: original.line - 1, column: original.column, name: original.name,
      });
    } else if (!points.has(end)) points.set(end, generated ? null : { source: id, ...old });
    shift += edit.text.length - (edit.end - edit.start);
  }
  for (const [offset, original] of [...points].sort(([a], [b]) => a - b)) {
    const at = positionAt(offset, newStarts);
    if (!original) addSegment(map, at.line, at.column);
    else addSegment(map, at.line, at.column, original.source, original.line, original.column, original.name);
  }
  return { code: output, map: rollupMap(toEncodedMap(map)) };
}

function substitute(template, args) {
  const groups = typeof args.at(-1) === 'object' ? args.at(-1) : null;
  const offset = args[args.length - (groups ? 3 : 2)], input = args[args.length - (groups ? 2 : 1)];
  const captures = args.slice(1, args.length - (groups ? 3 : 2));
  return template.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]+>)/g, (token, name) => {
    if (name === '$') return '$';
    if (name === '&') return args[0];
    if (name === '`') return input.slice(0, offset);
    if (name === "'") return input.slice(offset + args[0].length);
    if (name.startsWith('<')) return groups ? groups[name.slice(1, -1)] ?? '' : token;
    const number = Number(name);
    if (number > 0 && number <= captures.length) return captures[number - 1] ?? '';
    const first = Number(name[0]);
    return name.length === 2 && first > 0 && first <= captures.length
      ? (captures[first - 1] ?? '') + name[1] : token;
  });
}
export function replacementEdits(code, pattern, replacement, all = false) {
  const edits = [];
  const replace = all ? String.prototype.replaceAll : String.prototype.replace;
  const output = replace.call(code, pattern, (...args) => {
    const offset = args[args.length - (typeof args.at(-1) === 'object' ? 3 : 2)];
    const text = typeof replacement === 'function' ? String(replacement(...args)) : substitute(String(replacement), args);
    edits.push({ start: offset, end: offset + args[0].length, text });
    return text;
  });
  return { edits, code: output };
}

/** Same replacement in normal builds; diagnostic mode also updates final map assets. */
export function replaceChunkSource(chunk, pattern, replacement, { all = false, coverage = coverageMapsEnabled(), bundle } = {}) {
  if (!coverage) { chunk.code = all ? chunk.code.replaceAll(pattern, replacement) : chunk.code.replace(pattern, replacement); return; }
  const { edits, code } = replacementEdits(chunk.code, pattern, replacement, all);
  if (!edits.length) return;
  const updated = editMappedSource(chunk.code, edits, { id: chunk.fileName, previous: chunk.map, generated: !chunk.map });
  if (updated.code !== code) throw Error(`Source-map replacement bytes differ: ${chunk.fileName}`);
  chunk.code = code; chunk.map = updated.map;
  const asset = bundle?.[`${chunk.fileName}.map`];
  if (asset) asset.source = JSON.stringify(updated.map);
}

export function diagnosticMapAssetsPlugin() {
  return {
    name: 'houseplan-diagnostic-map-assets',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle).filter(item => item.type === 'chunk')) {
        const map = jsonMap(chunk.map), asset = bundle[`${chunk.fileName}.map`];
        if (!map || !asset) throw Error(`Diagnostic final map missing: ${chunk.fileName}`);
        map.x_houseplan_coverage_recipe = hashMapRecipe;
        chunk.map = rollupMap(map); asset.source = JSON.stringify(map);
      }
    },
  };
}
