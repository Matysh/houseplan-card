#!/usr/bin/env node
// Read-only derivation of the retained raw evidence. Never launches/retries a gate.
import { readFileSync } from 'node:fs';
import { nodeSeriesSummary } from '../demo/helpers/node-performance-report.mjs';
const paths = process.argv.slice(2);
if (!paths.length || paths.some(p => p.startsWith('--'))) {
  console.error('usage: node scripts/node-connected-diagnostics.mjs <raw-report.json> [<raw-report.json> ...]');
  process.exitCode = 2;
} else {
  try {
    const summary = nodeSeriesSummary(paths.map(path => JSON.parse(readFileSync(path, 'utf8'))));
    // Raw rows already live in the original report; keep this CLI bounded/readable.
    console.log(JSON.stringify({ ...summary, observations: summary.observations.map(o => ({ ...o,
      attribution: o.attribution.status === 'observed' ? { ...o.attribution, rows: undefined } : o.attribution })) }, null, 2));
  } catch (error) { console.error(`node diagnostic: ${error.message}`); process.exitCode = 1; }
}
