// Smoke (#746): a room's fill and stroke never get darker in transit than at
// either end when the room changes state on the same node.
//
// `.room { transition: 0.12s }` interpolates the colour and `fill-opacity` /
// `stroke-opacity` independently, and the visible opacity is their product.
// When one state keeps its transparency in the colour (`rgba(…, 0.06)` with
// the default opacity 1) and the other in `*-opacity` (an opaque colour with
// 0.18), one half rises while the other falls, and the product in the middle
// is larger than both ends: on dev opening the space settings on a floor with
// no fill flashed every room grey (0 → 0.241 → 0), and entering or leaving
// the plan editor briefly darkened a filled floor (0.18 → 0.317 → 0.06).
//
// The witness is deterministic, not a frame recording. A MutationObserver on
// the room node pauses every CSS transition at its first frame as soon as Lit
// commits the new class or style (a microtask, before any frame), and the
// smoke then seeks each transition through 0…120 ms in steps of 15 ms. The
// result does not depend on how busy the machine is.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch();
/** Visible opacity may exceed the larger end by this much (rounding). */
const TOLERANCE = 0.005;
/**
 * Resting paint of each room state, as dev drew it before #746: colour of the
 * visible paint (null when nothing is visible) and its visible opacity
 * (colour alpha × `*-opacity`). The fix must not move any of them.
 */
const REST = {
  overlay: { fill: [null, 0], stroke: [null, 0] },
  styled: { fill: ['rgb(96, 125, 139)', 0.18], stroke: [null, 0] },
  outlined: { fill: ['rgb(62, 166, 255)', 0.06], stroke: ['rgb(62, 166, 255)', 0.55] },
  picked: { fill: ['rgb(255, 193, 77)', 0.25], stroke: ['rgb(255, 193, 77)', 1] },
  yard: { fill: ['rgb(75, 140, 90)', 0.14], stroke: ['rgb(75, 140, 90)', 1] },
};

