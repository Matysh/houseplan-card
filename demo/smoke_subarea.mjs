import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  // комната без зоны на f1
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({
    ...s, rooms: [...s.rooms, { id: 'rc', name: 'Cupboard', area: null, poly: [[0.05,0.62],[0.2,0.62],[0.2,0.9],[0.05,0.9]] }],
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
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
