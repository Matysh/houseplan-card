import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch(
  { width: 390, height: 760 }, 1, [], { hasTouch: true, isMobile: true },
);

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (card._modeTransitionBusy && performance.now() - started < 1500);
    await card.updateComplete;
  };

  [...root().querySelectorAll('.modetab')][2]?.click();
  await settleMode();
  card._decorTool = 'line';
  card.requestUpdate();
  await card.updateComplete;

  const picker = root().querySelector('.editor-secondary hp-color-opacity');
  const trigger = picker?.shadowRoot?.querySelector('.trigger');
  const events = [];
  picker?.addEventListener('hp-color-opacity-change', (event) => events.push(event.detail));
  trigger?.click();
  await picker?.updateComplete;
  await frame();
  const surface = () => picker?.shadowRoot?.querySelector('.picker');
  const ranges = () => [...(surface()?.querySelectorAll('input[type="range"]') || [])];

  out.oneSurfaceNoNativePicker = !!surface()
    && surface().getAttribute('role') === 'dialog'
    && !surface().querySelector('input[type="color"]');
  out.allDimensionsVisible = !!surface()?.querySelector('.sv-field')
    && ranges().length === 4
    && !!surface()?.querySelector('input[type="text"]')
    && !!surface()?.querySelector('input[type="number"]');
  out.englishLabels = surface()?.getAttribute('aria-label') === 'Color picker'
    && ranges().map((input) => input.getAttribute('aria-label')).join('|')
      === 'Hue|Saturation|Brightness|Opacity';
  const rect = surface()?.getBoundingClientRect();
  out.narrowViewportFits = !!rect && rect.left >= 0 && rect.right <= innerWidth
    && rect.top >= 0 && rect.bottom <= innerHeight
    && surface().scrollWidth <= surface().clientWidth;

  const hue = ranges()[0];
  const hueStyle = getComputedStyle(hue);
  out.hueTrackContract = hue?.classList.contains('hue-range')
    && hue.min === '0' && hue.max === '359' && hue.step === '1'
    && hueStyle.getPropertyValue('--hp-picker-hue-track').includes('linear-gradient')
    && hue.getBoundingClientRect().height >= 40;
  ranges()[1].value = '100';
  ranges()[1].dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  ranges()[2].value = '100';
  ranges()[2].dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  hue.value = '120';
  hue.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await picker.updateComplete;
  out.hueUpdatesSharedDraft = picker.color === '#00ff00'
    && card._decorStyle.color === '#00ff00';

  const beforeShift = Number(ranges()[0].value);
  ranges()[0].dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowRight', shiftKey: true, bubbles: true, composed: true, cancelable: true,
  }));
  await picker.updateComplete;
  out.shiftArrowUsesTenStep = Math.round(picker._hue) === beforeShift + 10;

  const opacity = ranges().at(-1);
  opacity.value = '37';
  opacity.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await picker.updateComplete;
  out.opacitySharesTheSameSurface = picker.opacity === 0.37
    && card._decorStyle.opacity === 0.37;

  let hex = surface().querySelector('input[type="text"]');
  hex.value = '#0af';
  hex.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await picker.updateComplete;
  out.shortHexNormalizesAndEmits = picker.color === '#00aaff'
    && events.at(-1)?.color === '#00aaff';

  const eventCount = events.length;
  hex = surface().querySelector('input[type="text"]');
  hex.value = '#12';
  hex.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  hex.dispatchEvent(new FocusEvent('blur'));
  await picker.updateComplete;
  hex = surface().querySelector('input[type="text"]');
  out.invalidHexNeverEmits = events.length === eventCount
    && hex.value === '#00aaff' && hex.getAttribute('aria-invalid') === 'true';

  const field = surface().querySelector('.sv-field');
  const fieldRect = field.getBoundingClientRect();
  const eventsBeforePointer = events.length;
  field.dispatchEvent(new PointerEvent('pointerdown', {
    pointerId: 41, pointerType: 'touch', clientX: fieldRect.left + fieldRect.width * .25,
    clientY: fieldRect.top + fieldRect.height * .25, bubbles: true, composed: true, cancelable: true,
  }));
  field.dispatchEvent(new PointerEvent('pointermove', {
    pointerId: 41, pointerType: 'touch', clientX: fieldRect.right + 20,
    clientY: fieldRect.bottom + 20, bubbles: true, composed: true, cancelable: true,
  }));
  field.dispatchEvent(new PointerEvent('pointercancel', {
    pointerId: 41, pointerType: 'touch', bubbles: true, composed: true, cancelable: true,
  }));
  await frame();
  out.pointerCancelAddsNoEvent = events.length === eventsBeforePointer + 1
    && events.at(-1)?.color === picker.color
    && picker._activePointerId === null;

  picker.showOpacity = false;
  await picker.updateComplete;
  out.colorOnlyKeepsColorControls = ranges().length === 3
    && !surface().querySelector('input[type="number"]');
  picker.showOpacity = true;
  await picker.updateComplete;

  card._config = { ...card._config, language: 'ru' };
  card.requestUpdate();
  await card.updateComplete;
  await picker.updateComplete;
  out.cardLanguageOwnsCopy = surface()?.getAttribute('aria-label') === 'Выбор цвета'
    && surface()?.querySelector('input[type="text"]')?.getAttribute('aria-label') === 'Цвет HEX';

  const escapeControl = surface()?.querySelector('input[type="range"]');
  escapeControl?.focus();
  escapeControl?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await picker.updateComplete;
  await frame();
  out.escapeClosesFirstAndRefocuses = trigger?.getAttribute('aria-expanded') === 'false'
    && picker.shadowRoot.activeElement === trigger;

  picker.disabled = true;
  await picker.updateComplete;
  trigger?.click();
  await picker.updateComplete;
  out.disabledDoesNotOpen = trigger?.getAttribute('aria-expanded') === 'false';
  return out;
});

checkAll(result);
await finish(browser, result);