await page.evaluate(() => {
  const c = window.__card;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const settle = async (frames = 10, ms = 400) => {
    for (let i = 0; i < frames; i++) await frame();
    await sleep(ms);
  };
  const room = () => c.renderRoot.querySelector('[data-hp="room"][data-id="r1"]');
  const channels = (color) => /rgba?\(([^)]+)\)/.exec(color)?.[1].split(/[\s,/]+/).filter(Boolean) || null;
  const alphaOf = (color) => {
    const parts = channels(color);
    if (!parts) return 0; // `none`
    return parts.length > 3 ? Number(parts[3]) : 1;
  };
  const rgbOf = (color) => {
    const parts = channels(color);
    return parts ? `rgb(${parts.slice(0, 3).join(', ')})` : color;
  };
  const round = (value) => Math.round(value * 10000) / 10000;
  /** Visible paint of the room: colour alpha × `*-opacity`, and the colour when it shows. */
  const paint = (node) => {
    const style = getComputedStyle(node);
    const fill = round(alphaOf(style.fill) * Number(style.fillOpacity));
    const stroke = round(alphaOf(style.stroke) * Number(style.strokeOpacity));
    return {
      cls: node.getAttribute('class'),
      fill: [fill > 0 ? rgbOf(style.fill) : null, fill],
      stroke: [stroke > 0 ? rgbOf(style.stroke) : null, stroke],
    };
  };
  const transitionsOf = (node) => node.getAnimations().filter((animation) => animation instanceof CSSTransition);
  /**
   * Pause every transition of the node at its first frame. The observer runs
   * right after Lit's commit, and `getAnimations()` flushes the style, so the
   * transition exists and has not advanced yet; `transitionrun` covers one
   * started by anything else.
   */
  const freezeOn = (node) => {
    const freeze = () => {
      for (const animation of transitionsOf(node)) {
        if (animation.playState === 'paused') continue;
        animation.pause();
        animation.currentTime = 0;
      }
    };
    const observer = new MutationObserver(freeze);
    observer.observe(node, { attributes: true });
    node.addEventListener('transitionrun', freeze);
    return () => { observer.disconnect(); node.removeEventListener('transitionrun', freeze); };
  };
  const close = (a, b) => Math.abs(a - b) <= 0.005;
  window.__fillWitness = {
    settle,
    paint: () => paint(room()),
    async rest() { await settle(); return paint(room()); },
    /** Run `act`, then seek the room's frozen transitions through their whole 0.12 s. */
    async measure(act) {
      await settle();
      const node = room();
      const start = paint(node);
      const release = freezeOn(node);
      await act();
      await settle(4, 80);
      release();
      const after = room();
      const transitions = transitionsOf(after);
      const samples = [];
      for (let t = 0; t <= 120; t += 15) {
        for (const animation of transitions) animation.currentTime = t;
        samples.push(paint(after));
      }
      const frozen = transitions.every((animation) => animation.playState === 'paused');
      for (const animation of transitions) animation.finish();
      await frame();
      const end = paint(after);
      const peak = (key) => Math.max(...samples.map((sample) => sample[key][1]));
      return {
        sameNode: after === node,
        from: start.cls,
        to: end.cls,
        properties: [...new Set(transitions.map((animation) => animation.transitionProperty))].sort(),
        frozen,
        // the seek spans the real transition: first sample is the old state, last the new one
        spansBothEnds: samples.length > 0
          && close(samples[0].fill[1], start.fill[1]) && close(samples[0].stroke[1], start.stroke[1])
          && close(samples.at(-1).fill[1], end.fill[1]) && close(samples.at(-1).stroke[1], end.stroke[1]),
        fill: [start.fill[1], peak('fill'), end.fill[1]],
        stroke: [start.stroke[1], peak('stroke'), end.stroke[1]],
        fillOvershoot: round(peak('fill') - Math.max(start.fill[1], end.fill[1])),
        strokeOvershoot: round(peak('stroke') - Math.max(start.stroke[1], end.stroke[1])),
      };
    },
  };
});

const run = (fn) => page.evaluate(fn);
const measured = {};
const rest = {};

// AC1 (1): open «Space settings» on a floor without fill. The dialog shows
// "no fill" as its own colour at alpha 0, so the room goes overlay → styled.
rest.overlay = await run(() => window.__fillWitness.rest());
measured.openSettings = await run(() => window.__fillWitness.measure(
  () => window.__hpTest.openSpaceDialog('edit', 'f1')));

// AC1 (2): preview alpha 18 % in the dialog, then cancel it: styled → overlay.
await run(async () => {
  const dialog = window.__card.renderRoot.querySelector('[data-hp="dialog"][data-kind="space"]');
  // the custom-fill row: its picker holds the default fill colour at alpha 0
  const field = [...dialog.querySelectorAll('.hpf-colorfield')]
    .find((node) => node.querySelector('hp-color-opacity')?.color?.toLowerCase() === '#607d8b');
  if (!field) throw new Error('#746: the space dialog shows no custom-fill row');
  await window.__hpTest.input(field.querySelector('input[type="number"]'), '18');
  await window.__fillWitness.settle();
});
const preview = await run(() => window.__fillWitness.paint());
measured.cancelSettings = await run(() => window.__fillWitness.measure(async () => {
  const T = window.__hpTest;
  const dialog = window.__card.renderRoot.querySelector('[data-hp="dialog"][data-kind="space"]');
  const { confirm } = await T.close(dialog, { via: 'cancel' });
  // the preview made the dialog dirty: discard it the way a person does
  if (confirm) {
    confirm.querySelector('[data-hp="dialog-confirm"]').click();
    await T.settled();
  }
}));
const dialogClosed = await run(() => !window.__card.renderRoot.querySelector('[data-hp="dialog"][data-kind="space"]'));

