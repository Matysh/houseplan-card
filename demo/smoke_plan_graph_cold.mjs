/** #1167 AC6: one cold current11 read-only View, with diagnostics only.
 * Fresh browser/document, no frontend entry before measurement. config/get is
 * a synthetic in-page boundary, NOT Home Assistant/network/storage proof.
 * Timing/memory have no pass thresholds and no comparative baseline. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { projectGraphSpace, validateGraph, verifyGraphProjection } from '../test-build/plan-graph.js';

requirePinnedBrowser();
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('./srv/assets/houseplan-assets.json', import.meta.url), 'utf8'));
const columns = 12, rows = 8;
const nid = (x, y) => `n-${x}-${y}`;
const horizontal = (x, y) => `h-${x}-${y}`;
const vertical = (x, y) => `v-${x}-${y}`;
const graph = { version: 1, nodes: [], edges: [], rooms: [], dependencies: [] };
for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
  graph.nodes.push({ id: nid(x, y), p: ['l', String(12 + x * 18), String(12 + y * 27)] });
  if (x < columns) graph.edges.push({ kind: 'wall', id: horizontal(x, y), from: nid(x, y), to: nid(x + 1, y), cm: 15 });
  if (y < rows) graph.edges.push({ kind: 'wall', id: vertical(x, y), from: nid(x, y), to: nid(x, y + 1), cm: 15 });
}
const rooms = [];
for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
  const id = `room-${x}-${y}`;
  rooms.push({ id, name: `Synthetic room ${x + 1}/${y + 1}`, area: null });
  graph.rooms.push({ room: id, edges: [
    { kind: 'wall', id: horizontal(x, y), reverse: false },
    { kind: 'wall', id: vertical(x + 1, y), reverse: false },
    { kind: 'wall', id: horizontal(x, y + 1), reverse: true },
    { kind: 'wall', id: vertical(x, y), reverse: true },
  ] });
}
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
graph.nodes.sort((a,b) => order(a.id,b.id));
graph.edges.sort((a,b) => order(a.kind+':'+a.id,b.kind+':'+b.id));
graph.rooms.sort((a,b) => order(a.room,b.room));
assert.equal(validateGraph(graph).ok, true);
const space = projectGraphSpace({ id: 'cold-current', title: 'Synthetic current graph', cell_cm: 5,
  view_box: [0, 0, 1, 1], rooms, partitions: [], openings: [] }, graph).space;
verifyGraphProjection(space, graph);
const config = { model_version: 11, spaces: [space], markers: [],
  settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } };
const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');

// These are current process snapshots. VmHWM is the kernel's per-process
// lifetime RSS high-water value; it is NOT a measured simultaneous browser peak.
const nativeMemory = async browserSession => {
  try {
    const { processInfo } = await browserSession.send('SystemInfo.getProcessInfo');
    const processes = await Promise.all(processInfo.map(async entry => {
      const id = String(entry.id);
      if (!/^\d+$/.test(id)) return { ...entry, unavailable: 'non-numeric PID' };
      const values = text => Object.fromEntries([...text.matchAll(/^(VmRSS|VmHWM|VmSize|Rss|Pss|Private_Clean|Private_Dirty|Shared_Clean|Shared_Dirty):\s+(\d+) kB$/gm)]
        .map(([, key, value]) => [key, Number(value) * 1024]));
      const status = await readFile(`/proc/${id}/status`, 'utf8').then(values).catch(error => ({ unavailable: error.code }));
      const rollup = await readFile(`/proc/${id}/smaps_rollup`, 'utf8').then(values).catch(error => ({ unavailable: error.code }));
      return { pid: entry.id, type: entry.type, cpuTimeSeconds: entry.cpuTime, statusBytes: status, smapsRollupBytes: rollup };
    }));
    const total = field => processes.every(p => Number.isFinite(p.smapsRollupBytes?.[field]))
      ? processes.reduce((sum, p) => sum + p.smapsRollupBytes[field], 0) : null;
    return { processes, summedPssBytes: total('Pss'), summedRssBytes: total('Rss'),
      note: 'Point-in-time live process set. Summed RSS double-counts shared pages. PSS only when all processes expose it. No aggregate/browser peak measured.' };
  } catch (error) { return { unavailable: error.message }; }
};
const wallStarted = performance.now();
const { page, browser } = await launchPanelCold({ width: 1440, height: 1040 });
const browserHarnessLaunchMs = performance.now() - wallStarted;
const requested = [];
page.on('request', request => requested.push(request.url()));
try {
  const browserSession = await browser.newBrowserCDPSession();
  const pageSession = await page.context().newCDPSession(page);
  await pageSession.send('Performance.enable');
  const nativeBeforeEntry = await nativeMemory(browserSession);
  check('cold.current.no_frontend_entry_before_start', await page.evaluate(() =>
    !customElements.get('houseplan-card') && !window.__card &&
    !performance.getEntriesByType('resource').some(r => /houseplan-(card|panel)\.js/.test(r.name))));
  const hostStarted = performance.now();
  const result = await page.evaluate(async ({ config, expectedRooms }) => {
    const hass = window.__mkHass(), original = hass.callWS.bind(hass), calls = [], writes = [];
    hass.devices = {}; hass.entities = {}; hass.states = {};
    hass.callWS = async message => {
      calls.push({ type: message.type, atMs: performance.now() });
      if (message.type === 'houseplan/config/get') {
        let response = structuredClone(config);
        if (message.space_id != null) response.spaces = response.spaces.filter(s => s.id === message.space_id);
        if (message.fields?.length) response = Object.fromEntries(Object.entries(response).filter(([key]) => message.fields.includes(key)));
        return { config: response, rev: 1, can_write: false, plan_graph_api: 1 };
      }
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      if (message.type.endsWith('registry/list')) return [];
      if (message.type.startsWith('houseplan/') && !message.type.endsWith('/get')) {
        writes.push(message.type); throw new Error(`read-only cold View attempted ${message.type}`);
      }
      return original(message);
    };
    const start = performance.now();
    await import('/assets/houseplan-card.js');
    const entryLoaded = performance.now();
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title: 'Current graph cold diagnostic', language: 'en' });
    document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
    const mounted = performance.now();
    const ready = await new Promise((resolve, reject) => {
      const deadline = start + 30000;
      const inspect = () => {
        const root = card.renderRoot, svg = root?.querySelector('svg.plan-svg');
        const stage = root?.querySelector('.stage'), mode = root?.querySelector('ha-card[data-hp-mode]');
        const ids = new Set([...root?.querySelectorAll('[data-hp="room"][data-id]') || []].map(r => r.getAttribute('data-id')));
        const bounds = svg?.getBoundingClientRect();
        if (card._booting === false && card._serverCfg?.model_version === 11 && card._space === 'cold-current' &&
            mode?.getAttribute('data-hp-mode') === 'view' && ids.size === expectedRooms && bounds?.width > 0 && bounds.height > 0 &&
            getComputedStyle(svg).visibility === 'visible' && (!stage || getComputedStyle(stage).visibility === 'visible')) {
          const firstReady = performance.now();
          requestAnimationFrame(() => requestAnimationFrame(() => resolve({ firstReady, afterTwoFrames: performance.now(), ids: [...ids].sort() })));
        } else if (performance.now() > deadline) reject(new Error(`current View readiness timeout: boot=${card._booting}, mode=${mode?.getAttribute('data-hp-mode')}, rooms=${ids.size}`));
        else requestAnimationFrame(inspect);
      };
      inspect();
    });
    const memory = performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      note: 'Chromium performance.memory diagnostic; precision/coverage depend on browser implementation.' } : null;
    return { timingMs: { entryImport: entryLoaded - start, mount: mounted - entryLoaded,
      entryStartToViewReady: ready.firstReady - start, entryStartToTwoFrames: ready.afterTwoFrames - start },
      render: { roomIds: ready.ids, serverCanWrite: card._serverCanWrite, mode: card._mode,
        editorRuntimeLoaded: !!card._editorRuntime, modelVersion: card._serverCfg?.model_version,
        graph: structuredClone(card._serverCfg.spaces[0].plan_graph),
        svgNodes: card.renderRoot.querySelectorAll('svg.plan-svg *').length },
      calls, writes, performanceMemory: memory,
      resources: performance.getEntriesByType('resource').filter(r => r.name.includes('/assets/')).map(r => ({
        name: new URL(r.name).pathname, durationMs: r.duration, transferSize: r.transferSize,
        encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize })) };
  }, { config, expectedRooms: rooms.length });
  const hostEntryToReadyMs = performance.now() - hostStarted;
  const fingerprint = await assertFreshDemoBundle(page, root); // Strict, never stale bypass.
  check('cold.current.actual_view_ready', result.render.mode, 'view');
  check('cold.current.server_readonly', result.render.serverCanWrite, false);
  check('cold.current.model11', result.render.modelVersion, 11);
  check('cold.current.all_synthetic_rooms_rendered', result.render.roomIds, rooms.map(r => r.id).sort());
  assert.deepEqual(result.render.graph, graph, 'cold read must retain the actual current graph');
  check('cold.current.graph_authority_unchanged', true);
  check('cold.current.no_editor_runtime', result.render.editorRuntimeLoaded, false);
  check('cold.current.no_writes', result.writes, []);
  const cdp = await pageSession.send('Performance.getMetrics');
  const wanted = new Set(['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'Frames', 'LayoutCount',
    'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration']);
  const cdpMetrics = Object.fromEntries(cdp.metrics.filter(m => wanted.has(m.name)).map(m => [m.name, m.value]));
  const domCounters = await pageSession.send('Memory.getDOMCounters').catch(error => ({ unavailable: error.message }));
  const nativeAtReady = await nativeMemory(browserSession);
  console.log('COLD_CURRENT_DIAGNOSTIC ' + JSON.stringify({
    kind: 'one cold current11 readonly frontend sample; synthetic local config/get, NOT HA server',
    noPerformanceThreshold: true, noBaselineComparison: true, browserVersion: browser.version(), fingerprint,
    fixture: { rooms: rooms.length, graphNodes: graph.nodes.length, graphEdges: graph.edges.length, configUtf8Bytes: bytes },
    timingsMs: { browserHarnessLaunch: browserHarnessLaunchMs, hostEntryToReady: hostEntryToReadyMs, ...result.timingMs },
    timingScope: 'Browser import→first ready View and two requestAnimationFrame callbacks. Local intercepted uncompressed assets; excludes real HA/auth/network. Fresh process/document; no editor preload. One diagnostic sample, not a statistical latency claim.',
    bundle: { fingerprint: manifest.fingerprint, initialViewGzipBytes: manifest.initialViewGzipBytes,
      totalGzipBytes: manifest.files.reduce((sum, file) => sum + file.gzipBytes, 0),
      initialFiles: manifest.initialViewFiles.length, totalFiles: manifest.files.length,
      gzipScope: 'Sum of independent manifest gzip(level9) files; total includes both package entries and all lazy assets, not transferred bytes.' },
    render: { rooms: result.render.roomIds.length, svgNodes: result.render.svgNodes, editorRuntimeLoaded: false },
    reads: result.calls.map(({ type, atMs }) => ({ type, atMs })), requestedAssets: requested.filter(url => url.includes('/assets/')),
    resources: result.resources, memory: { cdpMetrics, domCounters, performanceMemory: result.performanceMemory,
      nativeBeforeEntry, nativeAtReady, harnessNode: process.memoryUsage(),
      limitation: 'No forced GC, no sampled aggregate peak, no GPU allocation accounting; CDP metrics are point-in-time/lifetime counters as defined by Chromium.' },
  }));
} catch (error) {
  console.error('cold.current.failure', error.stack || error); process.exitCode = 1;
} finally { await finish(browser); }
