import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1280, height: 800 });
const results = {};
try {
  // #1483: the viewport can change the promotion hint on the same SVG
  // while the mode owner is sampling its opacity. Hold the first RAF so
  // that the intervening Lit commit sees the outgoing inline opacity.
  const card = page.locator('houseplan-card');
  await page.evaluate(() => window.__card.style.setProperty('--ha-card-background', '#445e73'));
  for (const mode of ['plan', 'view']) {
    await page.evaluate(() => {
      const controller = window.__card._modeTransition;
      const clock = controller._clock;
      const hold = window.__hpFirstModeFrame = { clock, callback: null };
      controller._clock = {
        ...clock,
        requestFrame(callback) { hold.callback = callback; return -1483; },
        cancelFrame(id) {
          if (id === -1483) hold.callback = null;
          else clock.cancelFrame(id);
        },
      };
    });
    await card.locator(mode === 'plan'
      ? '[data-hp="mode-tab"][data-mode="plan"]'
      : '.editor-close-slot [data-hp="editor-close"]').click();
    await page.waitForFunction(() => !!window.__hpFirstModeFrame.callback);
    results['viewportHintChangedDuring-' + mode] = await page.evaluate(async () => {
      const card = window.__card;
      const surfaces = [...card.renderRoot.querySelectorAll('svg.hp-mode-scene-svg')]
        .filter(svg => svg.style.willChange === 'opacity');
      for (const svg of surfaces) svg.style.removeProperty('will-change');
      card.requestUpdate();
      await card.updateComplete;
      const hold = window.__hpFirstModeFrame;
      card._modeTransition._clock = hold.clock;
      hold.clock.requestFrame(hold.callback);
      return surfaces.some(svg => svg.dataset.hpModeLayer === 'room-ink')
        && surfaces.some(svg => svg.dataset.hpModeLayer === 'plan-ink');
    });
    await page.waitForFunction(mode => window.__card._mode === mode && !window.__card._modeTransitionBusy, mode);
    await page.evaluate(() => window.__hpTest.settled());
    results['modePaintAfterViewportHint-' + mode] = await page.evaluate(mode => {
      const c = window.__card, root = c.renderRoot;
      const opacityMatches = (ids, opacity) => ids.every(id => {
        const layer = root.querySelector('[data-hp-mode-layer="' + id + '"]');
        return layer && getComputedStyle(layer).opacity === opacity && !layer.style.opacity;
      });
      return c._mode === mode && !c._stageEl.inert
        && opacityMatches(['paper', 'rooms', 'zero-view'], mode === 'view' ? '1' : '0')
        && opacityMatches(['paper-ink', 'room-ink', 'zero-editor', 'plan-base', 'plan-ink'], mode === 'plan' ? '1' : '0');
    }, mode);
  }
  checkAll(results);
} finally {
  await finish(browser, results);
}
