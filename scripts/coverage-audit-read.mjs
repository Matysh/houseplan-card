#!/usr/bin/env node
// Bounded access to the frozen #1018 review artifact, never a current-source
// coverage/CI verdict. Verify both representations before decoding a query.
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { digestBytes } from './coverage-identity.mjs';
import { isMainModule } from './spawn-portable.mjs';

const PREFIX = 'docs/audits/parallel-paths-1018-before';
const MAX_COMPRESSED = 8 * 1024 ** 2, MAX_PLAIN = 32 * 1024 ** 2, MAX_OUTPUT = 32768;
const boundedRead = (path, limit) => {
  if (statSync(path).size > limit) throw Error('Audit input exceeds the bounded reader limit');
  return readFileSync(path);
};
const boundedResult = value => {
  if (Buffer.byteLength(JSON.stringify(value, null, 2)) > MAX_OUTPUT) throw Error('Query exceeds the output budget; reduce --limit');
  return value;
};
export function readCoverageAudit({ root = process.cwd(), file, fn, line, limit = 10 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw Error('limit must be 1..30');
  if (file && (file.length > 512 || !file.startsWith('src/') || file.split('/').some(part => !part || part === '..' || part === '.'))) throw Error('Use an exact src/ path');
  if (fn && (!file || fn.length > 128)) throw Error('A function query requires an exact file and a bounded name');
  if (line !== undefined && (!file || !Number.isInteger(line) || line < 1 || line > 1000000)) throw Error('A line query requires an exact file and a positive line');
  const metadata = JSON.parse(boundedRead(resolve(root, `${PREFIX}-map-meta.json`), 65536));
  const summary = JSON.parse(boundedRead(resolve(root, `${PREFIX}.json`), 1024 ** 2));
  const head = { authority: 'diagnostic-only', semanticApproval: false,
    captureSha: metadata.identity.sha, projectorSha: metadata.identity.projection.projectorSha,
    complete: metadata.complete, safeZeroEnabled: metadata.safeZeroEnabled,
    counts: metadata.counts, outcomes: summary.outcomes, incompleteReasons: summary.completeness.reasonCounts,
    compressedSha256: metadata.compressed.sha256, plainSha256: metadata.plain.sha256 };
  if (!file) return boundedResult({ ...head, integrity: 'metadata-only; file queries verify compressed and plain bytes' });
  if (metadata.plain.bytes > MAX_PLAIN || metadata.compressed.bytes > MAX_COMPRESSED) throw Error('Declared audit exceeds the decode budget');
  const compressed = boundedRead(resolve(root, `${PREFIX}-map.json.gz`), MAX_COMPRESSED);
  if (compressed.length !== metadata.compressed.bytes || digestBytes(compressed) !== metadata.compressed.sha256) throw Error('Compressed audit identity mismatch');
  const plain = gunzipSync(compressed, { maxOutputLength: MAX_PLAIN });
  if (plain.length !== metadata.plain.bytes || digestBytes(plain) !== metadata.plain.sha256) throw Error('Plain audit identity mismatch');
  const map = JSON.parse(plain), pathId = map.strings.indexOf(file);
  if (map.identity.sha !== metadata.identity.sha || map.identity.projection.projectorSha !== metadata.identity.projection.projectorSha
      || map.completeness.complete !== metadata.complete) throw Error('Audit material identity mismatch');
  const functions = map.functions.filter(row => row[0] === pathId && (!fn || map.strings[row[4]] === fn)
    && (line === undefined || row[1] <= line && line <= row[3]));
  const ranges = map.ranges.filter(row => row[0] === pathId && (!fn || functions.some(f => f[1] <= row[1] && row[1] <= f[3]))
    && (line === undefined || row[1] <= line && line <= row[3]));
  const status = count => {
    if (count === 0 && !metadata.complete) throw Error('Incomplete audit cannot expose a safe zero');
    return count === null ? { status: 'unknown' } : { status: count > 0 ? 'observed' : 'zero-observed', maxCount: count };
  };
  const result = { ...head, integrity: 'compressed-and-plain verified', file, function: fn || null, line: line ?? null, matchingFunctions: functions.length, matchingNativeRanges: ranges.length,
    functions: functions.slice(0, limit).map(row => ({ line: row[1], column: row[2], endLine: row[3], name: map.strings[row[4]],
      unit: row[5], smoke: row[6], golden: row[7] })),
    nativeRanges: ranges.slice(0, limit).map(row => ({ line: row[1], column: row[2], endLine: row[3], endColumn: row[4],
      kind: map.strings[row[5]], name: map.strings[row[6]], unit: status(row[7]), smoke: status(row[8]), golden: status(row[9]),
      witnessReferences: row[10].slice(0, 3).map(id => { const w = map.witnesses[id]; return {
        owner: map.strings[w[0]], jsSha256: map.strings[w[1]], startOffset: w[2], endOffset: w[3], blockCoverage: w[4] }; }) })) };
  return boundedResult(result);
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
  try { console.log(JSON.stringify(readCoverageAudit({ file: arg('file'), fn: arg('function'),
    line: arg('line') === undefined ? undefined : Number(arg('line')),
    limit: arg('limit') === undefined ? 10 : Number(arg('limit')) }), null, 2)); }
  catch (error) { console.error(String(error)); process.exitCode = 2; }
}
