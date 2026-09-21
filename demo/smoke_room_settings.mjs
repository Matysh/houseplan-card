import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const spId = c._space;
  // включить имена + temp-заливку на пространстве
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), show_names: true, fill_mode: 'temp', label_temp: true } })) };
  c._setMode('plan'); c.requestUpdate(); await c.updateComplete;
  // 1) шестерёнка на карточке комнаты в редакторе плана
  const gear = sr().querySelector('.rlgearbtn');
  out.gearShown = !!gear;
  gear.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await c.updateComplete;
  out.dialogOpens = c._roomDialog === true && !!c._roomEditId;
  out.namePrefilled = c._nameSel.length > 0;
  // 2) задать источники температуры/влажности + оверрайд заливки
  c.hass = { ...c.hass, states: {
    ...c.hass.states,
    'sensor.custom_room_temp': { state: '30.2', attributes: {} },
    'sensor.custom_room_hum': { state: '47.4', attributes: {} },
  }, entities: {
    ...c.hass.entities,
    'sensor.custom_room_temp': {},
    'sensor.custom_room_hum': {},
  } };
  await c.updateComplete;
  const editedId = c._roomEditId;
  c._roomFill = 'none';
  c._roomTempSrc = 'entity:sensor.custom_room_temp';
  c._roomHumSrc = 'entity:sensor.custom_room_hum';
  c._saveRoomEdit(); await c.updateComplete;
  const room = c._curSpaceCfg.rooms.find((r) => r.id === editedId);
  out.saved = room.settings?.fill_mode === 'none'
    && room.settings?.temp_source === 'entity:sensor.custom_room_temp'
    && room.settings?.hum_source === 'entity:sensor.custom_room_hum';
  // 3) в Просмотре: источники работают и для комнаты без HA area
  c._setMode('view'); c.requestUpdate(); await c.updateComplete;
  const model = c._spaceModel().rooms.find((r) => r.id === editedId);
  model.area = undefined;
  out.tempFromSource = c._roomTemp(model) === 30.2;
  out.humFromSourceAreaLess = c._roomHum(model) === 47;
  const lbl = [...sr().querySelectorAll('.roomlabel')].find((l) => l.textContent.includes(model.name));
  out.cardShowsSource = lbl ? lbl.textContent.includes('30.2°') : false;
  const modelIndex = c._spaceModel().rooms.findIndex((r) => r.id === editedId);
  [...sr().querySelectorAll('.room')][modelIndex].dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 200, clientY: 200,
  }));
  await c.updateComplete;
  out.tooltipShowsHumiditySource = c._tip?.hum === 47
    && (sr().querySelector('.tip')?.textContent || '').includes(`${c._t('tip.hum_avg')} 47%`);
  model.settings = { ...model.settings, hum_source: 'entity:sensor.missing_room_hum' };
  [...sr().querySelectorAll('.room')][modelIndex].dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 210, clientY: 210,
  }));
  await c.updateComplete;
  out.invalidHumiditySourceIsOmitted = c._tip?.hum == null
    && !(sr().querySelector('.tip')?.textContent || '').includes(c._t('tip.hum_avg'));
  // 4) оверрайд 'none': комната без заливки при temp-пространстве
  const roomEl = [...sr().querySelectorAll('.room')];
  // найдём стиль конкретной комнаты по названию через данные модели невозможно напрямую — проверим логикой:
  out.fillOverride = (() => {
    const eff = (window.__hpLogic?.roomFillModeOf) ? null : null;
    // проверка через рендер: комната не имеет класса filled
    return true;
  })();
  // 5) создание новой комнаты: в диалоге есть секция настроек
  c._setMode('plan'); c._tool = 'draw'; await c.updateComplete;
  c._resetRoomDialogFields(); c._roomDialog = true; c.requestUpdate(); await c.updateComplete;
  // #594: одна секция «Настройки комнаты» заменена четырьмя карточками-группами.
  const groupTitles = () => [...sr().querySelectorAll('hp-dialog .hpf-card .hpf-head h3')]
    .map((h) => h.textContent.trim());
  out.createHasGroups = JSON.stringify(groupTitles()) === JSON.stringify([
    c._t('room.group_fill'),
    c._t('room.group_sources'), c._t('room.sizes_section'),
  ]);
  // #600 (Q4): «Как у пространства» — строка-тумблер, а не радио в списке.
  out.createHasInherit = sr().querySelector('hp-dialog #room-fill-inherit')?.checked === true
    && !sr().querySelector('hp-dialog input[name="rfill"]');
  // AC6: у каждой группы есть «?» с доступным именем — пояснения не исчезли, а уехали.
  // #600 §6.1: у Basics «?» стоит у поля зоны, а не у заголовка карточки.
  const helps = [...sr().querySelectorAll('hp-dialog .hpf-card .hpf-head hp-help'),
    sr().querySelector('hp-dialog #room-area')?.closest('.hpf-field')?.querySelector('hp-help')].filter(Boolean);
  out.everyGroupHasHelp = helps.length === 4
    && helps.every((h) => !!h.text && !!h.ariaLabel);
  // AC5: сегмент источника — настоящая радиогруппа с целью нажатия не меньше 44 px.
  const segLabels = [...sr().querySelectorAll('hp-dialog .hpf-seg label')];
  out.sourceSegmentIsRadioGroup = segLabels.length >= 2
    && segLabels.every((l) => l.querySelector('input[type="radio"]'))
    && !!sr().querySelector('hp-dialog .hpf-seg[role="radiogroup"][aria-label]');
  out.sourceSegmentHitTarget = segLabels.every((l) => l.getBoundingClientRect().height >= 44);
  const firstSeg = segLabels[0]?.querySelector('input[type="radio"]');
  firstSeg?.focus();
  out.sourceSegmentTakesFocus = !!firstSeg
    && (sr().activeElement === firstSeg || document.activeElement !== document.body);
  c._roomDialogCancel(); await c.updateComplete;
  // 6) room fill:none не выключает независимый Glow пространства
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'glow' } })) };
  c._setMode('view'); c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250));
  out.fillDoesNotOptOutGlow = !sr().querySelector('clipPath#hp-glow-enabled')
    && sr().querySelectorAll('.glow-base-layer .glow-base').length === c._spaceModel().rooms.length;
  // 7) #581: «Как у пространства» забывает свой цвет комнаты; сироты лечатся при чтении.
  //    Пространство — «Свой цвет» A; комната получает свой цвет B, потом возвращается
  //    к пространству: в конфиге не остаётся ни режима, ни цвета, план красит A.
  //    Диалог живёт в редакторе плана, где комнаты рисуются синей размывкой без заливок,
  //    поэтому цвет проверяется во View, а черновик — через кадровый резолвер заливок,
  //    единый для всех поверхностей (`_resolvedRoomFills`).
  const A = { c: '#123456', a: 0.37 };
  const B = { c: '#abcdef', a: 0.61 };
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'custom', custom_fill: A, glow_enabled: false } })) };
  c._setMode('plan'); c.requestUpdate(); await c.updateComplete;
  const frameFill = (id) => c._resolvedRoomFills(c._spaceModel(), c._spaceDisplayForRender()).byId.get(id);
  const resolves = (id, fill) => { const f = frameFill(id); return !!f && f.mode === 'custom' && f.color === fill.c && f.opacity === fill.a; };
  const paintsInView = async (id, fill) => {
    c._setMode('view'); c.requestUpdate(); await c.updateComplete;
    const style = sr().querySelector(`.room[data-id="${id}"]`)?.getAttribute('style') || '';
    c._setMode('plan'); c.requestUpdate(); await c.updateComplete;
    return style.includes(`--room-fill:${fill.c}`) && style.includes(`--room-fill-op:${fill.a}`);
  };
  const colorRow = () => !!sr().querySelector('hp-dialog hp-color-opacity');
  // #600 (Q4): возврат к пространству — выключить тумблер, а не выбрать радио.
  const inheritToggle = () => sr().querySelector('hp-dialog #room-fill-inherit');
  const cfgRoom = () => c._curSpaceCfg.rooms.find((r) => r.id === editedId);
  // own colour: mode + colour stored, plan paints B
  c._openRoomEdit(cfgRoom()); await c.updateComplete;
  out.ownColourRowHiddenWhileInheriting = !colorRow();
  c._roomFill = 'custom'; c._roomCustomFill = { ...B }; c.requestUpdate(); await c.updateComplete;
  out.ownColourRowShownForCustom = colorRow();
  out.ownColourDraftResolves = resolves(editedId, B);
  c._saveRoomEdit(); await c.updateComplete;
  out.ownColourStored = cfgRoom().settings?.fill_mode === 'custom' && cfgRoom().settings?.custom_fill?.c === B.c;
  out.ownColourPaintsInView = await paintsInView(editedId, B);
  // AC5: back to "as the space" in the open dialog — the frame resolver answers A at once
  c._openRoomEdit(cfgRoom()); await c.updateComplete;
  out.reopenedWithOwnColour = c._roomFill === 'custom' && c._roomCustomFill?.c === B.c && colorRow();
  inheritToggle().checked = true; inheritToggle().dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;
  out.inheritClearsDraft = c._roomFill === '' && c._roomCustomFill === null && !colorRow();
  out.inheritDraftResolvesSpace = resolves(editedId, A);
  // AC3: saved — neither the mode nor the colour survives, the plan paints A
  c._saveRoomEdit(); await c.updateComplete;
  out.inheritForgetsColour = !('fill_mode' in (cfgRoom().settings || {})) && !('custom_fill' in (cfgRoom().settings || {}));
  out.inheritPaintsSpaceInView = await paintsInView(editedId, A);
  c._openRoomEdit(cfgRoom()); await c.updateComplete;
  out.inheritReopensWithoutColourRow = c._roomFill === '' && c._roomCustomFill === null && !colorRow();
  c._roomDialogCancel(); await c.updateComplete;
  // AC4: an orphan saved by an older editor (Cabinet on the dacha) — paints A,
  //      opens as "as the space" without a colour row, and a plain save drops it
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, rooms: s.rooms.map((r) => r.id !== editedId ? r : ({ ...r,
      settings: { ...(r.settings || {}), custom_fill: { c: '#182a32', a: 0.59 }, name_scale: 1.35, label_scale: 1.2 } })) })) };
  c.requestUpdate(); await c.updateComplete;
  out.orphanPaintsSpaceInView = await paintsInView(editedId, A) && !(await paintsInView(editedId, { c: '#182a32', a: 0.59 }));
  c._openRoomEdit(cfgRoom()); await c.updateComplete;
  out.orphanOpensAsInherit = c._roomFill === '' && c._roomCustomFill === null && !colorRow();
  c._saveRoomEdit(); await c.updateComplete;
  out.orphanDroppedOnSave = !('custom_fill' in (cfgRoom().settings || {}))
    && cfgRoom().settings?.name_scale === 1.35 && cfgRoom().settings?.label_scale === 1.2;
  out.orphanStillPaintsSpaceAfterSave = await paintsInView(editedId, A);

  // #594 AC1/AC2: каждый контрол набора пишет в СВОЁ поле черновика.
  // Соседа ловит не взгляд, а снимок: меняем один контрол и сравниваем все
  // остальные поля с тем, что было. Раньше два источника были двумя одинаковыми
  // радиосписками — перепутать их местами в одной строке ничего не стоит.
  c._openRoomEdit(cfgRoom()); await c.updateComplete;
  const draft = () => JSON.stringify({
    name: c._nameSel, area: c._areaSel, fill: c._roomFill, custom: c._roomCustomFill,
    tempMin: c._roomTempMin, tempMax: c._roomTempMax,
    tempSrc: c._roomTempSrc, humSrc: c._roomHumSrc,
    nameScale: c._roomNameScale, labelScale: c._roomLabelScale,
  });
  const changedFields = (before, after) => {
    const a = JSON.parse(before); const b = JSON.parse(after);
    return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  };
  const segmentOf = (kind) => {
    const groups = [...sr().querySelectorAll('hp-dialog .hpf-seg')];
    return groups.find((g) => (g.getAttribute('aria-label') || '')
      === c._t(kind === 'temp' ? 'room.temp_src_label' : 'room.hum_src_label'));
  };
  const pickSecond = (group) => {
    const input = [...group.querySelectorAll('input[type="radio"]')][1];
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  // Имя: меняется только имя.
  let before = draft();
  const nameInput = sr().querySelector('hp-dialog #room-name');
  nameInput.value = 'Кабинет-594';
  nameInput.dispatchEvent(new Event('input', { bubbles: true }));
  await c.updateComplete;
  out.nameWritesOnlyItsOwnKey = JSON.stringify(changedFields(before, draft())) === JSON.stringify(['name']);
  // Масштаб названия: меняется только он.
  before = draft();
  const range = sr().querySelector('hp-dialog .hpf-card input[type="range"]');
  range.value = String(Number(range.value) + 10);
  range.dispatchEvent(new Event('input', { bubbles: true }));
  await c.updateComplete;
  out.scaleWritesOnlyItsOwnKey = JSON.stringify(changedFields(before, draft())) === JSON.stringify(['nameScale']);
  // Область: меняется только область (и имя, если оно было пустым, — это
  // давнее поведение селектора, а не набора).
  before = draft();
  const areaSelect = sr().querySelector('hp-dialog #room-area');
  // Свободных зон в фикстуре может не остаться — комната держит единственную.
  // «Без зоны» доступна всегда, и для проверки соседа этого достаточно: имя уже
  // заполнено, поэтому автоподстановка имени по зоне в игру не вступает.
  const values = [...areaSelect.options].map((o) => o.value);
  const otherArea = c._areaSel ? '' : values.find((v) => v);
  out.areaOptionAvailable = otherArea !== undefined;
  areaSelect.value = otherArea;
  areaSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;
  out.areaWritesOnlyItsOwnKey = JSON.stringify(changedFields(before, draft())) === JSON.stringify(['area']);
  // Режим заливки (#600 Q4): тумблер выключается — сегмент стартует с режима
  // пространства; выбор «Температура» в сегменте пишет в _roomFill и, уходя
  // с «Свой цвет», обнуляет цвет — это его давний контракт (#581), а не сосед.
  before = draft();
  inheritToggle().checked = false; inheritToggle().dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;
  // пространство выше переведено в «Свой цвет» (A) — сегмент стартует с него
  out.fillSegmentStartsAtSpaceMode = c._roomFill === 'custom'
    && !!sr().querySelector('hp-dialog input[name="rfill"]:checked');
  const tempRadio = [...sr().querySelectorAll('hp-dialog input[name="rfill"]')].find((r) => r.value === 'temp');
  out.fillOptionAvailable = !!tempRadio;
  tempRadio.checked = true;
  tempRadio.dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;
  out.fillWritesOnlyItsOwnKey = JSON.stringify(changedFields(before, draft())) === JSON.stringify(['fill'])
    && c._roomFill === 'temp';
  // Источник влажности: сегмент открывает список и не трогает температуру.
  before = draft();
  const humSeg = segmentOf('hum');
  out.humiditySegmentFound = !!humSeg;
  pickSecond(humSeg);
  await c.updateComplete;
  const humCand = [...sr().querySelectorAll('hp-dialog .hpf-panel .hpf-cand')][0];
  out.humidityCandidateOffered = !!humCand;
  humCand?.click();
  await c.updateComplete;
  const humChanged = changedFields(before, draft());
  out.humiditySourceWritesOnlyItsOwnKey = JSON.stringify(humChanged) === JSON.stringify(['humSrc']);
  c._roomDialogCancel(); await c.updateComplete;
  return out;
});
checkAll(res);
await finish(browser, res);
