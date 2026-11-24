// #1545 and #1552: a single first-open status covers measured HA chrome.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

// ---------- phase 1: normal mode, HA panel lands late ----------
const res = await page.evaluate(async () => {
  const out = {};
  customElements.get('houseplan-card')?._warmBootReset?.(); // DEV-B703: this scenario simulates a COLD first open — forget the page's warm re-mount memo
  const spacer = document.createElement('div');
  spacer.style.cssText = 'height:0px';
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card' });
  c.hass = window.__card.hass;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  wrap.append(spacer, c);
  document.body.appendChild(wrap);

  const frames = [];
  const sr = () => c.shadowRoot || c.renderRoot;
  const t0 = performance.now();
  let grown = false;
  await new Promise((done) => {
    const sample = () => {
      const t = performance.now() - t0;
      if (!grown && t >= 300) {
        grown = true; // the "HA panel" arrives: everything above the card grows
        spacer.style.height = '56px';
        window.dispatchEvent(new Event('resize'));
      }
      const stage = sr().querySelector('.stage');
      if (stage) {
        const status = stage.querySelector('.floor-preparation-status');
        const wrapEl = stage.querySelector(':scope > .zoomwrap');
        const preview = !!stage.querySelector('[data-hp-cache-preview]');
        const style = wrapEl && getComputedStyle(wrapEl);
        frames.push({
          t: Math.round(t),
          planVisible: !!style && style.visibility === 'visible' && +style.opacity > 0 && !preview,
          previewSafe: !preview || (!!wrapEl?.inert && style.pointerEvents === 'none'
            && !stage.querySelector('[data-hp="device"],.roomlabel,[data-hp-live-editor],.glowlayer')),
          status: status && stage.querySelectorAll('.floor-preparation-status').length,
          opacity: style?.visibility === 'visible' ? +style.opacity : 0,
          background: getComputedStyle(stage).backgroundColor,
          house: !!sr().querySelector('.bootveil,.boothouse'),
          stageH: stage.clientHeight,
        });
      } else {
        frames.push(null);
      }
      if (t < 1400) requestAnimationFrame(sample);
      else done();
    };
    requestAnimationFrame(sample);
  });

  const seen = frames.filter(Boolean);
  const finalH = seen[seen.length - 1].stageH;
  out.sampledFrames = seen.length > 40;
  out.cachedPreviewIsPassiveWithoutLiveLayersOrNames = seen.every(f => f.previewSafe);
  out.singleStatusWhileSettling = seen.some(f => f.status === 1 && !f.planVisible)
    && seen.every(f => !f.status || f.status === 1);
  out.noHouse = seen.every(f => !f.house);
  out.oneStageBackground = new Set(seen.map(f => f.background)).size === 1;
  out.fullSceneFadesOverBackground = seen.some(f => f.status === 1 && f.opacity > 0 && f.opacity < 1);
  // THE assertion: no frame may show the plan at a stale (pre-panel) height
  const bad = seen.filter((f) => f.planVisible && Math.abs(f.stageH - finalH) > 2);
  out.noVisibleFrameAtStaleHeight = bad.length === 0
    ? true
    : `plan visible at h=${bad[0].stageH} (final ${finalH}) at t=${bad[0].t}ms — the jump is visible`;
  const shown = seen.filter((f) => f.planVisible);
  out.planShownAfterSettle = shown.length >= 5 && Math.abs(shown[0].stageH - finalH) <= 2;
  out.statusGoneInTheEnd = !seen.at(-1).status && seen.at(-1).opacity === 1;
  out.heightReactedToPanel = finalH !== seen[0].stageH; // the simulated panel actually moved the stage
  wrap.remove();
  return out;
});
for (const [k, v] of Object.entries(res)) check(k, v);

// ---------- phase 2: kiosk uses the same status for preparation ----------
const kiosk = await page.evaluate(async () => {
  const out = {};
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  c.hass = window.__card.hass;
  c.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:700px;z-index:99';
  document.body.appendChild(c);
  const sr = () => c.shadowRoot || c.renderRoot;
  let veilEver = false;
  let statusSeen = false, liveSeen = false;
  const t0 = performance.now();
  await new Promise((done) => {
    const sample = () => {
      const stage = sr().querySelector('.stage');
      if (stage) {
        if (sr().querySelector('.bootveil')) veilEver = true;
        const wrapEl = stage.querySelector(':scope > .zoomwrap');
        statusSeen ||= !!stage.querySelector('.floor-preparation-status');
        liveSeen ||= !stage.inert && !!wrapEl && getComputedStyle(wrapEl).opacity === '1';
      }
      if (performance.now() - t0 < 900) requestAnimationFrame(sample);
      else done();
    };
    requestAnimationFrame(sample);
  });
  out.kioskNoVeil = !veilEver;
  out.kioskStatusThenLive = statusSeen && liveSeen;
  c.remove();
  return out;
});
check('kioskNoVeil', kiosk.kioskNoVeil);
check('kioskStatusThenLive', kiosk.kioskStatusThenLive);

// ---------- phase 3: prefers-reduced-motion publishes in one frame ----------
// The wait lives on the Playwright side: an in-page promise that only a
// requestAnimationFrame chain keeps alive was reported as "garbage collected"
// on a CI runner (#506 beta.9 candidate) while the same phase passed locally.
// Polling from outside cannot be collected, and a destroyed context or a
// navigation surfaces as its own error instead of a vanished promise.
page.on('framenavigated', (frame) => console.log('diagnostic navigation:', frame.url()));
page.on('crash', () => console.log('diagnostic page crash'));
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.evaluate(() => {
  customElements.get('houseplan-card')?._warmBootReset?.(); // DEV-B703: this scenario simulates a COLD first open — forget the page's warm re-mount memo
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card' });
  c.hass = window.__card.hass;
  c.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99';
  document.body.appendChild(c);
  window.__preloaderReduced = { card: c, showedStatus: false, faded: false };
});
const reduced = await page.waitForFunction(() => {
  const probe = window.__preloaderReduced;
  const stage = probe.card.renderRoot.querySelector('.stage');
  if (!stage) return null;
  probe.showedStatus ||= !!stage.querySelector('.floor-preparation-status');
  probe.faded ||= stage.hasAttribute('data-hp-startup-finish');
  const wrap = stage.querySelector('.zoomwrap');
  return wrap && !stage.inert && probe.card.houseplanStartupFloorDiagnostics()?.live > 0
    ? { reducedStatusWasShown: probe.showedStatus, reducedHasNoFade: !probe.faded,
      reducedIsFullyVisible: getComputedStyle(wrap).visibility === 'visible'
        && getComputedStyle(wrap).opacity === '1' && !stage.querySelector('.floor-preparation-status') }
    : null;
}, null, { polling: 'raf', timeout: 5000 }).then(handle => handle.jsonValue());
await page.evaluate(() => { window.__preloaderReduced.card.remove(); delete window.__preloaderReduced; });
for (const [key, value] of Object.entries(reduced)) check(key,value);

await finish(browser, { ...res, ...kiosk, ...reduced });
