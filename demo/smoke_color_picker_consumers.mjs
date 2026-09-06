import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 390, height: 1000 });

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const change = (picker, detail) => picker.dispatchEvent(new CustomEvent(
    'hp-color-opacity-change', { detail, bubbles: true, composed: true },
  ));
  const pickerByLabel = (dialog, label) => [...dialog.querySelectorAll('hp-color-opacity')]
    .find((picker) => picker.label === label);
  const nativeColors = () => root().querySelectorAll('input[type="color"]').length;

  card._openSettingsDialog();
  card._settingsDialog = { ...card._settingsDialog, bgMode: 'static', bgColor: null };
  card.requestUpdate();
  await card.updateComplete;
  let dialog = root().querySelector('hp-dialog');
  const generalPickers = [...dialog.querySelectorAll('hp-color-opacity')];
  const lightOn = pickerByLabel(dialog, card._t('gs.light_on'));
  const tempCold = pickerByLabel(dialog, card._t('gs.temp_cold'));
  const globalBg = pickerByLabel(dialog, card._t('gs.bg_color'));
  out.generalSettingsUsesTwelveUnifiedPickers = generalPickers.length === 12
    && generalPickers.filter((picker) => picker.showOpacity).length === 11
    && globalBg?.showOpacity === false
    && nativeColors() === 0;
  const previousTemp = { ...card._settingsDialog.colors.temp_cold };
  change(lightOn, { color: '#123456', opacity: 0.37 });
  await card.updateComplete;
  out.generalColorAndOpacityStayAtomic = card._settingsDialog.colors.light_on.c === '#123456'
    && card._settingsDialog.colors.light_on.a === 0.37
    && JSON.stringify(card._settingsDialog.colors.temp_cold) === JSON.stringify(previousTemp);

  lightOn.renderRoot.querySelector('.trigger').click();
  await lightOn.updateComplete;
  await frame();
  tempCold.renderRoot.querySelector('.trigger').click();
  await tempCold.updateComplete;
  await frame();
  out.generalPickersAreExclusive = lightOn.renderRoot.querySelector('.trigger')
    ?.getAttribute('aria-expanded') === 'false'
    && tempCold.renderRoot.querySelector('.trigger')?.getAttribute('aria-expanded') === 'true';
  tempCold.renderRoot.querySelector('.trigger').click();
  await tempCold.updateComplete;

  lightOn.renderRoot.querySelector('.trigger').click();
  await lightOn.updateComplete;
  await frame();
  const pickerSurface = lightOn._surface();
  const confirmButton = pickerSurface?.querySelector('.confirm');
  let pickerSurfaceClicks = 0;
  pickerSurface?.addEventListener('click', () => { pickerSurfaceClicks += 1; });
  confirmButton?.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  await lightOn.updateComplete;
  await frame();
  out.generalConfirmDoesNotClickThrough = !!pickerSurface && !!confirmButton
    && lightOn.renderRoot.querySelector('.trigger')
    ?.getAttribute('aria-expanded') === 'false'
    && pickerSurfaceClicks === 0;

  const originalGlobalBg = card._settingsDialog.bgColor;
  globalBg.renderRoot.querySelector('.trigger').click();
  await globalBg.updateComplete;
  globalBg.renderRoot.querySelector('.trigger').click();
  await globalBg.updateComplete;
  out.globalBackgroundOpenCloseDoesNotMaterialize = originalGlobalBg === null
    && card._settingsDialog.bgColor === null;
  change(globalBg, { color: '#0a2a4a', opacity: 0.12 });
  await card.updateComplete;
  dialog = root().querySelector('hp-dialog');
  const defaultButton = [...dialog.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === card._t('gs.bg_default'));
  const explicitGlobalBg = card._settingsDialog.bgColor;
  defaultButton?.click();
  await card.updateComplete;
  out.globalBackgroundIgnoresAlphaAndResets = explicitGlobalBg === '#0a2a4a'
    && card._settingsDialog.bgColor === null;

  card._settingsDialog = null;
  card._setMode('devices');
  card._openMarkerDialog();
  card._markerDialog = { ...card._markerDialog, display: 'icon_ripple', rippleColor: '', rippleSize: 4.5 };
  card.requestUpdate();
  await card.updateComplete;
  dialog = root().querySelector('hp-dialog');
  const ripple = pickerByLabel(dialog, card._t('marker.activity_color'));
  out.rippleUsesColorOnlyPicker = !!ripple && ripple.showOpacity === false
    && ripple.color === '#3ea6ff' && nativeColors() === 0;
  const rippleLabelBox = ripple?.renderRoot.querySelector('.label')?.getBoundingClientRect();
  const rippleSizeBox = dialog.querySelector('.ripple-sizerow .opl')?.getBoundingClientRect();
  out.rippleLabelsDoNotOverlapOnMobile = !!rippleLabelBox && !!rippleSizeBox
    && (rippleLabelBox.bottom <= rippleSizeBox.top || rippleLabelBox.right <= rippleSizeBox.left);
  const rippleSize = card._markerDialog.rippleSize;
  change(ripple, { color: '#abcdef', opacity: 0.05 });
  await card.updateComplete;
  out.rippleChangeLeavesSizeAndAlphaModelAlone = card._markerDialog.rippleColor === '#abcdef'
    && card._markerDialog.rippleSize === rippleSize
    && !Object.hasOwn(card._markerDialog, 'rippleOpacity');

  card._markerDialog = null;
  card._setMode('view');
  card._openSpaceDialog('edit', card._space);
  card._spaceDialog = { ...card._spaceDialog, bgMode: 'static', bgColor: null };
  card.requestUpdate();
  await card.updateComplete;
  dialog = root().querySelector('hp-dialog');
  const roomColor = pickerByLabel(dialog, card._t('space.room_color'));
  let spaceBg = pickerByLabel(dialog, card._t('space.bg_color'));
  out.spaceUsesOpacityAndColorOnlyModes = roomColor?.showOpacity === true
    && spaceBg?.showOpacity === false && nativeColors() === 0;
  change(roomColor, { color: '#fedcba', opacity: 0.63 });
  await card.updateComplete;
  out.roomColorAndOpacityStayAtomic = card._spaceDialog.roomColor === '#fedcba'
    && card._spaceDialog.roomOpacity === 0.63;
  const serverSpaceBefore = JSON.stringify(card._serverCfg.spaces.find((space) => space.id === card._space));
  spaceBg = pickerByLabel(root().querySelector('hp-dialog'), card._t('space.bg_color'));
  change(spaceBg, { color: '#102030', opacity: 0.2 });
  await card.updateComplete;
  dialog = root().querySelector('hp-dialog');
  const inheritButton = [...dialog.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === card._t('space.bg_inherit'));
  const explicitSpaceBg = card._spaceDialog.bgColor;
  inheritButton?.click();
  await card.updateComplete;
  card._spaceDialog = null;
  await card.updateComplete;
  out.spaceBackgroundIgnoresAlphaAndCancelPersistsNothing = explicitSpaceBg === '#102030'
    && JSON.stringify(card._serverCfg.spaces.find((space) => space.id === card._space)) === serverSpaceBefore;

  out.noNativeColorInputInAnyMigratedDialog = nativeColors() === 0;
  return out;
});

checkAll(result);
await finish(browser, result);
