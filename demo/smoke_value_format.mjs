// Значения форматирует HOME ASSISTANT (docs/STYLING-HOOKS.md §6, docs/LIVE-TEXT.md §2.1).
// Везде, где карточка печатает состояние ОДНОЙ сущности, она зовёт
// hass.formatEntityState (и hass.formatEntityAttributeValue для атрибута) —
// значит, работают display_precision, локальный разделитель дробной части и
// переводы состояний, а единица не дублируется.
//   1) бейдж display:'value' — «68,4 %» вместо сырых «68.42 %»;
//   2) живой текст декора — то же, плюс перевод 'on' → «Включено»;
//   3) своя единица заменяет единицу форматтера, а не приписывается к ней;
//   4) атрибут идёт через СВОЙ форматтер, а не через форматтер состояния;
//   5) старый HA без форматтера — прежнее поведение слово в слово;
//   6) плашки °/% остаются нашими: это производное значение, а не состояние.
// ПАДАЕТ на сборке до этих правок: бейдж и живой текст печатают сырое
// состояние, 'on' остаётся 'on', а своя единица приписывается к чужой.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const base = window.__mkHass();

  // ---- сущности стенда: датчик с «лишними» знаками и выключатель ----
  const EXTRA = {
    'sensor.tank': { entity_id: 'sensor.tank', state: '68.42',
      attributes: { friendly_name: 'Бак', unit_of_measurement: '%' } },
    'switch.pump': { entity_id: 'switch.pump', state: 'on',
      attributes: { friendly_name: 'Насос' } },
    'climate.hall': { entity_id: 'climate.hall', state: 'heat',
      attributes: { friendly_name: 'Котёл', current_temperature: 21.53, unit_of_measurement: '°C' } },
  };
  // Стаб ровно того, что делает HA: display_precision = 1, русская локаль
  // (запятая), перевод состояний и единица ВНУТРИ результата.
  const haFormat = (st) => {
    if (st.state === 'on') return 'Включено';
    if (st.state === 'off') return 'Выключено';
    if (st.state === 'heat') return 'Нагрев';
    if (st.state === 'locked') return 'Заперто';
    const n = Number(st.state);
    if (!Number.isFinite(n)) return st.state;
    const txt = n.toFixed(1).replace('.', ',');
    const u = st.attributes?.unit_of_measurement;
    return u ? `${txt} ${u}` : txt;
  };
  const haAttr = (st, a) => String(st.attributes?.[a]).replace('.', ',');
  const mk = (withFormatter) => {
    const h = {
      ...base,
      states: { ...base.states, ...EXTRA },
      entities: { ...base.entities,
        'sensor.tank': { entity_id: 'sensor.tank', platform: 'demo' },
        'switch.pump': { entity_id: 'switch.pump', platform: 'demo' },
        'climate.hall': { entity_id: 'climate.hall', platform: 'demo' } },
    };
    if (withFormatter) { h.formatEntityState = haFormat; h.formatEntityAttributeValue = haAttr; }
    else { delete h.formatEntityState; delete h.formatEntityAttributeValue; }
    return h;
  };
  const apply = async (withFormatter) => {
    c.hass = mk(withFormatter);
    c._regSignature = ''; c._cfgEpoch++; c._maybeRebuildDevices(); c.requestUpdate();
    await c.updateComplete; await sleep(60); await c.updateComplete;
  };

  // ================= 1. бейдж «значение вместо значка» =================
  c._serverCfg = { ...c._serverCfg, markers: [
    { id: 'm_tank', binding: 'entity:sensor.tank', space: c._space, display: 'value' },
  ] };
  await apply(true);
  const badge = () => sr().querySelector('[data-hp="device"][data-id="m_tank"] .valtext');
  out.badgeRendered = !!badge();
  out.badgeIsHaFormatted = badge()?.textContent.trim() === '68,4 %';
  out.badgeUnitNotDoubled = !/%\s*%/.test(badge()?.textContent || '');
  // старый HA без форматтера — ровно прежняя строка
  await apply(false);
  out.badgeFallsBackToRawState = badge()?.textContent.trim() === '68.42 %';
  await apply(true);

  // ================= 2. живой текст декора =================
  c._curSpaceCfg.decor = [
    { id: 'lt_val', kind: 'text', x: 0.2, y: 0.92, text: 'Бак {}', color: '#123456', entity: 'sensor.tank' },
    { id: 'lt_unit', kind: 'text', x: 0.5, y: 0.92, text: '{}', color: '#123456', entity: 'sensor.tank', unit: 'проц.' },
    { id: 'lt_state', kind: 'text', x: 0.8, y: 0.92, text: 'Насос: {}', color: '#123456', entity: 'switch.pump' },
    { id: 'lt_attr', kind: 'text', x: 0.2, y: 0.96, text: '{}', color: '#123456', entity: 'climate.hall', attr: 'current_temperature' },
    { id: 'lt_attru', kind: 'text', x: 0.5, y: 0.96, text: '{}', color: '#123456', entity: 'climate.hall', attr: 'current_temperature', unit: '°C' },
  ];
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  const txt = (id) => sr().querySelector(`text.dtext[data-id="${id}"]`)?.textContent.trim();
  out.liveTextIsHaFormatted = txt('lt_val') === 'Бак 68,4 %';
  out.liveTextUnitNotDoubled = txt('lt_val') === 'Бак 68,4 %' && !/%\s*%/.test(txt('lt_val'));
  out.liveTextOwnUnitReplacesTheFormatters = txt('lt_unit') === '68,4 проц.';
  out.liveTextStateIsTranslated = txt('lt_state') === 'Насос: Включено';
  // атрибут идёт через СВОЙ форматтер: иначе тут было бы «Нагрев»
  out.attrUsesTheAttributeFormatter = txt('lt_attr') === '21,53';
  out.attrDoesNotInheritTheEntityUnit = txt('lt_attr') === '21,53';
  out.attrTakesAnExplicitUnit = txt('lt_attru') === '21,53 °C';
  // без форматтера — прежнее поведение слово в слово
  await apply(false);
  out.liveTextFallsBackToRawState = txt('lt_val') === 'Бак 68.42 %';
  out.liveTextFallbackTranslatesNothing = txt('lt_state') === 'Насос: on';
  out.attrFallsBackToTheRawAttribute = txt('lt_attr') === '21.53';
  await apply(true);

  // ================= 3. инфо-карточка =================
  const dev = c._devices.find((d) => d.primary === 'lock.front_door');
  c._infoCard = dev; c.requestUpdate(); await c.updateComplete;
  const rowVals = [...sr().querySelectorAll('.entlist .entrow')]
    .map((r) => r.querySelector('.entbtn, .ev')?.textContent.trim());
  out.infoCardUsesTheFormatter = rowVals.includes('Заперто');
  out.infoCardPrintsNoRawState = !rowVals.includes('locked');
  c._infoCard = null; c.requestUpdate(); await c.updateComplete;

  // ================= 4. плашки °/% остались нашими =================
  // термометр в режиме «значение» по-прежнему показывает компактное «22.4°»:
  // это ПРОИЗВОДНОЕ показание (среднее по датчикам зоны / атрибут климата),
  // а не состояние одной сущности, и весь план читается как один прибор
  c._serverCfg = { ...c._serverCfg, markers: [
    { id: 'd_temp', binding: 'device:d_temp', display: 'value' },
  ] };
  await apply(true);
  const tempBadge = [...sr().querySelectorAll('.dev.valonly .valtext')].map((e) => e.textContent.trim());
  out.tempPlateKeepsItsCompactForm = tempBadge.includes('22.4°');
  return out;
});
checkAll(res);
await finish(browser, res);
