import { launch, check, finish } from './serve.mjs';
import { installStaticStability, resetGoldenStability } from './golden/static-stability.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';
const { page, browser } = await launch({ width: 1000, height: 820 });
try {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const read = () => page.evaluate(() => {
    const node = window.__card.shadowRoot.querySelector('[data-hp="device"]');
    return { transition: getComputedStyle(node).transitionDuration,
      animation: getComputedStyle(node).animationName, styles: document.querySelectorAll('[data-hp-capture-stability]').length };
  });
  const ordinary = await read();
  check('#896 ordinary card has a real transition', ordinary.transition.split(',').some(value => parseFloat(value) > 0));
  await page.evaluate(() => {
    const head = document.createElement('style'); head.id = 'hp-golden-stability';
    head.textContent = '*{animation:none!important;transition:none!important}'; document.head.append(head);
  });
  check('#896 head-only negative control does not reach card shadow', (await read()).transition, ordinary.transition);
  await page.evaluate(installStaticStability);
  check('#896 static capture suppresses real card shadow transition', (await read()).transition, '0s');
  const lazy = await page.evaluate(async () => {
    const el = document.createElement('div'); document.body.append(el);
    const shadow = el.attachShadow({ mode: 'open' });
    // An upgrading custom element may replace its first contents after attach.
    shadow.innerHTML = '<style>span{transition:opacity .23s;animation:fixture 2s infinite}@keyframes fixture{to{opacity:.5}}</style><span>lazy capture root</span>';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.__stabilityLazy = el;
    return { transition: getComputedStyle(shadow.querySelector('span')).transitionDuration,
      animation: getComputedStyle(shadow.querySelector('span')).animationName };
  });
  check('#896 lazy open root transition suppressed after content replacement', lazy.transition, '0s');
  check('#896 lazy open root animation suppressed', lazy.animation, 'none');
  const marker = page.locator('houseplan-card').locator('[data-hp="device"][data-id="d_light1"]');
  await marker.hover(); await page.evaluate(() => window.__hpTest.settled());
  const first = await marker.screenshot(); await page.waitForTimeout(120);
  check('#896 ordinary hovered static marker captures identical pixels', first.equals(await marker.screenshot()));
  await resetGoldenStability(page);
  check('#896 reset restores exact ordinary card transition', (await read()).transition, ordinary.transition);
  const restored = await page.evaluate(() => ({
    transition: getComputedStyle(window.__stabilityLazy.shadowRoot.querySelector('span')).transitionDuration,
    animation: getComputedStyle(window.__stabilityLazy.shadowRoot.querySelector('span')).animationName,
    styles: [...document.querySelectorAll('*')].flatMap(el => [...(el.shadowRoot?.querySelectorAll('[data-hp-capture-stability]') || [])]).length,
    active: !!window.__hpGoldenStability,
  }));
  check('#896 reset restores lazy transition', restored.transition, '0.23s');
  check('#896 reset restores lazy animation', restored.animation, 'fixture');
  check('#896 reset removes overrides and observer lifetime', [restored.styles, restored.active], [0, false]);
  const media = () => page.evaluate(() => ({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    forced: matchMedia('(forced-colors: active)').matches,
  }));
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light', forcedColors: 'none' });
  const beforeCapture = await media();
  const scenario = GOLDEN_SCENARIOS.find(scene => scene.mode === 'view' && scene.theme === 'dark'
    && !scene.hoverDevice && !scene.kiosk && !scene.projection && !scene.pdfExport && !scene.moonClock);
  if (!scenario) throw new Error('ordinary golden lifecycle fixture missing');
  // Exercise the actual preparation entry, not just the stylesheet installer.
  await prepareGoldenScenario(page, scenario);
  const prepared = await media();
  check('#896 actual prepare really enables reduced capture motion', prepared.reduced);
  check('#896 no-reset negative observation differs from ordinary media', JSON.stringify(prepared) === JSON.stringify(beforeCapture), false);
  await resetGoldenStability(page);
  check('#896 actual prepare/reset restores all prior observed media modes', await media(), beforeCapture);
  // A failing screenshot/semantic phase follows the same finally path.
  let failedPhaseObserved = false;
  try {
    await prepareGoldenScenario(page, scenario);
    throw new Error('controlled capture phase failure');
  } catch (error) { failedPhaseObserved = error.message === 'controlled capture phase failure'; }
  finally { await resetGoldenStability(page); }
  check('#896 controlled failed capture phase was reached', failedPhaseObserved);
  check('#896 failed capture finally also restores media', await media(), beforeCapture);
} finally { await resetGoldenStability(page); await finish(browser); }
