// #718 AC11/AC12: the «Now: …» line under the moon switch in General
// settings, in the production bundle. One snapshot per opening, judged by the
// lazy moon chunk as if the switch were on; kept outside the draft. Moscow
// through `hass.config`, the page clock at 2026-10-21 18:00Z (the moon at
// 23.9°, 79 % lit), the demo in English.
import { launch, checkAll, finish } from './serve.mjs';

const MOSCOW = { latitude: 55.75, longitude: 37.62 };
const NIGHT_SUN = { azimuth: 0, elevation: -12, rising: false };
const HINT = 'Shown behind the plan with any background, from 3° above the horizon, except around new moon; '
  + 'computed from the home coordinates in Home Assistant.';
const SHOWN = 'Now: shown (24° above the horizon, 79% lit).';
const DAY_SUN = 'Now: not shown (the sun is 25° above the horizon; the moon shows once it is below 6°).';
const checks = {};
const report = {};
const isMoonAsset = (url) => /\/moon-runtime-[^/?]*\.js(?:\?|$)/.test(url);

/**
 * A fresh page (the chunk is loaded once per page). `route` intercepts the
 * moon chunk on top of the harness's `route('**\/*')`.
 */
async function open({ moon = false, route = null } = {}) {
  const run = await launch({ width: 1000, height: 760 });
  run.moonRequests = [];
  run.page.on('request', (request) => { if (isMoonAsset(request.url())) run.moonRequests.push(request.url()); });
  if (route) await run.page.route('**/moon-runtime-*.js', route);
  await run.page.clock.setFixedTime(new Date('2026-10-21T18:00:00Z'));
  await pushHass(run.page, { config: MOSCOW, sun: NIGHT_SUN });
  await run.page.evaluate((moon) => window.__hpTest.setServerConfig((cfg) => {
    cfg.settings = { ...(cfg.settings || {}), bg_mode: 'static' };
    if (moon) cfg.settings.moon = true; else delete cfg.settings.moon;
    return cfg;
  }), moon);
  return run;
}

const pushHass = (page, { config, sun }) => page.evaluate(async ({ config, sun }) => {
  const card = window.__card;
  card.hass = {
    ...card.hass,
    ...(config ? { config } : {}),
    states: sun
      ? { ...card.hass.states, 'sun.sun': { entity_id: 'sun.sun', state: sun.elevation > 0 ? 'above_horizon' : 'below_horizon', attributes: sun } }
      : card.hass.states,
  };
  await card.updateComplete;
}, { config, sun });

/** Open General settings; what the first rendered frame shows. */
const openDialog = (page) => page.evaluate(async () => {
  const card = window.__card;
  card._openSettingsDialog();
  await card.updateComplete;
  const lines = card.renderRoot.querySelectorAll('hp-dialog [data-moon-status]');
  return {
    lines: lines.length,
    caption: card.renderRoot.querySelector('hp-dialog #gs-moon-caption')?.textContent.trim() ?? null,
  };
});
const line = (page) => page.evaluate(() => {
  const root = window.__card.renderRoot;
  const nodes = root.querySelectorAll('hp-dialog [data-moon-status]');
  const node = nodes[0] || null;
  return {
    count: nodes.length,
    reason: node?.dataset.moonStatus ?? null,
    text: node?.textContent.trim() ?? null,
    describedBy: root.querySelector('hp-dialog #gs-moon')?.getAttribute('aria-describedby') ?? null,
    inCaption: !!node?.closest('#gs-moon-caption'),
    live: !!node?.closest('[aria-live]'),
    saveDisabled: !!root.querySelector('hp-dialog [data-hp="dialog-confirm"]')?.disabled,
  };
});
const waitLine = (page, timeout = 2000) => page.waitForFunction(
  () => !!window.__card.renderRoot.querySelector('hp-dialog [data-moon-status]'), null, { timeout },
).then(() => true, () => false);
const closeDialog = (page) => page.evaluate(async () => {
  const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
  if (!dialog) return { closed: false, confirm: false };
  const result = await window.__hpTest.close(dialog);
  return { closed: result.closed, confirm: !!result.confirm };
});
/**
 * #731: Lovelace replaces the card — remove, then a new element with the same
 * config in the same slot (as in smoke_warm_dialogs); `window.__card` follows
 * the successor. True once the successor has revived the dialog of `kind`.
 */
const remount = (page, kind) => page.evaluate(async (kind) => {
  const old = window.__card;
  const host = old.parentNode;
  const hass = old.hass;
  old.remove();
  await new Promise((done) => setTimeout(done, 20));
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 });
  card.hass = hass;
  host.appendChild(card);
  window.__card = card;
  const revived = () => !!card.renderRoot?.querySelector(`hp-dialog[data-kind="${kind}"]`);
  // The page clock is fixed: count steps, not milliseconds.
  for (let step = 0; step < 250 && !revived(); step++) await new Promise((done) => setTimeout(done, 20));
  await card.updateComplete;
  return revived();
}, kind);
const draftOf = (page) => page.evaluate(() => JSON.stringify(window.__card._settingsDialog));

