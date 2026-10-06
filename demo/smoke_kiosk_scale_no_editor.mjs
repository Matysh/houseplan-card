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
