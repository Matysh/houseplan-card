// #869: Optimize explains position records it could not match, on the
// production bundle. The owner example (two v1.0–v1.4 lamp groups `grp_*` and
// one opaque id, all on floors that no longer exist): a plain summary, why the
// records are safe to keep, the count per cause with the exact HA Area name,
// «Copy diagnostics» and «Close». Incomplete HA data adds «Check again»: a
// refused reload keeps the same report, a full one moves the record to its
// live owner, a late answer after Close changes nothing. Layout at 1280/360 px
// in both themes, keyboard reach, and no config/layout write anywhere.
import { launch, check, finish } from './serve.mjs';

const OPAQUE = '601413c5793c698f73b8af0a0b93cac6';
const { page, browser } = await launch({ width: 1280, height: 900 });
const results = {};
const record = (name, value) => { results[name] = value; check(name, value); };

// --------------------------------------------------------------- setup
const setup = await page.evaluate(async (opaque) => {
  const card = window.__card;
  const test = window.__hpTest;
  const base = card.hass;
  const writes = [];
  // Every houseplan/* call except the reads the card makes on a pushed revision.
  const watched = (message) => {
    if (/^houseplan\//.test(message.type) && !/\/get$/.test(message.type)) writes.push(message.type);
  };
  window.__869 = { writes, gate: null };
  const callWS = base.callWS;
  const language = (code) => ({ language: code, locale: { language: code } });
  window.__869.hass = (patch = {}) => {
    card.hass = {
      ...card.hass, ...patch,
      callWS: async (message) => {
        watched(message);
        const gate = window.__869.gate;
        if (gate && /registry\/list$/.test(message.type)) await gate.promise;
        return callWS(message);
      },
    };
  };
  window.__869.hass({
    ...language('ru'),
    areas: { ...base.areas, detskaia_elina: { area_id: 'detskaia_elina', name: 'Детская Элины' } },
  });
  window.__869.language = (code) => window.__869.hass(language(code));
  await test.settled();
  // Optimize's own candidate is the clean plan: the second run must find nothing.
  card._editorRuntime.optimizePlans.open();
  await test.settled();
  const clean = structuredClone(card._alignDialog);
  await test.close(undefined, { via: 'cancel' });
  await test.setServerConfig(clean.config);
  await test.setLayout({
    ...clean.layout,
    grp_detskaia_elina: { s: 'f2', x: 0.25, y: 0.25 },
    grp_detskaia_maiia: { s: 'f2', x: 0.5, y: 0.5 },
    [opaque]: { s: 'smrnf8s7x', x: 0.75, y: 0.75 },
  });
  await test.settled();
  writes.length = 0; // only what the dialog itself might write is judged below
  return { cleanChanged: clean.changed, access: card._haRegistry.access };
}, OPAQUE);
console.log('setup', JSON.stringify(setup));

/** Open Optimize and describe what a person sees in it. */
const openAndRead = () => page.evaluate(async () => {
  const card = window.__card;
  const test = window.__hpTest;
  card._editorRuntime.optimizePlans.open();
  await test.settled();
  const dialog = (card.shadowRoot || card.renderRoot).querySelector('hp-dialog[data-kind="settings"]');
  const body = dialog?.querySelector('.body');
  const block = body?.querySelector('.optimize-unverified');
  const details = body?.querySelector('details.optimize-details');
  const main = [...(body?.children || [])].filter((element) => element !== details)
    .map((element) => element.textContent || '').join(' ').replace(/\s+/g, ' ');
  return {
    open: !!dialog,
    main,
    blockLines: [...(block?.querySelectorAll('p, li') || [])].map((element) => element.textContent.trim()),
    buttons: [...(dialog?.querySelectorAll('button') || [])].map((button) => button.textContent.trim()),
    hasApply: !!dialog?.querySelector('[data-hp="dialog-confirm"]'),
    // The fixture has no vacuum warning: no alert may remain in the body at all.
    alertInBlock: !block || !!body.querySelector('[role="alert"]'),
    statusInBlock: !!block?.querySelector('[role="status"]'),
    detailsClosed: details?.open === false,
    details: details?.textContent.replace(/\s+/g, ' ') || '',
    changed: card._alignDialog?.changed,
    sameLayout: JSON.stringify(card._alignDialog?.layout) === JSON.stringify(card._layout),
    registryAuthoritative: card._alignDialog?.report.registryAuthoritative,
  };
});
const t = (key, vars) => page.evaluate(([k, v]) => window.__card._t(k, v), [key, vars]);
const close = (via) => page.evaluate(async (how) => {
  const card = window.__card;
  const dialog = (card.shadowRoot || card.renderRoot).querySelector('hp-dialog[data-kind="settings"]');
  if (how === 'scrim') {
    const native = dialog?.shadowRoot?.querySelector('dialog');
    native?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await window.__hpTest.settled();
  } else {
    await window.__hpTest.close(dialog, { via: how });
  }
  return card._alignDialog === null && !dialog?.isConnected;
}, via);

// ------------------------------------------------- AC1: the owner example
const fullRegistry = setup.access === 'full';
record('setupFullRegistry', fullRegistry);
let seen = await openAndRead();
record('ownerOpensWithNothingToApply', seen.open && seen.changed === false && !seen.hasApply);
record('ownerLayoutUnchanged', seen.sameLayout);
record('ownerPlainSummary', seen.main.includes(await t('gs.optimize_no_changes'))
  && !seen.main.includes('Проверьте') && !seen.main.includes('проверить позиций'));
const namesRu = await t('gs.optimize_live_names', { names: 'Детская Элины', more: '' });
record('ownerExplainsAndGroups', JSON.stringify(seen.blockLines) === JSON.stringify([
  await t('gs.optimize_unverified', { n: '3' }),
  await t('gs.optimize_unverified_safe'),
  await t('gs.optimize_unverified_legacy', { n: '2', names: namesRu }),
  await t('gs.optimize_unverified_unknown', { n: '1' }),
]));
record('ownerActionsCopyAndClose', JSON.stringify(seen.buttons.filter(Boolean)) === JSON.stringify([
  await t('gs.preflight_copy'), await t('btn.close'),
]));
record('ownerBlockIsNotAlert', !seen.alertInBlock && !seen.statusInBlock);
record('ownerIdsOnlyInClosedDetails', seen.detailsClosed
  && !/grp_detskaia|smrnf8s7x|601413c5/.test(seen.main)
  && seen.details.includes('«Детская Элины» (grp_detskaia_elina)')
  && seen.details.includes(OPAQUE));

// ------------------------------------------------- AC5: copy diagnostics
const copy = await page.evaluate(async () => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  let copied = null;
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async (text) => { copied = text; } }, configurable: true,
  });
  root.querySelector('hp-dialog .optimize-copy')?.click();
  await window.__hpTest.settled();
  let block = null;
  try { block = JSON.parse(copied); } catch { /* stays null */ }
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { throw new Error('denied'); } }, configurable: true,
  });
  root.querySelector('hp-dialog .optimize-copy')?.click();
  await window.__hpTest.settled();
  const pre = root.querySelector('hp-dialog .optimize-unverified details[open] pre');
  return {
    block,
    hasNames: /Детская|Элины/.test(copied || ''),
    fallback: !!pre && pre.textContent.includes('houseplan-optimize-unverified')
      && getComputedStyle(pre).userSelect !== 'none',
  };
});
record('copyCarriesEveryRecordByCause', copy.block?.kind === 'houseplan-optimize-unverified'
  && copy.block.records.length === 3
  && JSON.stringify(copy.block.counts) === JSON.stringify({
    total: 3, legacy_group: 2, unknown_owner: 1, registry_unavailable: 0,
  })
  && typeof copy.block.cardVersion === 'string' && typeof copy.block.registry?.authoritative === 'boolean');
