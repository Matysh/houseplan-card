// Shared launcher for demo captures: starts headless Chromium serving demo/srv/
// via request interception (no HTTP server needed). Usage: const {page,browser}=await launch();
import { chromium } from 'playwright';
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';
import { ensureHarnessEditorRuntime } from './editor-runtime-compat.mjs';
import { installHarnessIsoRuntimeHelper } from './iso-runtime-compat.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const ROOT = dirname(fileURLToPath(import.meta.url)) + '/srv';
// Корень репозитория, а не каталог раздачи: фингерпринт считается по
// src/** и demo/fixtures, которых внутри demo/srv нет (#236).
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CT = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
// ---- assertion harness (audit T1) --------------------------------------
// Until 2026-07-27 the smokes printed booleans and always exited 0: a broken
// build reported success. `check()` accumulates named failures, `finish()`
// prints them and sets the exit code.
const _failures = [];
let _pageErrors = 0;
/**
 * Открытые страницы — для round-trip'а перед чтением счётчика (#404).
 *
 * Ссылок на страницы у `finish(browser, out)` нет, а менять её сигнатуру
 * нельзя: так её зовут 205 смоков. Поэтому страницы регистрируются там, где
 * создаются.
 */
const _livePages = new Set();

/**
 * События `pageerror` Playwright доставляет асинхронно по CDP, а гард читал
 * счётчик синхронно (#404). Если исключение возникло после последнего обращения
 * смока к странице, счётчик к моменту проверки ещё нулевой, а `browser.close()`
 * уносит недоставленное событие. В логе это видно дословно: `EXC` печатается
 * ПОСЛЕ результата и ДО `OK`.
 *
 * Круговой запрос к странице вытесняет ранее поставленные макрозадачи, поэтому
 * всё, что страница успела произвести до этого момента, к нам уже дошло.
 *
 * Честная граница: исключение, возникшее ПОСЛЕ этого round-trip'а — например, в
 * обработчике `beforeunload` при закрытии браузера, — не учитывается. Ловить его
 * значит ждать неизвестно чего неизвестно сколько; контракт формулируется как
 * «всё, что произошло до вызова вердикта».
 */
async function roundTripLivePages() {
  for (const page of _livePages) {
    try { await page.evaluate(() => 0); } catch { /* закрыта, упала или в навигации */ }
  }
}

/**
 * Подписать страницу, созданную ВНЕ `launch()` (#404, Medium-1 ревью ТЗ).
 *
 * Таких мест два — `smoke_zoom_flash` открывает вторую страницу на своём
 * контексте, `smoke_svg_sandbox` создаёт три. Их исключения не считал никто:
 * первая печатала своё `EXC2` мимо счётчика, остальные три не имели слушателя
 * вовсе. Регистрация в `launchInternal` их не покрывает по построению, поэтому
 * гард отдаёт наружу ровно одну функцию — и её вызов виден в диффе смока.
 */
export function watchPage(page) {
  page.on('pageerror', (e) => { _pageErrors++; console.log('EXC', e.stack || e.message); });
  _livePages.add(page);
  page.on('close', () => _livePages.delete(page));
  return page;
}

/** Assert one named fact. `expected` defaults to true. */
export function check(name, actual, expected = true) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) _failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return ok;
}

/** Assert a whole result object: every key must equal true unless listed. */
export function checkAll(out, expected = {}) {
  for (const [k, v] of Object.entries(out)) check(k, v, k in expected ? expected[k] : true);
  return out;
}

/**
 * Тот же вердикт по исключениям в карточке, что у `finish()`, для смоков со
 * своей логикой выхода (#407).
 *
 * Счётчик `_pageErrors` живёт здесь, а читал его только `finish()`. Шесть
 * смоков `finish()` не вызывали вовсе — у каждого была своя ручная развязка
 * (`if (!ok) process.exit(1)`) либо `throw` из try/finally, и ни одна не
 * спрашивала про исключения. То есть необработанное исключение внутри карточки
 * во время этих шести проходило незамеченным всегда: в лог печаталось `EXC`, а
 * прогон оставался зелёным.
 *
 * Функция ничего не бросает намеренно. Смок с ручной развязкой продолжает
 * решать сам, что печатать и когда выходить; здесь только выставляется код
 * возврата, который дальше уже не отнять — `process.exitCode` переживёт любой
 * последующий `console.log`.
 *
 * @returns true, если карточка бросала — чтобы вызывающий мог добавить своё
 *          сообщение, не считая исключения заново.
 */
