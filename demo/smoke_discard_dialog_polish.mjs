// #990: actual native confirmation paint/input, not source-text inspection.
import { mkdirSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });
const results = {};
const owner = page.locator('hp-dialog[data-kind="settings"]');
const question = page.locator('hp-confirm hp-dialog');
const back = question.locator('[slot="footer"] [data-hp="dialog-cancel"]');
const close = question.locator('.close');
const captureDir = process.env.HP_990_CAPTURE_DIR || 'demo/out/discard-dialog-990';
mkdirSync(captureDir, { recursive: true });

const openDirty = async () => {
  await page.evaluate(async () => {
    const card = window.__card;
    await card._ensureEditorRuntime();
    card._openSettingsDialog();
    await card.updateComplete;
  });
  await owner.locator('#gs-show-lqi').click();
};
const openQuestion = async () => {
  // Sample the same rendering turn as the public cancel click; a locator's
  // stability wait would deliberately miss a correctly moving entrance.
  return page.evaluate(async () => {
    const root = window.__card.shadowRoot;
    root.querySelector('hp-dialog[data-kind="settings"] [slot="footer"] [data-hp="dialog-cancel"]').click();
    await window.__card.updateComplete;
    const confirm = root.querySelector('hp-confirm');
    await confirm.updateComplete;
    const dialog = confirm.querySelector('hp-dialog');
    await dialog.updateComplete;
    const surface = dialog.shadowRoot.querySelector('.surface');
    const animations = surface.getAnimations();
    const entering = animations.find(animation => animation.effect?.getTiming().iterations === 1);
    if (entering) {
      await entering.ready;
      entering.pause();
      entering.currentTime = Number(entering.effect.getTiming().duration) / 2;
    }
    const paint = getComputedStyle(surface);
    const button = dialog.querySelector('[slot="footer"] [data-hp="dialog-cancel"]');
    const buttonPaint = getComputedStyle(button);
    return {
      animated: !!entering,
      movingPaint: Number(paint.opacity) > 0 && Number(paint.opacity) < 1
        && new DOMMatrix(paint.transform).m42 > 0,
      keyboardTarget: root.activeElement === button,
      noInitialRing: buttonPaint.outlineStyle === 'none' && buttonPaint.boxShadow === 'none',
      modal: dialog.shadowRoot.querySelector('dialog').matches(':modal'),
    };
  });
};
const finishEntrance = () => question.locator('.surface').evaluate(surface => {
  for (const animation of surface.getAnimations()) animation.finish();
});
const waitReturned = async () => {
  await question.waitFor({ state: 'detached' });
  await owner.locator('#gs-show-lqi').waitFor();
};

try {
  for (const [width, theme] of [[1280, 'light'], [360, 'dark']]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    // The native demo's HA theme is explicit CSS variables, not a media query.
    await page.evaluate(theme => {
      const palette = theme === 'light'
        ? ['#fff', '#eceeef', '#223039', '#64747e', '#dce2e6', '#008aa5']
        : ['#17222e', '#0f1822', '#e7eef4', '#a6b6c3', '#354755', '#67cfe8'];
      const card = window.__card;
      ['--card-background-color', '--primary-background-color', '--primary-text-color',
        '--secondary-text-color', '--divider-color', '--primary-color']
        .forEach((key, index) => card.style.setProperty(key, palette[index]));
      card.style.setProperty('--secondary-background-color', palette[1]);
    }, theme);
    await page.mouse.move(2, 2);
    await openDirty();
    const saved = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
    const draft = await owner.locator('#gs-show-lqi').isChecked();
    await page.keyboard.press('Tab');
    const first = await openQuestion();
    for (const [key, value] of Object.entries(first)) results[`${width}_${theme}_${key}`] = value;
    await page.screenshot({ path: `${captureDir}/${width}-${theme}-entrance.png` });
    await finishEntrance();
    results[`${width}_actualThemeSurface`] = await question.locator('.surface').evaluate((surface, theme) =>
      getComputedStyle(surface).backgroundColor === (theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(23, 34, 46)'), theme);
    await page.screenshot({ path: `${captureDir}/${width}-${theme}-settled.png` });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    results[`${width}_tabRestoresVisibleFocus`] = await back.evaluate(button => {
      const paint = getComputedStyle(button);
      return button.matches(':focus-visible') && !button.classList.contains('hp-dialog-return-focus')
        && (paint.outlineStyle !== 'none' || paint.boxShadow !== 'none');
    });
    await page.mouse.move(2, 2);
    await close.hover();
    results[`${width}_standardCloseMotion`] = await close.locator('ha-icon').evaluate(async icon => {
      await Promise.all(icon.getAnimations().map(animation => animation.finished));
      const paint = getComputedStyle(icon), matrix = new DOMMatrix(paint.transform);
      return paint.transitionDuration === '0.16s' && paint.transitionTimingFunction === 'ease'
        && Math.abs(matrix.a) < .01 && Math.abs(matrix.b - 1.12) < .01;
    });
    await close.click();
    await waitReturned();
    results[`${width}_closeKeepsDraft`] = await owner.locator('#gs-show-lqi').isChecked() === draft;
    await openQuestion();
    await finishEntrance();
    await page.keyboard.press('Escape');
    await waitReturned();
    results[`${width}_escapeKeepsDraft`] = await owner.locator('#gs-show-lqi').isChecked() === draft;
    await openQuestion();
    await finishEntrance();
    await back.click();
    await waitReturned();
    results[`${width}_backKeepsDraft`] = await owner.locator('#gs-show-lqi').isChecked() === draft;
    await openQuestion();
    await finishEntrance();
    await question.locator('[data-hp="dialog-confirm"]').click();
    await question.waitFor({ state: 'detached' });
    await owner.waitFor({ state: 'detached' });
    results[`${width}_discardDoesNotSave`] = saved === await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDirty();
  const reduced = await openQuestion();
  results.reducedNoEntrance = !reduced.animated && !reduced.movingPaint;
  await close.hover();
  results.reducedCloseIsStill = await close.locator('ha-icon').evaluate(icon => {
    const paint = getComputedStyle(icon);
    return paint.transitionDuration === '0s' && paint.transform === 'none';
  });
  await back.click();
  await waitReturned();
  // Risky neighbour: ordinary warning/destructive dialogs retain their own
  // safe autofocus and do not acquire the unsaved-draft entrance animation.
  await openQuestion();
  await finishEntrance();
  await question.locator('[data-hp="dialog-confirm"]').click();
  await question.waitFor({ state: 'detached' });
  await owner.waitFor({ state: 'detached' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    void window.__card._confirmDanger({ key: '990-unrelated-warning', kind: 'warning',
      title: 'Warning', message: 'Unchanged warning', confirmLabel: 'Proceed', cancelLabel: 'Cancel' });
  });
  await back.waitFor();
  results.unrelatedKeepsSafeFocus = await back.evaluate(button => button.getRootNode().activeElement === button);
  results.unrelatedHasNoNewEntrance = await question.locator('.surface').evaluate(surface => surface.getAnimations().length === 0);
  await back.click();
  await question.waitFor({ state: 'detached' });
  console.log(JSON.stringify(results, null, 2));
  checkAll(results);
} finally {
  await finish(browser, results);
}
