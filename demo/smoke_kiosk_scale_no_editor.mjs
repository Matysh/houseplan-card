// #763: the kiosk scale dialog is drawn by the core card and saved by the
// summary runtime. A wall tablet that opens it with the 3 s hold must not pay
// for the lazy editor runtime: no chunk request, the editor loader stays idle.
//
// Cold page (launchColdView: the harness preload is off, the editor chunk has
// never been fetched), a real 3.4 s touch hold on the empty stage, and the
// dialog driven like a user would: keyboard on the sliders, taps on Reset and
// Close, a second hold to reopen. The chunk is identified by the bundle
// manifest, so a renamed hash cannot make the check vacuous.
//
// Negative probe: the editor chunk is refused by the network. The dialog must
// still work and the user must see no "editor failed to load" notice.
// Control: the ordinary editor entry outside the kiosk still fetches it.
//
// #813: the same hold with a real mouse, three times in a row. A mouse has no
// implicit capture, so the release of the press that opened the dialog goes to
// the modal and never to the stage; the stage gesture must end when the modal
// takes over, or the next hold reads as a second finger (no dialog, the plan
// zooms) and the plan stops following Home Assistant. Then the presses that
// must NOT open the dialog: a tap, a cancelled touch, a touch that loses its
// capture, a press interrupted by the window losing focus, a press across a
// detach/reattach of the card, and a pinch — none of them calls a service or
// asks for the editor.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtimePath = manifest.files
  .map((file) => file.path)
  .find((path) => /houseplan-editor-runtime-[^/]+\.js$/.test(path));
if (!runtimePath) throw new Error('editor runtime is absent from the bundle manifest');
const runtimeName = runtimePath.split('/').at(-1);
const isRuntime = (url) => new URL(url).pathname.endsWith(`/${runtimeName}`);

const HOLD_MS = 3400; // the kiosk opens its dialog after a 3 s hold
const KIOSK = '#hp-kiosk';
const DIALOG = `${KIOSK} hp-dialog[data-kind="kiosk"]`;
const SUMMARY_PREFIX = 'houseplan.summary-panel.v1:';
// #813 (F12): the pre-summary key is read once for migration and never written.
const LEGACY_SCALE_KEY = 'houseplan_card_kiosk_v1';
/** `true`, or what actually happened — the value is the evidence. */
const same = (expected, actual) => JSON.stringify(actual) === JSON.stringify(expected)
  || `${JSON.stringify(actual)} instead of ${JSON.stringify(expected)}`;
const near = (expected, actual) => Math.abs(actual - expected) < 0.01 || `${actual} instead of ${expected}`;

const openKiosk = async (blockRuntime) => {
  const session = await launchColdView({ width: 900, height: 760 }, 1, [], { hasTouch: true });
  const { page } = session;
  const chunk = { requests: 0, refused: 0 };
  page.on('request', (request) => { if (isRuntime(request.url())) chunk.requests += 1; });
  if (blockRuntime) {
    await page.route(`**/${runtimeName}*`, (route) => {
      chunk.refused += 1;
      return route.abort('failed');
    });
  }
  const cold = await page.evaluate((name) => performance.getEntriesByType('resource')
    .every((entry) => !new URL(entry.name).pathname.endsWith(`/${name}`)), runtimeName);
  await page.evaluate(() => {
    const card = document.createElement('houseplan-card');
    card.id = 'hp-kiosk';
    card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
    card.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:99';
    card.hass = window.__card.hass;
    document.body.appendChild(card);
    // Each toast node that appears is one notice the user saw.
    window.__hpNotices = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.matches('[data-hp="toast"]')) window.__hpNotices += 1;
        }
      }
    }).observe(card.shadowRoot || card.renderRoot, { childList: true, subtree: true });
  });
  await page.waitForFunction((selector) => {
    const card = document.querySelector(selector);
    return card && !card._booting && (card.shadowRoot || card.renderRoot).querySelector('.stage .devlayer');
  }, KIOSK, { timeout: 9000 });
  const cdp = await page.context().newCDPSession(page);
  return { ...session, chunk, cold, cdp };
};

