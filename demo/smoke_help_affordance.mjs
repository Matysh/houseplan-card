// Issue #68: contextual help trigger parity, dialog overlay ownership and the
// real non-Popover fallback. Run by the prerelease smoke suite, not on edits.
import { launch, launchColdView, checkAll, finish } from './serve.mjs';

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
  const enterWithRealMouse = (target) => {
    target?.dispatchEvent(new PointerEvent('pointerover', {
      pointerType: 'mouse', bubbles: true, composed: true,
    }));
    target?.dispatchEvent(new PointerEvent('pointerenter', {
      pointerType: 'mouse', bubbles: false, composed: true,
    }));
  };

  // Empty or incomplete content must not leave a dead focus target behind.
  const incompleteHelp = document.createElement('hp-help');
  incompleteHelp.text = '   ';
  incompleteHelp.ariaLabel = 'Help: unavailable description';
  document.body.append(incompleteHelp);
  await incompleteHelp.updateComplete;
  out.emptyTextHidesTrigger = !incompleteHelp.shadowRoot?.querySelector('.trigger')
    && getComputedStyle(incompleteHelp).display === 'none';
  incompleteHelp.text = 'Available description';
  incompleteHelp.ariaLabel = '   ';
  await incompleteHelp.updateComplete;
  out.emptyAriaHidesTrigger = !incompleteHelp.shadowRoot?.querySelector('.trigger')
    && getComputedStyle(incompleteHelp).display === 'none';
  incompleteHelp.ariaLabel = 'Help: available description';
  await incompleteHelp.updateComplete;
  const restoredTrigger = incompleteHelp.shadowRoot?.querySelector('.trigger');
  out.circledQuestionIcon = restoredTrigger?.querySelector('svg[viewBox="0 0 24 24"] path')
    ?.getAttribute('d')?.length > 0;
  incompleteHelp.text = Array.from({ length: 320 }, (_, index) => `Line ${index + 1}`).join(' · ');
  await incompleteHelp.updateComplete;
  const overflowTrigger = incompleteHelp.shadowRoot?.querySelector('.trigger');
  overflowTrigger?.click();
  await incompleteHelp.updateComplete;
  await frame();
  const longSurface = incompleteHelp.shadowRoot?.querySelector('.tooltip');
  overflowTrigger?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'PageDown', bubbles: true, composed: true, cancelable: true,
  }));
  await frame();
  out.overflowHelpScrollsFromTrigger = !!longSurface
    && longSurface.scrollHeight > longSurface.clientHeight && longSurface.scrollTop > 0;
  overflowTrigger?.click();
  incompleteHelp.remove();

  card._setMode('devices');
  const marker = card._devices[0];
  card._openMarkerDialog(marker);
  await card.updateComplete;
  await frame();

  const dialogBody = root().querySelector('hp-dialog .body');
  const scrollGeometry = () => dialogBody ? {
    clientHeight: dialogBody.clientHeight,
    scrollHeight: dialogBody.scrollHeight,
    scrollTop: dialogBody.scrollTop,
  } : null;

  const roleHelp = root().querySelector('hp-help[data-help-key="marker.light_role.help"]');
  const roleButton = helpButton('marker.light_role.help');
  const roleDescription = roleHelp?.shadowRoot?.querySelector('[role="tooltip"]');
  out.realButton = roleButton?.tagName === 'BUTTON'
    && !!roleDescription?.id
    && !roleButton.hasAttribute('aria-describedby');

  const beforeHoverGeometry = scrollGeometry();
  enterWithRealMouse(roleButton);
  await wait(330);
  out.mouseHover = roleButton?.getAttribute('aria-expanded') === 'true'
    && roleButton.getAttribute('aria-describedby') === roleDescription?.id
    && !!helpSurface('marker.light_role.help');
  out.hoverKeepsDialogScrollGeometry = JSON.stringify(scrollGeometry())
    === JSON.stringify(beforeHoverGeometry);
  roleButton?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true, composed: true }));
  await wait(180);
  out.mouseLeave = roleButton?.getAttribute('aria-expanded') === 'false';

  // Escape dismisses a mouse-hovered bubble without moving keyboard focus
  // away from the form control the user was editing.
  const nameInput = root().querySelector('hp-dialog .namein');
  nameInput?.focus();
  enterWithRealMouse(roleButton);
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
  const colorOnlySurface = picker?.shadowRoot?.querySelector('.picker');
  out.glowColorOnlyHasNoAlpha = colorOnlySurface?.querySelectorAll('input[type="range"]').length === 3
    && !colorOnlySurface?.querySelector('input[type="number"]');
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
  const beforeFallbackGeometry = scrollGeometry();
  glowHelpButton?.click();
  await frame();
  const dialog = root().querySelector('hp-dialog');
  const fallback = dialog?.shadowRoot?.querySelector('[data-hp-overlay="help"]');
  const fallbackBox = fallback?.shadowRoot?.querySelector('.tooltip')?.getBoundingClientRect();
  out.realFallback = !!fallback && !!fallbackBox?.width && !!fallbackBox?.height;
  out.fallbackKeepsDialogScrollGeometry = JSON.stringify(scrollGeometry())
    === JSON.stringify(beforeFallbackGeometry);
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

  // #86 Party 1: all general-settings placements are real help controls and
  // opening one of them cannot mutate its associated setting.
  card._openSettingsDialog();
  await card.updateComplete;
  const generalKeys = ['gs.glow_radius.help', 'gs.bg_mode.help', 'gs.north.help'];
  out.party1GeneralInventory = generalKeys.every((key) => !!helpButton(key));
  const generalBefore = JSON.stringify({
    glowRadius: card._settingsDialog?.glowRadius,
    bgMode: card._settingsDialog?.bgMode,
    northDeg: card._settingsDialog?.northDeg,
  });
  helpButton('gs.bg_mode.help')?.click();
  await frame();
  out.party1GeneralHelpIsReadOnly = generalBefore === JSON.stringify({
    glowRadius: card._settingsDialog?.glowRadius,
    bgMode: card._settingsDialog?.bgMode,
    northDeg: card._settingsDialog?.northDeg,
  });
  card._settingsDialog = null;
  card.requestUpdate();
  await card.updateComplete;

  // The regular editor and cold-install onboarding render separate space
  // dialog templates; this smoke covers the editor copy while the source/i18n
  // contract covers both implementations.
  card._openSpaceDialog('edit', card._space);
  await card.updateComplete;
  const spaceKeys = [
    'space.cell_cm.help', 'space.zero_wall_style.help', 'space.bg_mode.help',
    'space.north.help', 'space.fill_mode.help',
  ];
  out.party1SpaceInventory = spaceKeys.every((key) => !!helpButton(key));
  const spaceBefore = JSON.stringify({
    cellCm: card._spaceDialog?.cellCm,
    zeroWallStyle: card._spaceDialog?.zeroWallStyle,
    bgMode: card._spaceDialog?.bgMode,
    northDeg: card._spaceDialog?.northDeg,
    fillMode: card._spaceDialog?.fillMode,
  });
  helpButton('space.zero_wall_style.help')?.click();
  await frame();
  out.party1SpaceHelpIsReadOnly = spaceBefore === JSON.stringify({
    cellCm: card._spaceDialog?.cellCm,
    zeroWallStyle: card._spaceDialog?.zeroWallStyle,
    bgMode: card._spaceDialog?.bgMode,
    northDeg: card._spaceDialog?.northDeg,
    fillMode: card._spaceDialog?.fillMode,
  });
  card._spaceDialog = null;
  card.requestUpdate();
  await card.updateComplete;

  card._openDeviceInbox();
  await card.updateComplete;
  const hiddenBefore = card._showHidden;
  const hiddenHelpButton = helpButton('device_inbox.show_hidden.help');
  hiddenHelpButton?.click();
  await frame();
  const hiddenSurface = helpSurface('device_inbox.show_hidden.help');
  const hiddenBox = hiddenSurface?.getBoundingClientRect();
  out.party1ShowHiddenHelpIsReadOnly = !!hiddenHelpButton
    && card._showHidden === hiddenBefore;
  out.party1ShowHiddenHelpInsideNarrowViewport = !!hiddenBox
    && hiddenBox.left >= (visualViewport?.offsetLeft || 0)
    && hiddenBox.top >= (visualViewport?.offsetTop || 0)
    && hiddenBox.right <= (visualViewport?.offsetLeft || 0) + (visualViewport?.width || innerWidth)
    && hiddenBox.bottom <= (visualViewport?.offsetTop || 0) + (visualViewport?.height || innerHeight);

  return out;
});

