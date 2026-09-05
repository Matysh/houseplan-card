/** #461 production-bundle wall-draw terminal-click performance profile. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch, finish } from './serve.mjs';
import {
  installWallDrawClickHarness, resetWallDrawClickHarness, runWallDrawClickChain,
} from './wall-draw-click-harness.mjs';

const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const output = outputArg ? resolve(outputArg.slice('--output='.length)) : null;
const { page, browser } = await launch({ width: 1200, height: 900 }, 1);
await installWallDrawClickHarness(page);

const run = async (remote) => {
  const fixture = await resetWallDrawClickHarness(page, remote);
  // One complete chain warms the browser/JIT; reset removes all of its state.
  await runWallDrawClickChain(page);
  await resetWallDrawClickHarness(page, remote);
  return { fixture, result: await runWallDrawClickChain(page) };
};
const base = await run(false);
const remote = await run(true);
const sorted = [...base.result.times].sort((a, b) => a - b);
const medianMs = sorted[Math.floor(sorted.length / 2)];
const maxMs = Math.max(...base.result.times);
const remoteSorted = [...remote.result.times].sort((a, b) => a - b);
const remoteMedianMs = remoteSorted[Math.floor(remoteSorted.length / 2)];

const clickShape = (click) => click.fullSpacePhysicalChecks === 0
  && click.localPhysicalChecks === 1
  && click.junctionArtifactPasses === 1
  && click.configWrites === 1 && click.history === 1 && click.pathPoints === 1;
const fixtureShape = base.fixture.spaces === 5 && base.fixture.rooms === 12
  && base.fixture.positiveSegments >= 36 && base.fixture.savedDrafts === 4;
const remoteFixtureShape = remote.fixture.positiveSegments === base.fixture.positiveSegments * 2;
const structural = fixtureShape && remoteFixtureShape
  && base.result.first.fullSpacePhysicalChecks === 0
  && base.result.first.localPhysicalChecks === 0
  && base.result.first.configWrites === 0 && base.result.first.history === 0
  && base.result.clicks.length === 7 && base.result.clicks.every(clickShape)
  && remote.result.clicks.every(clickShape)
  && base.result.metrics.localProofMaxObjects < base.fixture.positiveSegments
  && remote.result.metrics.localProofMaxObjects === base.result.metrics.localProofMaxObjects
  && base.result.ids.length === 7 && new Set(base.result.ids).size === 7
  && base.result.terminal.fullSpacePhysicalChecks >= 1
  && base.result.terminalPartitionCount >= 1 && base.result.activeCleared;
const budgets = {
  medianMs: 150,
  maxMs: 250,
  remoteMedianMs: medianMs * 1.5 + 20,
};
const timing = medianMs <= budgets.medianMs && maxMs <= budgets.maxMs
  && remoteMedianMs <= budgets.remoteMedianMs;
const report = {
  issue: 461, profile: 'wall-draw-click-v1',
  fixture: base.fixture, remoteFixture: remote.fixture,
  timing: {
    samplesMs: base.result.times.map((value) => Math.round(value * 10) / 10),
    medianMs: Math.round(medianMs * 10) / 10,
    maxMs: Math.round(maxMs * 10) / 10,
    remoteMedianMs: Math.round(remoteMedianMs * 10) / 10,
  },
  budgets: Object.fromEntries(Object.entries(budgets)
    .map(([key, value]) => [key, Math.round(value * 10) / 10])),
  counters: base.result.metrics,
  structural,
  timingPass: timing,
  pass: structural && timing,
};
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
await finish(browser);
