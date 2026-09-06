/** #461 production-bundle wall-draw terminal-click performance profile. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { launch, finish } from './serve.mjs';
import {
  installWallDrawClickHarness, resetWallDrawClickHarness, runWallDrawClickChain,
  runWallDrawFinishProfile,
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
const runFinish = async (remoteVariant) => {
  await resetWallDrawClickHarness(page, remoteVariant);
  // Warm the distinct finalizer path, then measure it from the same fixture.
  await runWallDrawFinishProfile(page);
  await resetWallDrawClickHarness(page, remoteVariant);
  return runWallDrawFinishProfile(page);
};
const baseFinish = await runFinish(false);
const remoteFinish = await runFinish(true);
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
  && base.fixture.positiveSegments >= 36 && base.fixture.savedPartitions === 8;
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
  && base.result.metrics.wallGenericFallbacks === 0
  && base.result.terminal.fullSpacePhysicalChecks === 0
  && base.result.terminal.localPhysicalChecks === 0
  && base.result.terminal.configWrites === 0 && base.result.terminal.history === 0
  && base.result.terminalPartitionCount === base.fixture.savedPartitions + 7
  && base.result.activeCleared;
const finishStructural = baseFinish.terminal.fullSpacePhysicalChecks === 0
  && baseFinish.terminal.localPhysicalChecks === 1
  && baseFinish.terminal.configWrites === 1
  && baseFinish.terminal.history === 0
  && baseFinish.terminal.wallFinishBarriers === 1
  && baseFinish.terminal.wallGenericFallbacks === 0
  && baseFinish.surviving.length === 1
  && baseFinish.terminalPartitionCount === base.fixture.savedPartitions + 1
  && baseFinish.optimizeChanged === false
  && baseFinish.activeCleared
  && remoteFinish.terminal.fullSpacePhysicalChecks === 0
  && remoteFinish.terminal.localPhysicalChecks === 1
  && remoteFinish.terminal.configWrites === 1
  && remoteFinish.terminal.wallFinishBarriers === 1
  && remoteFinish.surviving.length === 1
  && remoteFinish.optimizeChanged === false;
const budgets = {
  medianMs: 150,
  maxMs: 250,
  remoteMedianMs: medianMs * 1.5 + 20,
  finishMs: 250,
  remoteFinishMs: baseFinish.finishMs * 1.5 + 20,
};
const timing = medianMs <= budgets.medianMs && maxMs <= budgets.maxMs
  && remoteMedianMs <= budgets.remoteMedianMs
  && baseFinish.finishMs <= budgets.finishMs
  && remoteFinish.finishMs <= budgets.remoteFinishMs;
const report = {
  issue: 461, profile: 'wall-draw-click-v1',
  fixture: base.fixture, remoteFixture: remote.fixture,
  timing: {
    samplesMs: base.result.times.map((value) => Math.round(value * 10) / 10),
    medianMs: Math.round(medianMs * 10) / 10,
    maxMs: Math.round(maxMs * 10) / 10,
    remoteMedianMs: Math.round(remoteMedianMs * 10) / 10,
    finishMs: Math.round(baseFinish.finishMs * 10) / 10,
    remoteFinishMs: Math.round(remoteFinish.finishMs * 10) / 10,
  },
  budgets: Object.fromEntries(Object.entries(budgets)
    .map(([key, value]) => [key, Math.round(value * 10) / 10])),
  counters: base.result.metrics,
  finishCounters: baseFinish.terminal,
  structural: structural && finishStructural,
  timingPass: timing,
  pass: structural && finishStructural && timing,
};
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
await finish(browser);
