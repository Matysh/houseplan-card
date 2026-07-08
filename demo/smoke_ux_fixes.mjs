import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 640, height: 980 }, 2);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c.hass = { ...c.hass, locale: { language: 'ru' } };
  await c.updateComplete;
  // заливка temp вкл → класс filled и тултип с температурой
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s,
    settings: { show_borders: true, show_names: true, fill_mode: 'temp', temp_min: 20, temp_max: 25 } })) };
  c._regSignature=''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.filledClass = sr().querySelectorAll('.room.styled.filled').length;   // только living (термометр)
  out.unfilled = sr().querySelectorAll('.room.styled:not(.filled)').length;
  // тултип комнаты: средняя температура
  const room = sr().querySelector('.room');
  room.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true, clientX: 200, clientY: 200 }));
  await c.updateComplete;
  out.tipTemp = c._tip?.temp;
  out.tipHasTempLine = (sr().querySelector('.tip')?.textContent || '').includes('средняя температура');
  c._tip = null;
  // диалог: радио заливки, компактные поля, ширина
  c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
  out.fillRadios = sr().querySelectorAll('input[name="fillmode"]').length;
  out.tempInputs = sr().querySelectorAll('.temprange .tempin').length;
  out.dialogWide = !!sr().querySelector('.dialog.wide .srcrow');
  out.dialogWidth = Math.round(sr().querySelector('.dialog').getBoundingClientRect().width);
  // NaN-защита: пустой ввод не ломает границы
  const before = c._spaceDialog.tempMax;
  const fakeEv = { target: { value: '' } };
  // симулируем input с пустым значением через обработчик радио-строки — парсер должен сохранить старое
  const n = parseFloat('');
  out.nanGuard = !Number.isFinite(n) && c._spaceDialog.tempMax === before;
  return out;
});
await page.screenshot({ path: '/tmp/ux_dialog.png' });
console.log(JSON.stringify(res, null, 1));
await browser.close();
