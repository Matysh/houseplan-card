import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // включить имена и все метрики у текущего пространства
  const spId = c._space;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), show_names: true,
      label_temp: true, label_hum: true, label_lqi: true, label_light: true } })) };
  c.requestUpdate(); await c.updateComplete;
  const labels = [...sr().querySelectorAll('.roomlabel')];
  out.labels = labels.length;
  const cards = labels.filter((l) => l.classList.contains('card'));
  out.cardsWithMetrics = cards.length;
  out.hasName = !!labels[0]?.querySelector('.rlname');
  const metrics = cards[0] ? [...cards[0].querySelectorAll('.rlm')].map((m) => m.textContent.trim()) : [];
  out.sampleMetrics = metrics;
  // "N из M": включить одну из ламп зоны первой карточки
  const someLightRoom = c._spaceModel().rooms.find((r) => r.area && c._devices.some((d) => d.area === r.area && d.entities.some((e) => e.startsWith('light.'))));
  out.partialTested = false;
  if (someLightRoom) {
    const lights = [...new Set(c._devices.filter((d) => d.area === someLightRoom.area).flatMap((d) => d.entities).filter((e) => e.startsWith('light.')))];
    if (lights.length >= 2) {
      const st = { ...c.hass.states };
      lights.forEach((e, i) => { st[e] = { ...st[e], state: i === 0 ? 'on' : 'off' }; });
      c.hass = { ...c.hass, states: st }; await c.updateComplete;
      const lbl = [...sr().querySelectorAll('.roomlabel.card')].find((l) => l.textContent.includes(someLightRoom.name));
      out.partialText = lbl?.querySelector('.rlm.lit')?.textContent.trim();
      out.partialTested = /1\D+' + lights.length + '/.test(out.partialText || '') || (out.partialText || '').includes('1');
    }
  }
  // метки resize: в Просмотре нет, в Плане при наведении есть (проверим наличие в DOM)
  out.noHandlesInView = sr().querySelectorAll('.rlhandle').length === 0;
  c._setMode('plan'); await c.updateComplete;
  const planLbl = sr().querySelector('.roomlabel');
  out.handlesInPlan = planLbl?.querySelectorAll('.rlhandle').length === 4;
  // метрики скрыты в редакторе плана (карточка = имя, чтобы не мешать разметке)
  out.plainInPlan = sr().querySelectorAll('.roomlabel.card').length === 0;
  // масштаб: сымитируем resize через прямой вызов
  const room = c._spaceModel().rooms.find((r) => r.name);
  c._rlResize = { id: 'rl_' + room.id, space: spId, k0: 1, cx: 100, cy: 100, d0: 50 };
  c._rlResizeMove({ clientX: 200, clientY: 100, stopPropagation() {} });
  c._rlResizeUp();
  await c.updateComplete;
  out.scaleSaved = Math.abs((c._layout['rl_' + room.id]?.k || 0) - 2) < 0.01;
  const lblEl = sr().querySelector('.roomlabel');
  out.scaleApplied = getComputedStyle(lblEl).getPropertyValue('--rl-scale').trim() === '2';
  // клампы
  c._rlResize = { id: 'rl_' + room.id, space: spId, k0: 2, cx: 100, cy: 100, d0: 50 };
  c._rlResizeMove({ clientX: 1000, clientY: 100, stopPropagation() {} });
  c._rlResizeUp();
  out.clamped = c._layout['rl_' + room.id].k <= 3;
  // drag сохраняет масштаб
  c._savePos({ id: 'rl_' + room.id, space: spId }, 300, 300);
  out.dragKeepsScale = c._layout['rl_' + room.id].k <= 3 && c._layout['rl_' + room.id].k >= 2.9;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
