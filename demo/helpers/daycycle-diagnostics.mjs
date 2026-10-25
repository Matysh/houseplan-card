import { availableParallelism, cpus, freemem, release, totalmem, type } from 'node:os';
import { readFileSync } from 'node:fs';

const optionalRead = (path, pattern) => {
  try { return pattern ? readFileSync(path, 'utf8').match(pattern)?.[1] ?? null : readFileSync(path, 'utf8').trim(); }
  catch { return null; }
};

/** Once, before any pan. Unsupported protocol fields remain explicitly unknown. */
export async function daycycleEnvironment(browser) {
  let session;
  let gpu;
  try {
    session = await browser.newBrowserCDPSession();
    const info = await session.send('SystemInfo.getInfo');
    gpu = { status: 'available', source: 'CDP SystemInfo.getInfo', data: info.gpu };
  } catch (error) { gpu = { status: 'unavailable', reason: error.message, data: null }; }
  finally { await session?.detach(); }
  return { node: process.version, platform: process.platform, arch: process.arch,
    os: { type: type(), release: release() },
    resources: { availableParallelism: availableParallelism(), logicalCpus: cpus().length,
      cpuModel: cpus()[0]?.model ?? null, totalMemory: totalmem(), freeMemory: freemem(),
      cpuAllowedList: optionalRead('/proc/self/status', /^Cpus_allowed_list:\s*(.+)$/m),
      cpuMax: optionalRead('/sys/fs/cgroup/cpu.max'),
      profile: process.env.HP_DAYCYCLE_RESOURCE_PROFILE || 'ordinary host; no declared resource control' },
    github: { run: process.env.GITHUB_RUN_ID ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      job: process.env.GITHUB_JOB ?? null, runnerOS: process.env.RUNNER_OS ?? null }, gpu };
}

/** Layer notifications carry receipt time in Node's clock, not invented frame timestamps. */
export async function beginDaycycleLayers(cdp) {
  const events = [];
  const tree = value => events.push({ type: 'tree', receivedAtNodeMs: performance.now(), ...value });
  const painted = value => events.push({ type: 'painted', receivedAtNodeMs: performance.now(), ...value });
  cdp.on('LayerTree.layerTreeDidChange', tree);
  cdp.on('LayerTree.layerPainted', painted);
  let status = 'available', reason = null;
  try { await cdp.send('LayerTree.enable'); }
  catch (error) { status = 'unavailable'; reason = error.message; }
  return { async stop() {
    cdp.off('LayerTree.layerTreeDidChange', tree);
    cdp.off('LayerTree.layerPainted', painted);
    if (status === 'available') await cdp.send('LayerTree.disable');
    return { status, reason, clock: 'Node performance.now milliseconds at notification receipt', events };
  } };
}

/** DOM backend IDs let an offline reader map real layer nodes to named geometry. */
export async function daycycleLayerNodes(cdp) {
  const nodes = [];
  for (const [role, selector] of [['stage', '.stage'], ['paper', '.hp-paperg'],
    ['plan', '.plan-svg'], ['outline', '.hp-paper-outline-svg']]) {
    let objectId;
    try {
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(window.__card.shadowRoot || window.__card.renderRoot).querySelector(${JSON.stringify(selector)})`,
      });
      objectId = result.result?.objectId;
      if (!objectId) { nodes.push({ role, status: 'absent', backendNodeId: null }); continue; }
      const { node } = await cdp.send('DOM.describeNode', { objectId });
      nodes.push({ role, status: 'available', backendNodeId: node.backendNodeId });
    } catch (error) { nodes.push({ role, status: 'unavailable', backendNodeId: null, reason: error.message }); }
    finally { if (objectId) await cdp.send('Runtime.releaseObject', { objectId }); }
  }
  return nodes;
}

export function daycycleTraceObservation(events, pageObservation, layers) {
  const marker = events.find(event => event.name === pageObservation.marker && Number.isFinite(event.ts));
  return { page: pageObservation, layers,
    clockAlignment: marker && Number.isFinite(pageObservation.markerAt)
      ? { status: 'available', source: 'same page performance.mark and trace user-timing event',
        marker: pageObservation.marker, traceTsMicros: marker.ts, pageAtMs: pageObservation.markerAt,
        traceOriginMicros: marker.ts - pageObservation.markerAt * 1000 }
      : { status: 'unavailable', reason: 'matching user-timing marker absent', traceOriginMicros: null },
    // Complete durations are elapsed spans. tts/tdur are optional protocol data,
    // never inferred from dur, CPU count, overlap or the Node notification clock.
    rasterCpuClock: events.some(event => event.name === 'RasterTask' && Number.isFinite(event.tdur))
      ? 'tdur retained where provided' : 'unavailable: trace supplied no RasterTask tdur',
  };
}
