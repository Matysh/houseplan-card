// #281: an exact outer-wall partition blocks Resize, explicit Optimize safely
// rehosts its windows, and the production pointer path then moves two rooms.
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const source = JSON.parse(readFileSync(
  new URL('../test/fixtures/281-resize-outer-partitions.json', import.meta.url),
  'utf8',
));
const clone = (value) => JSON.parse(JSON.stringify(value));

const { page, browser } = await launch({ width: 900, height: 820 });
const out = await page.evaluate(async (fixture) => {
  const result = {};
  const card = window.__card;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  let serverConfig = copy(fixture);
  let serverLayout = {};
  const sent = [];
  const baseCall = card.hass.callWS.bind(card.hass);
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/plan/optimize') {
        sent.push(message.type);
        serverConfig = copy(message.config);
        serverLayout = copy(message.layout);
        return { ok: true, config_rev: 2, layout_rev: 2, can_undo: true };
      }
      if (message.type === 'houseplan/config/get')
        return { config: copy(serverConfig), rev: 2, can_write: true, can_optimize_undo: true };
      if (message.type === 'houseplan/layout/get')
        return { layout: copy(serverLayout), rev: 2 };
      return baseCall(message);
    },
  };

  const resetResize = async () => {
    card._setMode('plan');
    card._tool = 'resize';
    card._rszDrag = null;
    card._rszPreview = null;
    card._rszLive = null;
    card._rszEligibilityCache = null;
    card._modelCache = null;
    card._frame = null;
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  };
  const targetHandles = () => [...card.renderRoot.querySelectorAll('.rszhandle')]
    .filter((handle) => Math.abs(Number(handle.getAttribute('cx')) - 500) < 1
      && Math.abs(Number(handle.getAttribute('cy')) - 500) < 1);
  const screenPoint = (x, y) => {
    const stage = card.renderRoot.querySelector('.stage');
    const rect = stage.getBoundingClientRect();
    const svg = stage.querySelector('svg');
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    return [rect.left + ((x - vx) / vw) * rect.width,
      rect.top + ((y - vy) / vh) * rect.height];
  };
  const dispatch = (target, type, x, y, pointerId = 281) => target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId,
      clientX: x, clientY: y, pointerType: 'mouse',
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  );

  card._serverCfg = copy(fixture);
  card._layout = {};
  card._space = 'resize-outer';
  await resetResize();
  const beforeHandles = targetHandles();
  result.beforeIsExplainedDisabled = beforeHandles.length === 2
    && beforeHandles.every((handle) => handle.getAttribute('aria-disabled') === 'true'
      && /independent wall|partition|перегород/i.test(handle.getAttribute('aria-label') || ''));
  const [beforeX, beforeY] = screenPoint(500, 500);
  dispatch(beforeHandles[0], 'pointerdown', beforeX, beforeY);
  result.disabledCapturesNothing = card._rszDrag == null
    && card._geometryHistory.size === 0;

  card._openAlignDialog();
  await card.updateComplete;
  result.previewProvesOuterRewrite = card._alignDialog?.changed === true
    && card._alignDialog?.preflight?.ok === true
    && card._alignDialog?.report?.partitionsReconciled === 3
    && card._alignDialog?.report?.openingsRehosted === 2
    && card._alignDialog?.config?.spaces?.[0]?.partitions == null
    && card._alignDialog?.config?.spaces?.[0]?.openings?.every((opening) => opening.host == null);
  await card._runAlignToGrid();
  await card.updateComplete;
  result.optimizeUsesOneWrite = sent.filter((type) => type === 'houseplan/plan/optimize').length === 1;
  const optimized = card._serverCfg.spaces[0];
  result.optimizePreservesOpeningFields = optimized.partitions == null
    && optimized.openings[0].host == null
    && optimized.openings[0].cover === 'cover.left'
    && optimized.openings[0].future_field?.keep === 'left'
    && optimized.openings[1].host == null
    && optimized.openings[1].contact === 'binary_sensor.right';

  await resetResize();
  const afterHandles = targetHandles();
  result.afterIsEnabled = afterHandles.length === 2
    && afterHandles.every((handle) => handle.getAttribute('aria-disabled') === 'false');
  const [startX, startY] = screenPoint(500, 500);
  const [moveX] = screenPoint(550, 500);
  dispatch(afterHandles[0], 'pointerdown', startX, startY);
  result.dragStarts = card._rszDrag != null;
  dispatch(afterHandles[0], 'pointermove', moveX, startY);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  dispatch(afterHandles[0], 'pointerup', moveX, startY);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const left = card._serverCfg.spaces[0].rooms.find((room) => room.id === 'left');
  const right = card._serverCfg.spaces[0].rooms.find((room) => room.id === 'right');
  result.gestureMovesExactlySharedEndpoints = Math.abs(left.poly[1][0] - 0.55) < 0.006
    && Math.abs(left.poly[2][0] - 0.55) < 0.006
    && Math.abs(right.poly[0][0] - 0.55) < 0.006
    && Math.abs(right.poly[3][0] - 0.55) < 0.006
    && card._serverCfg.spaces[0].rooms.length === 2
    && card._geometryHistory.size === 1;
  return result;
}, clone(source));

await finish(browser, checkAll(out));
