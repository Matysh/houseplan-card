// #73: lifecycle frame-sequence contract. The last complete plan must remain
// visible across quick/long returns; recovery tokens may advance, pixels may
// not disappear or regress to an empty/default frame.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitUntil = async (predicate, timeout = 3000) => {
    const start = performance.now();
    while (!predicate() && performance.now() - start < timeout) await sleep(20);
    return predicate();
  };
  await waitUntil(() => !card._booting
    && root().querySelector('.stage')
    && root().querySelector('ha-card')?.dataset.frameFingerprint);

  const stage = root().querySelector('.stage');
  const before = {
    rooms: stage.querySelectorAll('.room').length,
    viewBox: stage.querySelector('.zoomwrap > svg')?.getAttribute('viewBox'),
    fingerprint: root().querySelector('ha-card')?.dataset.frameFingerprint || '',
    token: Number(root().querySelector('ha-card')?.dataset.continuityToken || 0),
  };
  out.hasCompleteBaseline = before.rooms > 0 && !!before.viewBox && !!before.fingerprint;

  // A short return is deliberately a direct no-op signal: no token/update.
  card._pageVisibility({
    kind: 'visible', token: 1, at: Date.now(), hiddenFor: 1000, long: false,
  });
  await new Promise(requestAnimationFrame);
  const afterQuick = root().querySelector('ha-card');
  out.quickReturnSteady = afterQuick?.dataset.continuityState === 'steady';
  out.quickReturnKeepsToken = Number(afterQuick?.dataset.continuityToken || 0) === before.token;

  // Long return may revalidate asynchronously. Sample every presented frame.
  card._pageVisibility({
    kind: 'visible', token: 2, at: Date.now(), hiddenFor: 20_000, long: true,
  });
  const samples = [];
  await new Promise((done) => {
    let left = 36;
    const sample = () => {
      const liveStage = root().querySelector('.stage');
      const zoom = liveStage?.querySelector('.zoomwrap');
      const computed = zoom ? getComputedStyle(zoom) : null;
      samples.push({
        rooms: liveStage?.querySelectorAll('.room').length || 0,
        viewBox: liveStage?.querySelector('.zoomwrap > svg')?.getAttribute('viewBox') || '',
        visible: !!computed && computed.display !== 'none' && computed.visibility !== 'hidden',
        overlay: !!root().querySelector('.recoveryoverlay'),
        state: root().querySelector('ha-card')?.dataset.continuityState || '',
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

  const trace = card.houseplanContinuityTrace?.() || [];
  out.traceIsBoundedAndRedacted = trace.length > 0 && trace.length <= 80
    && !JSON.stringify(trace).includes('/api/houseplan/content/');
  return out;
});

for (const [name, value] of Object.entries(result)) check(name, value);
await finish(browser, result);