record('copyHasNoNames', !copy.hasNames);
record('clipboardRefusalShowsSelectableText', copy.fallback);
record('closeWritesNothing', await close('cancel'));

// ------------------------------- AC6: layout, themes, widths, keyboard
const measure = () => page.evaluate(async () => {
  const card = window.__card;
  const test = window.__hpTest;
  card._editorRuntime.optimizePlans.open();
  await test.settled();
  await document.fonts.ready;
  const dialog = (card.shadowRoot || card.renderRoot).querySelector('hp-dialog[data-kind="settings"]');
  const surface = dialog.shadowRoot?.querySelector('.surface, ha-dialog') || dialog;
  const body = dialog.querySelector('.body');
  const block = body.querySelector('.optimize-unverified');
  if (!block) return { noOverflow: false, tall: false, actions: 0 };
  const actions = [...block.querySelectorAll('.optimize-action')];
  const rects = [...block.querySelectorAll('*')].map((element) => element.getBoundingClientRect());
  const box = surface.getBoundingClientRect();
  return {
    // The demo page itself is wider than 360 px (the card has a minimum
    // width); the dialog surface must stay inside the viewport regardless.
    noOverflow: box.left >= -1 && box.right <= innerWidth + 1
      && body.scrollWidth <= body.clientWidth + 1 && block.scrollWidth <= block.clientWidth + 1
      && rects.every((rect) => rect.left >= box.left - 1 && rect.right <= box.right + 1),
    tall: actions.length > 0 && actions.every((button) => button.getBoundingClientRect().height >= 44),
    actions: actions.length,
  };
});
const tabReach = () => page.evaluate(async () => {
  const card = window.__card;
  const dialog = (card.shadowRoot || card.renderRoot).querySelector('hp-dialog[data-kind="settings"]');
  const deep = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  return { first: deep()?.textContent?.trim() || '', inside: dialog.contains(deep()) };
});
for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  for (const [lang, width] of [['ru', 1280], ['ru', 360], ['en', 360], ['en', 1280]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async (code) => { window.__869.language(code); await window.__hpTest.settled(); }, lang);
    const m = await measure();
    record(`layout_${theme}_${lang}_${width}`, m.noOverflow && m.tall && m.actions === 1);
    await close('escape');
  }
}
// Keyboard: Tab reaches every button of the block and the footer; Esc closes.
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(async () => { window.__869.language('ru'); await window.__hpTest.settled(); });
await page.evaluate(async () => {
  window.__card._editorRuntime.optimizePlans.open();
  await window.__hpTest.settled();
});
const reached = new Set();
for (let step = 0; step < 12; step++) {
  await page.keyboard.press('Tab');
  const focus = await tabReach();
  if (focus.inside) reached.add(focus.first);
}
record('tabReachesCopyAndClose', reached.has(await t('gs.preflight_copy')) && reached.has(await t('btn.close')));
await page.keyboard.press('Escape');
record('escapeClosesWithoutWrite', await page.evaluate(async () => {
  await window.__hpTest.settled();
  return window.__card._alignDialog === null;
}));
await page.evaluate(async () => {
  window.__card._editorRuntime.optimizePlans.open();
  await window.__hpTest.settled();
});
record('scrimClosesWithoutWrite', await close('scrim'));
record('noWriteWhileReadingCopyingClosing', await page.evaluate(() => window.__869.writes.length === 0));

