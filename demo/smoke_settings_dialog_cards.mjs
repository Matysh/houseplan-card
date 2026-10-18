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
    'Information on the plan', 'Appearance and background', 'Room fills',
    'Light, Sun and Moon', 'Zigbee diagnostics', 'Backups and maintenance',
  ]);
  o.everyGeneralCardHasContent = cards().every(card => card.querySelector('.hpf-body > *'));
  sr().querySelector('[data-section-target="plan"]').click(); await c.updateComplete;
  const bg = sr().querySelector('hp-dialog select[name="gs-bg-mode"]');
  o.bgSelectHasNameAndOptions = !!bg?.getAttribute('aria-label') && bg.options.length === 2;
  const trigger=bg.closest('hp-settings-select').shadowRoot.querySelector('button');
  o.bgSelectTargetIsBigEnough=trigger.getBoundingClientRect().height>=42;
  trigger.focus();o.bgSelectTakesFocus=trigger.getRootNode().activeElement===trigger;
  const before = c._settingsDialog.bgMode;
  bg.value = before === 'daynight' ? 'static' : 'daynight';
  bg.dispatchEvent(new Event('change',{bubbles:true})); await c.updateComplete;
  o.bgSelectWritesItsOwnKey = c._settingsDialog.bgMode !== before && c._settingsDialog.northDeg === null;
  sr().querySelector('[data-section-target="sun"]').click(); await c.updateComplete;
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
