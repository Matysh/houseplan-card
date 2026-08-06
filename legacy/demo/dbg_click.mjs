import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];
  c.hass = { ...c.hass, callService: (d, s, data) => { calls.push([d, s, data.entity_id]); return Promise.resolve(); } };
  // glow на текущем пространстве
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'glow' } })) };
  c.requestUpdate(); await c.updateComplete;
  out.mode = c._mode;
  out.suppress = c._suppressClick;
  out.holdFired = c._holdFired;
  out.drag = !!c._drag;
  // реальный клик по включённой лампе (элемент .dev)
  const litDev = c._devices.find((d) => d.space === c._space && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on'));
  out.hasLit = !!litDev;
  const el = [...sr().querySelectorAll('.dev')].find((e) => e.textContent.includes(litDev.name) || true);
  // найдём элемент точно: по индексу устройства
  const devEls = [...sr().querySelectorAll('.dev')];
  out.devCount = devEls.length;
  const target = devEls[c._devices.filter((d) => d.space === c._space).indexOf(litDev)] || devEls[0];
  const before = calls.length;
  c._infoCard = null;
  // эмулируем полный цикл: pointerdown/up + click
  const opts = { bubbles: true, composed: true };
  target.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 5 }));
  target.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 5 }));
  target.dispatchEvent(new MouseEvent('click', opts));
  await c.updateComplete;
  out.reaction = calls.length > before ? 'service:' + JSON.stringify(calls.at(-1)) : c._infoCard ? 'info' : 'NOTHING';
  out.suppressAfter = c._suppressClick;
  // и через прямой вызов
  c._infoCard = null;
  c._clickDevice(new MouseEvent('click'), litDev);
  await c.updateComplete;
  out.directReaction = calls.length > before + 1 ? 'service' : c._infoCard ? 'info' : 'NOTHING';
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