// Empty-install onboarding owns a separate lazy runtime and a second copy of
// the space dialog. Exercise that production chunk, not merely the regular
// editor template or its source inventory (#86 review r1 M1).
const onboarding = await launchColdView({ width: 390, height: 780 });
await onboarding.page.evaluate(async () => {
  const card = window.__card;
  card._onboardingShown = false;
  card._serverCfg = { ...card._serverCfg, spaces: [] };
  card._model = [];
  card.hass = { ...card.hass, floors: {}, areas: {} };
  card.requestUpdate();
  await card.updateComplete;
});
await onboarding.page.waitForFunction(() => {
  const card = window.__card;
  return card._onboardingRuntime && !card._editorRuntime
    && card.renderRoot.querySelector('hp-dialog');
});
const onboardingHelp = await onboarding.page.evaluate(async () => {
  const card = window.__card;
  const root = card.renderRoot;
  const keys = [
    'space.cell_cm.help', 'space.zero_wall_style.help', 'space.bg_mode.help',
    'space.north.help', 'space.fill_mode.help',
  ];
  const help = (key) => root.querySelector(`hp-help[data-help-key="${key}"]`);
  const before = JSON.stringify({
    cellCm: card._spaceDialog?.cellCm,
    zeroWallStyle: card._spaceDialog?.zeroWallStyle,
    bgMode: card._spaceDialog?.bgMode,
    northDeg: card._spaceDialog?.northDeg,
    fillMode: card._spaceDialog?.fillMode,
  });
  const zeroWallHelp = help('space.zero_wall_style.help');
  zeroWallHelp?.shadowRoot?.querySelector('.trigger')?.click();
  await zeroWallHelp?.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const after = JSON.stringify({
    cellCm: card._spaceDialog?.cellCm,
    zeroWallStyle: card._spaceDialog?.zeroWallStyle,
    bgMode: card._spaceDialog?.bgMode,
    northDeg: card._spaceDialog?.northDeg,
    fillMode: card._spaceDialog?.fillMode,
  });
  return {
    inventory: keys.every((key) => !!help(key)?.shadowRoot?.querySelector('.trigger')),
    selectedHelpOpened: zeroWallHelp?.shadowRoot
      ?.querySelector('.trigger')?.getAttribute('aria-expanded') === 'true',
    readOnly: before === after,
    editorStillLazy: !!card._onboardingRuntime && !card._editorRuntime,
  };
});
res.party1ColdOnboardingInventory = onboardingHelp.inventory;
res.party1ColdOnboardingHelpOpens = onboardingHelp.selectedHelpOpened;
res.party1ColdOnboardingHelpIsReadOnly = onboardingHelp.readOnly;
res.party1ColdOnboardingKeepsEditorLazy = onboardingHelp.editorStillLazy;
await onboarding.browser.close();

