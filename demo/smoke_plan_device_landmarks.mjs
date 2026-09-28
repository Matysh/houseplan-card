// #687: in the Plan editor device markers are landmarks exactly as in the
// Background editor (#362) — the same markers as View, at the Background
// editor's effective opacity, and fully pointer-inert so every Plan tool
// receives the point below them. Room labels (same .devlayer) stay opaque.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const probe = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  // Entering a mode settles the camera after the stage resizes; wait until
  // marker positions hold still so measured points are the clicked points.
  const layoutKey = () => [...sr().querySelectorAll('.devlayer [data-hp="device"]')]
    .map((node) => { const r = node.getBoundingClientRect(); return `${r.left.toFixed(1)},${r.top.toFixed(1)}`; })
    .join('|');
  const enter = async (mode) => {
    c._setMode(mode, false);
    await settleMode();
    const started = performance.now();
    let key = layoutKey(), still = 0;
    while (still < 10 && performance.now() - started < 3000) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const next = layoutKey();
      still = next === key ? still + 1 : 0;
      key = next;
    }
    await c.updateComplete;
  };
  const stage = () => sr().querySelector('.stage');
  const markers = () => [...sr().querySelectorAll('.devlayer [data-hp="device"]')];
  const visible = (node) => {
    const r = node.getBoundingClientRect();
    return getComputedStyle(node).display !== 'none' && r.width > 0 && r.height > 0;
  };
  const visibleIds = () => markers().filter(visible).map((node) => node.dataset.id).sort();
  // Effective alpha of one marker: its own and every ancestor's opacity and
  // filter: opacity(), up to and including the stage.
  const effectiveOpacity = (node) => {
    let alpha = 1;
    for (let el = node; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      alpha *= Number(cs.opacity);
      for (const m of cs.filter.matchAll(/opacity\(([^)]+)\)/g)) alpha *= Number(m[1]);
      if (el === stage()) break;
    }
    return alpha;
  };
  const opacityById = () => Object.fromEntries(markers().filter(visible)
    .map((node) => [node.dataset.id, effectiveOpacity(node)]));

  // One unavailable marker exercises contract item 2: the fade multiplies
  // the marker's own opacity (.unavail) exactly as the Background layer does.
  const target = markers().find((node) => node.dataset.entity && c.hass.states[node.dataset.entity]);
  if (target) {
    const entity = target.dataset.entity;
    c.hass = { ...c.hass, states: { ...c.hass.states,
      [entity]: { ...c.hass.states[entity], state: 'unavailable' } } };
    await c.updateComplete;
  }
  await enter('view');
  out.unavailableMarkerInView = !!sr().querySelector('.devlayer [data-hp="device"].unavail');
  const viewIds = visibleIds();
  out.viewHasMarkers = viewIds.length > 0;
  await enter('decor');
  const decorOpacity = opacityById();
  await enter('plan');
  const planIds = visibleIds();
  const planOpacity = opacityById();

  // AC1 — the same markers as View, each at the Background editor's alpha.
  out.planShowsViewMarkers = JSON.stringify(planIds) === JSON.stringify(viewIds);
  out.planOpacityMatchesBackground = planIds.length > 0 && planIds.every((id) =>
    id in decorOpacity && Math.abs(planOpacity[id] - decorOpacity[id]) < 1e-3);
  const plain = markers().find((node) => visible(node) && !node.classList.contains('unavail'));
  out.planPlainMarkerAt35 = !!plain && Math.abs(planOpacity[plain.dataset.id] - 0.35) < 1e-3;
  const unavail = markers().find((node) => visible(node) && node.classList.contains('unavail'));
  out.planUnavailableMarkerAt35x35 = !!unavail
    && Math.abs(planOpacity[unavail.dataset.id] - 0.35 * 0.35) < 1e-3;
  // Room labels share .devlayer: no layer fade reaches them (their own
  // opacity is the label design, not this contract).
  const label = sr().querySelector('.roomlabel');
  out.roomLabelNotFaded = !!label
    && Math.abs(effectiveOpacity(label) - Number(getComputedStyle(label).opacity)) < 1e-3
    && !/opacity\(/.test(getComputedStyle(label).filter);
  out.planMarkersOutOfTabOrder = markers().every((node) => !node.hasAttribute('tabindex')
    && !node.hasAttribute('role'));

  // AC2 — pick a marker wholly inside the stage, preferring a value capsule
  // that extends outside the marker's nominal box.
  const s = stage().getBoundingClientRect();
  const inside = markers().filter((node) => {
    const r = node.getBoundingClientRect();
    return visible(node) && r.left > s.left + 4 && r.right < s.right - 4
      && r.top > s.top + 4 && r.bottom < s.bottom - 4;
  });
  const at = (p) => p ? sr().elementFromPoint(p.x, p.y) : null;
  const centre = (node) => {
    const b = node.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  };
  // Room chrome lying under a marker keeps the hit (the demo plan puts a
  // marker over a room's settings button).
  const roomChrome = '.roomlabel, [data-hp="room-settings"]';
  const overLabel = inside.find((node) => at(centre(node))?.closest?.(roomChrome));
  out.roomChromeUnderMarkerGetsHit = !!overLabel;
  const gearPoint = overLabel && at(centre(overLabel))?.closest?.('[data-hp="room-settings"]')
    ? centre(overLabel) : null;
  // The tool probe lies over bare plan, so the Walls tool owns the point;
  // prefer a value capsule that extends outside the marker's nominal box.
  const overPlan = inside.filter((node) => !at(centre(node))?.closest?.('.devlayer'));
  const dev = overPlan.find((node) => node.classList.contains('valonly')
    || node.querySelector('.device-shell.with-values')) || overPlan[0];
  const frame = dev?.querySelector('.device-shell-frame');
  const r = dev?.getBoundingClientRect();
  const fr = frame?.getBoundingClientRect();
  const core = dev ? centre(dev) : null;
  const capsule = fr && fr.right > r.right + 2
    ? { x: fr.right - 1, y: fr.top + fr.height / 2 } : core;
  out.probeFound = !!dev && !!core;
  out.probeHasOutsideCapsule = !!fr && fr.right > r.right + 2;
  const cursorAt = (p) => { const t = at(p); return t ? getComputedStyle(t).cursor : null; };
  const hit = { core: at(core), capsule: at(capsule) };
  const cursor = { core: cursorAt(core), capsule: cursorAt(capsule) };
  out.coreFallsThrough = !!hit.core && !hit.core.closest('.dev');
  out.capsuleFallsThrough = !!hit.capsule && !hit.capsule.closest('.dev');
  out.markerSubtreeIsPointerInert = !!dev && !!frame
    && getComputedStyle(dev).pointerEvents === 'none'
    && getComputedStyle(dev, '::before').pointerEvents === 'none'
    && getComputedStyle(frame).pointerEvents === 'none'
    && [...dev.querySelectorAll('*')].every((el) => getComputedStyle(el).pointerEvents === 'none');
  // "The cursor over a marker is the cursor of what lies below": the same
  // point with the marker taken out of layout gives the same target/cursor.
  if (dev) {
    dev.style.display = 'none';
    out.targetSameWithoutMarker = at(core) === hit.core && at(capsule) === hit.capsule;
    out.cursorSameWithoutMarker = cursorAt(core) === cursor.core && cursorAt(capsule) === cursor.capsule;
    dev.style.display = '';
  }

  c._tool = 'draw'; c._path = []; c._cursorPt = null;
  await c.updateComplete;
  return { out, core, id: dev?.dataset.id, gearPoint };
});

