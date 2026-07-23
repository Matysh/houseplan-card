import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) в селекте действий 3 опции, дефолт «Карточка устройства»
  c._setMode('devices'); await c.updateComplete;
  const dev = c._devices.find((d) => !d.virtual && d.primary);
  c._openMarkerDialog(dev); await c.updateComplete;
  const sel = [...sr().querySelectorAll('.dialog select')].find((s) =>
    [...s.options].some((o) => o.textContent === c._t('tap.toggle')));
  out.threeOptions = sel && sel.options.length === 3;
  out.noAutoOption = sel && ![...sel.options].some((o) => o.value === '');
  out.defaultInfo = sel && sel.value === 'info';
  c._markerDialog = null; await c.updateComplete;
  // 2) правый клик в Просмотре открывает more-info
  c._setMode('view'); await c.updateComplete;
  let moreInfo = null;
  c._openMoreInfo = (eid) => { moreInfo = eid; };
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  c._ctxDevice(ev, dev);
  out.ctxMoreInfo = moreInfo === dev.primary;
  out.ctxPrevented = ev.defaultPrevented;
  // 3) в редакторах правый клик не перехватывается
  c._setMode('devices'); await c.updateComplete;
  moreInfo = null;
  const ev2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  c._ctxDevice(ev2, dev);
  out.editorNative = moreInfo === null && !ev2.defaultPrevented;
  // 4) виртуальное без primary → инфо-карточка
  c._setMode('view'); await c.updateComplete;
  const virt = c._devices.find((d) => d.virtual && !d.primary) || null;
  if (virt) {
    c._ctxDevice(new MouseEvent('contextmenu', { cancelable: true }), virt);
    out.virtInfo = c._infoCard === virt;
    c._infoCard = null;
  } else out.virtInfo = 'no-virt';
  // 5) card-wide tap_action игнорируется: без явного действия клик = инфо
  c._config = { ...c._config, tap_action: 'toggle' };
  const calls = [];
  c.hass = { ...c.hass, callService: (d2, s2, data) => { calls.push([d2, s2, data]); return Promise.resolve(); } };
  await c.updateComplete;
  const plain = c._devices.find((d) => !d.virtual && d.primary?.startsWith('light.') && !d.tapAction);
  if (plain) {
    c._infoCard = null;
    c._clickDevice(new MouseEvent('click'), plain);
    out.cardTapIgnored = calls.length === 0 && !!c._infoCard;
    c._infoCard = null;
  } else out.cardTapIgnored = 'no-plain-light';
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
