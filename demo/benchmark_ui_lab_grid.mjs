// #1081: paired unchanged-input native camera measurement. All samples are retained.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, requirePinnedBrowser } from './serve.mjs';
const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice(11);
if (!baseline) throw Error('Pass --baseline=<historical source tree with its matching bundle>');
const output = resolve(process.env.HP_1081_PERF_OUTPUT || 'output/ui-lab-1081-grid-performance');
mkdirSync(output, { recursive: true }); requirePinnedBrowser();
const samples = [];
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)];
async function sample(version, pair, dpr) {
  const root = version === 'before' ? resolve(baseline) : resolve('.');
  const { page, browser } = await launch({ width: 1400, height: 1000 }, dpr, [], { reducedMotion: 'reduce' }, resolve(root, 'demo/srv'), root);
  try {
    await page.evaluate(async () => {
      await window.__hpTest.setServerConfig(config => ({ ...config, markers: [], settings: { ...config.settings, bg_mode: 'static', bg_color: '#ffffff' },
        spaces: [{ id: 'grid', title: 'Grid', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], settings: { bg_mode: 'static', bg_color: '#ffffff' } }] }));
      await window.__hpTest.setMode('decor');
    });
    const card = page.locator('houseplan-card');
    await card.locator('[data-hp="zoom-fit"]').click();
    for (let i = 0; i < 8; i++) await card.locator('[data-hp="zoom-in"]').click();
    await page.waitForFunction(() => !window.__card._modeTransitionBusy && !window.__card._refitRaf && !window.__card._pendingRefitSize);
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable'); await session.send('LayerTree.enable');
    let layerMaxArea = 0, layerMaxCount = 0;
    session.on('LayerTree.layerTreeDidChange', ({ layers = [] }) => {
      const painted = layers.filter(layer => layer.drawsContent);
      layerMaxCount = Math.max(layerMaxCount, painted.length);
      layerMaxArea = Math.max(layerMaxArea, ...painted.map(layer => layer.width * layer.height), 0);
    });
    await session.send('HeapProfiler.collectGarbage');
    const before = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
    await page.evaluate(() => {
      const c = window.__card, scene = c.renderRoot.querySelector('.plan-svg');
      const observation = { frames: [], last: performance.now(), boxes: 0, active: true };
      observation.observer = new MutationObserver(records => { observation.boxes += records.filter(item => item.attributeName === 'viewBox').length; });
      observation.observer.observe(scene, { attributes: true });
      const frame = now => { if (!observation.active) return; observation.frames.push(now - observation.last); observation.last = now; requestAnimationFrame(frame); };
      requestAnimationFrame(frame); window.__gridObservation = observation;
    });
    await session.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReturnAsStream' });
    const stage = await card.locator('.stage').boundingBox();
    const x = stage.x + stage.width * .32, y = stage.y + stage.height * .6;
    await page.mouse.move(x, y); await page.mouse.down();
    for (const [dx, dy, steps] of [[120, 20, 18], [-90, -35, 24], [150, 40, 12], [0, 0, 20]])
      await page.mouse.move(x + dx, y + dy, { steps });
    const observation = await page.evaluate(() => {
      const o = window.__gridObservation; o.active = false; o.observer.disconnect();
      return { frames: o.frames, viewBoxWrites: o.boxes, zoom: window.__card._zoom,
        fingerprint: globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio } };
    });
    const after = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
    const completed = new Promise(resolve => session.once('Tracing.tracingComplete', resolve));
    await session.send('Tracing.end'); const { stream } = await completed;
    let trace = ''; for (;;) { const result = await session.send('IO.read', { handle: stream }); trace += result.data; if (result.eof) break; }
    await session.send('IO.close', { handle: stream });
    const traceName = `pair-${pair}-${version}-dpr${dpr}.trace.json`;
    writeFileSync(resolve(output, traceName), trace);
    const events = JSON.parse(trace).traceEvents;
    const duration = name => events.filter(event => event.name === name && event.ph === 'X').reduce((sum, event) => sum + (event.dur || 0), 0) / 1000;
    await page.mouse.up();
    return { pair, version, dpr, ...observation, frameMedianMs: quantile(observation.frames, .5), frameP95Ms: quantile(observation.frames, .95),
      taskMs: (after.TaskDuration - before.TaskDuration) * 1000, scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
      layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000, styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
      paintMs: duration('Paint'), heapBefore: before.JSHeapUsedSize, heapAfter: after.JSHeapUsedSize,
      layerMaxArea, layerMaxCount, trace: traceName };
  } finally { await browser.close(); }
}
for (let pair = 1; pair <= 6; pair++) {
  const order = pair % 2 ? ['before', 'after'] : ['after', 'before'];
  const dpr = pair <= 3 ? 1 : 2;
  for (const version of order) { const value = await sample(version, pair, dpr); samples.push(value); console.log(JSON.stringify(value));
    writeFileSync(resolve(output, 'samples.json'), JSON.stringify(samples, null, 2)); }
}
const summary = {};
for (const dpr of [1, 2]) for (const version of ['before', 'after']) {
  const selected = samples.filter(item => item.dpr === dpr && item.version === version);
  summary[`${version}-dpr${dpr}`] = Object.fromEntries(['frameMedianMs', 'frameP95Ms', 'taskMs', 'scriptMs', 'layoutMs', 'styleMs', 'paintMs', 'heapBefore', 'heapAfter', 'layerMaxArea', 'layerMaxCount', 'viewBoxWrites']
    .map(key => [key, { median: quantile(selected.map(item => item[key]), .5), min: Math.min(...selected.map(item => item[key])), max: Math.max(...selected.map(item => item[key])) }]));
}
writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
