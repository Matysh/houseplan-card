import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const run = promisify(execFile);

async function gpuMemory(pid) {
  if (process.platform !== 'win32' || !Number.isInteger(pid)) return null;
  const query = 'Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUProcessMemory'
    + ` | Where-Object Name -Like 'pid_${pid}_*'`
    + ' | Select-Object DedicatedUsage,SharedUsage,TotalCommitted | ConvertTo-Json -Compress';
  const { stdout } = await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command',query], { windowsHide: true });
  if (!stdout.trim()) return null;
  const raw = JSON.parse(stdout), rows = Array.isArray(raw) ? raw : [raw];
  return Object.fromEntries(['DedicatedUsage','SharedUsage','TotalCommitted']
    .map(key => [key, rows.reduce((total,row) => total + Number(row[key] || 0),0)]));
}

const executablePath = process.env.HP_ISO_CHROME;
if (!executablePath) throw Error('Set HP_ISO_CHROME to the real GPU browser executable.');
const width = +(process.env.HP_ISO_HARDWARE_WIDTH || 1408);
const height = +(process.env.HP_ISO_HARDWARE_HEIGHT || 952);
const dpr = +(process.env.HP_ISO_HARDWARE_DPR || 2);
const output = process.env.HP_ISO_HARDWARE_OUTPUT || 'artifacts/1478/hardware';
const { page, browser, provenance } = await startIsoPaintScene({ width, height, dpr,
  reducedMotion: 'no-preference', launchOptions: { executablePath, headless: false },
  referenceRoot: process.env.HP_ISO_PAINT_REFERENCE,
  browserArgs: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
});
const browserProtocol = await browser.newBrowserCDPSession();
const protocol = await page.context().newCDPSession(page);
let activeLayers = [], seen, created;
protocol.on('LayerTree.layerTreeDidChange', ({ layers }) => {
  if (!layers) return;
  activeLayers = layers;
  if (!seen) return;
  for (const layer of layers) if (layer.drawsContent && !seen.has(layer.layerId)) {
    seen.add(layer.layerId); created++;
  }
});
await protocol.send('LayerTree.enable');

const record = async (action) => {
  await page.evaluate(() => {
    const rows = [];
    let first, raf;
    function tick(now) {
      if (first !== undefined) rows.push(now - first);
      first = now;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    window.__isoHardwareFrames = () => { cancelAnimationFrame(raf); return rows; };
  });
  seen = new Set(activeLayers.filter(layer => layer.drawsContent).map(layer => layer.layerId));
  created = 0;
  const start = performance.now();
  await action();
  const elapsed = performance.now() - start;
  const gaps = await page.evaluate(() => window.__isoHardwareFrames());
  const layersCreated = created;
  seen = null;
  const sorted = [...gaps].sort((a,b) => a-b);
  return { elapsed, frames: gaps.length, fps: gaps.length * 1000 / elapsed,
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1),
    layersCreated, gaps };
};

try {
  const { gpu } = await browserProtocol.send('SystemInfo.getInfo');
  const gpuProcess = (await browserProtocol.send('SystemInfo.getProcessInfo')).processInfo.find(process => process.type === 'GPU');
  const visibility = await page.evaluate(() => ({ state: document.visibilityState, dpr: devicePixelRatio }));
  const stage = await page.locator('houseplan-card .stage').first().boundingBox();
  if (!stage || visibility.state !== 'visible' || visibility.dpr !== dpr || gpu.featureStatus?.gpu_compositing !== 'enabled') {
    throw Error('The expected visible, GPU-accelerated viewport is unavailable: ' + JSON.stringify({ visibility, gpu: gpu.featureStatus }));
  }
  const idle = await record(() => sleep(1500));
  const results = { provenance, stage, visibility, gpu: { devices: gpu.devices, featureStatus: gpu.featureStatus,
    renderer: gpu.auxAttributes?.glRenderer, processId: gpuProcess?.id }, idle, runs: [], processMemory: [] };
  const memory = async label => results.processMemory.push({ label, bytes: await gpuMemory(gpuProcess?.id) });
  await memory('idle');
  for (const light of ['off','on']) {
    await page.evaluate(async light => {
      const card = window.__isoPaint;
      card.hass = { ...card.hass, states: Object.fromEntries(Object.entries(card.hass.states).map(([id,state]) =>
        [id, id.startsWith('light.') ? { ...state, state: light } : state])) };
      await card.updateComplete;
    }, light);
    await sleep(800);
    await zoomIsoPaint(page, 2.18);
    const x = Math.round(stage.x + stage.width * .2), y = Math.round(stage.y + stage.height * .35);
    await page.mouse.move(x, y);
    await page.mouse.down();
    const pan = await record(async () => {
      const duration = 3500, steps = 385, start = performance.now();
      for (let i = 1; i <= steps; i++) {
        await sleep(Math.max(0, start + i * duration / steps - performance.now()));
        await page.mouse.move(x + Math.sin(i / steps * Math.PI) * stage.width * .36,
          y + Math.sin(i / steps * Math.PI * 2) * stage.height * .11);
      }
    });
    await page.mouse.up();
    await settleIsoPaint(page);
    await memory(light + '-pan');

    const zoom = {};
    for (const direction of ['in','out']) {
      await zoomIsoPaint(page, direction === 'in' ? 1.1 : 6);
      const at = { x: stage.x + stage.width * .88, y: stage.y + stage.height * .66 };
      await page.mouse.move(at.x, at.y);
      zoom[direction] = await record(async () => {
        const start = performance.now(), offered = [];
        for (let i = 0; i < 14; i++) {
          if (i) await sleep(Math.max(0, start + i * 140 - performance.now()));
          offered.push(protocol.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...at,
            deltaX: 0, deltaY: direction === 'in' ? -80 : 80 }));
        }
        await Promise.all(offered);
        await settleIsoPaint(page);
      });
      zoom[direction].finalZoom = await page.evaluate(() => window.__isoPaint._zoom);
      await memory(light + '-' + direction);
    }
    results.runs.push({ light, pan, zoom });
    console.log(JSON.stringify({ light, panFps: pan.fps, panP95: pan.p95Ms,
      zoomInFps: zoom.in.fps, zoomOutFps: zoom.out.fps, zoomLayers: [zoom.in.layersCreated,zoom.out.layersCreated] }));
  }
  await mkdir(output, { recursive: true });
  await writeFile(output + '/hardware.json', JSON.stringify(results,null,2));
} finally {
  await browser.close();
}