export async function reportPageErrors() {
  await roundTripLivePages();
  if (!_pageErrors) return false;
  console.error(`FAILED: ${_pageErrors} uncaught exception(s) inside the card`);
  process.exitCode = 1;
  return true;
}

/** Print the result, report failures, close the browser, set the exit code. */
export async function finish(browser, out) {
  if (out !== undefined) console.log(JSON.stringify(out, null, 1));
  // Порядок обязателен: сначала дать странице доставить события, потом читать
  // счётчик (#404). Обратный порядок и был дефектом.
  await roundTripLivePages();
  if (_pageErrors) _failures.push(`${_pageErrors} uncaught exception(s) inside the card`);
  await browser?.close?.();
  if (_failures.length) {
    console.error('\nFAILED (' + _failures.length + '):');
    for (const f of _failures) console.error('  - ' + f);
    process.exitCode = 1;
  } else {
    console.log('OK');
  }
}

async function launchInternal(
  preloadEditorRuntime,
  viewport = { width: 820, height: 760 },
  scale = 1,
  browserArgs = [],
  contextOptions = {},
  serveRoot = ROOT,
  repoRoot = REPO_ROOT,
) {
  const browser = await chromium.launch({ args: ['--no-sandbox', ...browserArgs] });
  const page = await (await browser.newContext({
    viewport, deviceScaleFactor: scale, ...contextOptions,
  })).newPage();
  // audit T1: an exception inside the card used to be logged and ignored.
  // Подписка и регистрация — одной функцией: разъехавшись, они дали бы
  // страницу, чьи исключения считаются, но доставки которых никто не ждёт (#404).
  watchPage(page);
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url());
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/demo.html';
    const f = serveRoot + p;
    existsSync(f)
      ? r.fulfill({ status: 200, headers: { 'content-type': CT[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }, body: readFileSync(f) })
      : r.fulfill({ status: 404, body: 'nf' });
  });
  await page.goto('http://demo.local/demo.html', { waitUntil: 'domcontentloaded' });
  await installHarnessIsoRuntimeHelper(page);
  await page.waitForFunction(() => window.__card?._model?.length > 0, { timeout: 9000 });
  // Свежесть бандла проверяется здесь, а не в каждом смоке (#236). Смок читает
  // demo/srv/assets/houseplan-card.js; если туда не скопирован свежий dist,
  // проверяется прежняя версия карточки — и результат выглядит осмысленным,
  // потому что часть проверок краснеет, а часть зеленеет. На #234 это стоило
  // круга разбора: три проверки упали, четвёртая ложно прошла, поскольку старый
  // код одинаково врал в двух местах, которые сверялись друг с другом.
  // golden и бенчмарки эту защиту имели с самого начала, смоки — нет.
  await assertFreshDemoBundleUnlessAllowed(page, repoRoot);
  // HP-1552: the first-open boot veil hides the plan (visibility:hidden) until
  // the stage height settles — real pointer interaction cannot hit a hidden
  // plan, so every smoke starts where the user does: with the plan revealed.
  await page.waitForFunction(() => window.__card._booting === false, { timeout: 9000 });
  // hass flows continuously in production; the stub sets it once — nudge a rebuild
  await page.evaluate(() => { const c = window.__card; c.hass = { ...c.hass }; });
  await page.waitForFunction(() => window.__card._devices.length > 0, { timeout: 9000 });
  // Existing product smokes exercise editor internals directly. They preload
  // the new #337 runtime without changing mode; the dedicated network smoke
  // uses launchColdView() and proves the real cold-View boundary separately.
  // Comparative performance runs also launch the previous stable through this
  // file. A pre-#337 monolithic card has no preload method and is already
  // ready; a current card still has to return truthy (#380).
  if (preloadEditorRuntime) {
    const ready = await page.evaluate(ensureHarnessEditorRuntime);
    if (!ready) throw new Error('editor runtime did not preload for browser smoke');
  }
  return { page, browser };
}

export const launch = (...args) => launchInternal(true, ...args);
export const launchColdView = (...args) => launchInternal(false, ...args);