// ─── AC11 and AC12 (chunk already loaded by the View at night) ───
{
  const { page, browser } = await open({ moon: true });
  const planMoon = await page.waitForFunction(
    () => window.__card.renderRoot.querySelector('.hp-moon.on')?.dataset.moonK, null, { timeout: 8000 },
  ).then((handle) => handle.jsonValue(), () => null);
  const first = await openDialog(page);
  // AC12: the View loaded the chunk — the line is in the dialog's first frame.
  checks.ac12_preloadedLineInTheFirstFrame = first.lines === 1;
  const shown = await line(page);
  report.ac11 = { planMoon, first, shown };
  checks.ac11_shownText = shown.text === SHOWN && shown.reason === 'shown';
  checks.ac11_percentIsThePlanMoon = planMoon !== null && Math.round(Number(planMoon) * 100) === 79;
  checks.ac11_lineIsTheSecondCaptionLine = shown.inCaption && shown.describedBy === 'gs-moon-caption'
    && !shown.live && first.caption === `${HINT}${SHOWN}`;
  checks.ac11_lineLeavesTheDraftClean = shown.saveDisabled;
  const toggled = [];
  for (let i = 0; i < 2; i++) {
    await page.evaluate(async () => {
      window.__card.renderRoot.querySelector('hp-dialog #gs-moon')?.click();
      await window.__card.updateComplete;
    });
    toggled.push(await line(page));
  }
  report.ac11.toggled = toggled;
  checks.ac11_switchDoesNotChangeTheText = toggled.every((state) => state.text === SHOWN && state.count === 1);
  const closed = await closeDialog(page);
  checks.ac11_closesWithoutAsking = closed.closed && !closed.confirm;

  await pushHass(page, { sun: { azimuth: 200, elevation: 25.4, rising: false } });
  await openDialog(page);
  const day = await line(page);
  checks.ac11_daySunText = day.count === 1 && day.reason === 'day_sun' && day.text === DAY_SUN;
  await closeDialog(page);

  await pushHass(page, { config: { unit_system: { length: 'km' } } });
  await openDialog(page);
  const noHome = await line(page);
  report.ac11.day = day;
  report.ac11.noHome = noHome;
  checks.ac11_noHomeReason = noHome.count === 1 && noHome.reason === 'no_home';
  await closeDialog(page);
  await browser.close();
}

// ─── AC12: the chunk arrives a second late ───
{
  const delay = async (route) => { await new Promise((done) => setTimeout(done, 1000)); await route.fallback(); };
  const { page, browser, moonRequests } = await open({ route: delay });
  const first = await openDialog(page);
  checks.ac12_noLineWhileLoading = first.lines === 0 && first.caption === HINT;
  checks.ac12_lineArrives = await waitLine(page, 2000);
  const late = await line(page);
  report.ac12 = { first, late, requests: moonRequests.length };
  // The switch is off here: the dialog alone asked for the chunk, and the line
  // still says what the switch would show when on.
  checks.ac12_dialogLoadsTheChunkWithTheMoonOff = moonRequests.length === 1 && late.reason === 'shown'
    && late.saveDisabled;
  await closeDialog(page);
  await browser.close();
}

// ─── AC12: opened while loading, closed, sun changed, opened again ───
{
  const delay = async (route) => { await new Promise((done) => setTimeout(done, 1000)); await route.fallback(); };
  const { page, browser } = await open({ route: delay });
  await openDialog(page);
  const closed = await closeDialog(page);
  await pushHass(page, { sun: { azimuth: 180, elevation: 40, rising: false } });
  await openDialog(page);
  const arrived = await waitLine(page, 3000);
  await page.waitForTimeout(300);
  const again = await line(page);
  report.ac12.reopened = { closed, again };
  checks.ac12_reopenShowsOnlyTheSecondSnapshot = closed.closed && arrived && again.count === 1
    && again.reason === 'day_sun';
  await closeDialog(page);
  await browser.close();
}

