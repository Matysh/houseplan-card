// #848: real module-map failures on the production graph; no runtime-field seeding.
import { readFileSync, mkdirSync } from 'node:fs';
import { launchColdView, launchPanelCold, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
requirePinnedBrowser('848 optional View recovery');

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const roots = {
  live: /\/live-interaction-runtime-[^/]+\.js$/,
  summary: /\/summary-panel-runtime-entry-[^/]+\.js$/,
  zigbee: /\/hp-zigbee-topology-overlay-[^/]+\.js$/,
};
const paths = Object.fromEntries(Object.entries(roots).map(([name, pattern]) => {
  const file = manifest.files.find(file => pattern.test(file.path));
  if (!file) throw Error(`missing optional View root: ${name}`);
  return [name, file.path];
}));
const boot = readFileSync('demo/srv/demo.html', 'utf8');
const out = {};
mkdirSync('artifacts/view-runtime', { recursive: true });

async function start(kind, { language = 'en', width = 1280, hidden = false, dependency = false, terminal = false, otherKinds = [] } = {}) {
  const { page, browser } = await launchColdView({ width: 1280, height: 900 }, 1, [], { hasTouch: true });
  // A genuine saved local preference from the preceding healthy document.
  await page.locator('houseplan-card .summary-control button[aria-pressed]').waitFor();
  if (kind === 'summary' && !hidden) await page.locator('houseplan-card .summary-control button[aria-pressed]').click();
  const preference = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
    .filter(key => key.startsWith('houseplan.summary-panel.v1:')).map(key => [key, localStorage.getItem(key)])));
  if (kind === 'summary' && !hidden && Object.keys(preference).length !== 1) throw Error('summary fixture did not persist exactly its real local preference');
  const options = { type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4, language };
  const source = boot
    .replace('#host{width:780px;', '#host{width:min(780px, calc(100vw - 16px));')
    .replace("card.setConfig({type:'custom:houseplan-card', title:'House Plan', icon_size:3.4});", `card.setConfig(${JSON.stringify(options)});`)
    // #896's wire fixture clones the seed when the store is constructed.
    // Enable the requested feature in that seed, not a detached CFG snapshot
    // after construction; config/get must actually report it as enabled.
    .replace('const server=createFixtureStore(CFG,LAYOUT',
      `${[kind, ...otherKinds].includes('zigbee') ? 'CFG.settings.zigbee_topology={enabled:true,z2m_base_topics:[]};\n' : ''}const server=createFixtureStore(CFG,LAYOUT`)
    .replace('  card.hass=mkHass();\n  window.__card=card;', `  card.hass={...mkHass(),themes:{darkMode:${language === 'ru'}}};\n  window.__card=card;`);
  await page.route('**/demo.html', route => route.fulfill({ status: 200, contentType: 'text/html', body: source }));
  const path = paths[kind], seen = [];
  let failRetry = terminal, enabled = true;
  const rootName = path.split('/').at(-1);
  await page.route(`**/${rootName}*`, route => {
    const url = new URL(route.request().url()); seen.push(url.search || 'plain');
    if (terminal) return route.fulfill({ status: 200, contentType: 'text/javascript',
      body: readFileSync(`demo/srv/assets/${path}`, 'utf8').replaceAll(manifest.fingerprint, 'f'.repeat(64)) });
    if (enabled && !dependency && (!url.search || failRetry)) return route.fulfill({ status: 404, body: 'controlled root404' });
    return route.fallback();
  });
  const others = {};
  for (const name of otherKinds) {
    const requests = others[name] = [];
    await page.route(`**/${paths[name].split('/').at(-1)}*`, route => {
      const query = new URL(route.request().url()).search;
      requests.push(query || 'plain');
      return query ? route.fallback() : route.fulfill({ status: 404, body: 'controlled sibling root404' });
    });
  }
  let dependencyRequests = 0;
  if (dependency) {
    const root = manifest.files.find(file => file.path === path);
    const candidate = root.imports.find(path => /live-tip-placement/.test(path));
    if (!candidate) throw Error('native dependency404 needs the real shared tooltip dependency');
    await page.route(`**/${candidate.split('/').at(-1)}*`, route => {
      dependencyRequests++;
      return enabled ? route.fulfill({ status: 404, body: 'controlled dependency404' }) : route.fallback();
    });
  }
  await page.setViewportSize({ width, height: 900 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await installHpTestOnPage(page);
  try {
    await page.waitForFunction(kind => {
      const c = window.__card;
      return c?._loadOk && !c._booting && c._viewRuntimes?.[kind]?.state === 'error';
    }, kind);
  } catch (error) {
    console.error('runtime failure setup diagnostics', { kind, language, seen,
      actual: await page.evaluate(() => ({ loadOk: window.__card?._loadOk,
        booting: window.__card?._booting, config: window.__card?._cfgRev,
        topology: window.__card?._serverCfg?.settings?.zigbee_topology,
        states: Object.fromEntries(['live', 'summary', 'zigbee'].map(name =>
          [name, window.__card?._viewRuntimes?.[name]?.state])) })) });
    await browser.close();
    throw error;
  }
  return { page, browser, seen, others, preference, rootName, dependencies: () => dependencyRequests,
    heal: () => { enabled = false; }, fail: () => { failRetry = true; } };
}

for (const language of ['en', 'ru']) for (const kind of Object.keys(roots)) {
  const width = language === 'en' ? 1280 : 360, prefix = `${kind}-${language}-${width}`;
  const f = await start(kind, { language, width });
  try {
    const notice = f.page.locator('houseplan-card [data-hp="view-runtime-notice"]');
    await notice.waitFor(); await f.page.waitForTimeout(3700);
    out[`${prefix}:persistent-readable-single-notice`] = await notice.count() === 1 && await notice.evaluate(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      const root = element.getRootNode(), header = root.querySelector('.hdr')?.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth
        && (!header || rect.top >= header.bottom) && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
        && !/https?:|stack|\.js\b/.test(element.textContent);
    });
    out[`${prefix}:both-controls-touch-floor`] = await notice.locator('button').evaluateAll(buttons => buttons.length === 2
      && buttons.every(button => { const r = button.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }));
    out[`${prefix}:base-plan-still-visible-no-eager-editor`] = await f.page.evaluate(() => {
      const c = window.__card, stage = c.renderRoot.querySelector('.zoomwrap');
      return c._model.length > 0 && c._devices.length > 0 && !c._editorRuntime
        && stage && getComputedStyle(stage).visibility === 'visible';
    });
    if (kind === 'live' && language === 'en') {
      await f.page.evaluate(() => {
        const c = window.__card, call = c.hass.callService;
        window.__safeCalls = [];
        c.hass = { ...c.hass, callService: async (...args) => { window.__safeCalls.push(args); return call(...args); } };
      });
      await f.page.locator('houseplan-card [data-hp="device"][data-id="d_light1"]').click();
      out.unrelatedLightActionRemainsAvailable = await f.page.evaluate(() => window.__safeCalls.length === 1
        && window.__safeCalls[0][0] === 'light' && !window.__card._editorRuntime);
    }
    await f.page.evaluate(async () => {
      const c = window.__card;
      for (let n = 0; n < 4; n++) { c.hass = { ...c.hass }; await c.updateComplete; }
    });
    const marker = f.page.locator('houseplan-card [data-hp="device"]').first();
    await marker.hover(); await f.page.mouse.move(1, 1); await marker.hover();
    out[`${prefix}:ticks-and-hover-do-not-reimport`] = f.seen.length === 1;
    await f.page.screenshot({ path: `artifacts/view-runtime/${prefix}.png` });
    const retry = notice.locator('[data-hp="view-runtime-retry"]');
    if (language === 'en') { await retry.focus(); await f.page.keyboard.press('Enter'); }
    else await retry.tap();
    try {
      await f.page.waitForFunction(kind => window.__card._viewRuntimes[kind].state === 'ready', kind);
    } catch (error) {
      console.error('recovery diagnostics', kind, f.seen, await f.page.evaluate(async path => {
        const boundary = window.__card._viewRuntimes[path.kind];
        const url = `/assets/${path.file}${path.query}`;
        try { const module = await import(url); return { state: boundary.state, terminal: boundary.terminalFailure,
          exports: Object.keys(module), fingerprint: module.SUMMARY_RUNTIME_FINGERPRINT }; }
        catch (error) { return { state: boundary.state, error: String(error), url }; }
      }, { kind, file: paths[kind], query: f.seen.at(-1) }));
      throw error;
    }
    out[`${prefix}:one-real-nonce-request-and-ready`] = f.seen.length === 2 && f.seen[0] === 'plain' && /hp_retry=view-/.test(f.seen[1]);
    // #1147 retires input immediately and paints the real140ms exit before detach.
    await f.page.evaluate(() => window.__card.updateComplete);
    if (await notice.count()) out[`${prefix}:recovered-notice-is-inert-during-exit`] = await notice.evaluate(element => element.inert);
    await notice.waitFor({ state:'detached' });
    out[`${prefix}:successful-recovery-clears-notice`] = await notice.count() === 0;
    if (kind === 'summary') out[`${prefix}:saved-show-preference-preserved`] = await f.page.evaluate(previous =>
      Object.entries(previous).every(([key, value]) => localStorage.getItem(key) === value)
      && window.__card.renderRoot.querySelector('.summary-control button[aria-pressed="true"]') !== null, f.preference);
    if (kind === 'zigbee') out[`${prefix}:verified-element-installed`] = await f.page.locator('houseplan-card hp-zigbee-topology-overlay').count() === 1;
  } finally { await f.browser.close(); }
}

