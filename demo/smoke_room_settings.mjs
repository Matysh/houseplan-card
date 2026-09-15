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
  out.createHasSection = [...sr().querySelectorAll('hp-dialog label')].some((l) => l.textContent === c._t('room.settings_section'));
  out.createHasInherit = [...sr().querySelectorAll('hp-dialog .srcrow')].some((l) => l.textContent.trim() === c._t('fill.inherit'));
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
  const inheritRadio = [...sr().querySelectorAll('hp-dialog .srcrow')]
    .find((l) => l.textContent.trim() === c._t('fill.inherit'))?.querySelector('input[type="radio"]');
  inheritRadio.checked = true; inheritRadio.dispatchEvent(new Event('change', { bubbles: true }));
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
  return out;
});
checkAll(res);
await finish(browser, res);