/** What the user sees and what the card holds, read in one pass. */
const kioskState = (page) => page.evaluate(({ selector, prefix }) => {
  const card = document.querySelector(selector);
  const root = card.shadowRoot || card.renderRoot;
  const dialog = root.querySelector('hp-dialog[data-kind="kiosk"]');
  const style = root.querySelector('.devlayer')?.getAttribute('style') || '';
  const stored = Object.keys(localStorage).filter((key) => key.startsWith(prefix))
    .map((key) => JSON.parse(localStorage.getItem(key)))
    .map((value) => [value?.icon_scale, value?.font_scale]);
  return {
    open: !!dialog,
    sliders: dialog ? [...dialog.querySelectorAll('input[type="range"]')].map((input) => Number(input.value)) : [],
    labels: dialog ? [...dialog.querySelectorAll('.opv')].map((node) => node.textContent.trim()) : [],
    iconSize: Number.parseFloat(style.match(/--icon-size:([\d.]+)/)?.[1]),
    labelFont: Number.parseFloat(style.match(/--rl-font:([\d.]+)/)?.[1]),
    stored,
    loader: card._editorRuntimeLoader.state,
    runtime: !!card._editorRuntime,
    notices: window.__hpNotices,
    toast: card._toast || '',
  };
}, { selector: KIOSK, prefix: SUMMARY_PREFIX });

/** A point of the bare stage: the hold ignores presses on devices, labels and locks. */
const emptyStagePoint = (page) => page.evaluate((selector) => {
  const card = document.querySelector(selector);
  const root = card.shadowRoot || card.renderRoot;
  const stage = root.querySelector('.stage');
  const box = stage.getBoundingClientRect();
  const owned = '.dev, .roomlabel, .oplock';
  const busy = `${owned}, [data-hp="room"], .summary-overlay, .kioskdots`;
  let fallback = null;
  for (let row = 4; row <= 16; row += 1) {
    for (let col = 4; col <= 16; col += 1) {
      const x = Math.round(box.left + (box.width * col) / 20);
      const y = Math.round(box.top + (box.height * row) / 20);
      const hit = root.elementFromPoint(x, y);
      if (!hit || !stage.contains(hit) || hit.closest(owned)) continue;
      if (!hit.closest(busy)) return { x, y };
      fallback ||= { x, y };
    }
  }
  return fallback;
}, KIOSK);

/**
 * A real touch held past the 3 s kiosk threshold. Chromium's synthetic gesture
 * runs the touch through its gesture detector, so the lift ends a long press.
 * Raw `Input.dispatchTouchEvent` would not: without a long-press gesture the
 * lift becomes a tap on the freshly opened dialog's backdrop and dismisses it.
 */
const hold = async (session) => {
  const point = await emptyStagePoint(session.page);
  if (!point) throw new Error('no bare stage point for the kiosk hold');
  const shownBefore = await session.page.locator(DIALOG).count();
  const started = Date.now();
  await session.cdp.send('Input.synthesizeTapGesture', {
    x: point.x, y: point.y, duration: HOLD_MS, tapCount: 1, gestureSourceType: 'touch',
  });
  const heldMs = Date.now() - started;
  let opened = shownBefore === 0;
  try {
    await session.page.locator(DIALOG).waitFor({ state: 'attached', timeout: 2000 });
  } catch {
    opened = false;
  }
  await session.page.waitForTimeout(300);
  return { opened, heldMs };
};

/** The plan's own frame: a zoom or a pan of the plan changes it. */
const planViewBox = (page) => page.evaluate((selector) => {
  const card = document.querySelector(selector);
  return (card.shadowRoot || card.renderRoot).querySelector('.zoomwrap > svg')?.getAttribute('viewBox') || '';
}, KIOSK);

