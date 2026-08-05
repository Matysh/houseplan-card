// Живой текст в декоре (docs/LIVE-TEXT.md): все связи с HA живут прямо в
// тексте как {entity} / {entity:attribute}. Один блок может смешивать обычный
// текст и несколько переменных; выбор значения вставляет токен в позицию
// курсора. Старые entity/attr/unit читаются, но первое сохранение мигрирует их.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** текст фигуры в DOM, склеенный из строк (tspan) */
  const dom = (id) => {
    const el = sr().querySelector(`.decorlayer text.dtext[data-id="${id}"]`);
    if (!el) return null;
    return [...el.querySelectorAll('tspan')].map((t) => t.textContent).join('\n');
  };
  /** открыть форму существующей надписи (на старой сборке — двойным щелчком) */
  const open = (sh) => (c._decorOpenText ? c._decorOpenText(sh) : c._decorShapeDbl(sh));
  /** подменить одно состояние — ровно так, как HA присылает новый hass */
  const push = async (id, st) => {
    const states = { ...c.hass.states };
    if (st === null) delete states[id]; else states[id] = st;
    c.hass = { ...c.hass, states };
    await c.updateComplete;
  };

  sr().querySelectorAll('.modetab')[2].click(); await c.updateComplete;
  out.decorMode = c._mode === 'decor';
  c._curSpaceCfg.decor = [];

  // ---------- 1. несколько inline-переменных и обычная надпись -------------
  c._decorTextDialog = { x: 0.3, y: 0.3,
    text: 'Бак {sensor.living_temp}; LQI {sensor.living_temp:linkquality}',
    color: '#112233' };
  c._decorSaveText(); await c.updateComplete;
  const live = c._decorList.find((x) => x.kind === 'text');
  out.onlyTextStored = !('entity' in live) && !('attr' in live) && !('unit' in live);
  out.templateStoredRaw = live.text ===
    'Бак {sensor.living_temp}; LQI {sensor.living_temp:linkquality}';
  out.multipleValuesRendered = dom(live.id) === 'Бак 22.4 °C; LQI 154';

  c._decorTextDialog = { x: 0.6, y: 0.3, text: 'Сауна', color: '#112233' };
  c._decorSaveText(); await c.updateComplete;
  const plain = c._decorList.find((x) => x.text === 'Сауна');
  out.plainUntouched = dom(plain.id) === 'Сауна' && !('entity' in plain);

  // ---------- 2. значение живое: новый hass — новый текст -------------------
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: '23.9',
    attributes: { unit_of_measurement: '°C', linkquality: 154 } });
  out.updatesOnState = dom(live.id) === 'Бак 23.9 °C; LQI 154';
  out.plainStillUntouched = dom(plain.id) === 'Сауна';
  // как отдаёт HA: ни округления, ни переформатирования
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: '23.94781',
    attributes: { unit_of_measurement: '°C', linkquality: 154 } });
  out.noRounding = dom(live.id) === 'Бак 23.94781 °C; LQI 154';

  // ---------- 3. мёртвая сущность — прочерк, шаблон остаётся ---------------
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: 'unavailable',
    attributes: { unit_of_measurement: '°C' } });
  out.deadIsDash = dom(live.id) === 'Бак —; LQI —';
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: 'unknown', attributes: {} });
  out.unknownIsDash = dom(live.id) === 'Бак —; LQI —';
  await push('sensor.living_temp', null);
  out.missingIsDash = dom(live.id) === 'Бак —; LQI —';
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: '22.4',
    attributes: { unit_of_measurement: '°C', linkquality: 154 } });
  out.backAlive = dom(live.id) === 'Бак 22.4 °C; LQI 154';

  // ---------- 4. picker вставляет полный токен ровно в позицию курсора ------
  c._decorTextDialog = { x: 0.45, y: 0.45, text: 'До после', color: '#112233',
    pickerEntity: 'sensor.living_temp' };
  c._decorTextSelection = { start: 3, end: 3 };
  c._decorInsertLiveVariable('linkquality'); await c.updateComplete;
  out.insertedAtCaret = c._decorTextDialog.text ===
    'До {sensor.living_temp:linkquality}после';
  c._decorSaveText(); await c.updateComplete;
  const inserted = c._decorList.find((x) => x.text?.startsWith('До '));
  out.insertedRenders = dom(inserted.id) === 'До 154после';

  // ---------- 5. ручная dotted-форма и отсутствующий атрибут ---------------
  c._decorTextDialog = { x: 0.55, y: 0.55,
    text: '{sensor.living_temp.linkquality} / {sensor.living_temp:nope}',
    color: '#112233' };
  c._decorSaveText(); await c.updateComplete;
  const manual = c._decorList.find((x) => x.text?.includes(':nope'));
  out.manualTokensWork = dom(manual.id) === '154 / —';

  // ---------- 6. старая связка мигрирует при первом редактировании ----------
  const legacy = { id: 'legacy_live', kind: 'text', x: 0.7, y: 0.7,
    text: 'Старый {}', color: '#112233', entity: 'sensor.living_temp' };
  c._curSpaceCfg.decor = [...c._decorList, legacy];
  c.requestUpdate(); await c.updateComplete;
  out.legacyStillRenders = dom(legacy.id) === 'Старый 22.4 °C';
  open(legacy); await c.updateComplete;
  out.legacyOpensAsToken = c._decorTextDialog?.text ===
    'Старый {sensor.living_temp}';
  c._decorSaveText(); await c.updateComplete;
  const migrated = c._decorList.find((x) => x.id === legacy.id);
  out.legacyMigrated = !('entity' in migrated)
    && migrated.text === 'Старый {sensor.living_temp}'
    && dom(legacy.id) === 'Старый 22.4 °C';

  // ---------- 7. просмотр и киоск рисуют то же самое ------------------------
  const editorText = dom(live.id);
  c._setMode('view'); await c.updateComplete; await sleep(60);
  out.sameInViewMode = dom(live.id) === editorText
    && editorText === 'Бак 22.4 °C; LQI 154';

  const kiosk = document.createElement('houseplan-card');
  kiosk.setConfig({ type: 'custom:houseplan-card', kiosk: true });
  kiosk.hass = c.hass;
  document.body.appendChild(kiosk);
  await kiosk.updateComplete; await sleep(400); await kiosk.updateComplete;
  const kr = kiosk.shadowRoot || kiosk.renderRoot;
  const kEl = kr.querySelector(`.decorlayer text.dtext[data-id="${live.id}"]`);
  out.sameInKiosk = !!kEl
    && [...kEl.querySelectorAll('tspan')].map((t) => t.textContent).join('\n') === editorText;
  kiosk.remove();

  // ---------- 8. round-trip хранит только текстовый шаблон ------------------
  const sent = [];
  const ws = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async (m) => { sent.push(m); return ws(m); } };
  c._setMode('decor'); await c.updateComplete;
  open(c._decorList.find((x) => x.id === live.id)); await c.updateComplete;
  c._decorSaveText();
  await sleep(900);
  const set = sent.filter((m) => m.type === 'houseplan/config/set').pop();
  const shape = set && (set.config.spaces.find((s) => s.id === c._space).decor || [])
    .find((x) => x.id === live.id);
  out.roundTrip = !!shape && !('entity' in shape) && !('attr' in shape) && !('unit' in shape)
    && shape.text === 'Бак {sensor.living_temp}; LQI {sensor.living_temp:linkquality}';
  return out;
});
checkAll(res);
await finish(browser, res);