const hidden = await start('summary', { hidden: true });
try {
  out.hiddenSummaryIsNotReportedAsBroken = await hidden.page.locator('[data-hp="view-runtime-notice"]').count() === 0;
  out.hiddenSummaryDidNotChangePreference = await hidden.page.evaluate(previous =>
    Object.entries(previous).every(([key, value]) => localStorage.getItem(key) === value), hidden.preference);
} finally { await hidden.browser.close(); }

const dependency = await start('live', { dependency: true });
try {
  await dependency.page.locator('[data-hp="view-runtime-retry"]').click();
  await dependency.page.waitForFunction(() => window.__card._viewRuntimes.live.terminalFailure);
  out.dependency404RemainsHonestReloadOnly = await dependency.page.locator('[data-hp="view-runtime-retry"]').count() === 0
    && await dependency.page.locator('[data-hp="view-runtime-reload"]').count() === 1;
  dependency.heal();
  await dependency.page.evaluate(async () => { const c = window.__card; c.hass = { ...c.hass }; await c.updateComplete; });
  out.failedDependencyIsNotFalselyRetried = dependency.seen.length === 2 && dependency.dependencies() === 1;
  out.noInventedVersionMismatch = await dependency.page.locator('[data-version-recovery-target]').count() === 0;
} finally { await dependency.browser.close(); }

