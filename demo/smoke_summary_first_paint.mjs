// #509: первый показ сводной панели на большом плане.
//
// Что здесь доказывается и почему смоком, а не юнитом. Обе половины дефекта
// видны только в живом кадре: «Source unavailable» вместо значений рисовался
// в первом же рендере панели, а подвисание возникало оттого, что агрегаты
// считались синхронно внутри render — юнит на чистой функции ни того, ни
// другого не замечает. План берётся тот же, на котором мерили в S2
// (demo/fixtures/large-house.mjs: 3 пространства, 60 комнат): на демо-доме
// расчёт дёшев и дефект не воспроизводится.
import { launch, check, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const fixture = makeLargeHouseFixture();
const BLOCK = {
  id: 'first-paint', title: 'General', visible: true, scope: { type: 'all' },
  values: [
    { id: 'devices', label: 'Devices', source: { type: 'system', key: 'device_count' } },
    { id: 'area', label: 'Floor area', source: { type: 'system', key: 'total_area' } },
    { id: 'clock', label: 'Date and time', source: { type: 'system', key: 'datetime' } },
  ],
};

/** Панель на большом плане: возвращает страницу и хелперы. */
async function openLargePlan(page, { reducedMotion = false } = {}) {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !!window.__card?._summary);
  return page.evaluate(async ({ config, block }) => {
    const card = window.__card;
    const root = () => card.shadowRoot || card.renderRoot;
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const settle = async () => { await card.updateComplete; await frame(); await card.updateComplete; };
    card._config = { ...card._config, language: 'en', kiosk: false };
    card._serverCanWrite = true;
    card._haSummaryPanelApi = 1;
    card.narrow = false;
    const next = structuredClone(config);
    next.settings = {
      ...next.settings,
      summary_panel: { version: 1, title: 'Summary', show_on_mobile: true, blocks: [block] },
    };
    card._serverCfg = next;
    card._settings = next.settings;
    card._cfgEpoch = (card._cfgEpoch || 0) + 1;
    card._sendConfigCandidate = async () => {};
    card._summary.updated();
    card.requestUpdate();
    await settle();
    window.__firstPaint = {
      card, root, frame, settle,
      overlay: () => root().querySelector('.summary-overlay'),
      rows: () => [...(root().querySelector('.summary-overlay')?.querySelectorAll('.summary-value') || [])],
      texts: () => [...(root().querySelector('.summary-overlay')?.querySelectorAll('.summary-value strong') || [])]
        .map((node) => node.textContent.trim()),
      pending: () => (root().querySelector('.summary-overlay')?.querySelectorAll('.summary-value-pending') || []).length,
    };
    return { ready: !!card._summary, spaces: card._serverCfg.spaces.length };
  }, { config: fixture.config, block: BLOCK });
}

// --- (а) первый показ: скелеты вместо текста ошибки, кадр не заблокирован ---
{
  const { page, browser } = await launch({ width: 1280, height: 900 });
  const opened = await openLargePlan(page);
  check('largePlanReady', opened.ready && opened.spaces === 3);

  const first = await page.evaluate(async () => {
    const f = window.__firstPaint;
    const toggle = f.root().querySelector('.summary-control')?.querySelector('button:last-child');
    const started = performance.now();
    toggle?.click();
    // Ровно один кадр: именно его и видел человек как «зависание».
    await f.card.updateComplete;
    await f.frame();
    const blockedMs = performance.now() - started;
    return {
      blockedMs, rows: f.rows().length, pending: f.pending(), texts: f.texts(),
      hasOverlay: !!f.overlay(),
    };
  });
  check('overlayShownOnFirstFrame', first.hasOverlay && first.rows === 3);
  // AC1: до готовности — скелеты; ни одна строка не врёт про недоступный источник.
  check('skeletonsInsteadOfError', first.pending >= 2);
  check('noUnavailableOnFirstFrame', !first.texts.some((text) => /unavailable/i.test(text)));
  // AC4: первый кадр не съеден расчётом. Порог с большим запасом от измеренного
  // (S2: до правки один только расчёт площади занимал секунды на этом плане).
  check('firstFrameNotBlocked', first.blockedMs < 400);

  // AC8: скелет живёт ограниченное время — значения приходят следом.
  const settled = await page.evaluate(async () => {
    const f = window.__firstPaint;
    const started = performance.now();
    const deadline = started + 4000;
    while (performance.now() < deadline && f.pending() > 0) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      await f.card.updateComplete;
    }
    return { waitedMs: performance.now() - started, pending: f.pending(), texts: f.texts() };
  });
  check('skeletonReplacedByValues', settled.pending === 0);
  check('valuesAreReal', settled.texts.every((text) => text && !/unavailable/i.test(text)));
  check('replacedWithinBudget', settled.waitedMs < 3000);

  // AC5: появление панели анимируется — кадры анимации реально существуют.
  const motion = await page.evaluate(async () => {
    const f = window.__firstPaint;
    const toggle = f.root().querySelector('.summary-control')?.querySelector('button:last-child');
    toggle?.click(); // скрыть
    await f.card.updateComplete;
    const exiting = (f.overlay()?.getAnimations?.() || []).map((a) => a.effect?.getTiming?.().duration);
    await new Promise((resolve) => setTimeout(resolve, 320));
    toggle?.click(); // показать снова
    await f.card.updateComplete;
    const entering = (f.overlay()?.getAnimations?.() || []).map((a) => a.effect?.getTiming?.().duration);
    return { exiting, entering };
  });
  check('exitAnimated', motion.exiting.includes(190));
  check('enterAnimated', motion.entering.includes(190));
  await browser.close();
}

// --- (б) reduced motion: прямоугольник есть, моторики нет ---
{
  const { page, browser } = await launch({ width: 1280, height: 900 });
  await openLargePlan(page, { reducedMotion: true });
  const calm = await page.evaluate(async () => {
    const f = window.__firstPaint;
    const toggle = f.root().querySelector('.summary-control')?.querySelector('button:last-child');
    toggle?.click();
    await f.card.updateComplete;
    await f.frame();
    const skeleton = f.overlay()?.querySelector('.summary-value-pending i');
    const style = skeleton ? getComputedStyle(skeleton) : null;
    const overlayAnimations = (f.overlay()?.getAnimations?.() || []).length;
    return {
      hasSkeleton: !!skeleton,
      animationName: style?.animationName || '',
      opacity: Number(style?.opacity || '0'),
      overlayAnimations,
    };
  });
  // AC6: прямоугольник остаётся видимым, пульсация выключена.
  check('skeletonStillDrawn', calm.hasSkeleton && calm.opacity > 0.05);
  check('skeletonDoesNotPulse', calm.animationName === 'none');
  // AC5 (вторая половина): при reduced motion панель не анимируется вовсе.
  check('panelNotAnimatedWhenReduced', calm.overlayAnimations === 0);
  await browser.close();
}

finish();
