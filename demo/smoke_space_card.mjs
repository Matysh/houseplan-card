// Smoke: houseplan-space-card renders a live, non-interactive schematic + deep-link button.
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
  const named = mk({ type: 'custom:houseplan-space-card', space: spaceId, title: 'Named floor' });
  const compact = mk({ type: 'custom:houseplan-space-card', space: spaceId, title: '' });
  const compactNoButton = mk({ type: 'custom:houseplan-space-card', space: spaceId, title: '', show_button: false });
  const waitForStage = async (el) => {
    const t0 = Date.now();
    while (!el.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) {
      await new Promise(r => setTimeout(r, 80));
    }
    await el.updateComplete;
  };
  await Promise.all([card, named, compact, compactNoButton].map(waitForStage));

  const frameOf = (el) => {
    const vb = el.renderRoot.querySelector('.hp-static-stage svg')?.viewBox?.baseVal;
    return vb ? { x: vb.x, y: vb.y, w: vb.width, h: vb.height } : null;
  };
  const frame = frameOf(card);
  const namedFrame = frameOf(named);
  const compactFrame = frameOf(compact);
  const compactNoButtonFrame = frameOf(compactNoButton);
  const compactCardBox = compact.renderRoot.querySelector('ha-card')?.getBoundingClientRect();
  const compactStageBox = compact.renderRoot.querySelector('.hp-static-stage')?.getBoundingClientRect();
  const compactTopGap = compactCardBox && compactStageBox
    ? Math.abs(compactStageBox.top - compactCardBox.top) : null;

  const stage = card.renderRoot.querySelector('.hp-static-stage');
  const pe = stage ? getComputedStyle(stage).pointerEvents : null;
  const markers = card.renderRoot.querySelectorAll('.hp-static-stage .devlayer .dev').length;
  const litMarker = card.renderRoot.querySelector('.hp-static-stage .dev[data-id="d_light1"]');
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
    litMarkerOn: !!litMarker?.classList.contains('on'),
    sharedFacePresent: !!litMarker?.querySelector('ha-icon'),
    omittedTitle: card.renderRoot.querySelector('.hp-static-title')?.textContent?.trim() || null,
    namedTitle: named.renderRoot.querySelector('.hp-static-title')?.textContent?.trim() || null,
    compactHasTitle: !!compact.renderRoot.querySelector('.hp-static-title'),
    compactTopGap,
    frame,
    namedFrame,
    compactFrame,
    compactNoButtonFrame,
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
  res.litMarkerOn &&
  res.sharedFacePresent &&
  !!res.omittedTitle &&
  res.namedTitle === 'Named floor' &&
  !res.compactHasTitle &&
  res.compactTopGap !== null && res.compactTopGap < 0.51 &&
  res.frame && res.namedFrame && res.compactFrame && res.compactNoButtonFrame &&
  JSON.stringify(res.frame) === JSON.stringify(res.namedFrame) &&
  res.compactFrame.x === res.frame.x &&
  res.compactFrame.w === res.frame.w &&
  res.compactFrame.y > res.frame.y &&
  Math.abs((res.compactFrame.y + res.compactFrame.h) - (res.frame.y + res.frame.h)) < 1e-6 &&
  JSON.stringify(res.compactFrame) === JSON.stringify(res.compactNoButtonFrame) &&
  res.hasButton &&
  typeof res.deepLink === 'string' && res.deepLink.includes('#space=') &&
  res.errorShown;
console.log(JSON.stringify(res));
if (!ok) { console.error('FAIL space-card smoke'); process.exit(1); }
console.log('OK space-card: live shared marker face, pointer-events:none, deep-link button, error card');
