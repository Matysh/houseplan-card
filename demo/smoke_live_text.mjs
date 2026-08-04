// Живой текст в декоре (docs/LIVE-TEXT.md): текстовая фигура может показывать
// значение ОДНОЙ сущности. Шаблон — поле text, место значения — {}; единица по
// умолчанию из сущности; мёртвая/отсутствующая сущность — прочерк «—»; ничего
// не округляем и не переформатируем. Смок проверяет, что значение читается
// живьём (новый hass — новый текст в DOM, без пересоздания карточки), что
// редактор и просмотр рисуют одно и то же и что все три поля переживают
// сохранение конфига.
// ПАДАЕТ на сборке до этой фичи: подстановки нет, в DOM остаётся сырой шаблон.
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

  // ---------- 1. связанная и обычная надписи -------------------------------
  c._decorTextDialog = { x: 0.3, y: 0.3, text: 'Бак {}', color: '#112233',
    entity: 'sensor.living_temp', attr: '', unit: '' };
  c._decorSaveText(); await c.updateComplete;
  const live = c._decorList.find((x) => x.kind === 'text');
  out.linkStored = live.entity === 'sensor.living_temp';
  out.noEmptyFieldsStored = !('attr' in live) && !('unit' in live);
  out.templateStoredRaw = live.text === 'Бак {}';   // в конфиге — ШАБЛОН
  out.liveValueRendered = dom(live.id) === 'Бак 22.4 °C';

  c._decorTextDialog = { x: 0.6, y: 0.3, text: 'Сауна', color: '#112233' };
  c._decorSaveText(); await c.updateComplete;
  const plain = c._decorList.find((x) => x.text === 'Сауна');
  out.plainUntouched = dom(plain.id) === 'Сауна' && !('entity' in plain);

  // ---------- 2. значение живое: новый hass — новый текст -------------------
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: '23.9',
    attributes: { unit_of_measurement: '°C', linkquality: 154 } });
  out.updatesOnState = dom(live.id) === 'Бак 23.9 °C';
  out.plainStillUntouched = dom(plain.id) === 'Сауна';
  // как отдаёт HA: ни округления, ни переформатирования
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: '23.94781',
    attributes: { unit_of_measurement: '°C', linkquality: 154 } });
  out.noRounding = dom(live.id) === 'Бак 23.94781 °C';

  // ---------- 3. мёртвая сущность — прочерк, шаблон остаётся ---------------
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: 'unavailable',
    attributes: { unit_of_measurement: '°C' } });
  out.deadIsDash = dom(live.id) === 'Бак —';
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: 'unknown', attributes: {} });
  out.unknownIsDash = dom(live.id) === 'Бак —';
  await push('sensor.living_temp', null);
  out.missingIsDash = dom(live.id) === 'Бак —';
  await push('sensor.living_temp', { entity_id: 'sensor.living_temp', state: '22.4',
    attributes: { unit_of_measurement: '°C', linkquality: 154 } });
  out.backAlive = dom(live.id) === 'Бак 22.4 °C';

  // ---------- 4. атрибут и единица ----------------------------------------
  open(live); await c.updateComplete;
  out.dialogHasTheLink = c._decorTextDialog?.id === live.id
    && c._decorTextDialog?.entity === 'sensor.living_temp';
  c._decorTextDialog = { ...c._decorTextDialog, attr: 'linkquality' };
  c._decorSaveText(); await c.updateComplete;
  out.attrRead = dom(live.id) === 'Бак 154';
  open(c._decorList.find((x) => x.id === live.id)); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, unit: 'LQI' };
  c._decorSaveText(); await c.updateComplete;
  out.unitOverride = dom(live.id) === 'Бак 154 LQI';
  // атрибута нет — прочерк, но остальная надпись жива
  open(c._decorList.find((x) => x.id === live.id)); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, attr: 'nope', unit: '' };
  c._decorSaveText(); await c.updateComplete;
  out.missingAttrIsDash = dom(live.id) === 'Бак —';

  // ---------- 5. без плейсхолдера значение уезжает в конец ------------------
  open(c._decorList.find((x) => x.id === live.id)); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, text: 'Бак', attr: '', unit: '' };
  c._decorSaveText(); await c.updateComplete;
  out.appendedWithoutSlot = dom(live.id) === 'Бак 22.4 °C';

  // ---------- 6. отвязали — снова обычная надпись --------------------------
  open(c._decorList.find((x) => x.id === live.id)); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, text: 'Бак {}', entity: '' };
  c._decorSaveText(); await c.updateComplete;
  const unlinked = c._decorList.find((x) => x.id === live.id);
  out.linkCleared = !('entity' in unlinked) && !('attr' in unlinked) && !('unit' in unlinked);
  out.rawTemplateShown = dom(live.id) === 'Бак {}';

  // ---------- 7. просмотр и киоск рисуют то же самое ------------------------
  open(unlinked); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, entity: 'sensor.living_temp' };
  c._decorSaveText(); await c.updateComplete;
  const editorText = dom(live.id);
  c._setMode('view'); await c.updateComplete; await sleep(60);
  out.sameInViewMode = dom(live.id) === editorText && editorText === 'Бак 22.4 °C';

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

  // ---------- 8. все три поля переживают запись конфига ---------------------
  const sent = [];
  const ws = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async (m) => { sent.push(m); return ws(m); } };
  c._setMode('decor'); await c.updateComplete;
  open(c._decorList.find((x) => x.id === live.id)); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, attr: 'linkquality', unit: 'LQI' };
  c._decorSaveText();
  await sleep(900);
  const set = sent.filter((m) => m.type === 'houseplan/config/set').pop();
  const shape = set && (set.config.spaces.find((s) => s.id === c._space).decor || [])
    .find((x) => x.id === live.id);
  out.roundTrip = !!shape && shape.entity === 'sensor.living_temp'
    && shape.attr === 'linkquality' && shape.unit === 'LQI' && shape.text === 'Бак {}';
  return out;
});
checkAll(res);
await finish(browser, res);
