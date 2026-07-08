// Smoke: houseplan-space-card renders a static, non-interactive schematic + deep-link button.
import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const hass = window.__card.hass;
  const spaceId = window.__card._model[0].id;
  const host = document.createElement('div');
  document.body.appendChild(host);

  const mk = (cfg) => { const el = document.createElement('houseplan-space-card'); el.setConfig(cfg); el.hass = hass; host.appendChild(el); return el; };
  const card = mk({ type: 'custom:houseplan-space-card', space: spaceId, button_target: '/plan-doma' });
  // wait for the static stage to render (config loads via WS)
  const t0 = Date.now();
  while (!card.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) { await new Promise(r => setTimeout(r, 80)); }
  await card.updateComplete;

  const stage = card.renderRoot.querySelector('.hp-static-stage');
  const pe = stage ? getComputedStyle(stage).pointerEvents : null;
  const markers = card.renderRoot.querySelectorAll('.hp-static-stage .devlayer .dev').length;
  const btn = card.renderRoot.querySelector('.hp-static-btn');

  // deep-link: clicking the button pushes #space=<id>
  let pushed = null;
  const orig = history.pushState;
  history.pushState = function (a, b, url) { pushed = url; return orig.apply(this, arguments); };
  btn?.click();
  history.pushState = orig;

  // error card for an unknown space
  const bad = mk({ type: 'custom:houseplan-space-card', space: '__nope__' });
  await bad.updateComplete;
  const errCard = bad.renderRoot.querySelector('.hp-static-error');

  return {
    stagePointerEvents: pe,
    markers,
    hasButton: !!btn,
    deepLink: pushed,
    errorShown: !!errCard,
    errorText: errCard?.textContent?.trim() || null,
  };
});
await browser.close();
const ok =
  res.stagePointerEvents === 'none' &&
  res.markers > 0 &&
  res.hasButton &&
  typeof res.deepLink === 'string' && res.deepLink.includes('#space=') &&
  res.errorShown;
console.log(JSON.stringify(res));
if (!ok) { console.error('FAIL space-card smoke'); process.exit(1); }
console.log('OK space-card: static (pointer-events:none), markers rendered, deep-link button, error card');
