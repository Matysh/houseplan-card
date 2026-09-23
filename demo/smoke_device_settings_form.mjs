// #600, серия 4: «Устройство на плане» по референсу docs/design/600-settings-dialogs/
// (§7 SPEC.md). Фокусный свидетель формы: состав карточек и отсутствие старой
// разметки (AC1), оболочка и полосы экранов (AC2), привязка сегментом и кнопкой
// выбора с «Show entities» внутри панели (Q8), «Ask for confirmation» только у
// действий (Q8), сегменты роли/свечения/стороны бейджа и плашки цвета (Q5),
// блок свечения отключается целиком с объяснением, Display preview целиком в
// блоке на тинте (Q3), размеры с числом, чипы источников, Save только при
// изменениях и вопрос при закрытии (AC6/К10), цели и семантика (AC9).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 30)); };
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

  // --- AC1: пять карточек по §7.1, старой разметки нет --------------------
  o.fiveCardsInOrder = JSON.stringify(qa('.hpf-card').map((card) => card.dataset.card))
    === JSON.stringify(['basics', 'tap', 'light', 'appearance', 'details']);
  o.noLegacyMarkup = qa('.srcrow, .namein, .areasel, .dropbtn, .droppanel, .candlist, fieldset, .markerlightgroup, .markerradios, '
    + '.colorrow, .habindingbanner, .bindsel, .bindharow, .entcheck, .ctrlchips, .ctrllist, .ctrlopt, .opl, .opv, .descin, .tempin, '
    + '.markerhelpfield, .markerhelplabel, .helpfieldlabel, .rhint, .markerlightdisabled, .markerlightwarning').length === 0;
  o.badgeShowsSpaceTitle = dlg().badge === c._spaceModelById(lamp.space)?.title && !!dlg().shadowRoot.querySelector('.badge');
  o.shellIs560 = dlg().hasAttribute('form-shell') && Math.round(dlg().shadowRoot.querySelector('.surface').getBoundingClientRect().width) === 560;
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
  o.roomIsASelectWithHint = !!q('#marker-room.hpf-select') && !!q('#marker-room')?.closest('.hpf-field')?.querySelector('.hpf-hint');

  // --- Tap action: подтверждение только у действий (Q8), чипы источников -----
  o.tapActionCardHasNoLargeHeading = !q('.hpf-card[data-card="tap"] > .hpf-head');
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

  // --- Light and glow: сегменты, блок свечения отключается целиком -----------
  o.roleIsASegmentWithAutoHint = qa('input[name="marker-light-role"]').length === 3
    && !!q('input[name="marker-light-role"]')?.closest('.hpf-seg[role="radiogroup"]')
    && (c._markerDialog.lightRole !== 'auto' || !!q('input[name="marker-light-role"]')?.closest('.hpf-field')?.querySelector('.hpf-hint'));
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

  // --- Appearance: иконка, display, бейдж, превью (Q3), размеры ----------------
  o.iconFieldHasPreview = !!q('#marker-icon') && !!q('.hpf-iconfield .hpf-iconpreview ha-icon');
  const pin = q('.iconauto .hpf-link');
  o.autoIconHintHasPinLink = !c._markerDialog.icon ? !!pin : true;
  if (pin) { pin.click(); await upd(); }
  o.pinWritesIcon = !!c._markerDialog.icon && c._markerDialog.icon === c._markerDialog.autoIcon && !!q('.hpf-iconclear');
  q('.hpf-iconclear').click(); await upd();
  o.clearResetsIcon = c._markerDialog.icon === '';
  o.displaySelectWithHint = !!q('#marker-display.hpf-select') && !!q('#marker-display')?.closest('.hpf-field')?.querySelector('.hpf-hint');
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

  // --- Details: Model и Link в ряд, описание, вложения ------------------------
  const modelBox = q('#marker-model').getBoundingClientRect();
  const linkBox = q('#marker-link').getBoundingClientRect();
  o.modelAndLinkInOneRow = Math.abs(modelBox.top - linkBox.top) < 2 && linkBox.left > modelBox.right;
  o.descriptionIsAKitTextarea = q('#marker-description')?.tagName === 'TEXTAREA' && q('#marker-description').classList.contains('hpf-input');
  o.attachInActions = !!q('.hpf-card[data-card="details"] .hpf-actions .filebtn');
  const radarToggle = q('#marker-radar-presence');
  o.radarEntryIsAToggleInAdditionalActions = !!radarToggle
    && !!radarToggle.closest('.hpf-card[data-card="details"] .radaradditional')
    && !q('.hpf-card[data-card="basics"] .radargroup');
  if (radarToggle && !radarToggle.checked) { radarToggle.click(); await upd(); }
  const firstRadarDraft = c._markerDialog.radar;
  const firstInstallation = firstRadarDraft?.installationId;
  o.radarExpandsImmediatelyBelowToggle = !!firstRadarDraft && !c._markerDialog.radarRemove
    && !!q('#marker-radar-presence')?.closest('.radaradditional')?.querySelector(':scope > .radargroup')
    && !q('.hpf-card[data-card="basics"] .radargroup');
  q('#marker-radar-presence')?.click(); await upd();
  o.radarOffKeepsSessionDraft = c._markerDialog.radar === firstRadarDraft
    && c._markerDialog.radarRemove === true && !q('.radaradditional > .radargroup');
  q('#marker-radar-presence')?.click(); await upd();
  o.radarOnRestoresSessionDraft = c._markerDialog.radar === firstRadarDraft
    && c._markerDialog.radar?.installationId === firstInstallation
    && c._markerDialog.radarRemove === false && !!q('.radaradditional > .radargroup');
  input(q('#marker-model'), 'Model 600'); await upd();
  o.modelWritesOwnKey = c._markerDialog.model === 'Model 600' && c._markerDialog.link === d0.link;

  // --- AC9: цели ≥ 44 ---------------------------------------------------------
  o.toggleTargetsAre44 = qa('.hpf-toggle > input[type="checkbox"]').every((i) => { const b = i.getBoundingClientRect(); return b.width >= 44 && b.height >= 44; });
  o.segmentsAreRadiogroups = qa('.hpf-seg').length >= 4 && qa('.hpf-seg').every((s) => s.getAttribute('role') === 'radiogroup' && s.getAttribute('aria-label'));

  // --- К10: Save только при изменениях, вопрос при закрытии --------------------
  c._closeMarkerDialog(); await upd();
  c._openMarkerDialog(lamp); await upd();
  o.saveDisabledWhenClean = saveBtn().disabled === true && statusText() === '';
  const editName0 = c._markerDialog.name;
  input(q('#marker-name'), `${editName0} x`); await upd();
  o.saveEnabledWhenDirtyWithoutDuplicateStatus = saveBtn().disabled === false && statusText() === '';
  input(q('#marker-name'), editName0); await upd();
  o.cleanAgainWhenReverted = saveBtn().disabled === true && statusText() === '';
  input(q('#marker-name'), `${editName0} staged`); await upd();
  const runtime = c._editorRuntime;
  const saveMarker = runtime._saveMarker;
  runtime._saveMarker = async () => undefined;
  saveBtn().click(); await upd();
  runtime._saveMarker = saveMarker;
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
    && !!q('.hpf-card[data-card="basics"] .hpf-error') && q('#marker-binding').getAttribute('aria-expanded') === 'true';
  q('.hpf-status .hpf-link').click(); await upd();
  o.reviewLinkFocusesBinding = (sr().activeElement ?? document.activeElement)?.id === 'marker-binding';
  await pickSeg('bmode', 'virtual');
  o.createVirtualHasHint = c._markerDialog.binding === 'virtual' && saveBtn().disabled === true
    && !!q('input[name="bmode"]')?.closest('.hpf-field')?.querySelector('.hpf-hint');
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
    const surface = dlg.shadowRoot.querySelector('.surface');
    const content = dlg.shadowRoot.querySelector('.content');
    const body = dlg.querySelector('.body');
    const sw = Math.round(surface.getBoundingClientRect().width);
    const expected = w >= 600 ? sw === 560 : w > 480 ? sw <= Math.round(w * 0.94) + 1 : sw === w;
    const noHorizontal = content.scrollWidth <= content.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1;
    const gridCols = getComputedStyle(dlg.querySelector('.hpf-card[data-card="details"] .hpf-grid')).gridTemplateColumns.split(' ').length;
    const footer = dlg.querySelector('.dialog-action-footer');
    const footerVisible = footer.getBoundingClientRect().bottom <= innerHeight + 1;
    const segFits = [...dlg.querySelectorAll('.hpf-seg label')].every((l) => {
      const b = l.getBoundingClientRect(); return b.right <= content.getBoundingClientRect().right + 1;
    });
    c._markerDialog = null; c.requestUpdate(); await c.updateComplete;
    return { sw, expected, noHorizontal, gridCols, footerVisible, segFits };
  }, width);
  bands[`w${width}_surfaceWidth`] = m.expected;
  bands[`w${width}_noHorizontalScroll`] = m.noHorizontal;
  bands[`w${width}_footerVisible`] = m.footerVisible;
  bands[`w${width}_detailsColumns`] = m.gridCols === (width <= 480 ? 1 : 2);
  bands[`w${width}_segmentsFit`] = m.segFits;
}

checkAll(out);
checkAll(bands);
await finish(browser, { ...out, ...bands });