const mismatch = await start('zigbee', { terminal: true });
try {
  out.foreignBuildIsRejectedBeforeCustomElementRegistration = await mismatch.page.evaluate(() =>
    !customElements.get('hp-zigbee-topology-overlay') && !window.__card.renderRoot.querySelector('hp-zigbee-topology-overlay'));
  out.foreignBuildOffersReloadOnlyWithoutAnotherImport = mismatch.seen.length === 1
    && await mismatch.page.locator('[data-hp="view-runtime-retry"]').count() === 0;
} finally { await mismatch.browser.close(); }

const aggregate = await start('live', { otherKinds: ['zigbee'] });
try {
  await aggregate.page.waitForFunction(() => window.__card._viewRuntimes.zigbee.state === 'error');
  const notice = aggregate.page.locator('[data-hp="view-runtime-notice"]');
  out.multipleFailuresAreNamedInOneNotice = await notice.count() === 1
    && await notice.locator('.view-runtime-functions').evaluate(element => /Live/.test(element.textContent) && /Zigbee/.test(element.textContent));
  const button = notice.locator('[data-hp="view-runtime-retry"]');
  await button.dblclick();
  await aggregate.page.waitForFunction(() => ['live', 'zigbee'].every(name => window.__card._viewRuntimes[name].state === 'ready'));
  out.doubleClickRemainsOneRetryPerFailedBoundary = aggregate.seen.length === 2 && aggregate.others.zigbee.length === 2;
  await aggregate.page.evaluate(() => window.__card.updateComplete);
  if (await notice.count()) out.aggregateRetiresBeforeExit = await notice.evaluate(element => element.inert);
  await notice.waitFor({ state:'detached' });
  out.aggregateDisappearsOnlyAfterBothFunctionsRecover = await notice.count() === 0;
} finally { await aggregate.browser.close(); }

