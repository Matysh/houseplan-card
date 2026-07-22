import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  c._setMode('devices'); await c.updateComplete;
  const near = (a, b) => a && b && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 && a.s === b.s;
  // подопытный: авто-устройство с сохранённой позицией
  const dev = c._devices.find((d) => !d.virtual && !d.marker && c._layout[d.id]);
  out.hasDev = !!dev;
  const pos0 = { ...c._layout[dev.id] };
  // 1) смена комнаты (та же space) → позиция не меняется
  const otherRoom = c._spaceModel(dev.space).rooms.find((r) => r.id && r.area && r.area !== dev.area);
  out.hasOtherRoom = !!otherRoom;
  c._openMarkerDialog(dev);
  c._markerDialog = { ...c._markerDialog, room: dev.space + '#' + otherRoom.area };
  await c._saveMarker(); await c.updateComplete;
  out.stayAfterRoomChange = near(c._layout[dev.id], pos0);
  // вернуть комнату назад
  c._openMarkerDialog(c._devices.find((d) => d.id === dev.id));
  c._markerDialog = { ...c._markerDialog, room: dev.space + '#' + dev.area };
  await c._saveMarker(); await c.updateComplete;
  // 2) смена привязки device -> entity (id меняется) → позиция мигрирует
  const freeEnt = Object.keys(c.hass.states).find((e) => e.startsWith('sensor.') &&
    !c._devices.some((d) => d.id === 'lg_' + e));
  out.hasFreeEnt = !!freeEnt;
  c._openMarkerDialog(c._devices.find((d) => d.id === dev.id));
  c._markerDialog = { ...c._markerDialog, binding: 'entity:' + freeEnt };
  await c._saveMarker(); await c.updateComplete;
  const newId = 'lg_' + freeEnt;
  out.migrated = near(c._layout[newId], pos0);
  out.oldGone = !c._layout[dev.id];
  // 3) новый виртуальный маркер по-прежнему центрируется в выбранной комнате
  c._openMarkerDialog();
  const room = c._spaceModel().rooms.find((r) => r.id && r.area);
  c._markerDialog = { ...c._markerDialog, name: 'Тест', binding: 'virtual', room: c._space + '#' + room.area };
  await c._saveMarker(); await c.updateComplete;
  const vid = c._serverCfg.markers.find((m) => m.name === 'Тест')?.id;
  const center = c._roomCenter(room);
  const vpos = c._layout[vid];
  const aspect = c._curSpaceCfg.aspect || 1;
  out.newCentered = vpos && Math.abs(vpos.x * 1000 - center[0]) < 1 && Math.abs(vpos.y * (1000 / aspect) - center[1]) < 1;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