// A real mouse click on the marker core reaches the Walls tool. It runs
// before the synthetic probes below, which leave pointer state behind.
if (probe.core) await page.mouse.click(probe.core.x, probe.core.y);

// A real click on a marker lying over a room's settings button opens the
// room dialog: the button below owns the point.
if (probe.gearPoint) await page.mouse.click(probe.gearPoint.x, probe.gearPoint.y);
const gear = await page.evaluate(async () => {
  const c = window.__card;
  await c.updateComplete;
  const opened = c._roomDialog === true && !!c._roomEditId;
  if (opened) { c._roomDialogCancel(); await c.updateComplete; }
  return { roomSettingsOpenThroughMarker: opened };
});

const inert = await page.evaluate(async ({ core, id }) => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  await c.updateComplete;
  out.wallsToolReceivesClickThroughMarker = c._path.length === 1;
  c._path = []; c._cursorPt = null;
  await c.updateComplete;
  const dev = [...sr().querySelectorAll('.devlayer [data-hp="device"]')].find((node) => node.dataset.id === id);
  const r = dev?.getBoundingClientRect();
  // The click above must have landed on the probed marker.
  out.probeDidNotMove = !!r && !!core
    && Math.abs(r.left + r.width / 2 - core.x) < 1 && Math.abs(r.top + r.height / 2 - core.y) < 1;
  // Handlers fail closed even when events are dispatched on the marker itself.
  let serviceCalls = 0, wsCalls = 0;
  const oldCallService = c.hass.callService;
  const oldCallWS = c.hass.callWS;
  c.hass.callService = () => { serviceCalls += 1; };
  c.hass.callWS = async () => { wsCalls += 1; return { ok: true }; };
  const before = { tip: c._tip, info: c._infoCard, drag: c._deviceDrag, sel: c._selId };
  const opts = { bubbles: true, composed: true, cancelable: true, clientX: core?.x || 0, clientY: core?.y || 0 };
  dev?.dispatchEvent(new PointerEvent('pointerover', { ...opts, pointerId: 687, pointerType: 'mouse', isPrimary: true }));
  dev?.dispatchEvent(new PointerEvent('pointermove', { ...opts, pointerId: 687, pointerType: 'mouse', isPrimary: true }));
  dev?.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 688, pointerType: 'mouse', button: 0, isPrimary: true }));
  dev?.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 688, pointerType: 'mouse', button: 0, isPrimary: true }));
  dev?.dispatchEvent(new MouseEvent('click', { ...opts, button: 0 }));
  const ctx = new MouseEvent('contextmenu', { ...opts, button: 2 });
  dev?.dispatchEvent(ctx);
  await c.updateComplete;
  out.handlersFailClosed = serviceCalls === 0 && wsCalls === 0
    && c._tip === before.tip && c._infoCard === before.info
    && c._deviceDrag === before.drag && c._selId === before.sel;
  out.noDeviceHoverAttribute = !sr().querySelector('.dev[data-hp-device-hover]');
  out.contextMenuNotClaimed = !ctx.defaultPrevented;
  c.hass.callService = oldCallService;
  c.hass.callWS = oldCallWS;
  c._pointers?.clear?.(); c._panStart = null; c._panLock = null;
  c._path = []; c._cursorPt = null;
  await c.updateComplete;
  return out;
}, { core: probe.core, id: probe.id });

const res = { ...probe.out, ...gear, ...inert };
checkAll(res);
await finish(browser, res);
