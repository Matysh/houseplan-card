// #377: the Background editor's default style persists into
// settings.decor_default_style — one debounced write per palette drag (AC4),
// and a card born with the key draws new objects with the saved style (AC5).
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  const base = c.hass.callWS;
  const writes = [];
  let rev = 40;
  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/set') {
      writes.push(JSON.parse(JSON.stringify(m.config.settings?.decor_default_style ?? null)));
      rev += 1;
      return { ok: true, rev };
    }
    return base(m);
  } };
  c._cfgRev = rev;

  // войти в Background-редактор — там живёт рантайм с _updateDecorStyle
  [...sr().querySelectorAll('.modetab')][2].click(); await settleMode();
  out.decorMode = c._mode === 'decor';
  const runtime = c._editorRuntime;
  out.hasRuntime = !!runtime;

  // AC4: серия быстрых изменений (драг по палитре) = одна запись после дебаунса
  runtime._updateDecorStyle({ ...c._decorStyle, color: '#101010' });
  runtime._updateDecorStyle({ ...c._decorStyle, color: '#404040' });
  runtime._updateDecorStyle({ ...c._decorStyle, color: '#8b0000' });
  out.instantStyle = c._decorStyle.color === '#8b0000';
  await new Promise((r) => setTimeout(r, 400));
  out.noEagerWrite = writes.length === 0; // дебаунс ещё держит
  // 750 мс > внутренний дебаунс _saveConfig (500 мс): если бы персист ушёл
  // сразу (без своего дебаунса в 1 с), запись уже долетела бы до callWS
  await new Promise((r) => setTimeout(r, 350));
  out.stillNoWriteBeforeDebounce = writes.length === 0;
  await new Promise((r) => setTimeout(r, 550));
  c._saveConfigDebounced?.flush?.();
  await new Promise((r) => setTimeout(r, 200));
  out.oneWrite = writes.length === 1;
  out.writeCarriesKey = !!writes[0] && writes[0].color === '#8b0000'
    && writes[0].width_cm === 3.6 && writes[0].fill === false;

  // возврат в дефолт = запись БЕЗ ключа
  runtime._updateDecorStyle({
    color: '#607d8b', opacity: 1, widthCm: 3.6,
    fill: false, fillColor: '#607d8b', fillOpacity: 0.25,
  });
  await new Promise((r) => setTimeout(r, 1100));
  c._saveConfigDebounced?.flush?.();
  await new Promise((r) => setTimeout(r, 200));
  out.defaultRemovesKey = writes.length === 2 && writes[1] === null;

  // AC5: карта, рождённая с ключом, сеет _decorStyle из него.
  // Чистый reload: кэш мгновенного рендера убираем, чтобы посев шёл из
  // серверного конфига (после настоящей записи кэш нёс бы тот же ключ).
  localStorage.removeItem('houseplan_card_cfg_v1');
  const fresh = document.createElement('houseplan-card');
  fresh.setConfig({ type: 'custom:houseplan-card' });
  fresh.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') {
      const r = await base(m);
      const config = JSON.parse(JSON.stringify(r.config));
      config.settings = { ...(config.settings || {}),
        decor_default_style: { color: '#8b0000', width_cm: 5 } };
      return { ...r, config, rev };
    }
    return base(m);
  } };
  document.body.appendChild(fresh);
  const t0 = Date.now();
  while (!fresh._serverCfg && Date.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 60));
  out.seeded = fresh._decorStyle.color === '#8b0000'
    && fresh._decorStyle.widthCm === 5
    && fresh._decorStyle.fillColor === '#607d8b'; // частичный ключ наследует дефолт
  fresh.remove();
  return out;
});
checkAll(res, ['decorMode', 'hasRuntime', 'instantStyle', 'noEagerWrite',
  'stillNoWriteBeforeDebounce', 'oneWrite',
  'writeCarriesKey', 'defaultRemovesKey', 'seeded']);
await finish(browser);
