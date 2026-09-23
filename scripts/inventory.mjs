// Current test inventory, printed on demand.
//
// docs/STATUS.md used to carry these numbers inline; they went stale within a
// couple of releases while the version line next to them was kept current,
// which is worse than no number at all — a maintainer reading the snapshot
// underestimates the coverage that exists (review R5-2). The counts live here
// now, one command away, and STATUS.md describes the layers instead.
import { readdirSync, readFileSync } from 'node:fs';
import { METRIC_NAMES, collectMetrics, readBaseline } from './monolith-metrics.mjs';

const count = (dir, match, re) =>
  readdirSync(dir)
    .filter((f) => match.test(f))
    .reduce((n, f) => n + (readFileSync(`${dir}/${f}`, 'utf8').match(re) || []).length, 0);

const files = (dir, match) => readdirSync(dir).filter((f) => match.test(f)).length;

// Count both node:test spellings and indented pytest methods. Pure backend
// includes validation plus trail helper/recorder tests; only `test_ha_*` needs
// the Home Assistant harness (AUD-159B7-03).
const rows = [
  ['Node unit (frontend + tooling)', count('test', /\.test\.mjs$/, /^\s*(test|it)\(/gm)],
  ['pure backend (pytest, no HA)', count('tests_backend', /^test_(?!ha_).*\.py$/, /^\s*(?:async\s+)?def test_/gm)],
  ['HA-harness backend (CI, py3.13)', count('tests_backend', /^test_ha_.*\.py$/, /^\s*(?:async\s+)?def test_/gm)],
  ['browser smokes (headless chromium)', files('demo', /^smoke_.*\.mjs$/)],
];
const w = Math.max(...rows.map(([n]) => n.length));
for (const [name, n] of rows) console.log(`${name.padEnd(w)}  ${n}`);

// #624: связность монолита — те же шесть чисел и тот же модуль, что у гейта
// `npm run lint:unused` («одно число — один источник»); рядом — база, чтобы
// движение было видно без git blame. bundleBytes есть только после сборки.
const { metrics } = collectMetrics(process.cwd());
const baseline = readBaseline(process.cwd()) || {};
console.log('\nmonolith (scripts/monolith-metrics.mjs; база scripts/monolith-baseline.json)');
const mw = Math.max(...METRIC_NAMES.map((n) => n.length));
for (const name of METRIC_NAMES) {
  const now = metrics[name];
  const base = baseline[name];
  const delta = now != null && base != null && now !== base ? ` (${now > base ? '+' : ''}${now - base} к базе ${base})` : '';
  console.log(`${name.padEnd(mw)}  ${now ?? 'n/a — npm run build'}${delta}`);
}
