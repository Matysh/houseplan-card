// HP-1552: residual jump on first open in NORMAL (non-kiosk) mode. The stage is
// calc(100dvh - _hdrH) and _hdrH is measured from HA's chrome, which loads
// AFTER the card's first paint — so the plan painted, then jumped when the
// panels landed. The fix hides the plan behind a boot veil (pulsing house)
// until the height reads the same twice in a row (or ~600 ms). This smoke
// simulates the late HA panel: a spacer above the card grows 0 → 56 px at
// t=300 ms. Assertions: the veil is shown, and there is NOT A SINGLE frame
// where the plan is visible at a non-final stage height. Kiosk: no veil ever.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

// ---------- phase 1: normal mode, HA panel lands late ----------
const res = await page.evaluate(async () => {
  const out = {};
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
        const veil = sr().querySelector('.bootveil');
        const wrapEl = stage.querySelector(':scope > .zoomwrap');
        const planHidden =
          !wrapEl ||
          getComputedStyle(wrapEl).visibility === 'hidden' ||
          (veil && !veil.classList.contains('off') && getComputedStyle(veil).opacity !== '0');
        frames.push({
          t: Math.round(t),
          planVisible: !planHidden,
          veil: !!veil,
          veilBg: veil ? getComputedStyle(veil).backgroundColor : null,
          house: !!(veil && veil.querySelector('.boothouse path')),
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
  out.veilShownWhileSettling = seen.some((f) => f.veil && !f.planVisible && f.house);
  out.veilIsDark = (() => {
    const f = seen.find((x) => x.veilBg);
    const m = f && f.veilBg.match(/(\d+),\s*(\d+),\s*(\d+)/);
    return !!m && +m[1] + +m[2] + +m[3] < 300; // dark, not white/transparent
  })();
  // THE assertion: no frame may show the plan at a stale (pre-panel) height
  const bad = seen.filter((f) => f.planVisible && Math.abs(f.stageH - finalH) > 2);
  out.noVisibleFrameAtStaleHeight = bad.length === 0
    ? true
    : `plan visible at h=${bad[0].stageH} (final ${finalH}) at t=${bad[0].t}ms — the jump is visible`;
  const shown = seen.filter((f) => f.planVisible);
  out.planShownAfterSettle = shown.length >= 5 && Math.abs(shown[0].stageH - finalH) <= 2;
  out.veilGoneInTheEnd = !seen[seen.length - 1].veil;
  out.heightReactedToPanel = finalH !== seen[0].stageH; // the simulated panel actually moved the stage
  wrap.remove();
  return out;
});
for (const [k, v] of Object.entries(res)) check(k, v);

// ---------- phase 2: kiosk never shows the veil ----------
const kiosk = await page.evaluate(async () => {
  const out = {};
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  c.hass = window.__card.hass;
  c.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:700px;z-index:99';
  document.body.appendChild(c);
  const sr = () => c.shadowRoot || c.renderRoot;
  let veilEver = false;
  let planHiddenEver = false;
  const t0 = performance.now();
  await new Promise((done) => {
    const sample = () => {
      const stage = sr().querySelector('.stage');
      if (stage) {
        if (sr().querySelector('.bootveil')) veilEver = true;
        const wrapEl = stage.querySelector(':scope > .zoomwrap');
        if (wrapEl && getComputedStyle(wrapEl).visibility === 'hidden') planHiddenEver = true;
      }
      if (performance.now() - t0 < 900) requestAnimationFrame(sample);
      else done();
    };
    requestAnimationFrame(sample);
  });
  out.kioskNoVeil = !veilEver;
  out.kioskPlanNeverHidden = !planHiddenEver;
  c.remove();
  return out;
});
check('kioskNoVeil', kiosk.kioskNoVeil);
check('kioskPlanNeverHidden', kiosk.kioskPlanNeverHidden);

// ---------- phase 3: prefers-reduced-motion → the house does not pulse ----------
await page.emulateMedia({ reducedMotion: 'reduce' });
const reduced = await page.evaluate(async () => {
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card' });
  c.hass = window.__card.hass;
  c.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99';
  document.body.appendChild(c);
  const sr = () => c.shadowRoot || c.renderRoot;
  const t0 = performance.now();
  let anim = 'missed';
  await new Promise((done) => {
    const tick = () => {
      const house = sr().querySelector('.bootveil .boothouse');
      if (house) { anim = getComputedStyle(house).animationName; done(); return; }
      if (performance.now() - t0 < 500) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  c.remove();
  return { anim };
});
check('reducedMotionStaticHouse', reduced.anim, 'none');

await finish(browser, { ...res, ...kiosk, ...reduced });
