import test from 'node:test';
import assert from 'node:assert/strict';
import { lightPresentationComparison } from '../demo/helpers/light-presentation-report.mjs';
const receipt = (builds) => ({ pass: true, material: { sha: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false },
  observerSha256: 'a'.repeat(64), protocolSha256: 'b'.repeat(64), fixtureSha256: 'c'.repeat(64),
  pins: { node: 22, chromium: 151 }, node: '22.23.3', viewport: { width: 1440, height: 1000 }, dpr: 1,
  absoluteBudgets: { unchanged: true }, environment: { platform: 'linux', arch: 'x64', release: 'wsl',
    cpuModel: 'fixture', cpuCount: 4, totalMemory: 1000 },
  samples: Array.from({ length: 3 }, (_, index) => ({ index, chromium: '151', failures: [],
    settled: { bootSoft: false, booting: false, continuity: 'steady', devices: 200, strips: 50 },
    tickWork: { scenarios: { S2: { ticks: 100, presentationBuilds: builds, staleStripes: 0,
      rawTickMs: Array(100).fill(10), tickMs: { p95: 10 } } } },
    captureSamples: Array.from({ length: 100 }, () => ({ phase: 'S2', ms: 1 })), rawCpu: { S2: { nodes: [{}] } } })) });
test('#895 AC3 paired evidence accepts exactly three complete comparable reduced-work samples', () => {
  const report = lightPresentationComparison(receipt(40000), receipt(200));
  assert.equal(report.pass, true); assert.equal(report.rows.length, 3);
  assert.ok(report.rows.every((row) => row.reduction === .995));
});
test('#895 AC3 paired evidence rejects missing, dirty, warm-up, stale, different and insufficient-work evidence', () => {
  for (const corrupt of [
    (r) => { r.material.dirty = true; }, (r) => { r.protocolSha256 = 'd'.repeat(64); },
    (r) => { r.samples.pop(); }, (r) => { r.samples[0].settled.bootSoft = true; },
    (r) => { r.samples[0].tickWork.scenarios.S2.staleStripes = 1; },
    (r) => { r.samples[0].rawCpu = {}; }, (r) => { r.samples[0].captureSamples.pop(); },
    (r) => { r.samples[0].tickWork.scenarios.S2.presentationBuilds = 30000; },
  ]) {
    const after = receipt(200); corrupt(after);
    assert.equal(lightPresentationComparison(receipt(40000), after).pass, false);
  }
});
