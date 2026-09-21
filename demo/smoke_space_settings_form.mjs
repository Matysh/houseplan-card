// #600, серия 1: диалог «Пространство» по референсу
// docs/design/600-settings-dialogs/ (§4 SPEC.md).
//
// Фокусный свидетель формы: состав карточек и отсутствие старой разметки (AC1),
// оболочка и три полосы экранов (AC2), запись каждого нового контрола в тот же
// ключ (AC3/К1), Save только при изменениях и вопрос при закрытии (AC6/К10),
// цели и семантика (AC9/К7). Существующие смоки записи полей продолжают жить
// своей жизнью — здесь проверяется то, чего до #600 не проверял никто.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 30)); };
  const dlg = () => sr().querySelector('hp-dialog[data-kind="space"]');
  const q = (sel) => dlg()?.querySelector(sel);
  const qa = (sel) => [...(dlg()?.querySelectorAll(sel) || [])];
  const saveBtn = () => q('[data-hp="dialog-confirm"]');
  const statusText = () => q('.hpf-status')?.textContent.trim() || '';

  c._setMode('view');
  c._openSpaceDialog('edit', c._space);
  await upd();
  const d0 = c._spaceDialog;

  // --- AC1: карточки по §4.2, старой разметки нет ---------------------------
  o.fourCardsInOrder = JSON.stringify(qa('.hpf-card').map((card) => card.dataset.card))
    === JSON.stringify(['basics', 'appearance', 'room-cards', 'sun']);
  o.everyCardHasHeadingAndBody = qa('.hpf-card').every((card) =>
    card.querySelector(':scope > .hpf-head h3')?.textContent.trim() && card.querySelector(':scope > .hpf-body'));
  o.noLegacyMarkup = qa('.rhint, .srcrow, .dispsection, fieldset, .helpfieldlabel, .colorrow.gsrow').length === 0;
  o.badgeShowsSpaceTitle = dlg().badge === d0.title.trim() && !!dlg().shadowRoot.querySelector('.badge');
  o.previewKeptInsideCard = !!q('.hpf-card[data-card="room-cards"] .hpf-preview');
  o.subsectionsPresent = qa('.hpf-sub h4').length === 3; // Floor plan · Room fill · Visible layers
  o.redundantBasicsHintsRemoved = !q('#space-title')?.closest('.hpf-field')?.querySelector('.hpf-hint')
    && !q('#space-cell-cm')?.closest('.hpf-field')?.querySelector('.hpf-hint');

  // --- AC2: оболочка — 560, один скроллер --------------------------------
  const shell = dlg().shadowRoot;
  const surface = shell.querySelector('.surface');
  const content = shell.querySelector('.content');
  const body = q('.body');
  o.shellIs560 = dlg().hasAttribute('form-shell') && Math.round(surface.getBoundingClientRect().width) === 560;
  o.singleScroller = getComputedStyle(content).overflowY === 'auto'
    && getComputedStyle(body).overflowY === 'visible'
    && content.scrollHeight > content.clientHeight;
  o.bodyHasNoOwnMaxHeight = getComputedStyle(body).maxHeight === 'none';

  // --- AC9: цели ≥ 44, семантика ------------------------------------------
  const toggles = qa('.hpf-toggle > input[type="checkbox"]');
  o.togglesArePresent = toggles.length >= 6; // borders, 3 layers, names, glow
  o.toggleTargetsAre44 = toggles.every((i) => { const b = i.getBoundingClientRect(); return b.width >= 44 && b.height >= 44; });
  o.switchPartsAreGeometricallyCentered = toggles.every((input) => {
    const track = getComputedStyle(input, '::before');
    const knob = getComputedStyle(input, '::after');
    const center = input.getBoundingClientRect().height / 2;
    return Math.abs(parseFloat(track.top) + parseFloat(track.height) / 2 - center) < 0.6
      && Math.abs(parseFloat(knob.top) - center) < 0.6;
  });
  o.compactLayerSwitchesAlignWithTheirRows = qa('.hpf-compact-list .hpf-toggle').every((row) => {
    const inputBox = row.querySelector('input').getBoundingClientRect();
    const titleBox = row.querySelector('.hpf-toggle-title').getBoundingClientRect();
    return Math.abs((inputBox.top + inputBox.bottom - titleBox.top - titleBox.bottom) / 2) <= 1;
  });
  o.segmentsAreRadiogroups = qa('.hpf-seg').length === 3 && qa('.hpf-seg').every((s) => s.getAttribute('role') === 'radiogroup' && s.getAttribute('aria-label'));
  o.tilesAreAGroupOfCheckboxes = q('.hpf-tiles')?.getAttribute('role') === 'group' && qa('.hpf-tiles input[type="checkbox"]').length === 4;
  o.segmentLabelsAre38 = qa('.hpf-seg label').every((l) => l.getBoundingClientRect().height >= 38);

  // --- К10: Save только при изменениях -------------------------------------
  o.saveDisabledWhenClean = saveBtn().disabled === true && statusText() === '';
  q('#space-show-borders').click(); await upd();
  o.toggleWritesShowBorders = c._spaceDialog.showBorders === !d0.showBorders && c._spaceDialog.showNames === d0.showNames;
  // #602: доступная Save уже выражает dirty-state; дублирующей строки нет.
  o.saveEnabledWhenDirtyWithoutDuplicateStatus = saveBtn().disabled === false && statusText() === '';
  q('#space-show-borders').click(); await upd();
  o.saveDisabledAgainWhenReverted = saveBtn().disabled === true && statusText() === '';

  // --- К1: каждый новый контрол пишет в свой ключ ---------------------------
  const seg = (name, value) => qa(`input[name="${name}"]`).find((r) => r.closest('label').textContent.includes(value)) || null;
  const fillBefore = c._spaceDialog.fillMode;
  const tempRadio = qa('input[name="space-fill-mode"]').find((r) => !r.checked);
  tempRadio.click(); await upd();
  o.fillSegmentWritesFillMode = c._spaceDialog.fillMode !== fillBefore && c._spaceDialog.zeroWallStyle === d0.zeroWallStyle;
  c._spaceDialog = { ...c._spaceDialog, fillMode: 'temp' }; await upd();
  o.tempRangeAppearsForTemp = !!q('#space-temp-min') && !!q('#space-temp-max');
  q('#space-temp-max').value = '10'; q('#space-temp-max').dispatchEvent(new Event('input', { bubbles: true })); await upd();
  o.tempRangeErrorBlocksSave = c._spaceDialog.tempMax === 10 && c._spaceDialog.tempMin > 10
    && saveBtn().disabled === true && !!q('.hpf-status .hpf-link')
    && /1/.test(q('.hpf-status .hpf-link').textContent)
    && q('#space-temp-max').getAttribute('aria-invalid') === 'true';
  q('.hpf-status .hpf-link').click(); await upd();
  o.reviewLinkFocusesFirstProblem = (sr().activeElement ?? document.activeElement)?.id === 'space-temp-max';
  c._spaceDialog = { ...c._spaceDialog, fillMode: d0.fillMode, tempMax: d0.tempMax }; await upd();

  const tile = q('#space-tile-labelTemp');
  const namesOn = c._spaceDialog.showNames;
  if (!namesOn) { q('#space-show-names').click(); await upd(); }
  q('#space-tile-labelTemp').click(); await upd();
  o.tileWritesLabelTemp = c._spaceDialog.labelTemp === !d0.labelTemp && c._spaceDialog.labelHum === d0.labelHum;
  q('#space-show-names').click(); await upd();
  o.tilesDisabledWithoutNames = c._spaceDialog.showNames === false
    && qa('.hpf-tiles input').every((i) => i.disabled) && !!q('.hpf-callout .hpf-link');
  q('.hpf-callout .hpf-link').click(); await upd();
  o.calloutLinkTurnsNamesOn = c._spaceDialog.showNames === true;
  void tile;

  const opacityInput = q('.hpf-card[data-card="appearance"] .hpf-colorrow .hpf-opacity input');
  opacityInput.value = '100'; opacityInput.dispatchEvent(new Event('input', { bubbles: true })); await upd();
  o.opacity100FitsTheNumberField = opacityInput.value === '100' && opacityInput.clientWidth >= 60;
  opacityInput.value = '25'; opacityInput.dispatchEvent(new Event('input', { bubbles: true })); await upd();
  o.opacityNumberWritesRoomOpacity = Math.abs(c._spaceDialog.roomOpacity - 0.25) < 1e-9 && c._spaceDialog.roomColor === d0.roomColor;
  o.hexIsPrinted = q('.hpf-card[data-card="appearance"] .hpf-colorrow .hpf-hex')?.textContent === d0.roomColor.toUpperCase();
  o.noNativeColorInputs = qa('input[type="color"]').length === 0;

  const northSelect = q('#space-north-mode');
  northSelect.value = 'custom'; northSelect.dispatchEvent(new Event('change', { bubbles: true })); await upd();
  o.northCustomShowsDegrees = c._spaceDialog.northDeg !== null && !!q('#space-north-deg') && !!q('.hpf-compass');
  q('#space-north-deg').value = '400'; q('#space-north-deg').dispatchEvent(new Event('input', { bubbles: true })); await upd();
  o.northOutOfRangeIsAProblem = saveBtn().disabled === true && q('#space-north-deg').getAttribute('aria-invalid') === 'true';
  q('#space-north-deg').value = '90'; q('#space-north-deg').dispatchEvent(new Event('input', { bubbles: true })); await upd();
  o.northWritesDegrees = c._spaceDialog.northDeg === 90
    && q('.hpf-compass svg').style.transform === 'rotate(90deg)';
  const sunOff = qa('input[name="space-sun-rays"]').find((r) => r.closest('label').textContent.includes(c._t('space.sun_off')));
  sunOff.click(); await upd();
  o.sunRadioWritesFalse = c._spaceDialog.sunRays === false;

  // Reset to 100% disabled at 100, enabled after change, restores 1
  const resetLink = [...qa('.hpf-headline .hpf-link')][0];
  const cardFontRange = q('#space-card-font').closest('.hpf-range');
  const sliderBox = cardFontRange.querySelector('ha-slider, input[type="range"]').getBoundingClientRect();
  const endsBox = cardFontRange.nextElementSibling.querySelector('.hpf-range-ends-track').getBoundingClientRect();
  o.fontScaleEndsMatchTheSlider = Math.abs(sliderBox.left - endsBox.left) <= 1
    && Math.abs(sliderBox.right - endsBox.right) <= 1
    && endsBox.bottom <= cardFontRange.nextElementSibling.getBoundingClientRect().bottom + 1;
  o.resetDisabledAt100 = resetLink.disabled === true;
  c._spaceDialog = { ...c._spaceDialog, cardFontScale: 1.5 }; await upd();
  [...qa('.hpf-headline .hpf-link')][0].click(); await upd();
  o.resetRestores100 = c._spaceDialog.cardFontScale === 1;

  // --- К10: закрытие с изменениями спрашивает -------------------------------
  o.stillDirty = saveBtn().disabled === false;
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  const confirm = () => sr().querySelector('hp-confirm hp-dialog');
  o.discardAsksFirst = !!confirm() && !!dlg();
  const confirmFooter = confirm()?.querySelector('.danger-confirm-footer');
  const confirmButtons = [...(confirmFooter?.querySelectorAll('button') || [])].map((button) => button.getBoundingClientRect());
  o.discardActionsShareOneRow = confirmButtons.length === 2
    && Math.abs(confirmButtons[0].top - confirmButtons[1].top) <= 1
    && confirmFooter.scrollWidth <= confirmFooter.clientWidth + 1;
  confirm()?.querySelector('[data-hp="dialog-cancel"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.keepEditingKeepsDialog = !!dlg() && !confirm() && c._spaceDialog !== null;
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  confirm()?.querySelector('[data-hp="dialog-confirm"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.discardCloses = !dlg() && c._spaceDialog === null;

  // Без изменений — закрывается сразу, без вопроса.
  c._openSpaceDialog('edit', c._space); await upd();
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  o.cleanClosesImmediately = !dlg() && !confirm() && c._spaceDialog === null;

  // Create-режим: та же форма, без Copy/Delete, Save заблокирован до имени
  c._openSpaceDialog('create'); await upd();
  o.createHasNoCopyDelete = !!dlg() && !q('.dialog-action-danger') && qa('.hpf-card').length === 4;
  o.createSaveBlockedUntilTitle = saveBtn().disabled === true;
  c._spaceDialog = null; await upd();
  return o;
});

