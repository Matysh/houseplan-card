#!/usr/bin/env node
/** #895 paired diagnostic: EXACT #850 S0/S1/S1b/S2 function + 50×50 fixture.
 * Same observer protocol runs against --root=<base/result checkout>. It never
 * bypasses boot/continuity, changes budgets or substitutes a smaller fixture.
 * Three fixed cold samples retain raw CPU, tick and capture work. This is not
 * a replacement for the official seven-sample led-strips-v1 absolute gate.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import { makeLedStripsFixture } from './performance/led-strips-fixture.mjs';
import { sensorTickScenarios, summarizeCpuProfile, tickCounterFailures } from './performance/sensor-tick-scenarios.mjs';

const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(arg('root') || '.');
const output = arg('output');
if (!output) throw Error('--output is required (raw outcomes must be retained)');
if (process.env.HP_ALLOW_STALE_BUNDLE) throw Error('stale bundle escape hatch is forbidden for this witness');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const material = { sha: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  dirty: !!git('diff', '--name-only', 'HEAD', '--', '.', ':!dist/**',
    ':!custom_components/houseplan/frontend/**', ':!demo/srv/assets/**') };
if (material.dirty) throw Error('commit the source material before measuring');
process.chdir(root);
const { launch, reportPageErrors } = await import(pathToFileURL(resolve(root, 'demo/serve.mjs')));
const { pinsFromSources } = await import(pathToFileURL(resolve(root, 'scripts/toolchain-pins.mjs')));
const fixture = makeLedStripsFixture(50, 50);
const budgets = JSON.parse(readFileSync(resolve(root, 'demo/performance/budgets-led-strips.json'), 'utf8'));
const protocol = sensorTickScenarios.toString();
const report = { schema: 'houseplan-light-presentation/v1', material,
  observerSha256: hash(readFileSync(new URL(import.meta.url))), protocolSha256: hash(protocol),
  fixtureSha256: hash(JSON.stringify(fixture)), pins: pinsFromSources(), node: process.version,
  environment: { platform: process.platform, arch: process.arch, release: os.release(),
    cpuModel: os.cpus()[0]?.model, cpuCount: os.cpus().length, totalMemory: os.totalmem(), loadStart: os.loadavg() },
  viewport: { width: 1440, height: 1000 }, dpr: 1, samples: [],
  definition: '100 accepted HA ticks/scenario; tick assignment→updateComplete; capture wrapper wall time, CPU sampled separately; not OS CPU accounting or compositor paint',
  absoluteBudgets: budgets, pass: false };
try {
  for (let index = 0; index < 3; index++) {
    const { page, browser } = await launch(report.viewport, 1);
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const cpu = {}, rawCpu = {};
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
      await page.exposeFunction('__lightTickMark', async (name, phase) => {
        if (phase === 'start') await cdp.send('Profiler.start');
        else {
          const { profile } = await cdp.send('Profiler.stop');
          rawCpu[name] = profile; cpu[name] = summarizeCpuProfile(profile);
        }
      });
      await page.evaluate(`window.__lightTickScenarios = ${protocol}`);
      const sample = await page.evaluate(async (fixture) => {
        const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const until = async (fn) => {
          const deadline = performance.now() + 30000;
          while (!fn()) {
            if (performance.now() > deadline) throw Error('light presentation witness timeout');
            await new Promise((done) => setTimeout(done, 10));
          }
        };
        window.__card?.remove?.(); localStorage.clear();
        const card = document.createElement('houseplan-card');
        card.setConfig({ type: 'custom:houseplan-card', title: 'Light projection', icon_size: 3.4 });
        let states = fixture.states;
        const base = { language: 'en', locale: { language: 'en' },
          user: { id: 'perf', name: 'Performance fixture', is_admin: true },
          devices: fixture.devices, entities: fixture.entities, areas: fixture.areas,
          connection: { subscribeEvents: async () => () => {}, subscribeMessage: async () => () => {} },
          callWS: async (message) => {
            if (message.type === 'houseplan/config/get') return { config: structuredClone(fixture.config), rev: 1, can_write: true };
            if (message.type === 'houseplan/layout/get') return { layout: structuredClone(fixture.layout), rev: 1 };
            if (message.type === 'config/device_registry/list') return Object.values(fixture.devices);
            if (message.type === 'config/entity_registry/list') return Object.values(fixture.entities);
            return { ok: true };
          }, callService: async () => {}, localize: () => null, formatEntityState: (row) => row.state,
          config: { unit_system: { length: 'km' } } };
        const host = { get states() { return states; }, setStates(next) { states = next; card.hass = { ...base, states }; } };
        document.getElementById('host').replaceChildren(card); host.setStates(states);
        await until(() => card._loadOk && card._model?.length === 3 && !card._booting && !card._bootSoft
          && card._continuity?.state === 'steady' && card.renderRoot.querySelectorAll('[data-led-strip]').length === 50);
        await frame();
        const captureSamples = [];
        let phase = 'settle';
        const capture = card._captureRenderDeviceSnapshot;
        card._captureRenderDeviceSnapshot = function (...args) { // private-ok: observation only; removed in finally
          const began = performance.now();
          try { return capture.apply(this, args); }
          finally { captureSamples.push({ phase, began, ms: performance.now() - began }); }
        };
        const stats = async () => {
          const url = performance.getEntriesByType('resource').map((entry) => entry.name)
            .find((name) => /led-strip-runtime-[^/]+\.js/.test(name));
          if (!url) throw Error('LED runtime did not land');
          const runtime = await import(url); return { ...runtime.ledStats(card), loaded: true };
        };
        try {
          const settled = { bootSoft: card._bootSoft, booting: card._booting, continuity: card._continuity.state,
            devices: card._devices.length, strips: card.renderRoot.querySelectorAll('[data-led-strip]').length };
          const tickWork = await window.__lightTickScenarios({ card, host, layout: fixture.layout,
            entities: fixture.entities, ticks: 100, strips: 50, observe: true, frame, stats,
            mark: async (name, boundary) => {
              phase = boundary === 'start' ? name : 'settle';
              await window.__lightTickMark(name, boundary);
            } });
          return { settled, tickWork, captureSamples };
        } finally { delete card._captureRenderDeviceSnapshot; card.remove(); }
      }, fixture);
      report.samples.push({ index, chromium: await browser.version(), ...sample, cpu, rawCpu,
        fingerprint: await page.evaluate(() => window.__HOUSEPLAN_BUILD_FINGERPRINT__),
        failures: tickCounterFailures([{ ticks: sample.tickWork }], budgets.ticks) });
      await reportPageErrors();
    } finally { await browser.close(); }
    await reportPageErrors();
  }
  report.pass = !process.exitCode && report.samples.length === 3
    && report.samples.every((sample) => sample.failures.length === 0);
} catch (error) { report.error = { name: error.name, message: error.message }; }
finally {
  report.environment.loadEnd = os.loadavg();
  writeFileSync(resolve(output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ material, samples: report.samples.map((sample) => ({ index: sample.index,
    settled: sample.settled, S2: sample.tickWork.scenarios.S2, failures: sample.failures })),
    error: report.error, pass: report.pass }, null, 2));
  if (!report.pass) process.exitCode = 1;
}
