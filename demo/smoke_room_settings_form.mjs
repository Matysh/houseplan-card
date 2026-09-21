// #600, серия 3: «Настройки комнаты» по референсу docs/design/600-settings-dialogs/
// (§6 SPEC.md). Фокусный свидетель формы: состав карточек и отсутствие старой
// разметки (AC1), оболочка и полосы экранов (AC2), «Как у пространства»
// тумблером с сегментом от режима пространства (Q4), плашка цвета вокруг
// прежнего пикера (Q5), границы комфорта полями, кнопка выбора источника с
// панелью в потоке, размеры с числом и сбросом, образец карточки (Q2), Save
// только при изменениях и вопрос при закрытии (AC6/К10), цели и семантика (AC9).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 30)); };
  const dlg = () => sr().querySelector('hp-dialog[data-kind="room"]');
  const q = (sel) => dlg()?.querySelector(sel);
  const qa = (sel) => [...(dlg()?.querySelectorAll(sel) || [])];
  const saveBtn = () => q('.dialog-action-commit [data-hp="dialog-confirm"]');
  const statusText = () => q('.hpf-status')?.textContent.trim() || '';
  const input = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const change = (el) => el.dispatchEvent(new Event('change', { bubbles: true }));
  const spId = c._space;
  const setSpace = (settings) => {
    c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s
      : ({ ...s, settings: { ...(s.settings || {}), ...settings } })) };
  };
  setSpace({ fill_mode: 'light', show_names: true, card_font_scale: 1.2 });
  c._setMode('plan'); await upd();
  const room = c._curSpaceCfg.rooms[0];
  c._openRoomEdit(room); await upd();

  // --- AC1: четыре карточки по §6.1, старой разметки нет --------------------
  o.fourCardsInOrder = JSON.stringify(qa('.hpf-card').map((card) => card.dataset.card))
    === JSON.stringify(['basics', 'fill', 'sources', 'sizes']);
  o.basicsHasNoHeadingButKeepsFields = !q('.hpf-card[data-card="basics"] .hpf-head')
    && !!q('.hpf-card[data-card="basics"] #room-name')
    && !!q('.hpf-card[data-card="basics"] #room-area')
    && !!q('#room-area')?.closest('.hpf-field')?.querySelector('hp-help');
  o.noLegacyMarkup = qa('.srcrow, .namein, .areasel, .dropbtn, .droppanel, .candlist, .roomtemprange, .hpf-scale, .opv, fieldset').length === 0;
  o.badgeShowsSpaceTitle = dlg().badge === c._spaceModel().title && !!dlg().shadowRoot.querySelector('.badge');
  o.previewKept = !!q('.hpf-card[data-card="sizes"] .hpf-tint.hpf-preview .cardpreview'); // Q2
  const nameBox = q('#room-name').getBoundingClientRect();
  const areaBox = q('#room-area').getBoundingClientRect();
  o.basicsInOneRow = Math.abs(nameBox.top - areaBox.top) < 2 && areaBox.left > nameBox.right;
  o.everyCardHasHelp = qa('.hpf-card .hpf-head hp-help').length === 3 && !!q('#room-area')?.closest('.hpf-field')?.querySelector('hp-help'); // §6.1: у Basics «?» — у зоны

  // --- AC2: оболочка — 560, один скроллер -----------------------------------
  const shell = dlg().shadowRoot;
  o.shellIs560 = dlg().hasAttribute('form-shell') && Math.round(shell.querySelector('.surface').getBoundingClientRect().width) === 560;
  o.bodyHasNoOwnScroller = getComputedStyle(q('.body')).overflowY === 'visible' && getComputedStyle(q('.body')).maxHeight === 'none';

  // --- Q4: «Как у пространства» — тумблер; сегмент стартует с режима пространства
  const inherit = () => q('#room-fill-inherit');
  o.inheritIsAToggle = inherit()?.type === 'checkbox' && inherit().checked === true
    && !q('input[name="rfill"]') && !!q('.hpf-card[data-card="fill"] .hpf-hint');
  const toggleBox = inherit().getBoundingClientRect();
  o.toggleTargetIs44 = toggleBox.width >= 44 && toggleBox.height >= 44;
  inherit().checked = false; change(inherit()); await upd();
  o.segmentStartsAtSpaceMode = c._roomFill === 'light'
    && qa('input[name="rfill"]').length === 5
    && qa('input[name="rfill"]').find((r) => r.checked)?.value === 'light'
    && q('.hpf-seg[role="radiogroup"]') !== null;
  // Сегмент — радио с value режима (короткие подписи у lqi/custom из ленивого словаря)
  const pickMode = async (mode) => {
    const r = qa('input[name="rfill"]').find((x) => x.value === mode);
    r.checked = true; change(r); await upd();
  };
  // --- Q5: свой цвет — плашка вокруг прежнего hp-color-opacity ---------------
  await pickMode('custom');
  o.customShowsColorPlate = c._roomFill === 'custom' && !!q('.hpf-colorrow .hpf-colorfield hp-color-opacity[hide-label]')
    && !!q('.hpf-colorfield .hpf-hex') && qa('input[type="color"]').length === 0
    && !q('.hpf-colorfield .hpf-link'); // Reset появляется только у своего цвета
  input(q('.hpf-colorfield .hpf-opacity input'), '45'); await upd();
  o.opacityWritesOwnColour = c._roomCustomFill !== null && Math.abs(c._roomCustomFill.a - 0.45) < 1e-9
    && !!q('.hpf-colorfield .hpf-link');
  q('.hpf-colorfield .hpf-link').click(); await upd();
  o.resetForgetsOwnColour = c._roomCustomFill === null;
  // --- границы комфорта: два поля с единицей, легенда, ссылка «Как у пространства»
  await pickMode('temp');
  o.tempRangeIsTwoUnitFields = c._roomCustomFill === null && !!q('#room-temp-min') && !!q('#room-temp-max')
    && qa('.hpf-temprange .hpf-unit').length === 2 && !!q('.hpf-templegend')
    && !q('.hpf-temprange .hpf-link');
  input(q('#room-temp-min'), '30'); input(q('#room-temp-max'), '10'); await upd();
  // перевёрнутый диапазон валиден — границы меняются местами при чтении (roomTempThresholdDraft)
  o.typedBoundsWriteOwnKeys = c._roomTempMin === '30' && c._roomTempMax === '10' && saveBtn().disabled === false;
  // нечисло в поле type=number браузер не пропустит — ломаем черновик напрямую, как smoke_room_temperature_thresholds
  c._roomTempMin = 'broken'; await upd();
  o.brokenBoundBlocksSave = saveBtn().disabled === true && !!q('.hpf-temprange .hpf-error')
    && !!q('.hpf-status .hpf-link') && !!q('.hpf-temprange .hpf-link');
  q('.hpf-status .hpf-link').click(); await upd();
  o.reviewLinkFocusesFirstProblem = (sr().activeElement ?? document.activeElement)?.id === 'room-temp-min';
  q('.hpf-temprange .hpf-link').click(); await upd();
  o.resetRestoresInheritedBounds = c._roomTempMin === '' && c._roomTempMax === '' && !q('.hpf-temprange .hpf-error');
  inherit().checked = true; change(inherit()); await upd();
  o.inheritHidesSegmentAndShowsHint = c._roomFill === '' && !q('input[name="rfill"]') && !!q('.hpf-card[data-card="fill"] .hpf-hint')
    && !q('.hpf-temprange');

  // --- источники: сегмент → кнопка выбора → панель в потоке --------------------
  c.hass = { ...c.hass, states: { ...c.hass.states, 'sensor.room_form_temp': { state: '21.5', attributes: { friendly_name: 'Form temp' } } },
    entities: { ...c.hass.entities, 'sensor.room_form_temp': {} } };
  await upd();
  const seg = (name) => qa(`input[name="${name}"]`);
  o.sourceSegmentsPresent = seg('rsrc-temp').length === 2 && seg('rsrc-hum').length === 2 && !q('.hpf-pick');
  seg('rsrc-temp')[1].checked = true; change(seg('rsrc-temp')[1]); await upd();
  const picker = () => q('.hpf-card[data-card="sources"] .hpf-picker');
  o.pickOpensPanelInFlow = !!picker() && !!q('#room-temp-source') && q('#room-temp-source').getAttribute('aria-expanded') === 'true'
    && !!picker().querySelector('.hpf-panel input.hpf-input') && qa('.hpf-cand[role="option"]').length > 0
    && q('.hpf-list')?.getAttribute('role') === 'listbox'
    && getComputedStyle(picker().querySelector('.hpf-panel')).position !== 'absolute';
  input(picker().querySelector('.hpf-panel input.hpf-input'), 'Form temp'); await upd();
  const cands = qa('.hpf-cand[role="option"]');
  o.filterNarrowsCandidates = cands.length >= 1 && cands.every((b) => b.textContent.includes('Form temp'));
  const humBefore = c._roomHumSrc;
  cands[0].click(); await upd();
  o.pickWritesTempSourceOnly = c._roomTempSrc === 'entity:sensor.room_form_temp' && c._roomHumSrc === humBefore
    && !q('.hpf-panel') && q('#room-temp-source')?.querySelector('b')?.textContent === 'Form temp'
    && q('#room-temp-source').getAttribute('aria-expanded') === 'false';
  q('#room-temp-source').click(); await upd();
  o.buttonReopensPanelWithSelection = !!q('.hpf-panel') && q('.hpf-cand.sel')?.getAttribute('aria-selected') === 'true';
  seg('rsrc-temp')[0].checked = true; change(seg('rsrc-temp')[0]); await upd();
  o.averageClearsSource = c._roomTempSrc === '' && !q('.hpf-pick');

  // --- размеры: слайдер + число + Reset to 100%, подсказка, образец ---------
  o.sizeRowsHaveNumberAndReset = !!q('#room-name-scale') && !!q('#room-label-scale')
    && qa('.hpf-card[data-card="sizes"] .hpf-headline .hpf-link').length === 2
    && qa('.hpf-card[data-card="sizes"] .hpf-headline .hpf-link').every((l) => l.disabled)
    && qa('.hpf-card[data-card="sizes"] .hpf-range-ends').length === 2
    && q('.hpf-card[data-card="sizes"] > .hpf-body > .hpf-hint')?.textContent.includes('120');
  input(q('#room-name-scale'), '150'); await upd();
  o.numberWritesNameScaleOnly = Math.abs(c._roomNameScale - 1.5) < 1e-9 && c._roomLabelScale === 1
    && qa('.hpf-card[data-card="sizes"] .hpf-headline .hpf-link')[0].disabled === false
    && qa('.hpf-card[data-card="sizes"] .hpf-headline .hpf-link')[1].disabled === true;
  qa('.hpf-card[data-card="sizes"] .hpf-headline .hpf-link')[0].click(); await upd();
  o.resetRestores100 = c._roomNameScale === 1;

  // --- К10: Save только при изменениях, вопрос при закрытии -------------------
  c._roomDialogCancel(); await upd();
  c._openRoomEdit(c._curSpaceCfg.rooms[0]); await upd();
  o.saveDisabledWhenClean = saveBtn().disabled === true && statusText() === '';
  input(q('#room-name'), `${c._nameSel} x`); await upd();
  o.saveEnabledWhenDirtyWithoutDuplicateStatus = saveBtn().disabled === false && statusText() === '';
  input(q('#room-name'), c._nameSel.slice(0, -2)); await upd();
  o.cleanAgainWhenReverted = saveBtn().disabled === true && statusText() === '';
  input(q('#room-name'), ''); await upd();
  o.emptyNameIsAProblem = saveBtn().disabled === true && !!q('#room-name[aria-invalid="true"]')
    && !!q('.hpf-card[data-card="basics"] .hpf-error') && !!q('.hpf-status .hpf-link');
  input(q('#room-name'), 'Room 600'); await upd();
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  const confirm = () => sr().querySelector('hp-confirm hp-dialog');
  o.discardAsksFirst = !!confirm() && !!dlg();
  o.discardLabelsAreShort = ['Продолжить', 'Continue', 'Fortfahren', 'Continuer']
    .includes(confirm()?.querySelector('[data-hp="dialog-cancel"]')?.textContent.trim())
    && ['Отменить', 'Discard', 'Verwerfen', 'Abandonner']
      .includes(confirm()?.querySelector('[data-hp="dialog-confirm"]')?.textContent.trim());
  confirm()?.querySelector('[data-hp="dialog-cancel"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.keepEditingKeepsDialog = !!dlg() && !confirm() && c._roomDialog === true && c._nameSel === 'Room 600';
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  confirm()?.querySelector('[data-hp="dialog-confirm"]')?.click(); await upd(); await new Promise((r) => setTimeout(r, 60));
  o.discardCloses = !dlg() && c._roomDialog === false && c._curSpaceCfg.rooms[0].name !== 'Room 600';
  c._openRoomEdit(c._curSpaceCfg.rooms[0]); await upd();
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  o.cleanClosesImmediately = !dlg() && !confirm();

  // --- create-режим: Keep as walls слева, Save без «грязи», отмена без вопроса
  c._tool = 'draw'; c._resetRoomDialogFields(); c._roomDialog = true; await upd();
  o.createHasKeepAsWallsOnLeft = (() => {
    const keep = qa('.dialog-action-footer .btn').find((b) => b.textContent.trim() === c._t('btn.keep_as_walls'));
    return !!keep && keep.getBoundingClientRect().left < saveBtn().getBoundingClientRect().left;
  })();
  o.createSaveBlockedUntilNameOrArea = saveBtn().disabled === true && !!q('.hpf-status .hpf-link');
  input(q('#room-name'), 'New 600'); await upd();
  o.createSaveEnabledWithName = saveBtn().disabled === false && statusText() === '';
  dlg().dispatchEvent(new CustomEvent('hp-close', { bubbles: true, composed: true }));
  await upd(); await new Promise((r) => setTimeout(r, 60));
  o.createCancelsWithoutAsking = !dlg() && !confirm() && c._roomDialog === false;
  return o;
});

