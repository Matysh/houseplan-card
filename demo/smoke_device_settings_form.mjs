// #947: shared device sections and the existing functional fields/save guards.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { stackedFieldChecks } from './helpers/stacked-fields.mjs';

requirePinnedBrowser('#1013 device form geometry');
const { page, browser } = await launch({ width: 1280, height: 900 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await window.__hpTest.settled(); };
  const dlg = () => sr().querySelector('hp-dialog[data-kind="marker"]');
  const q = (sel) => dlg()?.querySelector(sel);
  const qa = (sel) => [...(dlg()?.querySelectorAll(sel) || [])];
  const saveBtn = () => q('.dialog-action-commit [data-hp="dialog-confirm"]');
  const statusText = () => q('.hpf-status')?.textContent.trim() || '';
  const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const change = (el) => el.dispatchEvent(new Event('change', { bubbles: true }));
  const pickSeg = async (name, value) => {
    const r = qa(`input[name="${name}"]`).find((x) => x.value === value);
    r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); await upd();
  };
  const select = async (el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await upd(); };

  c._setMode('devices'); await upd();
  const lamp = c._devices.find((d) => d.id === 'd_light1') || c._devices.find((d) => d.bindingKind === 'device');
  c._openMarkerDialog(lamp); await upd();
  const d0 = c._markerDialog;

  // --- AC1 plus #1000: five original cards followed by shared alarms -----
  o.sharedCardsWithAlarmsInOrder = JSON.stringify(qa('.hpf-card').map((card) => card.dataset.card
    ?? card.closest('[data-settings-section]')?.dataset.settingsSection))
    === JSON.stringify(['basics', 'appearance', 'tap', 'light', 'details', 'alarms'])
    && !!q('[data-settings-section=alarms] .alarm-table')
    && !!q('[data-settings-section=alarms] [data-hp=alarm-add]');
  o.noLegacyMarkup = qa('.srcrow, .namein, .areasel, .dropbtn, .droppanel, .candlist, fieldset, .markerlightgroup, .markerradios, '
    + '.colorrow, .habindingbanner, .bindsel, .bindharow, .entcheck, .ctrlchips, .ctrllist, .ctrlopt, .opl, .opv, .descin, .tempin, '
    + '.markerhelpfield, .markerhelplabel, .helpfieldlabel, .rhint, .markerlightdisabled, .markerlightwarning').length === 0;
  o.subtitleShowsSpace = dlg().subtitle.includes(c._spaceModelById(lamp.space)?.title) && !!dlg().shadowRoot.querySelector('.subtitle');
  o.shellIs560 = dlg().hasAttribute('form-shell') && Math.round(dlg().shadowRoot.querySelector('.surface').getBoundingClientRect().width) === 610;
  o.bodyHasNoOwnScroller = getComputedStyle(q('.body')).overflowY === 'visible' && getComputedStyle(q('.body')).maxHeight === 'none';
  o.footerGroups = !!q('.markeractions .btn.danger') && q('.markeractions').getBoundingClientRect().left < saveBtn().getBoundingClientRect().left;

  // --- Basics: имя с подсказкой, сегмент привязки, кнопка выбора, «Show entities» в панели (Q8)
  o.nameFieldWithoutRedundantHint = !!q('#marker-name.hpf-input')
    && !q('#marker-name')?.closest('.hpf-field')?.querySelector('.hpf-hint');
  o.bindingIsASegment = qa('input[name="bmode"]').length === 2 && q('input[name="bmode"]:checked')?.value === 'ha'
    && !!q('input[name="bmode"]')?.closest('.hpf-seg[role="radiogroup"]');
  o.bindingButtonShowsCurrent = !!q('#marker-binding.hpf-pick b') && q('#marker-binding').getAttribute('aria-expanded') === 'false'
    && !q('#marker-show-entities');
  q('#marker-binding').click(); await upd();
  o.panelHoldsSearchAndShowEntities = !!q('.hpf-card[data-card="basics"] .hpf-panel .hpf-toolbar input.hpf-input')
    && !!q('.hpf-card[data-card="basics"] .hpf-panel #marker-show-entities')
    && qa('.hpf-card[data-card="basics"] .hpf-cand[role="option"]').length > 0
    && getComputedStyle(q('.hpf-card[data-card="basics"] .hpf-panel')).position !== 'absolute';
  q('#marker-show-entities').click(); await upd();
  o.showEntitiesWritesOwnKey = c._markerDialog.showEntities === !d0.showEntities && c._markerDialog.binding === d0.binding;
  q('#marker-binding').click(); await upd();
  o.buttonClosesPanel = !q('.hpf-card[data-card="basics"] .hpf-panel') && c._markerDialog.bindingOpen === false;
  o.roomIsASelectWithContextualHelp = !!q('#marker-room.hpf-select')
    && !!q('#marker-room')?.closest('.hpf-field')?.querySelector('hp-help[data-help-key="marker.room.help"]')?.text;

  q('[data-section-target=actions]').click(); await upd();
  // --- Tap action: подтверждение только у действий (Q8), чипы источников -----
  o.tapActionCardHasHeading = !!q('.hpf-card[data-card="tap"] > .hpf-head');
  await select(q('#marker-tap-action'), 'none');
  o.noConfirmForDoNothing = !q('#marker-tap-confirm') && !q('#marker-toggle-hint');
  await select(q('#marker-tap-action'), 'toggle');
  o.confirmToggleRowForToggle = !!q('#marker-tap-confirm') && !!q('#marker-tap-confirm')?.closest('.hpf-toggle')
    && !!q('#marker-toggle-hint');
  q('#marker-tap-confirm').click(); await upd();
  o.confirmWritesOwnKey = c._markerDialog.tapConfirm === true && c._markerDialog.tapAction === 'toggle';
  input(q('#marker-controls-filter'), 'l'); await upd();
  const controlCands = qa('.hpf-card[data-card="tap"] .hpf-panel .hpf-cand');
  o.controlsSearchOpensPanelInFlow = controlCands.length > 0 && !q('.ctrllist');
  const controlsBefore = c._markerDialog.controls.length;
  controlCands[0].click(); await upd();
  o.controlPickAddsAChip = c._markerDialog.controls.length === controlsBefore + 1
    && qa('.hpf-card[data-card="tap"] .hpf-chips .hpf-chip').length === c._markerDialog.controls.length;
  q('.hpf-card[data-card="tap"] .hpf-chip button').click(); await upd();
  o.chipRemoveWritesControls = c._markerDialog.controls.length === controlsBefore;

  q('[data-section-target=light]').click(); await upd();
  // --- Light and glow: сегменты, блок свечения отключается целиком -----------
  o.roleIsASegmentWithAutoHint = qa('input[name="marker-light-role"]').length === 3
    && !!q('input[name="marker-light-role"]')?.closest('.hpf-seg[role="radiogroup"]')
    && q('input[name="marker-light-role"][value="auto"]')?.closest('label').textContent.includes('(');
  await pickSeg('marker-light-role', 'never');
  o.neverDisablesGlowBlock = c._markerDialog.lightRole === 'never'
    && q('.markerglowblock')?.classList.contains('hpf-disabled') && q('.markerglowblock').getAttribute('aria-disabled') === 'true'
    && qa('input[name="marker-glow-mode"]').every((r) => r.disabled) && q('#marker-glow-radius')?.disabled === true
    && !!q('#marker-glow-disabled-hint.hpf-callout')
    && q('input[name="marker-glow-mode"]').getAttribute('aria-describedby') === 'marker-glow-disabled-hint'
    && !q('.markerglowblock hp-help button[disabled]');
  await pickSeg('marker-light-role', 'always');
  await pickSeg('marker-glow-mode', 'fixed');
  o.fixedShowsColorPlateAndBrightness = c._markerDialog.glowMode === 'fixed'
    && !!q('.markerglowvalue .hpf-colorfield hp-color-opacity[hide-label]') && !!q('.markerglowvalue .hpf-hex')
    && !!q('#marker-glow-brightness') && qa('input[type="color"]').length === 0
    && !q('.markerglowblock.hpf-disabled');
  input(q('#marker-glow-brightness'), '42'); change(q('#marker-glow-brightness')); await upd();
  o.brightnessNumberWrites = c._markerDialog.glowBrightness === 42 && c._markerDialog.glowTouched === true;
  o.radiusHintWhenEmpty = c._markerDialog.glowRadius === '' && !!q('#marker-glow-radius')?.closest('.hpf-field')?.querySelector('.hpf-hint');
  // Ревью r1 M2: радиус — не условие Save. Нечисло или ноль, как на dev, при
  // сохранении молча становится общим радиусом; поле не помечается ошибкой.
  c._markerDialog = { ...c._markerDialog, glowRadius: 'x' }; await upd();
  o.badRadiusDoesNotBlockSave = saveBtn().disabled === false && !q('#marker-glow-radius[aria-invalid="true"]')
    && !q('.hpf-card[data-card="light"] .hpf-error') && !q('.hpf-status .hpf-link');
  input(q('#marker-glow-radius'), '2.5'); await upd();
  o.radiusWrites = c._markerDialog.glowRadius === '2.5' && saveBtn().disabled === false;
  // «Review N fields» ведёт к первому ошибочному полю — здесь к привязке (create-режим ниже проверяет ссылку).
  input(q('#marker-glow-radius'), '0'); await upd();
  o.zeroRadiusKeepsSaveEnabled = saveBtn().disabled === false;
  input(q('#marker-glow-radius'), ''); await upd();

  q('[data-section-target=appearance]').click(); await upd();
  // --- Appearance: иконка, display, бейдж, превью (Q3), размеры ----------------
  o.iconFieldHasPreview = !!q('#marker-icon') && !!q('.hpf-iconfield .hpf-iconpreview ha-icon');
  o.noAutoPinOrResetButton = !q('.iconauto .hpf-link') && !q('.hpf-iconclear');
  const icon = q('#marker-icon');
  icon.focus();
  const iconWrapper = getComputedStyle(icon.closest('.hpf-iconfield-control'));
  o.fallbackHasSingleFocusOwner = icon.tagName === 'INPUT'
    && parseFloat(iconWrapper.borderTopWidth) === 1 && iconWrapper.borderTopColor !== 'rgba(0, 0, 0, 0)'
    && iconWrapper.outlineStyle === 'solid' && parseFloat(iconWrapper.outlineWidth) === 2
    && getComputedStyle(icon.closest('.hpf-iconfield')).outlineStyle === 'none'
    && parseFloat(getComputedStyle(icon).borderTopWidth) === 0;
  if (icon.tagName === 'HA-ICON-PICKER') icon.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'mdi:home'}}));
  else input(icon,'mdi:home');
  await upd(); o.manualIconWrites = c._markerDialog.icon === 'mdi:home';
  if (icon.tagName === 'HA-ICON-PICKER') icon.dispatchEvent(new CustomEvent('value-changed',{detail:{value:''}}));
  else input(icon,'');
  await upd(); o.clearResetsIcon = c._markerDialog.icon === '';
  const displayField=q('#marker-display')?.closest('.hpf-field');
  o.displaySelectWithContextualHelp = !!q('#marker-display.hpf-select')
    && !!displayField?.querySelector('hp-help[data-help-key="marker.display.help"]')?.text
    && !displayField.querySelector('.hpf-hint');
  o.hideBatteryIsAnAppearanceToggle = !!q('#marker-hide-battery')
    && !!q('#marker-hide-battery')?.closest('.hpf-toggle.hpf-compact');
  o.badgeBlock = !!q('.markerbadgegroup.hpf-block .hpf-sub h4') && !!q('#marker-value-badge')?.closest('.hpf-toggle.hpf-compact');
  if (!q('#marker-value-badge').checked && !q('#marker-value-badge').disabled) { q('#marker-value-badge').click(); await upd(); }
  o.badgePositionIsASegment = qa('input[name="marker-value-badge-position"]').length === 4;
  await pickSeg('marker-value-badge-position', 'top');
  o.badgePositionWrites = c._markerDialog.valueBadgePosition === 'top' && c._markerDialog.valueBadgeTouched === true;
  // Q3: hp-device-preview целиком, без второго заголовка над ним (у компонента свой)
  o.previewIsTheComponentItself = !!q('.hpf-card[data-card="appearance"] hp-device-preview')
    && !q('.hpf-card[data-card="appearance"] .hpf-tint hp-device-preview');
  o.sizeRowsInAGrid = !!q('.hpf-card[data-card="appearance"] .hpf-grid #marker-size') && !!q('.hpf-card[data-card="appearance"] .hpf-grid #marker-angle');
  o.sizeAndAngleFieldsDoNotCoverSliders = ['#marker-size', '#marker-angle'].every((selector) => {
    const number = q(selector);
    const range = number.closest('.hpf-range');
    const slider = range.querySelector('ha-slider, input[type="range"]');
    const sliderBox = slider.getBoundingClientRect();
    const unitBox = number.closest('.hpf-unit').getBoundingClientRect();
    return sliderBox.right < unitBox.left && number.scrollWidth <= number.clientWidth
      && unitBox.right <= range.getBoundingClientRect().right + 3;
  });
  input(q('#marker-size'), '2'); change(q('#marker-size')); await upd();
  input(q('#marker-angle'), '35'); change(q('#marker-angle')); await upd();
  o.sizeAndAngleNumbersWrite = c._markerDialog.size === 2 && c._markerDialog.angle === 35;

  q('[data-section-target=details]').click(); await upd();
  // --- Details: Model и Link в ряд, описание, вложения ------------------------
  const modelBox = q('#marker-model').getBoundingClientRect();
  const linkBox = q('#marker-link').getBoundingClientRect();
  o.modelAndLinkUseAvailableWidth = linkBox.top > modelBox.bottom && Math.abs(linkBox.width-modelBox.width)<2;
  o.descriptionIsAKitTextarea = q('#marker-description')?.tagName === 'TEXTAREA' && q('#marker-description').classList.contains('hpf-input');
  o.attachInActions = !!q('.hpf-card[data-card="details"] .hpf-actions .filebtn');
  o.ordinaryDeviceHasNoRadarDeclaration = !q('#marker-radar-presence') && !q('[data-section-target=radar]') && !q('.radaradditional');
  input(q('#marker-model'), 'Model 600'); await upd();
  o.modelWritesOwnKey = c._markerDialog.model === 'Model 600' && c._markerDialog.link === d0.link;

  // --- AC9: цели ≥ 44 ---------------------------------------------------------
  o.toggleTargetsAre44 = qa('.hpf-toggle > input[type="checkbox"]').filter(i=>i.getBoundingClientRect().width>0).every((i) => { const b = i.getBoundingClientRect(); return b.width >= 44 && b.height >= 44; });
  o.segmentsAreRadiogroups = qa('.hpf-seg').length >= 4 && qa('.hpf-seg').every((s) => s.getAttribute('role') === 'radiogroup' && s.getAttribute('aria-label'));

  // --- К10: Save только при изменениях, вопрос при закрытии --------------------
  c._closeMarkerDialog(); await upd();
  c._openMarkerDialog(lamp); await upd();
  o.saveDisabledWhenClean = saveBtn().disabled === true && statusText().length > 0;
  q('#marker-hide-battery').click(); await upd();
  o.hideBatteryWritesOwnKeyAndMakesDirty = c._markerDialog.hideBattery === true && saveBtn().disabled === false;
  q('#marker-hide-battery').click(); await upd();
  o.hideBatteryRevertsToClean = c._markerDialog.hideBattery === false && saveBtn().disabled === true;
  const editName0 = c._markerDialog.name;
  input(q('#marker-name'), `${editName0} x`); await upd();
  o.saveEnabledWhenDirtyWithoutDuplicateStatus = saveBtn().disabled === false && statusText().length > 0;
  input(q('#marker-name'), editName0); await upd();
  o.cleanAgainWhenReverted = saveBtn().disabled === true && statusText().length > 0;
  input(q('#marker-name'), `${editName0} staged`); await upd();
  const callWS = c.hass.callWS;
  c.hass = {...c.hass,callWS:message=>message.type==='houseplan/config/set'
    ? Promise.reject({code:'not_allowed',message:'Device write refusal'}) : callWS(message)};
  saveBtn().click(); await window.__hpTest.waitForWrites().catch(()=>{}); await upd();
  c.hass = {...c.hass,callWS}; await upd();
  input(q('#marker-name'), editName0); await upd();
  o.saveAttemptDoesNotForgetBaseline = saveBtn().disabled === true;
  q('.markeractions .btn:not(.danger)').click(); await upd();
  o.hideMakesDirty = c._markerDialog.hideFromPlan === true && saveBtn().disabled === false;
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  const confirm = () => sr().querySelector('hp-confirm hp-dialog');
  o.discardAsksFirst = !!confirm() && !!dlg();
  confirm()?.querySelector('[data-hp="dialog-cancel"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.keepEditingKeepsDialog = !!dlg() && !confirm() && c._markerDialog?.hideFromPlan === true;
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  confirm()?.querySelector('[data-hp="dialog-confirm"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.discardCloses = !dlg() && c._markerDialog === null && lamp.marker?.hidden !== true;
  c._openMarkerDialog(lamp); await upd();
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  o.cleanClosesImmediately = !dlg() && !confirm();

  // --- create-режим: обязательные поля видны inline до вызова save ----------
  c._openMarkerDialog(); await upd();
  o.createHasNoHideDelete = !q('.markeractions .btn');
  o.virtualNameIsAnInlineProblem = saveBtn().disabled === true
    && q('#marker-name').getAttribute('aria-invalid') === 'true'
    && !!q('#marker-name').closest('.hpf-field').querySelector('.hpf-error')
    && /1/.test(q('.hpf-status .hpf-link').textContent);
  await pickSeg('bmode', 'ha');
  o.createHaWithoutBindingIsAProblem = saveBtn().disabled === true && !!q('.hpf-status .hpf-link')
    && !!q('.hpf-card[data-card="basics"] .hpf-error') && q('#marker-binding').getAttribute('aria-expanded') === 'false'
    && !q('#marker-binding').closest('.hpf-picker').querySelector('.hpf-panel');
  q('.hpf-status .hpf-link').click(); await upd();
  o.reviewLinkFocusesBinding = (sr().activeElement ?? document.activeElement)?.id === 'marker-binding';
  await pickSeg('bmode', 'virtual');
  o.virtualHasNoRedundantHint = c._markerDialog.binding === 'virtual' && saveBtn().disabled === true
    && !q('input[name="bmode"]')?.closest('.hpf-field')?.querySelector('.hpf-hint');
  input(q('#marker-name'), 'Virtual sensor'); await upd();
  o.virtualNameUnblocksSave = saveBtn().disabled === false && !q('#marker-name[aria-invalid="true"]');
  await select(q('#marker-tap-action'), 'run');
  o.runWithoutTargetIsInline = saveBtn().disabled === true
    && q('#marker-run-target').getAttribute('aria-invalid') === 'true'
    && !!q('#marker-run-target').closest('.hpf-field').querySelector('.hpf-error');
  c._markerDialog = { ...c._markerDialog, tapTarget: 'script.demo', runFilter: '' }; await upd();
  o.runTargetUnblocksSave = saveBtn().disabled === false;
  c._markerDialog = {
    ...c._markerDialog, valueBadgeTouched: true, valueBadgeEnabled: true, valueBadgeSource: null,
  }; await upd();
  o.badgeWithoutSourceIsInline = saveBtn().disabled === true
    && q('#marker-value-badge-source').getAttribute('aria-invalid') === 'true'
    && !!q('#marker-value-badge-source').closest('.hpf-field').querySelector('.hpf-error');
  c._markerDialog = null; await upd();
  return o;
});