// ─── #731 AC1/AC2: a warm revive is an opening of its own ───
{
  const { page, browser } = await open({ moon: true });
  await openDialog(page);
  const opened = await line(page);
  const draft = await draftOf(page);
  // The sun rises while the dialog is open: this opening keeps its snapshot…
  await pushHass(page, { sun: { azimuth: 200, elevation: 25.4, rising: false } });
  const stale = await line(page);
  // …and the card is replaced. The revived dialog is a new opening: its own
  // snapshot now, nothing carried over from the dead instance.
  const revived = await remount(page, 'settings');
  const arrived = await waitLine(page, 4000);
  const after = await line(page);
  const draftAfter = await draftOf(page);
  await closeDialog(page);
  // A regular opening at the same moment (the page clock is fixed).
  await openDialog(page);
  const regular = await line(page);
  report.r731 = { opened, stale, revived, after, regular };
  checks.r731_ac1_revivedDialogHasTheLine = revived && arrived && after.count === 1;
  checks.r731_ac1_sameAsARegularOpening = after.text === regular.text && after.reason === regular.reason
    && after.text === DAY_SUN;
  checks.r731_ac2_reviveTakesItsOwnSnapshot = opened.reason === 'shown' && stale.reason === 'shown'
    && after.reason === 'day_sun';
  checks.r731_ac2_lineLeavesTheRevivedDraftClean = after.saveDisabled && draftAfter === draft;
  await closeDialog(page);
  // In an editor the successor first waits for its own lazy runtime, then
  // adopts the mode and only then revives the dialog.
  await page.evaluate(() => window.__hpTest.setMode('plan'));
  await openDialog(page);
  const revivedInPlan = await remount(page, 'settings');
  const arrivedInPlan = await waitLine(page, 4000);
  const inPlan = await line(page);
  const planMode = await page.evaluate(() => window.__card._mode);
  report.r731.plan = { revivedInPlan, planMode, inPlan };
  checks.r731_ac1_revivedInAnEditorHasTheLine = revivedInPlan && arrivedInPlan && planMode === 'plan'
    && inPlan.count === 1 && inPlan.text === regular.text && inPlan.saveDisabled;
  await closeDialog(page);
  await browser.close();
}

// ─── #731 AC3: other revives never ask for the chunk; a revive while it loads ───
{
  const delay = async (route) => { await new Promise((done) => setTimeout(done, 1000)); await route.fallback(); };
  const { page, browser, moonRequests } = await open({ route: delay });
  const space = await page.evaluate(() => window.__card._space);
  await page.evaluate((id) => window.__hpTest.openSpaceDialog('edit', id), space);
  const revivedSpace = await remount(page, 'space');
  await page.waitForTimeout(600);
  const afterSpace = moonRequests.length;
  await page.evaluate(async () => {
    const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="space"]');
    if (dialog) await window.__hpTest.close(dialog);
  });
  // The opening asks for the chunk; the card is replaced before it lands.
  await openDialog(page);
  const revived = await remount(page, 'settings');
  const arrived = await waitLine(page, 3000);
  const late = await line(page);
  report.r731.ac3 = { revivedSpace, afterSpace, revived, late, requests: moonRequests.length };
  checks.r731_ac3_otherRevivesLeaveTheChunkAlone = revivedSpace && afterSpace === 0;
  checks.r731_ac3_reviveWhileTheChunkLoads = revived && arrived && late.count === 1
    && late.reason === 'shown' && late.text === SHOWN && late.saveDisabled && moonRequests.length === 1;
  await closeDialog(page);
  await browser.close();
}

// ─── AC12: the chunk request is refused ───
{
  const { page, browser } = await open({ route: (route) => route.abort() });
  const first = await openDialog(page);
  await page.waitForTimeout(800);
  const refused = await line(page);
  report.ac12.refused = { first, refused };
  checks.ac12_refusedLeavesNoLine = first.lines === 0 && refused.count === 0;
  // The dialog keeps working: a change enables Save and saves; Cancel closes.
  const saved = await page.evaluate(async () => {
    const card = window.__card;
    const root = card.renderRoot;
    root.querySelector('hp-dialog #gs-moon')?.click();
    await card.updateComplete;
    const save = root.querySelector('hp-dialog [data-hp="dialog-confirm"]');
    const enabled = !!save && !save.disabled;
    save?.click();
    const deadline = Date.now() + 4000;
    while (root.querySelector('hp-dialog[data-kind="settings"]') && Date.now() < deadline) {
      await new Promise((done) => setTimeout(done, 50));
    }
    return { enabled, closed: !root.querySelector('hp-dialog[data-kind="settings"]'), moon: card._serverCfg.settings.moon === true };
  });
  await openDialog(page);
  const cancelled = await page.evaluate(async () => {
    const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    const result = await window.__hpTest.close(dialog, { via: 'cancel' });
    return { closed: result.closed, confirm: !!result.confirm };
  });
  report.ac12.saved = saved;
  report.ac12.cancelled = cancelled;
  checks.ac12_saveStillWorks = saved.enabled && saved.closed && saved.moon;
  checks.ac12_cancelStillWorks = cancelled.closed && !cancelled.confirm;
  console.log(JSON.stringify(report, null, 1));
  checkAll(checks);
  await finish(browser, checks);
}