// Browser zoom at 200% on a 780 px-wide display exposes a 390 CSS px viewport
// at DPR 2. Playwright cannot change Chromium's toolbar preference, so create
// that exact renderer contract directly; unlike CSS `zoom`, this preserves the
// coordinate space used by fixed/popover surfaces and catches real clipping.
const zoomed = await launch({ width: 390, height: 900 }, 2);
const zoomedLayout = await zoomed.page.evaluate(async () => {
  const card = window.__card;
  const root = card.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  card._openSettingsDialog();
  await card.updateComplete;
  await frame();

  const help = root.querySelector('hp-help[data-help-key="gs.bg_mode.help"]');
  const trigger = help?.shadowRoot?.querySelector('.trigger');
  const stage = root.querySelector('.stage');
  const dialogBody = root.querySelector('hp-dialog .body');
  const stageRect = () => {
    const box = stage?.getBoundingClientRect();
    return box ? [box.left, box.top, box.width, box.height].map((value) => Math.round(value)) : null;
  };
  const settleStage = async () => {
    let previous = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      await frame();
      const current = stageRect();
      if (JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    return previous;
  };
  trigger?.scrollIntoView({ block: 'center', inline: 'nearest' });
  await frame();
  const before = await settleStage();
  trigger?.click();
  await help?.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const triggerBox = trigger?.getBoundingClientRect();
  const surface = help?.shadowRoot?.querySelector('.tooltip')
    || root.querySelector('hp-dialog')?.shadowRoot
      ?.querySelector('[data-hp-overlay="help"]')?.shadowRoot?.querySelector('.tooltip');
  const surfaceBox = surface?.getBoundingClientRect();
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const right = left + (viewport?.width || innerWidth);
  const bottom = top + (viewport?.height || innerHeight);
  const inside = (box) => !!box && box.width > 0 && box.height > 0
    && box.left >= left && box.top >= top && box.right <= right && box.bottom <= bottom;
  return {
    zoomApplied: devicePixelRatio === 2 && innerWidth === 390,
    triggerInside: inside(triggerBox),
    tooltipInside: inside(surfaceBox),
    noHorizontalDialogOverflow: !!dialogBody
      && dialogBody.scrollWidth <= dialogBody.clientWidth + 1,
    stageStable: JSON.stringify(await settleStage()) === JSON.stringify(before),
  };
});
res.party1BrowserZoom200Applied = zoomedLayout.zoomApplied;
res.party1BrowserZoom200TriggerInside = zoomedLayout.triggerInside;
res.party1BrowserZoom200TooltipInside = zoomedLayout.tooltipInside;
res.party1BrowserZoom200NoHorizontalOverflow = zoomedLayout.noHorizontalDialogOverflow;
res.party1BrowserZoom200StageStable = zoomedLayout.stageStable;
await zoomed.browser.close();

res.keyboardFocus = keyboardFocus;

checkAll(res);
await finish(browser, res);
