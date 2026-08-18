import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  // комната без зоны на f1
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({
    ...s, rooms: [...s.rooms, { id: 'rc', name: 'Cupboard', area: null, poly: [[0.05,0.62],[0.2,0.62],[0.2,0.9],[0.05,0.9]] }],
  })).map((s) => s.id !== 'garden' ? s : ({
    ...s, rooms: [...s.rooms,
      { id: 'garden-shed-a', name: 'Shed A', area: null, poly: [[0.60,0.55],[0.80,0.55],[0.80,0.75],[0.60,0.75]] },
      { id: 'garden-shed-b', name: 'Shed B', area: null, poly: [[0.25,0.55],[0.45,0.55],[0.45,0.75],[0.25,0.75]] },
    ],
  })) };
  c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  // список комнат в диалоге содержит подзону
  c._setMode('devices');
  c._openMarkerDialog(); await c.updateComplete;
  const rooms = c._allRoomsFlat();
  out.subareaListed = rooms.some((r) => r.value === 'f1#@rc');
  // создать виртуальный маркер в подзону
  c._markerDialog = { ...c._markerDialog, name: 'Vacuum dock', binding: 'virtual', room: 'f1#@rc' };
  await c._saveMarker(); await c.updateComplete;
  const m = c._serverCfg.markers.find((x) => x.name === 'Vacuum dock');
  out.markerRoomId = m?.room_id;
  out.markerAreaNull = m ? m.area === null : null;
  // позиция — в центре подзоны (норм. центр rc: x=0.125, y=0.76)
  const pos = c._layout[m.id];
  out.posInRoom = pos && Math.abs(pos.x - 0.125) < 0.03 && Math.abs(pos.y - 0.76) < 0.03;
  // девайс отрисован
  const dev = c._devices.find((d) => d.id === m.id);
  out.deviceBuilt = !!dev && dev.space === 'f1';
  // reopen диалога восстанавливает выбор
  c._openMarkerDialog(dev); 
  out.reopenRoom = c._markerDialog?.room;
  c._markerDialog = null;

  // Реальное HA-устройство с registry Area вручную переносится в комнату без
  // Area другого пространства. Registry metadata не должна вернуть его в f1.
  const source = c._devices.find((d) => d.id === 'd_light1');
  c._openMarkerDialog(source); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, room: 'garden#@garden-shed-a' };
  await c._saveMarker(); await c.updateComplete;
  const haMarker = c._serverCfg.markers.find((x) => x.binding === 'device:d_light1');
  const moved = c._devices.find((d) => d.id === haMarker?.id);
  const crossPos = c._layout[haMarker?.id];
  out.haMarkerSaved = !!haMarker
    && haMarker.space === 'garden' && haMarker.area === null && haMarker.room_id === 'garden-shed-a';
  out.haRuntimePlacement = !!moved
    && moved.space === 'garden' && moved.area === '' && moved.marker?.room_id === 'garden-shed-a';
  out.crossSpaceCentered = !!crossPos && crossPos.s === 'garden'
    && Math.abs(crossPos.x - 0.70) < 0.03 && Math.abs(crossPos.y - 0.65) < 0.03;

  c._openMarkerDialog(moved); await c.updateComplete;
  out.haReopenRoom = c._markerDialog?.room === 'garden#@garden-shed-a';
  c._markerDialog = null;

  // Защитный негативный кейс: transient runtime-пара с room_id из другого
  // пространства не роняет диалог и не переписывает сохранённый marker.
  const persistedBeforeInvalidOpen = JSON.stringify(haMarker);
  c._openMarkerDialog({ ...moved, space: 'f1' }); await c.updateComplete;
  const invalidSelect = c.shadowRoot?.querySelector('#marker-room');
  out.invalidPairPlaceholder = invalidSelect?.value === '';
  out.invalidPairReadOnly = JSON.stringify(
    c._serverCfg.markers.find((x) => x.binding === 'device:d_light1'),
  ) === persistedBeforeInvalidOpen;
  c._markerDialog = null; await c.updateComplete;

  // Смена комнаты внутри того же пространства сохраняет уже закреплённую
  // позицию, хотя room_id меняется.
  c._openMarkerDialog(moved); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, room: 'garden#@garden-shed-b' };
  await c._saveMarker(); await c.updateComplete;
  const sameSpaceMarker = c._serverCfg.markers.find((x) => x.binding === 'device:d_light1');
  const sameSpacePos = c._layout[sameSpaceMarker?.id];
  const sameSpaceDevice = c._devices.find((d) => d.id === sameSpaceMarker?.id);
  out.sameSpaceRoomSaved = sameSpaceMarker?.room_id === 'garden-shed-b'
    && sameSpaceDevice?.space === 'garden' && sameSpaceDevice?.area === '';
  out.sameSpacePositionKept = !!sameSpacePos
    && sameSpacePos.s === crossPos.s && sameSpacePos.x === crossPos.x && sameSpacePos.y === crossPos.y;
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "markerRoomId": "rc",
  "reopenRoom": "f1#@rc",
});
await finish(browser, res);
