// #514: release.yml holds the assets of a stable release until E2E on a real HA is green.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
const at = (marker) => { const i = workflow.indexOf(marker); assert.ok(i > 0, `нет «${marker}»`); return i; };

test('#514 AC1/AC3: the E2E gate step exists in job gate, after Full Performance, for stable releases only', () => {
  const gate = at('  gate:\n');
  const build = at('  build:\n');
  const perf = at('      - name: Require full performance for a stable release\n');
  const e2e = at('      - name: Require green E2E on a real Home Assistant for a stable release\n');
  assert.ok(gate < perf && perf < e2e && e2e < build, 'E2E stands after Full Performance inside job gate');
  const step = workflow.slice(e2e, build);
  assert.match(step, /if: \$\{\{ !github\.event\.release\.prerelease \}\}/, 'prereleases skip the step');
  assert.match(step, /node scripts\/e2e-gate\.mjs --tag="\$TAG"/);
  assert.match(step, /TAG: \$\{\{ github\.event\.release\.tag_name \}\}/);
});

test('#514: the gate dispatches with a token that can reach houseplan-e2e, with the process token as fallback', () => {
  const e2e = at('      - name: Require green E2E on a real Home Assistant for a stable release\n');
  const step = workflow.slice(e2e, at('  build:\n'));
  assert.match(step, /GH_TOKEN: \$\{\{ secrets\.E2E_DISPATCH_TOKEN \|\| secrets\.HP_PROCESS_TOKEN \}\}/);
});
