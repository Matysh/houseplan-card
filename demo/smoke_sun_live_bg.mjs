// Owner 2026-08-04: «цвет фона не меняется сам с течением времени суток, только
// после обновления страницы». The day/night sky must follow sun.sun on a plain
// hass tick — no reload, no requestUpdate() from the outside — and the COMPUTED
// background of the stage (what the eye sees, not the style attribute) must
// actually arrive at the sky colour (docs/SUN.md).
import { launch, check, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const cfg = c._serverCfg;
  cfg.settings = { ...(cfg.settings || {}), north_deg: 0, bg_mode: 'daynight', sun_rays: true };
  cfg.spaces.find((s) => s.id === 'f1').openings = [
    { id: 'wS', type: 'window', x: 0.30, y: 0.86, angle: 0, length: 0.08 },
  ];
  c._cfgEpoch++;
  // NO requestUpdate anywhere below: production only ever assigns `hass`.
  const setSun = async (az, el) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: el > 0 ? 'above_horizon' : 'below_horizon',
      attributes: { azimuth: az, elevation: el },
    } } };
    await c.updateComplete;
    // one paint so the sky lands on screen, not only in the attribute
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  const stage = () => sr().querySelector('.stage');
  const comp = () => getComputedStyle(stage()).backgroundColor;
  const dim = () => (sr().querySelector('.zoomwrap').getAttribute('style') || '');
  const polys = () => sr().querySelectorAll('.sunlayer polygon').length;
  const hexToRgb = (h) => 'rgb(' + [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';

  await setSun(180, 40);
  out.dayComputedWhite = comp() === 'rgb(255, 255, 255)';
  out.dayNoDim = dim().includes('brightness(1.000)');
  out.dayRays = polys() > 0;

  // the whole point: a NEW hass, nothing else. No reload, no requestUpdate.
  await setSun(180, -10);
  out.nightComputedDark = comp() === 'rgb(10, 16, 25)';
  out.nightDimmed = dim().includes('brightness(0.900');
  out.nightNoRays = polys() === 0;

  // ...and back, again on a plain tick
  await setSun(180, 40);
  out.backToDayComputed = comp() === 'rgb(255, 255, 255)';
  out.backToDayRays = polys() > 0;

  // a small step still moves the sky (0.1° granularity of the model)...
  await setSun(180, 20);
  const twenty = comp();
  await setSun(180, 12);
  out.smallStepMovesSky = comp() !== twenty;

  // ...but a step the size of a REAL sun update (~1° per 4 minutes) must still
  // GLIDE: the catch-up jump is for a card that was not watching, never for the
  // day/night breathing itself (docs/SUN.md).
  await setSun(180, 12.6);
  const target = stage().getAttribute('style').split('background:')[1];
  out.realStepNoSnapClass = !sr().querySelector('.stage.skysnap');
  out.realStepStillGlides = comp() !== hexToRgb(target); // 45 s transition, not a jump

  // A quick tab switch is not a suspended renderer: keep the current painted
  // sky and hover in place. The old visibility handler cleared both on every
  // return, producing a one-frame whole-plan flash even after two seconds.
  const ownVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const room = c._spaceModel().rooms[0];
  c._hoverRoom = { space: c._space, room };
  c.requestUpdate();
  await c.updateComplete;
  const skyBeforeQuickReturn = c._skyElev;
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  await c.updateComplete;
  out.quickReturnKeepsSky = c._skyElev === skyBeforeQuickReturn;
  out.quickReturnKeepsHover = c._hoverRoom?.room === room;
  out.quickReturnHasNoSnapFrame = !stage().classList.contains('skysnap')
    && !stage().classList.contains('hpresume');
  if (ownVisibilityState) Object.defineProperty(document, 'visibilityState', ownVisibilityState);
  else delete document.visibilityState;

  // the tab came back from the background: the sky catches up at once
  await setSun(180, 25);          // 12° of sun happened while we were not painting
  out.returnFromHiddenSnaps = comp() === hexToRgb(stage().getAttribute('style').split('background:')[1]);

  return out;
});
await finish(browser, checkAll(res));
