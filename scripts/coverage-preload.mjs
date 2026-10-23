// #1018: enabled only by the diagnostic runner; no normal/product runtime import.
import { Session } from 'node:inspector';
import { takeCoverage } from 'node:v8';
import { threadId } from 'node:worker_threads';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { digestBytes, slash, COVERAGE_SCHEMA } from './coverage-identity.mjs';
import { attestLaunchedBrowser } from './browser-attestation.mjs';

if (process.env.HP_DIAGNOSTIC_COVERAGE === '1' && process.env.HP_COVERAGE_DIR) {
  const dir = resolve(process.env.HP_COVERAGE_DIR), root = process.cwd();
  const suffix = `${process.pid}-${threadId}`, sources = {}, pages = new Map(), contexts = new WeakSet(), browsers = new WeakSet();
  const meta = { schema: COVERAGE_SCHEMA, authority: 'diagnostic-only', case: process.env.HP_COVERAGE_CASE,
    pid: process.pid, threadId, started: Date.now(), pages: [], browsers: [], issues: [] };
  const MAX_BYTES = 64 * 1024 * 1024, MAX_PAGES = 64;
  let bytes = 0, pendingSources = 0;
  mkdirSync(dir, { recursive: true });
  const write = (name, value) => {
    const data = JSON.stringify(value);
    if (Buffer.byteLength(data) > MAX_BYTES || bytes + Buffer.byteLength(data) > MAX_BYTES) {
      meta.issues.push({ reason: 'recorder-capacity', name }); return false;
    }
    writeFileSync(resolve(dir, name), data); bytes += Buffer.byteLength(data); return true;
  };
  // Replacing metadata must not count every heartbeat against the raw-byte cap.
  const metadata = () => writeFileSync(resolve(dir, `recorder-${suffix}.json`), JSON.stringify(meta));
  const issue = (reason, detail = '') => { meta.issues.push({ reason, detail: String(detail).slice(0, 500) }); metadata(); };
  const session = new Session(); session.connect();
  session.on('Debugger.scriptParsed', ({ params }) => {
    let path;
    try { path = params.url.startsWith('file:') ? slash(relative(root, fileURLToPath(params.url))) : ''; } catch { return; }
    if (!/^test-build\/.+\.js$/.test(path)) return;
    pendingSources++;
    session.post('Debugger.getScriptSource', { scriptId: params.scriptId }, (error, result) => {
      pendingSources--;
      if (error || typeof result?.scriptSource !== 'string') { issue('node-source-unreadable', params.url); return; }
      if (Object.keys(sources).length >= 4096 || result.scriptSource.length > MAX_BYTES) { issue('node-source-capacity', params.url); return; }
      sources[params.scriptId] = { url: params.url, path, source: result.scriptSource, hash: digestBytes(result.scriptSource) };
    });
  });
  await new Promise(resolveReady => session.post('Debugger.enable', error => {
    if (error) issue('node-debugger-unavailable', error.message); resolveReady();
  }));
  const saveNode = () => {
    // One current snapshot per isolate; native V8 samples retain their separate intervals.
    const name = resolve(dir, `node-sources-${suffix}.json`);
    const data = JSON.stringify({ schema: COVERAGE_SCHEMA, pid: process.pid, threadId, pendingSources, sources });
    if (Buffer.byteLength(data) <= MAX_BYTES) writeFileSync(name, data); else issue('node-source-capacity');
    takeCoverage(); metadata();
  };
  const heartbeat = setInterval(saveNode, 5000); heartbeat.unref();

  const flushPage = async (page, final = true) => {
    const state = pages.get(page);
    if (!state || state.done) return state?.stop;
    state.done = final;
    state.stop = (async () => {
      try {
        await state.start;
        const entries = await page.coverage.stopJSCoverage();
        const name = `browser-${suffix}-${state.info.id}-${++state.segment}.json`;
        state.info.saved = write(name, { schema: COVERAGE_SCHEMA, case: meta.case,
          pid: process.pid, threadId, page: state.info, entries });
        state.info.raw.push(name);
      } catch (error) { state.info.error = String(error).slice(0, 500); issue('browser-stop-failed', state.info.error); }
      finally { metadata(); }
    })();
    return state.stop;
  };
  const installPage = async (page, early) => {
    if (pages.has(page)) {
      if (early) pages.get(page).info.early = true;
      await pages.get(page).start; return page;
    }
    if (pages.size >= MAX_PAGES) { issue('page-capacity'); return page; }
    const info = { id: pages.size + 1, early, urls: [], raw: [], started: Date.now(), saved: false };
    const state = { info, done: false, start: null, stop: null, segment: 0, navigating: false };
    pages.set(page, state); meta.pages.push(info);
    const start = () => page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: true })
      .catch(error => { issue('browser-start-failed', error); throw error; });
    state.start = start();
    // V8 forgets a destroyed context's counters even with resetOnNavigation:
    // false. Checkpoint BEFORE explicit navigation; unexpected script/link
    // navigation is recorded as incomplete rather than silently losing it.
    for (const method of ['goto', 'reload', 'goBack', 'goForward']) {
      const original = page[method].bind(page);
      page[method] = async (...args) => {
        await flushPage(page, false); state.stop = null; state.start = start(); await state.start;
        state.navigating = true;
        try { return await original(...args); } finally { state.navigating = false; }
      };
    }
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) {
      if (!state.navigating && info.urls.length) issue('uncheckpointed-navigation', frame.url());
      info.urls.push(frame.url()); metadata();
    } });
    page.on('crash', () => issue('page-crashed', info.id));
    page.on('close', () => { if (!state.done) issue('page-closed-before-stop', info.id); });
    const close = page.close.bind(page);
    page.close = async (...args) => { try { await flushPage(page); } finally { return close(...args); } };
    await state.start; metadata(); return page;
  };
  const installContext = context => {
    if (contexts.has(context)) return context;
    contexts.add(context);
    context.on('page', page => { void installPage(page, false).catch(error => issue('page-registration-failed', error)); });
    for (const page of context.pages()) void installPage(page, false).catch(error => issue('existing-page-registration-failed', error));
    const create = context.newPage.bind(context), close = context.close.bind(context);
    context.newPage = async (...args) => installPage(await create(...args), true);
    context.close = async (...args) => {
      try { await Promise.all(context.pages().map(p => flushPage(p))); }
      finally { return close(...args); }
    };
    return context;
  };
  const installBrowser = async browser => {
    if (browsers.has(browser)) return browser;
    browsers.add(browser);
    const observed = { version: browser.version(), owner: new Error().stack?.split('\n').slice(2, 6) };
    try { observed.attestation = await attestLaunchedBrowser(browser, { reason: '#1018 diagnostic', log: () => {}, logError: () => {} }); }
    catch (error) { observed.attestation = error.verdict || { ok: false }; issue('foreign-or-unproven-browser', error); }
    meta.browsers.push(observed);
    for (const context of browser.contexts()) installContext(context);
    const context = browser.newContext.bind(browser), page = browser.newPage.bind(browser), close = browser.close.bind(browser);
    browser.newContext = async (...args) => installContext(await context(...args));
    browser.newPage = async (...args) => {
      const result = await page(...args); installContext(result.context()); return installPage(result, true);
    };
    browser.close = async (...args) => {
      try { await Promise.all([...pages.keys()].filter(p => p.context().browser() === browser).map(p => flushPage(p))); }
      finally { return close(...args); }
    };
    metadata(); return browser;
  };
  for (const method of ['launch', 'connect', 'connectOverCDP']) {
    const original = chromium[method].bind(chromium);
    chromium[method] = async (...args) => installBrowser(await original(...args));
  }
  const persistent = chromium.launchPersistentContext.bind(chromium);
  chromium.launchPersistentContext = async (...args) => {
    const result = await persistent(...args); installContext(result);
    if (result.browser()) await installBrowser(result.browser()); return result;
  };
  metadata();
  process.on('exit', code => {
    clearInterval(heartbeat); meta.ended = Date.now(); meta.exitCode = code;
    for (const { info, done } of pages.values()) {
      if (!done || !info.saved) meta.issues.push({ reason: 'unfinished-page', page: info.id });
      if (!info.early) meta.issues.push({ reason: 'page-start-not-proved-early', page: info.id });
    }
    if (pendingSources) meta.issues.push({ reason: 'unfinished-node-sources', count: pendingSources });
    saveNode(); metadata(); session.disconnect();
  });
}