const pending = await launchPanelCold();
try {
  let release;
  const held = new Promise(resolve => { release = resolve; }), requests = { live: 0, summary: 0 };
  for (const name of Object.keys(requests)) await pending.page.route(`**/${paths[name].split('/').at(-1)}*`, async route => {
    requests[name]++; await held; return route.fallback();
  });
  await pending.page.evaluate(async () => {
    await import('/assets/houseplan-card.js');
    const make = title => {
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', title }); card.hass = window.__mkHass();
      document.getElementById('host').appendChild(card); return card;
    };
    window.__retiredCard = make('Retired pending card');
    window.__card = make('Current pending card');
    window.__makeViewCard = make;
  });
  await pending.page.waitForFunction(() => window.__retiredCard._loadOk && window.__card._loadOk);
  await pending.page.waitForFunction(() => ['live', 'summary'].every(name => window.__card._viewRuntimes[name].state === 'loading'));
  // #997 independently imports the compact header selector. Complete that
  // ordinary visible-header dependency before measuring ONLY the held View
  // imports. Their requests remain physically blocked throughout this setup.
  await pending.page.waitForFunction(() => !!customElements.get('hp-settings-select'));
  await pending.page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await window.__retiredCard.updateComplete;
  });
  await pending.page.evaluate(async () => {
    const old = window.__retiredCard; old.remove();
    // Finish the render already queued by the initial header measurement.
    // Imports remain physically held: only updates after release belong to
    // the late optional-runtime completion being measured here.
    while (old.isUpdatePending) await old.updateComplete;
    window.__retiredUpdates = 0;
    window.__retiredUpdateStacks = [];
    const update = old.requestUpdate.bind(old);
    old.requestUpdate = (...args) => { window.__retiredUpdates++; window.__retiredUpdateStacks.push(new Error().stack); return update(...args); };
  });
  release();
  await pending.page.waitForFunction(() => ['live', 'summary'].every(name => window.__card._viewRuntimes[name].state === 'ready'));
  const retired = await pending.page.evaluate(() => ({ live: !!window.__retiredCard._liveRt,
    summary: !!window.__retiredCard._summary, updates: window.__retiredUpdates, stacks: window.__retiredUpdateStacks }));
  out.pendingImportSharedWithoutConstructingForDetachedCard = requests.live === 1 && requests.summary === 1
    && !retired.live && !retired.summary && retired.updates === 0;
  if (!out.pendingImportSharedWithoutConstructingForDetachedCard) console.error('pending diagnostics', { requests, retired });
  out.warmCodeCreatesDistinctRuntimeBeforeFirstRender = await pending.page.evaluate(() => {
    const current = window.__card, warm = window.__makeViewCard('Warm independent card');
    return !!warm._summary && !!warm._liveRt && !warm.hasUpdated
      && warm._summary !== current._summary && warm._liveRt !== current._liveRt;
  });
} finally { await pending.browser.close(); }

checkAll(out); await finish(null, out);
