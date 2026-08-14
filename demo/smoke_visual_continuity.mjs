// #73: lifecycle frame-sequence contract. The last complete plan must remain
// visible across quick/long returns; recovery tokens may advance, pixels may
// not disappear or regress to an empty/default frame.
import { launch, check, finish } from './serve.mjs';
import { makeVisualMatrixFixture } from './fixtures/visual-matrix.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const fixture = makeVisualMatrixFixture();
fixture.states['sun.sun'].attributes.azimuth = 0;
fixture.config.spaces[1].plan_url = '/api/houseplan/content/continuity.svg';
fixture.config.spaces[1].decor = [
  { id: 'continuity-axis', kind: 'line', x1: 0.08, y1: 0.52, x2: 0.92, y2: 0.52,
    color: '#5d6a73', opacity: 0.45, width_cm: 1, line_style: 'dashed' },
];

const result = await page.evaluate(async (visualFixture) => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitUntil = async (predicate, timeout = 3000) => {
    const start = performance.now();
    while (!predicate() && performance.now() - start < timeout) await sleep(20);
    return predicate();
  };
  const originalHass = card.hass;
  const originalCallWS = originalHass.callWS;
  const fixtureCallWS = async (message) => {
    if (message.type === 'houseplan/config/get') {
      return { config: visualFixture.config, rev: 73, can_write: true };
    }
    if (message.type === 'houseplan/layout/get') return { layout: visualFixture.layout, rev: 73 };
    if (message.type === 'config/device_registry/list') return Object.values(visualFixture.devices);
    if (message.type === 'config/entity_registry/list') return Object.values(visualFixture.entities);
    if (message.type === 'houseplan/content/sign') {
      return { urls: Object.fromEntries((message.paths || []).map((path) =>
        [path, '/assets/f1.svg?authSig=continuity'])) };
    }
    return originalCallWS.call(originalHass, message);
  };
  card._serverCfg = visualFixture.config;
  card._layout = visualFixture.layout;
  card._space = 'golden-lighting';
  // This fixture starts after a same-route space choice. #131 deliberately
  // refuses to treat the class initializer/current id as cold-start intent;
  // mark this injected selection as already adopted navigation so the reload
  // exercises continuity instead of cold-start precedence.
  card._navApplied = true;
  card._regSignature = '';
  card.hass = {
    ...card.hass,
    states: visualFixture.states,
    entities: visualFixture.entities,
    devices: visualFixture.devices,
    areas: visualFixture.areas,
    callWS: fixtureCallWS,
  };
  await card.updateComplete;
  card.requestUpdate();

  await waitUntil(() => !card._booting
    && root().querySelector('.stage')
    && root().querySelector('ha-card')?.dataset.frameFingerprint
    && root().querySelector('.glow-pools')
    && root().querySelector('.sunlayer')
    && root().querySelector('image[href*="authSig=continuity"]'));

  const stage = root().querySelector('.stage');
  const before = {
    rooms: stage.querySelectorAll('.room').length,
    viewBox: stage.querySelector('.zoomwrap > svg')?.getAttribute('viewBox'),
    fingerprint: root().querySelector('ha-card')?.dataset.frameFingerprint || '',
    snapshot: root().querySelector('ha-card')?.dataset.deviceSnapshotSequence || '',
    token: Number(root().querySelector('ha-card')?.dataset.continuityToken || 0),
  };
  out.hasCompleteBaseline = before.rooms > 0 && !!before.viewBox && !!before.fingerprint
    && !!before.snapshot;
  const fixtureLayers = {
    wallbody: !!stage.querySelector('.wallbody'),
    opening: !!stage.querySelector('.opening'),
    glow: !!stage.querySelector('.glow-pools'),
    sun: !!stage.querySelector('.sunlayer'),
    decor: !!stage.querySelector('.decorlayer'),
    backdrop: !!stage.querySelector('image[href*="authSig=continuity"]'),
    devices: stage.querySelectorAll('.dev').length > 0,
  };
  out.fixtureCoversCriticalLayers = Object.values(fixtureLayers).every(Boolean);
  out.fixtureLayerDiagnostics = fixtureLayers;

  // Exercise the production Document listener, not the card's private callback.
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(requestAnimationFrame);
  const afterQuick = root().querySelector('ha-card');
  out.quickReturnSteady = afterQuick?.dataset.continuityState === 'steady';
  out.quickReturnKeepsToken = Number(afterQuick?.dataset.continuityToken || 0) === before.token;

  // Long return may revalidate asynchronously. Sample every presented frame.
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  const samples = [];
  await new Promise((done) => {
    let left = 36;
    const sample = () => {
      const liveStage = root().querySelector('.stage');
      const zoom = liveStage?.querySelector('.zoomwrap');
      const computed = zoom ? getComputedStyle(zoom) : null;
      const host = root().querySelector('ha-card');
      const svg = liveStage?.querySelector('.zoomwrap > svg');
      const stageRect = liveStage?.getBoundingClientRect();
      const svgRect = svg?.getBoundingClientRect();
      samples.push({
        rooms: liveStage?.querySelectorAll('.room').length || 0,
        viewBox: liveStage?.querySelector('.zoomwrap > svg')?.getAttribute('viewBox') || '',
        visible: !!computed && computed.display !== 'none' && computed.visibility !== 'hidden',
        overlay: !!root().querySelector('.recoveryoverlay'),
        state: host?.dataset.continuityState || '',
        token: Number(host?.dataset.continuityToken || 0),
        fingerprint: host?.dataset.frameFingerprint || '',
        snapshot: host?.dataset.deviceSnapshotSequence || '',
        href: liveStage?.querySelector('image')?.getAttribute('href') || '',
        blend: liveStage?.querySelector('.glow-pools')?.getAttribute('data-blend') || '',
        stageBox: stageRect ? [stageRect.x, stageRect.y, stageRect.width, stageRect.height] : [],
        svgBox: svgRect ? [svgRect.x, svgRect.y, svgRect.width, svgRect.height] : [],
      });
      if (--left > 0) requestAnimationFrame(sample);
      else done();
    };
    requestAnimationFrame(sample);
  });
  out.longReturnNeverHidesPlan = samples.every((sample) => sample.visible);
  out.longReturnNeverEmptiesPlan = samples.every((sample) => sample.rooms > 0);
  out.longReturnKeepsViewport = samples.every((sample) => sample.viewBox === before.viewBox);
  out.staleFrameNeedsNoOverlay = samples.every((sample) => !sample.overlay);
  out.noLegacyResumeClass = !root().querySelector('.stage.hpresume');
  out.productionAttributesPresent = samples.every((sample) => !!sample.state);
  out.longResumeAdvancesToken = samples.some((sample) => sample.token > before.token);
  out.frameSamplerHasRequiredFacts = samples.every((sample) => sample.fingerprint
    && sample.snapshot && sample.href.includes('authSig=continuity')
    && ['screen', 'normal'].includes(sample.blend)
    && sample.stageBox.length === 4 && sample.svgBox.length === 4);

  await waitUntil(() => root().querySelector('ha-card')?.dataset.continuityState === 'steady');
  out.longResumeEndsSteady = root().querySelector('ha-card')?.dataset.continuityState === 'steady'
    && !root().querySelector('.recoveryoverlay');

  const trace = card.houseplanContinuityTrace?.() || [];
  out.traceIsBoundedAndRedacted = trace.length > 0 && trace.length <= 80
    && !JSON.stringify(trace).includes('/api/houseplan/content/');
  out.productionListenerReachedController = trace.some((event) =>
    event.event === 'candidate-start' && event.reason === 'pageshow');
  return out;
}, fixture);

for (const [name, value] of Object.entries(result)) {
  if (name !== 'fixtureLayerDiagnostics') check(name, value);
}
await finish(browser, result);
