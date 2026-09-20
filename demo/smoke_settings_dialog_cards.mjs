// #598: три диалога настроек собраны в карточки-группы. Свидетель отдельный, а
// не дописанный к существующим: девять смоков с `.srcrow` объявлены в ТЗ
// неприкосновенными (AC2), и правка любого из них стоила бы ревью опоры —
// отличить «свидетель поправлен под новую разметку» от «свидетель ослаблен под
// сломанный код» по диффу такого файла нельзя.
//
// Здесь проверяется то, чего раньше не проверял никто: состав карточек,
// клавиатура новых сегментов, размер цели и — главное — что два сообщения о
// СОСТОЯНИИ остались на виду, а не уехали под «?» заодно с пояснениями (К5).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const cards = () => [...sr().querySelectorAll('hp-dialog .hpf-card')];
  const headings = () => cards().map((card) => card.querySelector('.hpf-head h3')?.textContent.trim());

  // --- «Общие настройки»: карточки, сегмент фона, сообщение о состоянии ----
  c._openSettingsDialog(); await c.updateComplete;
  o.generalCardsInOrder = JSON.stringify(headings()) === JSON.stringify([
    c._t('gs.card_display'), c._t('gs.card_zigbee'), c._t('gs.card_fills'),
    c._t('gs.glow_group'), c._t('gs.card_plan'), c._t('gs.sun_group'), c._t('gs.card_data'),
  ]);
  o.everyGeneralCardHasContent = cards().every((card) => card.querySelector('.hpf-head + *'));

  // Сегмент фона: настоящая радиогруппа с доступным именем и целью ≥ 44 px.
  const bgSeg = sr().querySelector('hp-dialog .hpf-seg[role="radiogroup"]');
  const bgRadios = bgSeg ? [...bgSeg.querySelectorAll('input[type="radio"]')] : [];
  o.bgSegmentIsRadioGroup = !!bgSeg && !!bgSeg.getAttribute('aria-label') && bgRadios.length === 2;
  // Цель нажатия ≥ 44 px. Проверка нашла настоящий дефект: лист набора
  // подключается вызовом `ensureFormKitStyles`, и без него сегмент рисовался
  // высотой 14 px — вся доступность держалась на стиле, которого не было.
  o.bgSegmentTargetIsBigEnough = bgRadios.length > 0 && bgRadios.every((radio) => {
    const box = radio.closest('label')?.getBoundingClientRect();
    return !!box && box.height >= 44;
  });
  // Клавиатура: стрелка переводит выбор на соседний вариант, как в списке,
  // который сегмент заменил. Значение черновика обязано поехать следом.
  const bgBefore = c._settingsDialog.bgMode;
  const other = bgRadios.find((radio) => !radio.checked);
  other?.focus();
  o.bgSegmentTakesFocus = !!other && bgSeg.contains(sr().activeElement ?? document.activeElement);
  other?.click(); await c.updateComplete;
  o.bgSegmentWritesItsOwnKey = c._settingsDialog.bgMode !== bgBefore
    && c._settingsDialog.northDeg === null;

  // `gs.sun_missing` — сообщение о состоянии. Убираем sun.sun и требуем, чтобы
  // абзац был виден, а не спрятан под «?» (К5).
  const states = { ...c.hass.states };
  delete states['sun.sun'];
  c.hass = { ...c.hass, states };
  await c.updateComplete;
  // #600 §3.1: сообщение о состоянии — callout набора, а не абзац `.rhint`.
  const sunNote = [...sr().querySelectorAll('hp-dialog .hpf-callout')]
    .find((node) => node.textContent.trim() === c._t('gs.sun_missing'));
  o.sunMissingStaysVisible = !!sunNote && sunNote.getBoundingClientRect().height > 0
    && !sr().querySelector('hp-dialog hp-help[data-help-key="gs.sun_missing.help"]');
  c._settingsDialog = null; await c.updateComplete;

  // --- «Пространство»: карточки и три сегмента (стены, заливка, фон) -------
  c._openSpaceDialog('edit', c._space); await c.updateComplete;
  o.spaceCardsInOrder = JSON.stringify(headings()) === JSON.stringify([
    c._t('space.card_basics'), c._t('space.display_section'),
    c._t('space.roomcard_section'), c._t('space.card_sun'),
  ]);
  const spaceSegs = [...sr().querySelectorAll('hp-dialog .hpf-seg[role="radiogroup"]')];
  // #600 §4.2: стиль нулевых стен, режим заливки и фон плана — три сегмента.
  o.spaceHasThreeSegments = spaceSegs.length === 3
    && spaceSegs.every((seg) => !!seg.getAttribute('aria-label'));
  const zeroBefore = c._spaceDialog.zeroWallStyle;
  const titleBefore = c._spaceDialog.title;
  const zeroOther = [...sr().querySelectorAll('hp-dialog input[name="space-zero-wall-style"]')]
    .find((radio) => !radio.checked);
  zeroOther?.click(); await c.updateComplete;
  o.zeroWallSegmentWritesItsOwnKey = c._spaceDialog.zeroWallStyle !== zeroBefore
    && c._spaceDialog.title === titleBefore;
  c._spaceDialog = null; await c.updateComplete;

  return o;
});
await finish(browser, checkAll(out));
