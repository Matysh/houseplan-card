import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const spId = c._space;
  // включить glow-режим
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'glow' } })) };
  c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250));
  // 1) все комнаты залиты темнотой одинаково (независимо от ламп)
  const rooms = [...sr().querySelectorAll('.room.styled')];
  out.roomsDark = rooms.length > 0 && rooms.every((el) => {
    const st = el.getAttribute('style') || '';
    return st.includes('--room-fill:#0d1b2a');
  });
  // 2) пятна от включённых ламп
  const litLight = c._devices.find((d) => d.space === spId && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on'));
  out.hasLitLight = !!litLight;
  out.spots = sr().querySelectorAll('.glowlayer circle').length;
  out.spotsMatchLights = out.spots === c._devices.filter((d) => d.space === spId && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on')).length;
  // 3) выключение лампы убирает её пятно
  const eid = litLight.entities.find((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on');
  const st0 = c.hass.states[eid];
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: { ...st0, state: 'off' } } };
  await c.updateComplete;
  out.spotGone = sr().querySelectorAll('.glowlayer circle').length === out.spots - 1;
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: st0 } }; await c.updateComplete;
  // 4) rgb-лампа красит градиент своим цветом (форсируем rgb у лампы)
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: { ...st0, state: 'on', attributes: { ...st0.attributes, rgb_color: [255, 0, 0] } } } };
  await c.updateComplete;
  out.gradientColored = [...sr().querySelectorAll('defs radialGradient stop')].some((s2) => s2.getAttribute('stop-color') === 'rgb(255, 0, 0)');
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: st0 } }; await c.updateComplete;
  // 5) пятно обрезано комнатой (есть clipPath)
  out.clipped = sr().querySelectorAll('defs clipPath[id^="hp-glowclip"]').length > 0;
  // 6) дверь в соседнюю комнату → в clip добавлен сектор (2 сабпути M)
  // добавим дверь между r1 и r2 на общей стене x=0.55… найдём общую стену программно:
  const spm = c._spaceModel();
  const r1 = spm.rooms.find((r) => r.id === 'r1');
  const r2 = spm.rooms.find((r) => r.id === 'r2');
  // возьмём точку на границе r1, ближайшую к центру r2
  const c2 = c._roomCenter(r2);
  const poly1 = r1.poly || [[r1.x, r1.y], [r1.x + r1.w, r1.y], [r1.x + r1.w, r1.y + r1.h], [r1.x, r1.y + r1.h]];
  // общая стена вертикальная — дверь ставим на неё
  const H = 1000 / (c._curSpaceCfg.aspect || 1);
  const doorPt = (() => {
    let best = null, bd = 1e9;
    for (const [x, y] of [[550, 150], [550, 200], [550, 250]]) {
      const d2 = Math.hypot(x - c2[0], y - c2[1]);
      if (d2 < bd) { bd = d2; best = [x, y]; }
    }
    return best;
  })();
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, openings: [{ id: 'gd', type: 'door', x: doorPt[0] / 1000, y: doorPt[1] / H, angle: 90, length: 0.09 }] })) };
  c.requestUpdate(); await c.updateComplete;
  // источник детерминированно ставим в центр r1 (двигаем реальную включённую лампу)
  const aspect = c._curSpaceCfg.aspect || 1;
  const c1 = c._roomCenter(r1);
  c._layout = { ...c._layout, [litLight.id]: { s: spId, x: c1[0] / 1000, y: c1[1] / (1000 / aspect) } };
  // радиус 6 м, чтобы дверь заведомо была в зоне досягаемости
  c._serverCfg = { ...c._serverCfg, settings: { ...(c._serverCfg.settings || {}), glow_radius_cm: 600 } };
  c.requestUpdate(); await c.updateComplete;
  const clips = [...sr().querySelectorAll('defs clipPath[id^="hp-glowclip"] path')];
  out.sectorAdded = clips.some((p) => ((p.getAttribute('d') || '').match(/M /g) || []).length >= 2);
  // у входной двери (наружу) сектора нет: дверь на внешней стене r1 (x=min)
  const minX = Math.min(...poly1.map((p) => p[0]));
  const yMid = (Math.min(...poly1.map((p) => p[1])) + Math.max(...poly1.map((p) => p[1]))) / 2;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, openings: [{ id: 'gd2', type: 'door', x: minX / 1000, y: yMid / (1000 / aspect), angle: 90, length: 0.09 }] })) };
  c.requestUpdate(); await c.updateComplete;
  const clips2 = [...sr().querySelectorAll('defs clipPath[id^="hp-glowclip"] path')];
  out.entranceNoSector = clips2.every((p) => ((p.getAttribute('d') || '').match(/M /g) || []).length === 1);
  // 7) радиус из настроек: 600 см против 300 см — вдвое больше
  const r600 = Number(sr().querySelector('.glowlayer circle')?.getAttribute('r'));
  c._serverCfg = { ...c._serverCfg, settings: { ...(c._serverCfg.settings || {}), glow_radius_cm: 300 } };
  c.requestUpdate(); await c.updateComplete;
  const r300 = Number(sr().querySelector('.glowlayer circle')?.getAttribute('r'));
  out.radiusReacts = Math.abs(r600 / r300 - 2) < 0.01;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
