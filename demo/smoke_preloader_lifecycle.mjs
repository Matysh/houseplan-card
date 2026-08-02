// AUD-1552-01 + AUD-1552-02: adversarial lifecycle regressions for the
// first-open boot veil (HP-1552). Both scenarios FAIL on v1.55.2.
//
// A. disconnect/reconnect while booting (Lovelace rebuilds its DOM, a view
//    switch remounts the card). v1.55.2 cleared the boot timer on disconnect
//    but kept its truthy id, so the reconnect never restarted the watcher and
//    the plan stayed hidden FOREVER. Now the veil lifecycle restarts from
//    connectedCallback: the veil must lift no later than the hard cap.
// B. layout shifts before, between and after the old poll ticks (150, 300,
//    450, 590 ms). v1.55.2 revealed the plan after two equal reads at
//    200/400 ms, so a panel landing at 450+ ms jumped on a VISIBLE plan. Now
//    the veil holds for the full protective window with trailing quiescence:
//    not a single frame may show the plan at a non-final stage height.
// C. a shift AFTER the reveal (slower than the cap) must glide, not snap:
//    for a short grace the stage height transitions and the plan refits
//    along with it (no transition at all on v1.55.2 — instant jump).
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

// ---------- A: detach before the first tick, reattach, veil must lift ----------
const rec = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card' });
  c.hass = window.__card.hass;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  wrap.appendChild(c);
  document.body.appendChild(wrap);
  await sleep(50); // the first boot tick has not fired yet
  out.bootingWhenDetached = c._booting === true;
  c.remove(); // disconnect: timers die here
  await sleep(30);
  wrap.appendChild(c); // reconnect — the veil lifecycle must restart
  const t0 = performance.now();
  const sr = () => c.shadowRoot || c.renderRoot;
  while (c._booting && performance.now() - t0 < 2000) await sleep(50);
  out.revealMs = Math.round(performance.now() - t0);
  out.bootSettledAfterReconnect = c._booting === false;
  out.settledWithinCap = performance.now() - t0 < 1500; // hard cap 1200 + slack
  await sleep(300); // let the fade finish
  const stage = sr().querySelector('.stage');
  const wrapEl = stage && stage.querySelector(':scope > .zoomwrap');
  out.planVisibleAfterReconnect = !!wrapEl && getComputedStyle(wrapEl).visibility === 'visible';
  out.noHpbootClass = !!stage && !stage.classList.contains('hpboot');
  out.veilGone = !sr().querySelector('.bootveil');

  // A2: a second detach DURING the fade must not leave a zombie veil either
  const c2 = document.createElement('houseplan-card');
  c2.setConfig({ type: 'custom:houseplan-card' });
  c2.hass = window.__card.hass;
  wrap.appendChild(c2);
  const t1 = performance.now();
  while (c2._booting && performance.now() - t1 < 2000) await sleep(50);
  // _bootFading is true for ~220 ms after the reveal — detach right inside it
  c2.remove();
  await sleep(30);
  wrap.appendChild(c2);
  await sleep(400);
  const sr2 = c2.shadowRoot || c2.renderRoot;
  out.fadeVeilGoneAfterReattach = !sr2.querySelector('.bootveil') && c2._bootFading === false;
  wrap.remove();
  return out;
});
for (const [k, v] of Object.entries(rec)) check(k, v, k === 'revealMs' ? rec.revealMs : true);

// ---------- B: shifts at 150/300/450/590 ms — never a visible stale frame ----------
const shifts = [150, 300, 450, 590];
const outB = {};
for (const shiftMs of shifts) {
  const res = await page.evaluate(async (shiftAt) => {
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
        if (!grown && t >= shiftAt) {
          grown = true; // the "HA panel" arrives
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
          frames.push({ t: Math.round(t), planVisible: !planHidden, stageH: stage.clientHeight });
        }
        if (t < 1900) requestAnimationFrame(sample);
        else done();
      };
      requestAnimationFrame(sample);
    });
    const seen = frames;
    const finalH = seen[seen.length - 1].stageH;
    // THE assertion: no frame may show the plan at a stale (pre-panel) height
    const bad = seen.filter((f) => f.planVisible && Math.abs(f.stageH - finalH) > 2);
    out.noStaleFrame = bad.length === 0
      ? true
      : `plan visible at h=${bad[0].stageH} (final ${finalH}) at t=${bad[0].t}ms`;
    const shown = seen.filter((f) => f.planVisible);
    out.planShown = shown.length >= 5 && Math.abs(shown[0].stageH - finalH) <= 2;
    out.heightReacted = finalH !== seen[0].stageH;
    wrap.remove();
    return out;
  }, shiftMs);
  outB[`shift${shiftMs}_noStaleFrame`] = res.noStaleFrame;
  outB[`shift${shiftMs}_planShown`] = res.planShown;
  outB[`shift${shiftMs}_heightReacted`] = res.heightReacted;
  check(`shift${shiftMs}_noStaleFrame`, res.noStaleFrame);
  check(`shift${shiftMs}_planShown`, res.planShown);
  check(`shift${shiftMs}_heightReacted`, res.heightReacted);
}

// ---------- C: shift AFTER the reveal glides instead of snapping ----------
const late = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const spacer = document.createElement('div');
  spacer.style.cssText = 'height:0px';
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card' });
  c.hass = window.__card.hass;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  wrap.append(spacer, c);
  document.body.appendChild(wrap);
  const sr = () => c.shadowRoot || c.renderRoot;
  const t0 = performance.now();
  while (c._booting && performance.now() - t0 < 2500) await sleep(25);
  out.revealed = c._booting === false;
  await sleep(120); // clearly after the reveal, still inside the soft grace
  const stage = sr().querySelector('.stage');
  const h0 = stage.clientHeight;
  spacer.style.height = '56px'; // VERY late panel — slower than the cap
  window.dispatchEvent(new Event('resize'));
  const heights = [];
  await new Promise((done) => {
    const t1 = performance.now();
    const sample = () => {
      heights.push(stage.clientHeight);
      if (performance.now() - t1 < 700) requestAnimationFrame(sample);
      else done();
    };
    requestAnimationFrame(sample);
  });
  const hEnd = heights[heights.length - 1];
  out.heightMoved = Math.abs(hEnd - h0) > 30;
  // the glide: intermediate frames strictly between the endpoints
  const mid = heights.filter((h) => Math.abs(h - h0) > 4 && Math.abs(h - hEnd) > 4);
  out.lateShiftGlides = mid.length >= 3
    ? true
    : `only ${mid.length} intermediate frame(s): ${h0} -> ${hEnd} snapped`;
  out.settledAtFinal = Math.abs(hEnd - (h0 - 56)) <= 2;
  wrap.remove();
  return out;
});
check('late_revealed', late.revealed);
check('late_heightMoved', late.heightMoved);
check('late_lateShiftGlides', late.lateShiftGlides);
check('late_settledAtFinal', late.settledAtFinal);

await finish(browser, { ...rec, ...outB, ...late });