/** Every real pointerup of a press, and whether the dialog or the stage received it. */
const watchReleases = (page) => page.evaluate((selector) => {
  window.__hpReleases = [];
  if (window.__hpReleaseWatch) return;
  window.__hpReleaseWatch = true;
  window.addEventListener('pointerup', (event) => {
    const path = event.composedPath();
    window.__hpReleases.push({
      type: event.pointerType,
      dialog: path.some((node) => node.localName === 'hp-dialog' && node.dataset?.kind === 'kiosk'),
      stage: path.some((node) => node.classList?.contains?.('stage')
        && node.getRootNode?.()?.host === document.querySelector(selector)),
    });
  }, true);
}, KIOSK);

/**
 * A real mouse press held on the bare stage until the dialog appears (or the
 * hold has clearly failed), then released where the pointer is: over the modal.
 */
const mouseHold = async (session, jitter = false) => {
  const point = await emptyStagePoint(session.page);
  if (!point) throw new Error('no bare stage point for the kiosk mouse hold');
  await session.page.mouse.move(point.x, point.y);
  await watchReleases(session.page);
  const started = Date.now();
  await session.page.mouse.down();
  if (jitter) await session.page.mouse.move(point.x + 2, point.y + 1);
  let opened = true;
  try {
    await session.page.locator(DIALOG).waitFor({ state: 'attached', timeout: HOLD_MS + 1600 });
  } catch {
    opened = false;
  }
  const heldMs = Date.now() - started;
  await session.page.mouse.up();
  await session.page.waitForTimeout(400);
  const state = await kioskState(session.page);
  const releases = await session.page.evaluate(() => window.__hpReleases);
  return { opened, heldMs, openAfterRelease: state.open, releases, state };
};

/** Close the dialog the way a user does, when it is open. */
const closeDialog = async (page) => {
  if (!(await kioskState(page)).open) return false;
  await footerButton(page, 'on').click();
  await page.locator(DIALOG).waitFor({ state: 'detached', timeout: 3000 });
  return true;
};

/** Long enough for a hold that should not exist to have opened the dialog. */
const noDialogAfterHold = async (page) => {
  await page.waitForTimeout(HOLD_MS + 500);
  return !(await kioskState(page)).open;
};

