// Smoke: houseplan-space-card renders a live, non-interactive schematic + deep-link button.
import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const hass = window.__card.hass;
  const spaceId = window.__card._model[0].id;
  // Give the real static renderer structural voters that room-only fixtures
  // cannot prove: an independent wall, saved draft, column and hosted door.
  const response = await hass.callWS({ type: 'houseplan/config/get' });
  const configs = [...new Set([response?.config, window.__card._serverCfg])].filter(Boolean);
  for (const config of configs) {
    const fixture = config.spaces.find((space) => space.id === spaceId);
    fixture.cell_cm = 5;
    fixture.settings = {
      ...(fixture.settings || {}), show_borders: true, show_names: true, hide_openings: false,
    };
    fixture.partitions = [{ id: 'fit-wall', a: [0.20, 0.25], b: [0.80, 0.25], cm: 15 }];
    fixture.room_drafts = [{
      id: 'fit-draft', points: [[0.18, 0.90], [0.42, 0.90]], segments: [{ cm: 10 }],
    }];
    fixture.wall_columns = [{ id: 'fit-column', shape: 'circle', center: [0.84, 0.90], cm: 30 }];
    fixture.openings = [{
      id: 'fit-door', type: 'door', length: 0.14,
      host: { kind: 'partition', id: 'fit-wall', t: 0.5 },
    }];
  }
  const host = document.createElement('div');
  document.body.appendChild(host);

  const mk = (cfg) => { const el = document.createElement('houseplan-space-card'); el.setConfig(cfg); el.hass = hass; host.appendChild(el); return el; };
  const card = mk({ type: 'custom:houseplan-space-card', space: spaceId, button_target: '/plan-doma' });
  const explicitContent = mk({ type: 'custom:houseplan-space-card', space: spaceId, fit: 'content' });
  const unknownFit = mk({ type: 'custom:houseplan-space-card', space: spaceId, fit: 'cover' });
  const tight = mk({ type: 'custom:houseplan-space-card', space: spaceId, fit: 'house' });
  const tightNoTitle = mk({ type: 'custom:houseplan-space-card', space: spaceId, fit: 'house', title: '' });
  const named = mk({ type: 'custom:houseplan-space-card', space: spaceId, title: 'Named floor' });
  const compact = mk({ type: 'custom:houseplan-space-card', space: spaceId, title: '' });
  const compactNoButton = mk({ type: 'custom:houseplan-space-card', space: spaceId, title: '', show_button: false });
  const narrowHost = document.createElement('div');
  narrowHost.style.width = '320px';
  compact.before(narrowHost);
  narrowHost.appendChild(compact);
  compact.hass = { ...hass, themes: { ...(hass.themes || {}), darkMode: false } };
  const wideHost = document.createElement('div');
  wideHost.style.width = '900px';
  compactNoButton.before(wideHost);
  wideHost.appendChild(compactNoButton);
  compactNoButton.hass = { ...hass, themes: { ...(hass.themes || {}), darkMode: true } };
  const waitForStage = async (el) => {
    const t0 = Date.now();
    while (!el.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) {
      await new Promise(r => setTimeout(r, 80));
    }
    await el.updateComplete;
  };
  await Promise.all([
    card, explicitContent, unknownFit, tight, tightNoTitle,
    named, compact, compactNoButton,
  ].map(waitForStage));

  const frameOf = (el) => {
    const vb = el.renderRoot.querySelector('.hp-static-stage svg')?.viewBox?.baseVal;
    return vb ? { x: vb.x, y: vb.y, w: vb.width, h: vb.height } : null;
  };
  const frame = frameOf(card);
  const explicitContentFrame = frameOf(explicitContent);
  const unknownFitFrame = frameOf(unknownFit);
  const tightFrame = frameOf(tight);
  const tightNoTitleFrame = frameOf(tightNoTitle);
  const namedFrame = frameOf(named);
  const compactFrame = frameOf(compact);
  const compactNoButtonFrame = frameOf(compactNoButton);
  const compactCardBox = compact.renderRoot.querySelector('ha-card')?.getBoundingClientRect();
  const compactStageBox = compact.renderRoot.querySelector('.hp-static-stage')?.getBoundingClientRect();
  const wideStageBox = compactNoButton.renderRoot.querySelector('.hp-static-stage')?.getBoundingClientRect();
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
    compactWidths: [compactStageBox?.width || 0, wideStageBox?.width || 0],
    compactOverflow: [compact, compactNoButton].some((el) => {
      const body = el.renderRoot.querySelector('.hp-static-body');
      return body ? body.scrollWidth > body.clientWidth + 1 : true;
    }),
    compactThemes: [compact.hass.themes.darkMode, compactNoButton.hass.themes.darkMode],
    frame,
    explicitContentFrame,
    unknownFitFrame,
    tightFrame,
    tightNoTitleFrame,
    tightPointerEvents: getComputedStyle(
      tight.renderRoot.querySelector('.hp-static-stage'),
    ).pointerEvents,
    tightStructuralEdges: (() => {
      const vb = tightFrame;
      if (!vb) return null;
      const rooms = [...tight.renderRoot.querySelectorAll('[data-hp="room"]')];
      const points = rooms.flatMap((room) => {
        if (room.tagName.toLowerCase() === 'polygon') {
          return Array.from(room.points).map((point) => [point.x, point.y]);
        }
        const x = room.x.baseVal.value, y = room.y.baseVal.value;
        const w = room.width.baseVal.value, h = room.height.baseVal.value;
        return [[x, y], [x + w, y + h]];
      });
      return points.every(([x, y]) =>
        x >= vb.x && x <= vb.x + vb.w && y >= vb.y && y <= vb.y + vb.h);
    })(),
    tightPaintedEnvelope: (() => {
      const svg = tight.renderRoot.querySelector('.hp-static-stage svg');
      if (!svg) return null;
      const viewport = svg.getBoundingClientRect();
      const nodes = [...svg.querySelectorAll('.wallbody, .zero-wall, .static-opening')];
      return {
        wall: !!svg.querySelector('.wallbody'),
        opening: !!svg.querySelector('[data-id="fit-door"]'),
        contained: nodes.length > 0 && nodes.every((node) => {
          const box = node.getBoundingClientRect();
          return box.left >= viewport.left - 0.51 && box.right <= viewport.right + 0.51
            && box.top >= viewport.top - 0.51 && box.bottom <= viewport.bottom + 0.51;
        }),
      };
    })(),
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
  res.compactWidths[0] > 300 && res.compactWidths[0] <= 320 &&
  res.compactWidths[1] > 880 && res.compactWidths[1] <= 900 &&
  !res.compactOverflow &&
  JSON.stringify(res.compactThemes) === JSON.stringify([false, true]) &&
  res.frame && res.namedFrame && res.compactFrame && res.compactNoButtonFrame &&
  res.explicitContentFrame && res.unknownFitFrame && res.tightFrame && res.tightNoTitleFrame &&
  JSON.stringify(res.frame) === JSON.stringify(res.explicitContentFrame) &&
  JSON.stringify(res.frame) === JSON.stringify(res.unknownFitFrame) &&
  JSON.stringify(res.tightFrame) === JSON.stringify(res.tightNoTitleFrame) &&
  res.tightFrame.w < res.frame.w && res.tightFrame.h < res.frame.h &&
  res.tightFrame.x > res.frame.x && res.tightFrame.y > res.frame.y &&
  res.tightPointerEvents === 'none' && res.tightStructuralEdges &&
  res.tightPaintedEnvelope?.wall && res.tightPaintedEnvelope?.opening &&
  res.tightPaintedEnvelope?.contained &&
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
