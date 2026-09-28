// Issue #230: the hatch step is a physical distance, not a coordinate one.
//
// The units own the arithmetic; this smoke owns the wiring — that both renderers
// actually put the computed step into the pattern, that neither of them scales
// it back by zoom, and that the two agree with each other.
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
  const pattern = (root) => root.querySelector('#hp-wall-hatch');
  const read = (p) => p && ({
    width: Number(p.getAttribute('width')),
    height: Number(p.getAttribute('height')),
    transform: p.getAttribute('patternTransform') || '',
    stroke: Number(p.querySelector('path')?.getAttribute('stroke-width')),
    d: p.querySelector('path')?.getAttribute('d') || '',
  });

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
  const atFive = read(pattern(c.shadowRoot));
  out.referenceStepIsEight = atFive?.width === 8 && atFive?.height === 8;
  out.referenceStrokeIsTwo = atFive?.stroke === 2;
  out.noZoomScaleAtReference = !!atFive && !/scale/.test(atFive.transform);

  // Zoom must not touch the pattern any more — that is the whole point.
  c._applyView(3); await settle();
  const zoomed = read(pattern(c.shadowRoot));
  out.zoomDoesNotChangeThePattern = JSON.stringify(zoomed) === JSON.stringify(atFive);
  c._applyView(1); await settle();

  // A coarse grid: the step follows the centimetres, so it shrinks in units.
  space().cell_cm = 25;
  // Saved, not just poked locally: the static card reads the config from the
  // server, so a local mutation would leave it on the old scale.
  c._saveConfig();
  await new Promise((r) => setTimeout(r, 500));
  c.requestUpdate(); await settle();
  const atTwentyFive = read(pattern(c.shadowRoot));
  out.coarseGridShrinksTheStep = Math.abs(atTwentyFive.width - 1.6) < 1e-9;
  out.coarseGridScalesTheStroke = Math.abs(atTwentyFive.stroke - 0.4) < 1e-9;
  out.coarseGridStripeSpansTheCell = atTwentyFive.d === `M0 0 L0 ${atTwentyFive.width}`;

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
  const staticPattern = read(pattern(card.renderRoot));
  out.staticRendererFollowsTheCell = !!staticPattern
    && Math.abs(staticPattern.width - 1.6) < 1e-9;
  out.bothRenderersAgree = JSON.stringify(staticPattern) === JSON.stringify(atTwentyFive);

  return out;
});
checkAll(res);
await finish(browser, res);
