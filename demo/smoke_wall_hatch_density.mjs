// Issue #230: the hatch step is a physical distance, not a coordinate one.
//
// The units own the arithmetic; this smoke owns the wiring — that both renderers
// actually put the computed step into the paint server, that neither of them
// scales it back by zoom, and that the two agree geometrically.  The full card
// uses #685's analytic repeating gradient while the non-interactive card keeps
// the historical stroked pattern, so the comparison deliberately normalises
// both representations to the same physical contract.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 1000, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const settle = async () => {
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    await c.updateComplete;
  };
  const space = () => c._serverCfg.spaces.find((s) => s.id === c._space);
  const paint = (root) => root.querySelector('#hp-wall-hatch');
  const read = (server) => {
    if (!server) return null;
    if (server.localName === 'linearGradient') {
      const x1 = Number(server.getAttribute('x1'));
      const y1 = Number(server.getAttribute('y1'));
      const x2 = Number(server.getAttribute('x2'));
      const y2 = Number(server.getAttribute('y2'));
      const stops = [...server.querySelectorAll('stop')];
      const edge = Number(stops[1]?.getAttribute('offset'));
      const step = Math.hypot(x2 - x1, y2 - y1);
      const rotation = Number((server.getAttribute('gradientTransform') || '')
        .match(/rotate\(([-+0-9.eE]+)/)?.[1] || 0);
      return {
        step,
        stripe: 2 * edge * step,
        angle: Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + rotation,
        origin: `${x1},${y1}`,
      };
    }
    const width = Number(server.getAttribute('width'));
    return {
      step: width,
      stripe: Number(server.querySelector('path')?.getAttribute('stroke-width')),
      angle: Number((server.getAttribute('patternTransform') || '').match(/rotate\(([-+0-9.eE]+)/)?.[1]),
      origin: '0,0',
    };
  };

  c._mode = 'plan'; c.requestUpdate(); await settle();
  await new Promise((r) => setTimeout(r, 400));

  // The demo house has no thick walls, and without a wall body neither renderer
  // emits the pattern. Set 15 cm on one wall the way a person would — through
  // the thickness tool, so the walls end up keyed exactly as the card expects.
  space().settings = { ...(space().settings || {}), show_borders: true };
  c._tool = 'wallthick';
  c.requestUpdate(); await settle();
  c._wallThickClick([50, 250]);
  await settle();
  c._wallDialog = { ...c._wallDialog, value: '15' };
  c._wallThickApply(true);
  await new Promise((r) => setTimeout(r, 500));
  c._tool = null;
  c.requestUpdate(); await settle();
  out.wallBodyIsRendered = !!c.shadowRoot.querySelector('.wallbody');

  // Reference scale: exactly the historical numbers, so old plans do not move.
  const atFive = read(paint(c.shadowRoot));
  out.referenceStepIsEight = Math.abs((atFive?.step ?? 0) - 8) < 1e-9;
  out.referenceStrokeIsTwo = Math.abs((atFive?.stripe ?? 0) - 2) < 1e-9;
  out.referenceAngleIsFortyFive = Math.abs((atFive?.angle ?? 0) - 45) < 1e-9;

  // Zoom must not touch the pattern any more — that is the whole point.
  c._applyView(3); c.requestUpdate(); await settle();
  const zoomed = read(paint(c.shadowRoot));
  out.zoomDoesNotChangeThePattern = JSON.stringify(zoomed) === JSON.stringify(atFive);
  c._applyView(1); c.requestUpdate(); await settle();

  // A coarse grid: the step follows the centimetres, so it shrinks in units.
  space().cell_cm = 25;
  // Saved, not just poked locally: the static card reads the config from the
  // server, so a local mutation would leave it on the old scale.
  c._saveConfig();
  await new Promise((r) => setTimeout(r, 500));
  c.requestUpdate(); await settle();
  const atTwentyFive = read(paint(c.shadowRoot));
  out.coarseGridShrinksTheStep = Math.abs(atTwentyFive.step - 1.6) < 1e-9;
  out.coarseGridScalesTheStroke = Math.abs(atTwentyFive.stripe - 0.4) < 1e-9;
  out.coarseGridKeepsTheAngle = Math.abs(atTwentyFive.angle - 45) < 1e-9;

  // The static renderer is the second path that draws a wall body, and it used
  // to carry its own hard-coded 8 (spec §8.2, AC12).
  await customElements.whenDefined('houseplan-space-card');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: c._space });
  card.hass = c.hass;
  host.appendChild(card);
  const t0 = Date.now();
  while (!card.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 80));
  }
  await card.updateComplete;
  const staticPattern = read(paint(card.renderRoot));
  out.staticRendererFollowsTheCell = !!staticPattern
    && Math.abs(staticPattern.step - 1.6) < 1e-9;
  out.bothRenderersAgree = !!staticPattern
    && Math.abs(staticPattern.step - atTwentyFive.step) < 1e-9
    && Math.abs(staticPattern.stripe - atTwentyFive.stripe) < 1e-9
    && Math.abs(staticPattern.angle - atTwentyFive.angle) < 1e-9
    && staticPattern.origin === atTwentyFive.origin;

  return out;
});
checkAll(res);
await finish(browser, res);