// --- AC2: полосы экранов ------------------------------------------------------
const bands = {};
for (const width of [320, 390, 480, 560, 768, 1280, 1920]) {
  await page.setViewportSize({ width, height: 900 });
  const m = await page.evaluate(async (w) => {
    const c = window.__card;
    const sr = () => c.shadowRoot || c.renderRoot;
    c._markerDialog = null; c.requestUpdate(); await c.updateComplete;
    const lamp = c._devices.find((d) => d.id === 'd_light1') || c._devices.find((d) => d.bindingKind === 'device');
    c._openMarkerDialog(lamp); c.requestUpdate(); await c.updateComplete;
    c._markerDialog = { ...c._markerDialog, lightRole: 'always', glowMode: 'fixed', display: 'icon_ripple' };
    c.requestUpdate(); await c.updateComplete;
    await new Promise((r) => setTimeout(r, 60));
    const dlg = sr().querySelector('hp-dialog[data-kind="marker"]');
    dlg.querySelector('[data-section-target=details]').click(); c.requestUpdate(); await c.updateComplete;
    const surface = dlg.shadowRoot.querySelector('.surface');
    const content = dlg.shadowRoot.querySelector('.content');
    const body = dlg.querySelector('.body');
    const sw = Math.round(surface.getBoundingClientRect().width);
    const expected = w >= 600 ? sw === 610 : w > 480 ? sw <= Math.round(w * 0.94) + 1 : sw === w;
    const noHorizontal = content.scrollWidth <= content.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1;
    const grid = dlg.querySelector('.hpf-card[data-card="details"] .hpf-grid');
    const layout = { container: grid.getBoundingClientRect().toJSON(), fields:
      ['#marker-model', '#marker-link'].map((id) => {
        const control = dlg.querySelector(id);
        return { field: control.closest('.hpf-field').getBoundingClientRect().toJSON(),
          control: control.getBoundingClientRect().toJSON() };
      }) };
    const footer = dlg.querySelector('.dialog-action-footer');
    const footerVisible = footer.getBoundingClientRect().bottom <= innerHeight + 1;
    const segFits = [...dlg.querySelectorAll('.hpf-seg label')].every((l) => {
      const b = l.getBoundingClientRect(); return b.right <= content.getBoundingClientRect().right + 1;
    });
    c._markerDialog = null; c.requestUpdate(); await c.updateComplete;
    return { sw, expected, noHorizontal, layout, footerVisible, segFits };
  }, width);
  bands[`w${width}_surfaceWidth`] = m.expected;
  bands[`w${width}_noHorizontalScroll`] = m.noHorizontal;
  bands[`w${width}_footerVisible`] = m.footerVisible;
  console.log('device stacked layout', JSON.stringify({ width, ...m.layout }));
  for (const [name, pass] of Object.entries(stackedFieldChecks(m.layout))) {
    bands[`w${width}_details_${name}`] = pass;
  }
  bands[`w${width}_segmentsFit`] = m.segFits;
}

checkAll(out);
checkAll(bands);
await finish(browser, { ...out, ...bands });
