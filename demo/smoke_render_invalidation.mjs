// #451: production-bundle guard for the boundary between HA intake, full Lit
// renders and RAF-owned interaction layers. The large benchmark owns timings;
// this fast smoke runs on every selected-smoke pass and owns wiring semantics.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const result = await page.evaluate(async () => {
  const card = window.__card;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const until = async (predicate, timeout = 5000) => {
    const started = performance.now();
    while (!predicate()) {
      if (performance.now() - started > timeout) throw new Error('render invalidation smoke timed out');
      await new Promise((done) => setTimeout(done, 10));
    }
  };
  const out = {};
  card._setMode('view', false);
  await card.updateComplete;
  if ('_bootSoft' in card) await until(() => card._bootSoft === false);
  await frame();

  let renders = 0;
  let intakes = 0;
  let scans = 0;
  const originalRenderBody = card._renderBody.bind(card);
  const originalObserve = card._renderLife.observe.bind(card._renderLife);
  const originalBindingStatus = card._bindingStatus.bind(card);
  card._renderBody = (...args) => { renders++; return originalRenderBody(...args); };
  card._renderLife.observe = (...args) => { intakes++; return originalObserve(...args); };
  card._bindingStatus = (...args) => { scans++; return originalBindingStatus(...args); };

  const dependency = [...(card._visibleDeviceSnapshot?.entityIds || [])]
    .find((id) => card.hass.states?.[id]);
  const originalHass = card.hass;
  const stableConfig = JSON.stringify(card._serverCfg);
  const stableLayout = JSON.stringify(card._layout);
  const withState = (id, state) => ({
    ...card.hass,
    states: { ...card.hass.states, [id]: { ...card.hass.states[id], state } },
  });

  const irrelevantBefore = renders;
  const intakeBefore = intakes;
  for (let index = 0; index < 5; index++) {
    card.hass = {
      ...card.hass,
      states: {
        ...card.hass.states,
        [`sensor.hp_451_irrelevant_${index}`]: { entity_id: `sensor.hp_451_irrelevant_${index}`, state: String(index), attributes: {} },
      },
    };
  }
  await card.updateComplete;
  await frame();
  out.irrelevantHaHasNoFullRender = renders - irrelevantBefore === 0;
  out.irrelevantHaStillIntakes = intakes - intakeBefore === 5;

  const relevantBefore = renders;
  if (dependency) card.hass = withState(dependency, '451-outside');
  await card.updateComplete;
  await frame();
  out.relevantHaRendersOnce = !!dependency && renders - relevantBefore === 1;

  scans = 0;
  const heavy = card.renderRoot.querySelector('.wallbodies');
  const stage = card.renderRoot.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const hoverBefore = renders;
  const device = card.renderRoot.querySelector('[data-hp="device"]');
  if (device) {
    device.dispatchEvent(new PointerEvent('pointerover', {
      bubbles: true, composed: true, pointerId: 450, pointerType: 'mouse', isPrimary: true,
      clientX: rect.left + 220, clientY: rect.top + 220,
    }));
    device.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, composed: true, pointerId: 450, pointerType: 'mouse', isPrimary: true,
      clientX: rect.left + 225, clientY: rect.top + 225,
    }));
  }
  await frame();
  const liveTip = card.renderRoot.querySelector('[data-hp-live-tip]');
  out.hoverUsesLightweightPaint = !!device && renders === hoverBefore
    && !!liveTip && !liveTip.hidden;
  device?.dispatchEvent(new PointerEvent('pointerleave', {
    bubbles: false, composed: true, pointerId: 450, pointerType: 'mouse', isPrimary: true,
  }));
  await frame();

  const pointer = (type, x, y, buttons) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, pointerId: 451, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons, clientX: rect.left + x, clientY: rect.top + y,
  }));
  pointer('pointerdown', 300, 300, 1);
  await card.updateComplete;
  const panBefore = renders;
  const panIntakeBefore = intakes;
  for (let index = 0; index < 3; index++) {
    pointer('pointermove', 320 + index * 20, 315 + index * 10, 1);
    if (dependency) card.hass = withState(dependency, `451-drag-${index}`);
  }
  await card.updateComplete;
  await frame();
  out.panAndDeferredHaSkipFullRender = renders === panBefore;
  out.deferredHaTicksStillIntake = intakes - panIntakeBefore === 3;
  const panTerminalBefore = renders;
  pointer('pointerup', 360, 335, 0);
  await card.updateComplete;
  await frame();
  out.panTerminalRendersOnce = renders - panTerminalBefore === 1;
  out.deferredHaIsLastWins = !!dependency
    && card._renderPlanHass.states?.[dependency]?.state === '451-drag-2';

  card._setMode('plan', false);
  card._tool = 'draw';
  card._path = [[100, 100]];
  card.requestUpdate();
  await card.updateComplete;
  await until(() => !card._modeTransitionBusy && card._continuity.state === 'steady');
  for (let index = 0; index < 5; index++) await frame();
  await frame();
  const editorBefore = renders;
  const editorPaintBefore = card._liveEditorPaintCount || 0;
  for (let index = 0; index < 20; index++) {
    stage.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, composed: true, pointerId: 452, pointerType: 'mouse', isPrimary: true,
      clientX: rect.left + 110 + index, clientY: rect.top + 120 + index,
    }));
  }
  await frame();
  out.editorMovesSkipFullRender = renders === editorBefore;
  out.editorMovesUseRafPaint = (card._liveEditorPaintCount || 0) > editorPaintBefore;
  card._cursorPt = null;
  card._path = [];
  const editorTerminalBefore = renders;
  card.requestUpdate();
  await card.updateComplete;
  await frame();
  out.editorTerminalHasAtMostOneRender = renders - editorTerminalBefore <= 1;

  out.heavySceneIdentityStable = card.renderRoot.querySelector('.wallbodies') === heavy;
  out.pointerWindowsSkipDiagnosticScans = scans === 0;
  out.interactionsDoNotWriteConfig = JSON.stringify(card._serverCfg) === stableConfig;
  out.interactionsDoNotWriteLayout = JSON.stringify(card._layout) === stableLayout;
  card.hass = originalHass;
  return out;
});

checkAll(result);
await finish(browser, result);