/** Flip a light in Home Assistant; does the kiosk plan paint the new state? */
const planFollowsHa = (page) => page.evaluate(async (selector) => {
  const card = document.querySelector(selector);
  const root = card.shadowRoot || card.renderRoot;
  const marker = () => root.querySelector('[data-hp="device"][data-id="d_light1"]');
  const before = marker()?.classList.contains('on');
  const state = card.hass.states['light.ceiling'];
  card.hass = { ...card.hass, states: { ...card.hass.states,
    'light.ceiling': { ...state, state: state.state === 'on' ? 'off' : 'on' } } };
  for (let i = 0; i < 20 && marker()?.classList.contains('on') === before; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return typeof before === 'boolean' && marker()?.classList.contains('on') === !before
    || `light marker stayed ${before ? 'on' : 'off'}`;
}, KIOSK);

const slider = (page, index) => page.locator(`${DIALOG} input[type="range"]`).nth(index);
const nudge = async (page, index, steps) => {
  await slider(page, index).focus();
  for (let i = 0; i < steps; i += 1) await page.keyboard.press('ArrowRight');
};
const footerButton = (page, kind) => page.locator(`${DIALOG} [slot="footer"] button.${kind}`);

const out = {};

// (1) Cold kiosk, network healthy: the dialog lives without the editor.
const kiosk = await openKiosk(false);
out.coldPageHasNoEditorChunk = kiosk.cold;
const before = await kioskState(kiosk.page);
out.coldKioskEditorIdle = same({ loader: 'idle', runtime: false, requests: 0 },
  { loader: before.loader, runtime: before.runtime, requests: kiosk.chunk.requests });

// #825: real slow pan crosses the existing 8 px classifier, then returns
// to the press origin without releasing. Neither leg may revive the hold.
await kiosk.page.evaluate((selector) => {
  const card = document.querySelector(selector), hass = card.hass;
  window.__panWrites = []; window.__panServices = 0; window.__panEvents = [];
  card.hass = { ...hass, callService: (...args) => {
    window.__panServices++; return hass.callService(...args);
  }, callWS: (request) => {
    if (/save|set_|delete/.test(request.type)) window.__panWrites.push(request.type);
    return hass.callWS(request);
  } };
  card.shadowRoot.querySelector('.stage').addEventListener('pointermove', event => {
    window.__panEvents.push({ trusted: event.isTrusted, type: event.pointerType });
  });
}, KIOSK);
for (const type of ['mouse', 'touch']) {
  const p = await emptyStagePoint(kiosk.page), original = await planViewBox(kiosk.page);
  const send = (kind, dx = 0, dy = 0) => kiosk.cdp.send('Input.dispatchTouchEvent', {
    type: kind, touchPoints: kind === 'touchEnd' ? [] : [{ x: p.x + dx, y: p.y + dy, id: 9 }],
  });
  if (type === 'mouse') { await kiosk.page.mouse.move(p.x, p.y); await kiosk.page.mouse.down(); }
  else await send('touchStart');
  await kiosk.page.waitForTimeout(300);
  if (type === 'mouse') await kiosk.page.mouse.move(p.x + 25, p.y + 20, { steps: 3 });
  else await send('touchMove', 25, 20);
  await kiosk.page.waitForTimeout(HOLD_MS);
  out[`${type}SlowPanActuallyMovesPlan`] = (await planViewBox(kiosk.page)) !== original;
  out[`${type}SlowPanNeverOpensHold`] = !(await kioskState(kiosk.page)).open;
  if (type === 'mouse') await kiosk.page.mouse.move(p.x, p.y, { steps: 3 });
  else await send('touchMove');
  await kiosk.page.waitForTimeout(HOLD_MS);
  out[`${type}ReturnToOriginDoesNotRearmHold`] = !(await kioskState(kiosk.page)).open;
  if (type === 'mouse') await kiosk.page.mouse.up(); else await send('touchEnd');
  if (process.argv.includes('--pan-red-witness') && !out[`${type}SlowPanNeverOpensHold`]) {
    checkAll(out); await finish(kiosk.browser, out); process.exit(process.exitCode || 0);
  }
  await closeDialog(kiosk.page);
}
out.slowPanUsesTrustedMouseAndTouch = await kiosk.page.evaluate(() => ['mouse', 'touch']
  .every(type => window.__panEvents.some(event => event.type === type && event.trusted)));
out.slowPanHasNoWritesServicesOrEditor = await kiosk.page.evaluate(() =>
  window.__panWrites.length === 0 && window.__panServices === 0) && kiosk.chunk.requests === 0;
if (process.argv.includes('--pan-red-witness')) {
  checkAll(out); await finish(kiosk.browser, out); process.exit(process.exitCode || 0);
}

const first = await hold(kiosk);
out.realHoldOpensDialog = first.opened && first.heldMs >= 3000 || `opened=${first.opened} after ${first.heldMs} ms`;
const opened = await kioskState(kiosk.page);
out.dialogShowsCurrentScale = same({ open: true, sliders: [100, 100], labels: ['100%', '100%'] },
  { open: opened.open, sliders: opened.sliders, labels: opened.labels });
out.openDialogLoadsNoEditor = same({ loader: 'idle', runtime: false, requests: 0 },
  { loader: opened.loader, runtime: opened.runtime, requests: kiosk.chunk.requests });

await nudge(kiosk.page, 0, 10); // icons 100 → 150 %
await nudge(kiosk.page, 1, 5); // label font 100 → 125 %
const scaled = await kioskState(kiosk.page);
out.slidersChangeScale = same({ sliders: [150, 125], labels: ['150%', '125%'] },
  { sliders: scaled.sliders, labels: scaled.labels });
out.iconScaleApplied = near(1.5, scaled.iconSize / before.iconSize);
out.fontScaleApplied = near(1.25, scaled.labelFont);
out.scaleSavedLocally = scaled.stored.some(([icon, font]) => icon === 1.5 && font === 1.25)
  || JSON.stringify(scaled.stored);

await footerButton(kiosk.page, 'ghost').tap(); // Reset
await kiosk.page.waitForTimeout(150);
const reset = await kioskState(kiosk.page);
out.resetRestoresDefaults = same({ open: true, sliders: [100, 100], labels: ['100%', '100%'] },
  { open: reset.open, sliders: reset.sliders, labels: reset.labels });
out.resetAppliedAndSaved = near(1, reset.iconSize / before.iconSize) === true
  && near(1, reset.labelFont) === true
  && reset.stored.some(([icon, font]) => icon === 1 && font === 1)
  || JSON.stringify({ iconSize: reset.iconSize, labelFont: reset.labelFont, stored: reset.stored });

await nudge(kiosk.page, 0, 4); // icons 100 → 120 %, kept across the reopen
await footerButton(kiosk.page, 'on').tap(); // Close
await kiosk.page.locator(DIALOG).waitFor({ state: 'detached', timeout: 3000 });
const closed = await kioskState(kiosk.page);
out.closeKeepsScale = same({ open: false }, { open: closed.open })
  && near(1.2, closed.iconSize / before.iconSize);

const second = await hold(kiosk);
const reopened = await kioskState(kiosk.page);
out.secondHoldReopens = second.opened || `not reopened after ${second.heldMs} ms`;
out.reopenedShowsSavedScale = same({ sliders: [120, 100], labels: ['120%', '100%'] },
  { sliders: reopened.sliders, labels: reopened.labels });
await footerButton(kiosk.page, 'on').tap();
await kiosk.page.locator(DIALOG).waitFor({ state: 'detached', timeout: 3000 });
await kiosk.page.waitForTimeout(500);
const after = await kioskState(kiosk.page);
out.kioskSessionNeverRequestedEditor = same(
  { requests: 0, loader: 'idle', runtime: false, notices: 0 },
  { requests: kiosk.chunk.requests, loader: after.loader, runtime: after.runtime, notices: after.notices },
);
out.scaleNeverWritesTheLegacyKey = same(null,
  await kiosk.page.evaluate((key) => localStorage.getItem(key), LEGACY_SCALE_KEY));

// (1b) #813 AC1: three real mouse holds in a row on the same cold kiosk.
await kiosk.page.evaluate((selector) => {
  const card = document.querySelector(selector);
  const hass = card.hass;
  window.__hpServiceCalls = 0;
  card.hass = { ...hass, callService: (...args) => {
    window.__hpServiceCalls += 1;
    return hass.callService(...args);
  } };
}, KIOSK);
const mouseBefore = { viewBox: await planViewBox(kiosk.page), state: await kioskState(kiosk.page) };
const rounds = [];
for (let round = 0; round < 3; round += 1) {
  const result = await mouseHold(kiosk, round === 0);
  result.viewBox = await planViewBox(kiosk.page);
  result.closed = await closeDialog(kiosk.page);
  await kiosk.page.waitForTimeout(300);
  result.viewBoxAfterClose = await planViewBox(kiosk.page);
  rounds.push(result);
}
const roundsSeen = rounds.map((round) => ({
  opened: round.opened, heldMs: round.heldMs, openAfterRelease: round.openAfterRelease,
  releases: round.releases, closed: round.closed,
}));
out.mouseHoldOpensTheDialogEveryTime = rounds.every((round) => round.opened && round.heldMs >= 3000)
  || JSON.stringify(roundsSeen);
out.mouseReleaseIsDeliveredToTheOpenDialog = rounds.every((round) => round.releases.length === 1
  && round.releases[0].type === 'mouse' && round.releases[0].dialog && !round.releases[0].stage)
  || JSON.stringify(roundsSeen);
out.dialogStaysOpenUntilClosed = rounds.every((round) => round.openAfterRelease && round.closed)
  || JSON.stringify(roundsSeen);
out.mouseHoldsNeverZoomThePlan = rounds.every((round) => round.viewBox === mouseBefore.viewBox
  && round.viewBoxAfterClose === mouseBefore.viewBox)
  || JSON.stringify({ before: mouseBefore.viewBox, after: rounds.map((round) => round.viewBoxAfterClose) });
const mouseAfter = await kioskState(kiosk.page);
out.mouseHoldsKeepTheSavedScale = same(
  { iconSize: mouseBefore.state.iconSize, labelFont: mouseBefore.state.labelFont, stored: mouseBefore.state.stored },
  { iconSize: mouseAfter.iconSize, labelFont: mouseAfter.labelFont, stored: mouseAfter.stored },
);
out.noPointerLeftOnTheStage = await kiosk.page.evaluate((selector) => document.querySelector(selector)._pointers.size === 0, KIOSK);
out.planFollowsHaAfterTheHolds = await planFollowsHa(kiosk.page);

// (1c) #813 AC2: presses that must not open the dialog.
const bare = await emptyStagePoint(kiosk.page);
const touch = (type, points) => kiosk.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
// An ordinary tap.
await kiosk.cdp.send('Input.synthesizeTapGesture', {
  x: bare.x, y: bare.y, duration: 80, tapCount: 1, gestureSourceType: 'touch',
});
out.touchTapOpensNothing = await noDialogAfterHold(kiosk.page);
await closeDialog(kiosk.page);
// A touch the browser cancels while it is held.
await touch('touchStart', [{ x: bare.x, y: bare.y, id: 1 }]);
await kiosk.page.waitForTimeout(400);
await touch('touchCancel', []);
out.cancelledTouchOpensNothing = await noDialogAfterHold(kiosk.page);
await closeDialog(kiosk.page);
// A held touch that loses its capture: the finger stays down, the stage no
// longer owns the pointer. Capture changes are delivered with the next event.
await kiosk.page.evaluate(() => {
  window.__hpPress = null;
  window.__hpLostCapture = 0;
  window.addEventListener('pointerdown', (event) => {
    window.__hpPress = { id: event.pointerId, target: event.composedPath()[0] };
  }, { capture: true, once: true });
  window.addEventListener('lostpointercapture', () => { window.__hpLostCapture += 1; }, true);
});
await touch('touchStart', [{ x: bare.x, y: bare.y, id: 2 }]);
await kiosk.page.waitForTimeout(100);
await touch('touchMove', [{ x: bare.x + 1, y: bare.y, id: 2 }]);
const captured = await kiosk.page.evaluate(() => {
  const press = window.__hpPress;
  const had = !!press?.target.hasPointerCapture(press.id);
  press?.target.releasePointerCapture(press.id);
  return had;
});
await touch('touchMove', [{ x: bare.x + 2, y: bare.y, id: 2 }]);
out.lostCaptureWasReal = captured && await kiosk.page.evaluate(() => window.__hpLostCapture === 1);
out.touchThatLostCaptureOpensNothing = await noDialogAfterHold(kiosk.page);
await closeDialog(kiosk.page);
await touch('touchEnd', []);
await kiosk.page.waitForTimeout(300);
await closeDialog(kiosk.page);
// A mouse press interrupted by the window losing focus to another document.
await kiosk.page.mouse.move(bare.x, bare.y);
await kiosk.page.mouse.down();
await kiosk.page.waitForTimeout(300);
out.windowBlurWasReal = await kiosk.page.evaluate(async () => {
  let blurred = false;
  window.addEventListener('blur', () => { blurred = true; }, { once: true });
  const frame = document.createElement('iframe');
  frame.id = 'hp-blur-frame';
  frame.srcdoc = '<input>';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:40px;height:40px;z-index:200';
  const loaded = new Promise((resolve) => { frame.onload = resolve; });
  document.body.appendChild(frame);
  await loaded;
  frame.contentWindow.focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  return blurred;
});
out.pressInterruptedByBlurOpensNothing = await noDialogAfterHold(kiosk.page);
await kiosk.page.mouse.up();
await kiosk.page.evaluate(() => { document.getElementById('hp-blur-frame')?.remove(); window.focus(); });
await closeDialog(kiosk.page);
// A press across a detach/reattach of the same card: released while detached.
await kiosk.page.mouse.move(bare.x, bare.y);
await kiosk.page.mouse.down();
await kiosk.page.waitForTimeout(300);
await kiosk.page.evaluate((selector) => {
  const card = document.querySelector(selector);
  window.__hpDetached = card;
  card.remove();
}, KIOSK);
await kiosk.page.mouse.up();
await kiosk.page.evaluate(() => document.body.appendChild(window.__hpDetached));
await kiosk.page.waitForFunction((selector) => !!document.querySelector(selector)
  ?.renderRoot.querySelector('.stage .devlayer'), KIOSK, { timeout: 9000 });
out.remountedPressOpensNothing = await noDialogAfterHold(kiosk.page);
await closeDialog(kiosk.page);
const afterRemount = await mouseHold(kiosk);
out.holdAfterRemountOpensTheDialog = afterRemount.opened && afterRemount.openAfterRelease
  || JSON.stringify({ opened: afterRemount.opened, heldMs: afterRemount.heldMs });
await closeDialog(kiosk.page);
// A pinch zooms the plan and is never a hold.
await kiosk.cdp.send('Input.synthesizePinchGesture', {
  x: bare.x, y: bare.y, scaleFactor: 1.4, relativeSpeed: 400, gestureSourceType: 'touch',
});
out.pinchOpensNothing = await noDialogAfterHold(kiosk.page);
await closeDialog(kiosk.page);
// The touch hold still works after all of it.
const lastTouch = await hold(kiosk);
out.touchHoldStillOpensTheDialog = lastTouch.opened || `not opened after ${lastTouch.heldMs} ms`;
await closeDialog(kiosk.page);
const lifecycle = await kioskState(kiosk.page);
out.kioskGesturesCallNoServiceAndNoEditor = same(
  { calls: 0, requests: 0, loader: 'idle', runtime: false, notices: 0 },
  {
    calls: await kiosk.page.evaluate(() => window.__hpServiceCalls), requests: kiosk.chunk.requests,
    loader: lifecycle.loader, runtime: lifecycle.runtime, notices: lifecycle.notices,
  },
);

// (2) Control: the ordinary editor entry outside the kiosk still fetches the
// chunk, once, and installs the runtime.
await kiosk.page.evaluate((selector) => {
  document.querySelector(selector).remove();
  window.__card.setAttribute('data-smoke', 'main');
}, KIOSK);
await kiosk.page.locator('[data-smoke="main"] [data-hp="mode-tab"][data-mode="plan"]').click();
await kiosk.page.waitForFunction(() => window.__card._mode === 'plan'
  && window.__card._editorRuntimeLoader.state === 'ready', null, { timeout: 9000 });
out.editorEntryOutsideKioskLoadsChunk = same(1, kiosk.chunk.requests);

// (3) Negative probe: the network refuses the editor chunk. The kiosk dialog
// works anyway and nobody is told the editor failed to load.
const offline = await openKiosk(true);
const blockedHold = await hold(offline);
out.blockedChunkHoldOpensDialog = blockedHold.opened || `not opened after ${blockedHold.heldMs} ms`;
await nudge(offline.page, 0, 2); // icons 100 → 110 %
const blockedScaled = await kioskState(offline.page);
out.blockedChunkSliderWorks = same({ sliders: [110, 100], labels: ['110%', '100%'] },
  { sliders: blockedScaled.sliders, labels: blockedScaled.labels })
  && blockedScaled.stored.some(([icon, font]) => icon === 1.1 && font === 1);
await footerButton(offline.page, 'ghost').tap();
await offline.page.waitForTimeout(150);
const blockedReset = await kioskState(offline.page);
out.blockedChunkResetWorks = same([100, 100], blockedReset.sliders);
await footerButton(offline.page, 'on').tap();
await offline.page.locator(DIALOG).waitFor({ state: 'detached', timeout: 3000 });
await offline.page.waitForTimeout(500);
const blockedAfter = await kioskState(offline.page);
out.blockedChunkNeverAsked = same(
  { requests: 0, refused: 0, loader: 'idle', runtime: false, notices: 0, toast: '' },
  {
    requests: offline.chunk.requests, refused: offline.chunk.refused, loader: blockedAfter.loader,
    runtime: blockedAfter.runtime, notices: blockedAfter.notices, toast: blockedAfter.toast,
  },
);

await offline.browser.close();
checkAll(out);
await finish(kiosk.browser, out);
