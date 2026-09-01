/** Regression smoke for #59: a modal must terminate the held view gesture. */
import { launch, reportPageErrors } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
try {
  const result = await page.evaluate(async () => {
    const card = window.__card;
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const until = async (predicate, timeout = 5000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error('long-press smoke timed out');
        await wait(20);
      }
    };
    card._setMode('view');
    await card.updateComplete;
    const device = card.renderRoot.querySelector('.stage .dev');
    const stage = card.renderRoot.querySelector('.stage');
    if (!device || !stage) throw new Error('fixture has no view marker/stage');

    device.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 5901, pointerType: 'mouse',
      clientX: 240, clientY: 260, button: 0, buttons: 1,
    }));
    if (!card._panStart || !card._pointers.has(5901))
      throw new Error('precondition failed: stage gesture did not start');
    await until(() => !!card._infoCard, 1500);
    await card.updateComplete;
    const clearedOnOpen = !card._panStart && !card._pinchStart
      && card._pointers.size === 0 && !card._swipeStart;

    const dialog = card.renderRoot.querySelector('hp-dialog');
    dialog?.dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
    await card.updateComplete;
    const before = JSON.stringify(card._view);
    stage.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, composed: true, pointerId: 5901, pointerType: 'mouse',
      clientX: 520, clientY: 470, buttons: 0,
    }));
    await card.updateComplete;
    const idleAfterClose = !card._infoCard && !card._panStart
      && card._pointers.size === 0 && JSON.stringify(card._view) === before;

    // One clean click on the stage must not consume a stale marker press or
    // reopen the device card. Device-specific short-click actions (toggle,
    // more-info, cover, run) are covered by their dedicated smokes.
    stage.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 5902, pointerType: 'mouse',
      clientX: 740, clientY: 680, button: 0, buttons: 1,
    }));
    stage.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, composed: true, pointerId: 5902, pointerType: 'mouse',
      clientX: 740, clientY: 680, button: 0, buttons: 0,
    }));
    stage.dispatchEvent(new MouseEvent('click', {
      bubbles: true, composed: true, clientX: 740, clientY: 680, button: 0,
    }));
    await card.updateComplete;
    const normalNextClick = !card._infoCard && !card._holdFired
      && !card._panStart && card._pointers.size === 0;
    return { clearedOnOpen, idleAfterClose, normalNextClick };
  });
  if (!Object.values(result).every(Boolean))
    throw new Error(`long-press gesture regression: ${JSON.stringify(result)}`);
  // #407: проверки выше бросают на своей регрессии, но про исключения внутри
  // карточки не спрашивает ни одна. Бросаем и здесь — тогда `finally` закроет
  // браузер, а строка успеха не напечатается после «FAILED».
  if (reportPageErrors()) throw new Error('uncaught exception inside the card — see EXC above');
  console.log(JSON.stringify({ ok: true, ...result }));
} finally {
  await browser.close();
}
