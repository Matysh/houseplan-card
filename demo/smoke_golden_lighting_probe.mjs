// Diagnostic only for #1204 / release #1192. Not a release/S6 completion claim.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { launch, finish } from './serve.mjs';
import { prepareGoldenScenario, goldenClip, resetGoldenStability } from './golden/harness.mjs';
import { captureGoldenFrame } from './golden/scene-repaint.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';
import { prepareGoldenSelection, goldenHarnessScenario } from '../process-next/catalog/golden-selection.mjs';
import { captureProvenance } from '../scripts/capture-environment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'artifacts/process-next/lighting-probe');
mkdirSync(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const { all } = prepareGoldenSelection(GOLDEN_SCENARIOS);
const selected = all.find(scene => scene.id === 'panel-lighting-glow-sun-dark');
const scenario = goldenHarnessScenario(selected);
const prefix = ['panel-wide-view-light-en', 'panel-compact-ui-1132',
  'panel-three-rows-ui-1132', 'panel-narrow-kiosk-fixed',
  'panel-device-icon-state-table-light', 'panel-device-icon-state-table-dark'];
const manifest = JSON.parse(readFileSync(resolve(root, 'dist/houseplan-assets.json')));
const rows = [];

async function inspect(page) {
  return page.evaluate(() => {
    const c = window.__goldenCard, r = c.renderRoot, stage = r.querySelector('.stage');
    const node = n => n ? {
      tag: n.tagName, attrs: Object.fromEntries([...n.attributes].map(a => [a.name, a.value])),
      rect: n.getBoundingClientRect().toJSON(),
      bbox: n.getBBox ? (() => { const b = n.getBBox(); return [b.x, b.y, b.width, b.height]; })() : null,
      ctm: n.getScreenCTM ? (() => { const m = n.getScreenCTM(); return m && [m.a, m.b, m.c, m.d, m.e, m.f]; })() : null,
    } : null;
    const snapshot = s => s ? {
      sourceSequence: s.sourceSequence, geometry: s.geometry,
      positions: s.positions ? [...s.positions] : 'unknown',
      devices: s.devices?.map(d => ({ id: d.id, icon: d.icon, display: d.display, space: d.space, area: d.area })),
      presentations: s.presentations ? [...s.presentations] : 'unknown',
    } : null;
    const devices = [...r.querySelectorAll('.dev[data-id]')].map(d => ({
      node: node(d), html: d.outerHTML,
      svg: [...d.querySelectorAll('svg,path,use')].map(node),
      icons: [...d.querySelectorAll('ha-icon')].map(icon => ({
        host: node(icon), shadow: icon.shadowRoot?.innerHTML,
        svg: node(icon.shadowRoot?.querySelector('svg')),
        path: node(icon.shadowRoot?.querySelector('path')),
        style: ['width', 'height', 'display', 'font-size', '--mdc-icon-size']
          .map(key => [key, getComputedStyle(icon).getPropertyValue(key)]),
      })),
      style: ['width', 'height', 'font-size', 'transform', 'container-type']
        .map(key => [key, getComputedStyle(d).getPropertyValue(key)]),
    }));
    return {
      at: { utc: new Date().toISOString(), monotonicMs: performance.now() },
      config: c._config, serverConfig: c._serverCfg, layout: c._layout,
      cfgRev: c._cfgRev, layoutRev: c._layoutRev, configEpoch: c._cfgEpoch,
      hassSequence: c._hassSequence, capturedSequence: c._capturedSeq,
      stagedToken: c._stagedToken, continuityToken: c._continuity?.token,
      visible: snapshot(c._visibleDeviceSnapshot), candidate: snapshot(c._candidateDeviceSnapshot),
      rendered: snapshot(c._renderDeviceSnapshot),
      relocated: c._areaRelocationIds ? [...c._areaRelocationIds] : 'unknown',
      registries: { devices: c.hass?.devices, entities: c.hass?.entities, areas: c.hass?.areas },
      view: c._view, zoom: c._zoom, warmVp: c._warmVp, warmKey: c._warmKey,
      warmSlot: c._warmSlot ? { path: c._warmSlot.path, vp: c._warmSlot.vp,
        frameFingerprint: c._warmSlot.frameFingerprint, devices: c._warmSlot.devices } : null,
      warmStats: customElements.get('houseplan-card')._warmBootStats?.(),
      pending: { booting: c._booting, fading: c._bootFading, soft: c._bootSoft,
        mode: c._modeTransitionBusy, camera: !!c._cameraTransition?.active,
        continuity: c._continuity?.state, overlay: c._continuity?.overlayVisible,
        writes: c._writesPending, dirty: c._dirtyPos?.size, sent: c._sentPos?.size,
        config: c._saveConfigDebounced?.pending(), layout: c._persistLayout?.pending() },
      stage: node(stage), svg: node(stage.querySelector('svg.plan-svg')),
      wall: node(stage.querySelector('.wallbodies')),
      wallPaths: [...stage.querySelectorAll('.wallbodies path')].map(node),
      devices, fonts: document.fonts.status, html: stage.outerHTML,
    };
  });
}

for (const kind of ['isolated', 'exact-prefix']) {
  const har = resolve(out, `${kind}.har`);
  const { page, browser } = await launch({ width: 1000, height: 900 }, 1,
    ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'],
    { locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark', reducedMotion: 'reduce',
      recordHar: { path: har, content: 'embed', mode: 'full' } });
  try {
    if (kind === 'exact-prefix') for (const id of prefix) {
      await prepareGoldenScenario(page, goldenHarnessScenario(all.find(scene => scene.id === id)));
      await resetGoldenStability(page);
    }
    const runtime = await prepareGoldenScenario(page, scenario);
    const clip = await goldenClip(page, scenario.capture);
    const options = { clip, animations: 'disabled', caret: 'hide', scale: 'css' };
    // Record both sides of screenshot('animations: disabled'): it may finish
    // CSS animations and deliver callbacks. No extra wait or forced fit occurs.
    const beforeOrdinary = await inspect(page);
    const ordinary = await page.screenshot(options);
    writeFileSync(resolve(out, `${kind}-ordinary.png`), ordinary);
    const initial = await inspect(page);
    await page.waitForFunction(() => {
      const c = window.__goldenCard;
      return !c._booting && !c._bootFading && !c._bootSoft && !c._modeTransitionBusy
        && !c._cameraTransition?.active && (!c._continuity || c._continuity.state === 'steady')
        && !c._continuity?.overlayVisible && document.fonts.status === 'loaded';
    }, undefined, { timeout: 9000 });
    await page.evaluate(async () => {
      await window.__goldenCard.updateComplete;
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const beforeRepaint = await inspect(page);
    const settled = await page.screenshot(options);
    writeFileSync(resolve(out, `${kind}-settled.png`), settled);
    // Diagnostic reuse of the existing repaint helper; no scenario preparation,
    // model, camera, device style or geometry mutation is performed here.
    const repainted = await captureGoldenFrame(page, { ...scenario, id: 'geometry-plan-editor-dark' }, options);
    writeFileSync(resolve(out, `${kind}-repainted.png`), repainted);
    const afterRepaint = await inspect(page);
    rows.push({ kind, prefix: kind === 'exact-prefix' ? prefix : [], runtime,
      beforeOrdinary, initial, beforeRepaint, afterRepaint,
      screenshotSha256: { ordinary: hash(ordinary), settled: hash(settled), repainted: hash(repainted) },
      repaintStageDomUnchanged: beforeRepaint.html === afterRepaint.html,
      repaintNativeUnchanged: JSON.stringify([beforeRepaint.serverConfig, beforeRepaint.layout,
        beforeRepaint.cfgRev, beforeRepaint.layoutRev, beforeRepaint.view]) === JSON.stringify([
        afterRepaint.serverConfig, afterRepaint.layout, afterRepaint.cfgRev, afterRepaint.layoutRev, afterRepaint.view]),
    });
  } finally {
    await resetGoldenStability(page);
    await page.context().close(); // flush HAR, including actual served response bodies
    await finish(browser);
    const entries = JSON.parse(readFileSync(har)).log.entries;
    const assets = entries.filter(entry => new URL(entry.request.url).pathname.startsWith('/assets/'))
      .map(entry => ({ url: entry.request.url, status: entry.response.status,
        sha256: entry.response.content.text === undefined ? null : hash(Buffer.from(
          entry.response.content.text, entry.response.content.encoding === 'base64' ? 'base64' : 'utf8')) }));
    writeFileSync(resolve(out, `${kind}-served-assets.json`), JSON.stringify(assets, null, 2));
    writeFileSync(resolve(out, 'probe.json'), JSON.stringify({ diagnosticOnly: true,
      productBase: '7274a9139966cfdd1f459615110ba70544709dc7',
      capture: captureProvenance({ chromium: browser.version(),
        buildFingerprint: manifest.fingerprint, root }),
      unknownFields: 'unknown means not exposed by the compiled runtime; no readiness claim',
      rows }, (_key, value) => value === undefined ? 'unknown' : value, 2));
  }
}
console.log('Diagnostic evidence recorded; no release/S6 readiness verdict or golden acceptance.');