// ------------------------------------------ AC3: incomplete HA data
// The gate device stays in the full registry but leaves the frontend projection;
// its old position points to a floor that is gone.
const limited = await page.evaluate(async () => {
  const card = window.__card;
  const test = window.__hpTest;
  await test.setLayout((layout) => ({ ...layout, d_gate: { s: 'gone_floor', x: 0.4, y: 0.4 } }));
  window.__setRegistryAccess('limited');
  const { d_gate: _gate, ...devices } = card.hass.devices;
  window.__869.hass({ devices });
  await test.settled();
  const deadline = performance.now() + 5000;
  while (card._haRegistry.access !== 'limited' && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await test.settled();
  window.__869.writes.length = 0; // the card's own device bookkeeping is not the dialog
  return card._haRegistry.access;
});
record('registryBecameLimited', limited === 'limited');
seen = await openAndRead();
const retryLabel = await t('gs.optimize_retry');
record('limitedOffersLineAndRetry', seen.registryAuthoritative === false
  && seen.main.includes(await t('gs.optimize_registry_limited'))
  && seen.buttons.includes(retryLabel) && seen.statusInBlock);
const reachedLimited = new Set();
for (let step = 0; step < 12; step++) {
  await page.keyboard.press('Tab');
  const focus = await tabReach();
  if (focus.inside) reachedLimited.add(focus.first);
}
record('tabReachesRetryCopyAndClose', reachedLimited.has(retryLabel)
  && reachedLimited.has(await t('gs.preflight_copy')) && reachedLimited.has(await t('btn.close')));
for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width: 360, height: 900 });
  const m = await page.evaluate(async () => {
    const card = window.__card;
    const dialog = (card.shadowRoot || card.renderRoot).querySelector('hp-dialog[data-kind="settings"]');
    const block = dialog.querySelector('.optimize-unverified');
    if (!block) return false;
    const body = dialog.querySelector('.body');
    const box = (dialog.shadowRoot?.querySelector('.surface, ha-dialog') || dialog).getBoundingClientRect();
    const actions = [...block.querySelectorAll('.optimize-action')];
    return box.left >= -1 && box.right <= innerWidth + 1 && body.scrollWidth <= body.clientWidth + 1
      && block.scrollWidth <= block.clientWidth + 1 && actions.length === 2
      && actions.every((button) => button.getBoundingClientRect().height >= 44
        && button.getBoundingClientRect().right <= block.getBoundingClientRect().right + 1);
  });
  record(`layout_retry_${theme}_ru_360`, m);
}
await page.setViewportSize({ width: 1280, height: 900 });