// --- AC2: полосы экранов ------------------------------------------------------
const bands = {};
for (const width of [320, 390, 480, 560, 768, 1280, 1920]) {
  await page.setViewportSize({ width, height: 900 });
  const m = await page.evaluate(async (w) => {
    const c = window.__card;
    const sr = () => c.shadowRoot || c.renderRoot;
    c._roomDialogCancel(); c.requestUpdate(); await c.updateComplete;
    c._openRoomEdit(c._curSpaceCfg.rooms[0]); c._roomFill = 'temp'; c.requestUpdate(); await c.updateComplete;
    await new Promise((r) => setTimeout(r, 60));
    const dlg = sr().querySelector('hp-dialog[data-kind="room"]');
    const surface = dlg.shadowRoot.querySelector('.surface');
    const content = dlg.shadowRoot.querySelector('.content');
    const body = dlg.querySelector('.body');
    const sw = Math.round(surface.getBoundingClientRect().width);
    const expected = w >= 600 ? sw === 560 : w > 480 ? sw <= Math.round(w * 0.94) + 1 : sw === w;
    const noHorizontal = content.scrollWidth <= content.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1;
    const gridCols = getComputedStyle(dlg.querySelector('.hpf-card[data-card="basics"] .hpf-grid')).gridTemplateColumns.split(' ').length;
    const footer = dlg.querySelector('.dialog-action-footer');
    const footerVisible = footer.getBoundingClientRect().bottom <= innerHeight + 1;
    const segFits = [...dlg.querySelectorAll('.hpf-seg label')].every((l) => {
      const b = l.getBoundingClientRect(); return b.right <= content.getBoundingClientRect().right + 1;
    });
    c._roomDialogCancel(); c.requestUpdate(); await c.updateComplete;
    return { sw, expected, noHorizontal, gridCols, footerVisible, segFits };
  }, width);
  bands[`w${width}_surfaceWidth`] = m.expected;
  bands[`w${width}_noHorizontalScroll`] = m.noHorizontal;
  bands[`w${width}_footerVisible`] = m.footerVisible;
  bands[`w${width}_basicsColumns`] = m.gridCols === (width <= 480 ? 1 : 2);
  bands[`w${width}_segmentsFit`] = m.segFits;
}

checkAll(out);
checkAll(bands);
await finish(browser, { ...out, ...bands });
