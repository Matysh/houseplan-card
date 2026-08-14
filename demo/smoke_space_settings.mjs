import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) дефолт (план есть): границ и лейблов нет
  out.defaultStyled = sr().querySelectorAll('.room.styled').length;
  out.defaultLabels = sr().querySelectorAll('.roomlabel').length;
  // 2) включаем границы+имена+заливку по свету
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : {
    ...s, settings: { show_borders: true, show_names: true, room_color: '#ff8800', room_opacity: 0.8, fill_mode: 'light' },
  })};
  c.requestUpdate(); await c.updateComplete;
  out.styled = sr().querySelectorAll('.room.styled').length;
  out.labels = [...sr().querySelectorAll('.roomlabel')].map((l) => l.textContent.trim());
  const liv = [...sr().querySelectorAll('.room.styled')][0];
  out.livingStyle = {
    stroke: liv.style.getPropertyValue('--room-stroke').trim(),
    strokeOpacity: Number(liv.style.getPropertyValue('--room-stroke-op')),
    fill: liv.style.getPropertyValue('--room-fill').trim(),
    fillOpacity: Number(liv.style.getPropertyValue('--room-fill-op')),
  };
  // living: ceiling on → жёлтая; kitchen: нет light-сущностей → без заливки; bedroom light off → серая
  const styles = [...sr().querySelectorAll('.room.styled')].map((r) => r.getAttribute('style'));
  out.hasYellow = styles.some((s) => s.includes('#ffd45c'));
  out.hasGrey = styles.some((s) => s.includes('#9aa0a6'));
  out.kitchenNoFill = styles.some((s) => s.includes('--room-fill:transparent'));
  // 3) lqi-заливка
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : {
    ...s, settings: { ...s.settings, fill_mode: 'lqi' },
  })};
  c.requestUpdate(); await c.updateComplete;
  out.lqiFills = [...sr().querySelectorAll('.room.styled')].filter((r) => (r.getAttribute('style') || '').includes('hsl(')).length;
  // 4) custom fill is static, room-overridable, and Glow pools do not tint it
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({
    ...s,
    settings: { ...s.settings, fill_mode: 'custom', glow_enabled: true,
      custom_fill: { c: '#123456', a: 0.37 } },
    rooms: s.rooms.map((room, index) => index ? room : ({ ...room,
      settings: { ...(room.settings || {}), custom_fill: { c: '#abcdef', a: 0.61 } } })),
  })) };
  c.requestUpdate(); await c.updateComplete;
  const customStyles = [...sr().querySelectorAll('.room.styled')].map((r) => r.getAttribute('style') || '');
  out.customSpaceFill = customStyles.some((s) => s.includes('--room-fill:#123456') && s.includes('--room-fill-op:0.37'));
  out.customRoomOverride = customStyles.some((s) => s.includes('--room-fill:#abcdef') && s.includes('--room-fill-op:0.61'));
  out.customNotTintedByBase = !sr().querySelector('.glow-base-layer, .glow-base-tunnels')
    && sr().querySelectorAll('.glow-pool').length > 0;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({
    ...s, rooms: s.rooms.map((room, index) => index ? room : ({ ...room,
      settings: { ...(room.settings || {}), fill_mode: 'none' } })),
  })) };
  c.requestUpdate(); await c.updateComplete;
  out.noneOverrideGetsGlowBase = sr().querySelectorAll('.glow-base-layer .glow-base').length === 1;
  // 5) drag лейбла → layout rl_ (только в редакторе плана, с v1.25)
  c._setMode('plan'); await c.updateComplete;
  const lbl = sr().querySelector('.roomlabel');
  c._labelDown({ preventDefault(){}, stopPropagation(){}, clientX: 100, clientY: 100, target: { setPointerCapture(){} }, pointerId: 5 },
    c._spaceModel().rooms[0], 'f1');
  c._labelMove({ clientX: 160, clientY: 140 }, c._spaceModel().rooms[0], 'f1');
  c._labelUp(c._spaceModel().rooms[0]);
  out.labelSaved = !!c._layout['rl_r1'];
  // 6) диалог: create + draw
  c._openSpaceDialog('create'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'Attic', source: 'draw', orientation: 'square' };
  await c.updateComplete;
  out.saveEnabled = !sr().querySelector('hp-dialog .btn.on[disabled]');
  await c._saveSpaceDialog(); await c.updateComplete;
  const attic = c._serverCfg.spaces.find((s) => s.title === 'Attic');
  out.atticSquare = attic?.aspect === undefined;  // no per-space ratio any more
  out.atticSettings = attic?.settings;
  out.atticNoPlan = attic ? attic.plan_url === null : null;
  out.atticOpensPlanEditor = c._space === attic?.id && c._mode === 'plan' && c._tool === 'draw';
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "defaultStyled": 0,
  "defaultLabels": 0,
  "styled": 4,
  "labels": ["Living room", "Kitchen", "Bedroom", "Hallway"],
  "livingStyle": {"stroke": "#ff8800", "strokeOpacity": 0.8, "fill": "#ffd45c", "fillOpacity": 0.18},
  "lqiFills": 0,
  "atticSquare": true,
  // New spaces keep the product default (Glow on), but store it independently
  // from the ordinary data fill.
  "atticSettings": {"show_borders": true, "show_names": true, "room_color": "#55606c", "room_opacity": 0.55, "bg_mode": "daynight", "fill_mode": "custom", "custom_fill": {"c": "#607d8b", "a": 0}, "glow_enabled": true, "temp_min": 20, "temp_max": 25, "show_lqi": true, "label_temp": false, "label_hum": false, "label_lqi": false, "label_light": false},
});
await finish(browser, res);
