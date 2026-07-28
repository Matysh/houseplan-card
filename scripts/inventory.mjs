// Current test inventory, printed on demand.
//
// docs/STATUS.md used to carry these numbers inline; they went stale within a
// couple of releases while the version line next to them was kept current,
// which is worse than no number at all — a maintainer reading the snapshot
// underestimates the coverage that exists (review R5-2). The counts live here
// now, one command away, and STATUS.md describes the layers instead.
import { readdirSync, readFileSync } from 'node:fs';

const count = (dir, match, re) =>
  readdirSync(dir)
    .filter((f) => match.test(f))
    .reduce((n, f) => n + (readFileSync(`${dir}/${f}`, 'utf8').match(re) || []).length, 0);

const files = (dir, match) => readdirSync(dir).filter((f) => match.test(f)).length;

const rows = [
  ['frontend unit (node:test)', count('test', /\.test\.mjs$/, /^test\(/gm)],
  ['pure backend (pytest, no HA)', count('tests_backend', /^test_validation\.py$/, /^def test_/gm)],
  ['HA-harness backend (CI, py3.13)', count('tests_backend', /^test_ha_.*\.py$/, /^async def test_|^def test_/gm)],
  ['browser smokes (headless chromium)', files('demo', /^smoke_.*\.mjs$/)],
];
const w = Math.max(...rows.map(([n]) => n.length));
for (const [name, n] of rows) console.log(`${name.padEnd(w)}  ${n}`);