// AC1 (3, 4): enter and leave the plan editor on a filled floor.
await run(async () => {
  await window.__hpTest.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.settings = { ...(space.settings || {}), fill_mode: 'custom' };
  });
});
rest.styled = await run(() => window.__fillWitness.rest());
measured.enterPlanEditor = await run(() => window.__fillWitness.measure(() => window.__hpTest.setMode('plan')));
rest.outlined = await run(() => window.__fillWitness.rest());
measured.leavePlanEditor = await run(() => window.__fillWitness.measure(() => window.__hpTest.setMode('view')));

// Control: a real colour change of the same room still animates its fill —
// catches a false fix `transition: none`.
measured.control = await run(() => window.__fillWitness.measure(() => window.__hpTest.setServerConfig((cfg) => {
  const space = cfg.spaces.find((item) => item.id === 'f1');
  space.settings = { ...space.settings, custom_fill: { c: '#ff9800', a: 0.3 } };
})));

// AC2: the room picked for a merge — a real click of the Merge tool.
await run(async () => {
  await window.__hpTest.setMode('plan');
  await window.__hpTest.setTool('merge');
  await window.__fillWitness.settle();
});
const box = await run(() => {
  const rect = window.__card.renderRoot.querySelector('[data-hp="room"][data-id="r1"]').getBoundingClientRect();
  return { x: rect.left + rect.width * 0.15, y: rect.top + rect.height * 0.2 };
});
await page.mouse.click(box.x, box.y);
// off the plan: View's hover paints the room in the accent colour
await page.mouse.move(2, 2);
rest.picked = await run(() => window.__fillWitness.rest());

// AC2: a space without a backdrop draws its rooms as `yard`.
await run(async () => {
  await window.__hpTest.setMode('view');
  await window.__hpTest.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    delete space.plan_url;
    // without a backdrop the borders default to on (`styled`); the bare state is wanted here
    space.settings = { show_borders: false };
  });
});
rest.yard = await run(() => window.__fillWitness.rest());

const STATES = {
  openSettings: [/^room overlay$/, /\bstyled filled\b/],
  cancelSettings: [/\bstyled filled\b/, /^room overlay$/],
  enterPlanEditor: [/\bstyled filled\b/, /\boutlined\b/],
  leavePlanEditor: [/\boutlined\b/, /\bstyled filled\b/],
  control: [/\bstyled filled\b/, /\bstyled filled\b/],
};
for (const [name, result] of Object.entries(measured)) {
  const [from, to] = STATES[name];
  check(`${name}: fixture`, from.test(result.from) && to.test(result.to) || [result.from, result.to]);
  check(`${name}: the same room node changes state`, result.sameNode);
  check(`${name}: a fill transition runs and is frozen at its first frame`,
    result.properties.includes('fill') && result.frozen && result.spansBothEnds || result);
  check(`${name}: fill is no darker in transit than at either end`,
    result.fillOvershoot <= TOLERANCE || result.fill);
  check(`${name}: stroke is no darker in transit than at either end`,
    result.strokeOvershoot <= TOLERANCE || result.stroke);
}
check('cancelSettings: the preview showed alpha 0.18', preview.fill[1], 0.18);
check('cancelSettings: the dialog closed', dialogClosed);
check('picked: the Merge click picked the room', /\bpicked\b/.test(rest.picked.cls) || rest.picked.cls);
check('yard: the room is drawn without a backdrop', /^room yard$/.test(rest.yard.cls) || rest.yard.cls);
for (const [state, expected] of Object.entries(REST)) {
  for (const channel of ['fill', 'stroke']) {
    const [color, opacity] = rest[state][channel];
    check(`${state} at rest: ${channel} colour and visible opacity unchanged`,
      color === expected[channel][0] && Math.abs(opacity - expected[channel][1]) <= TOLERANCE
        || rest[state][channel]);
  }
}
await finish(browser, { measured, rest, preview });