const retry = (expectChange) => page.evaluate(async (change) => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const before = card._alignDialog;
  root.querySelector('hp-dialog .optimize-retry')?.click();
  await window.__hpTest.settled();
  const during = {
    retryDisabled: root.querySelector('hp-dialog .optimize-retry')?.disabled === true,
    flag: card._alignDialog?.retrying === true,
  };
  const deadline = performance.now() + 12_000;
  while (card._alignDialog?.retrying && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await window.__hpTest.settled();
  const dialog = root.querySelector('hp-dialog[data-kind="settings"]');
  const report = card._alignDialog?.report;
  return {
    during,
    sameReport: report === before.report,
    retryFailed: card._alignDialog?.retryFailed === true,
    retryEnabled: dialog?.querySelector('.optimize-retry')?.disabled === false,
    hasRetry: !!dialog?.querySelector('.optimize-retry'),
    statusText: dialog?.querySelector('.optimize-registry[role="status"]')?.textContent.replace(/\s+/g, ' ') || '',
    gateLive: report?.liveMissingPositions.some((item) => item.id === 'd_gate') === true,
    gateUnverified: report?.unverifiedPositions.some((item) => item.id === 'd_gate') === true,
    authoritative: report?.registryAuthoritative,
    changeExpected: change,
  };
}, expectChange);

let answer = await retry(false);
record('retryInactiveWhileChecking', answer.during.retryDisabled && answer.during.flag);
record('refusedRetryKeepsReportAndSaysSo', answer.sameReport && answer.retryFailed && answer.retryEnabled
  && answer.statusText.includes(await t('gs.optimize_registry_still_limited')) && answer.gateUnverified);
await page.evaluate(() => window.__setRegistryAccess('full'));
answer = await retry(true);
record('fullRetryMovesRecordToLiveOwner', !answer.sameReport && answer.authoritative === true
  && answer.gateLive && !answer.gateUnverified && !answer.hasRetry);
record('closeAfterRetryWritesNothing', await close('cancel'));

// ------------------------------------- AC4: a late answer after Close
const late = await page.evaluate(async () => {
  const card = window.__card;
  const test = window.__hpTest;
  const root = card.shadowRoot || card.renderRoot;
  window.__setRegistryAccess('limited');
  window.__setRegistryArea('device', 'd_lamp', 'living_room');
  let deadline = performance.now() + 5000;
  while (card._haRegistry.access !== 'limited' && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  card._editorRuntime.optimizePlans.open();
  await test.settled();
  const opened = card._alignDialog?.report.registryAuthoritative === false;
  let release;
  window.__869.gate = { promise: new Promise((resolve) => { release = resolve; }) };
  window.__setRegistryAccess('full');
  root.querySelector('hp-dialog .optimize-retry')?.click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const dialog = root.querySelector('hp-dialog[data-kind="settings"]');
  await test.close(dialog, { via: 'escape' });
  const closed = card._alignDialog === null;
  window.__869.gate = null;
  release();
  deadline = performance.now() + 5000;
  while (card._haRegistry.access !== 'full' && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  await test.settled();
  return {
    opened, closed,
    stillClosed: card._alignDialog === null && !root.querySelector('hp-dialog[data-kind="settings"]'),
    full: card._haRegistry.access === 'full',
  };
});
record('lateAnswerAfterCloseChangesNothing', late.opened && late.closed && late.stillClosed && late.full);

const writes = await page.evaluate(() => window.__869.writes);
console.log('writes', JSON.stringify(writes));
record('noConfigOrLayoutWrite', writes.length === 0);

await finish(browser, results);
