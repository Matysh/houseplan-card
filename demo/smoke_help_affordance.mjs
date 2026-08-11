// Issue #68: contextual help trigger parity, dialog overlay ownership and the
// real non-Popover fallback. Run by the prerelease smoke suite, not on edits.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 390, height: 780 }, 1);
await page.keyboard.press('Tab');
const keyboardFocus = await page.evaluate(async () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const dialog = document.createElement('hp-dialog');
  dialog.title = 'Keyboard help smoke';
  const help = document.createElement('hp-help');
  help.text = 'Keyboard description';
  help.ariaLabel = 'Help: keyboard description';
  dialog.append(help);
  document.body.append(dialog);
  await dialog.updateComplete;
  await help.updateComplete;
  dialog._focusInitial();
  await frame();
  const button = help.shadowRoot?.querySelector('.trigger');
  const result = deepActive() === button
    && button?.matches(':focus-visible')
    && button?.getAttribute('aria-expanded') === 'true'
    && dialog._focusableElements().includes(button);
  dialog.remove();
  return result;
});
const res = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const helpButton = (key) => root().querySelector(`hp-help[data-help-key="${key}"]`)?.shadowRoot?.querySelector('.trigger');
  const helpSurface = (key) => {
    const help = root().querySelector(`hp-help[data-help-key="${key}"]`);
    return help?.shadowRoot?.querySelector('.tooltip')
      || root().querySelector('hp-dialog')?.shadowRoot?.querySelector('[data-hp-overlay="help"]')?.shadowRoot?.querySelector('.tooltip');
  };

  card._setMode('devices');
  const marker = card._devices[0];
  card._openMarkerDialog(marker);
  await card.updateComplete;
  await frame();

  const roleHelp = root().querySelector('hp-help[data-help-key="marker.light_role.help"]');
  const roleButton = helpButton('marker.light_role.help');
  const roleDescription = roleHelp?.shadowRoot?.querySelector('[role="tooltip"]');
  out.realButton = roleButton?.tagName === 'BUTTON'
    && !!roleDescription?.id
    && !roleButton.hasAttribute('aria-describedby');

  roleButton?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true, composed: true }));
  await wait(330);
  out.mouseHover = roleButton?.getAttribute('aria-expanded') === 'true'
    && roleButton.getAttribute('aria-describedby') === roleDescription?.id
    && !!helpSurface('marker.light_role.help');
  roleButton?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true, composed: true }));
  await wait(180);
  out.mouseLeave = roleButton?.getAttribute('aria-expanded') === 'false';

  // Escape dismisses a mouse-hovered bubble without moving keyboard focus
  // away from the form control the user was editing.
  const nameInput = root().querySelector('hp-dialog .namein');
  nameInput?.focus();
  roleButton?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true, composed: true }));
  await wait(330);
  nameInput?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await frame();
  out.hoverEscapeKeepsFocus = roleButton?.getAttribute('aria-expanded') === 'false'
    && deepActive() === nameInput;

  roleButton?.click();
  await frame();
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await frame();
  out.outsidePointer = roleButton?.getAttribute('aria-expanded') === 'false';
  roleButton?.click();
  await frame();
  out.touchClick = roleButton?.getAttribute('aria-expanded') === 'true';
  roleButton?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await card.updateComplete;
  out.escapeHelpFirst = roleButton?.getAttribute('aria-expanded') === 'false' && !!card._markerDialog;

  // The help in the first legend remains a real enabled target even while the
  // glow fieldset itself is disabled.
  card._markerDialog = { ...card._markerDialog, lightRole: 'never' };
  await card.updateComplete;
  const disabledHelpHost = root().querySelector('hp-help[data-help-key="marker.glow_mode.help"]');
  const disabledHelp = helpButton('marker.glow_mode.help');
  out.disabledExplanation = !!disabledHelp && !disabledHelp.disabled
    && !!disabledHelpHost?.closest('fieldset[disabled]')
    && !!disabledHelpHost?.closest('legend');

  // Exclusive transient surfaces: opening help dismisses an open colour picker.
  card._markerDialog = { ...card._markerDialog, lightRole: 'always', glowMode: 'fixed' };
  await card.updateComplete;
  const picker = root().querySelector('hp-color-opacity');
  const pickerButton = picker?.shadowRoot?.querySelector('.trigger');
  pickerButton?.click();
  await frame();
  const glowHelpButton = helpButton('marker.glow_mode.help');
  const focusables = root().querySelector('hp-dialog')?._focusableElements?.() || [];
  out.shadowFocusables = focusables.includes(glowHelpButton) && focusables.includes(pickerButton);
  glowHelpButton?.click();
  await frame();
  out.exclusive = pickerButton?.getAttribute('aria-expanded') === 'false'
    && glowHelpButton?.getAttribute('aria-expanded') === 'true';

  const surface = helpSurface('marker.glow_mode.help');
  const box = surface?.getBoundingClientRect();
  const viewport = window.visualViewport;
  out.insideViewport = !!box && box.left >= (viewport?.offsetLeft || 0)
    && box.top >= (viewport?.offsetTop || 0)
    && box.right <= (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth)
    && box.bottom <= (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);

  pickerButton?.click();
  await frame();
  out.reverseExclusive = glowHelpButton?.getAttribute('aria-expanded') === 'false'
    && pickerButton?.getAttribute('aria-expanded') === 'true';
  pickerButton?.click();
  glowHelpButton?.click();
  await frame();
  card._showToast('overlay priority');
  await frame();
  out.toastClosesTransient = glowHelpButton?.getAttribute('aria-expanded') === 'false'
    && !!card._markerDialog;
  glowHelpButton?.click();
  await frame();

  // Scrolling the owning dialog closes help instead of leaving a detached bubble.
  const body = glowHelpButton?.getRootNode()?.host?.closest('hp-dialog')?.querySelector('.body');
  body?.dispatchEvent(new Event('scroll', { bubbles: false }));
  await frame();
  out.ownScrollCloses = glowHelpButton?.getAttribute('aria-expanded') === 'false';

  // Force feature detection down the true portal fallback branch.
  const show = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
  const hide = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidePopover');
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: undefined });
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value: undefined });
  glowHelpButton?.click();
  await frame();
  const dialog = root().querySelector('hp-dialog');
  const fallback = dialog?.shadowRoot?.querySelector('[data-hp-overlay="help"]');
  const fallbackBox = fallback?.shadowRoot?.querySelector('.tooltip')?.getBoundingClientRect();
  out.realFallback = !!fallback && !!fallbackBox?.width && !!fallbackBox?.height;
  glowHelpButton?.click();
  pickerButton?.click();
  await frame();
  const pickerFallback = dialog?.shadowRoot?.querySelector('[data-hp-overlay="color-opacity"]');
  const pickerControl = pickerFallback?.shadowRoot?.querySelector('input');
  out.fallbackPickerFocusable = !!pickerControl
    && dialog?._focusableElements?.().includes(pickerControl);
  pickerButton?.click();
  if (show) Object.defineProperty(HTMLElement.prototype, 'showPopover', show);
  else delete HTMLElement.prototype.showPopover;
  if (hide) Object.defineProperty(HTMLElement.prototype, 'hidePopover', hide);
  else delete HTMLElement.prototype.hidePopover;

  // Explicit card language wins over HA locale and updates an existing component.
  card._config = { ...card._config, language: 'ru' };
  card.requestUpdate();
  await card.updateComplete;
  out.cardLanguage = /Определяет|источник/.test(root()
    .querySelector('hp-help[data-help-key="marker.light_role.help"]')?.text || '');

  const finalButton = helpButton('marker.light_role.help');
  finalButton?.click();
  await frame();
  finalButton?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await card.updateComplete;
  finalButton?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await card.updateComplete;
  out.secondEscapeClosesDialog = !card._markerDialog;

  return out;
});

res.keyboardFocus = keyboardFocus;

checkAll(res);
await finish(browser, res);