// --- AC2: три полосы экранов ------------------------------------------------
const bands = {};
for (const width of [320, 390, 480, 560, 768, 1280, 1920]) {
  await page.setViewportSize({ width, height: 900 });
  const m = await page.evaluate(async (w) => {
    const c = window.__card;
    const sr = () => c.shadowRoot || c.renderRoot;
    c._spaceDialog = null; c.requestUpdate(); await c.updateComplete;
    c._openSpaceDialog('edit', c._space); c.requestUpdate(); await c.updateComplete;
    await new Promise((r) => setTimeout(r, 60));
    const dlg = sr().querySelector('hp-dialog[data-kind="space"]');
    const surface = dlg.shadowRoot.querySelector('.surface');
    const content = dlg.shadowRoot.querySelector('.content');
    const body = dlg.querySelector('.body');
    const sw = Math.round(surface.getBoundingClientRect().width);
    const expected = w >= 600 ? sw === 560 : w > 480 ? sw <= Math.round(w * 0.94) + 1 : sw === w;
    const noHorizontal = content.scrollWidth <= content.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1;
    const tiles = getComputedStyle(dlg.querySelector('.hpf-tiles')).gridTemplateColumns.split(' ').length;
    const gridCols = getComputedStyle(dlg.querySelector('.hpf-grid')).gridTemplateColumns.split(' ').length;
    const footer = dlg.querySelector('.dialog-action-footer');
    const footerVisible = footer.getBoundingClientRect().bottom <= innerHeight + 1;
    c._spaceDialog = null; c.requestUpdate(); await c.updateComplete;
    return { sw, expected, noHorizontal, tiles, gridCols, footerVisible };
  }, width);
  bands[`w${width}_surfaceWidth`] = m.expected;
  bands[`w${width}_noHorizontalScroll`] = m.noHorizontal;
  bands[`w${width}_footerVisible`] = m.footerVisible;
  bands[`w${width}_tilesColumns`] = m.tiles === (width <= 480 ? 2 : 4);
  bands[`w${width}_basicsColumns`] = m.gridCols === (width <= 480 ? 1 : 2);
}

checkAll(out);
checkAll(bands);
await finish(browser, { ...out, ...bands });
