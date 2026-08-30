import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) Единый селектор содержит ровно пять актуальных действий;
  // legacy cover и пустая авто-опция в UI не возвращаются.
  c._setMode('devices'); await c.updateComplete;
  // v1.39.0: у ЛАМП дефолт 'toggle', поэтому для проверки дефолта 'info'
  // берём заведомо не-световое устройство
  const dev = c._devices.find((d) => !d.virtual && d.primary && !d.primary.startsWith('light.'));
  c._openMarkerDialog(dev); await c.updateComplete;
  const sel = sr().querySelector('#marker-tap-action');
  const values = sel ? [...sel.options].map((o) => o.value) : [];
  out.fiveCurrentOptions = JSON.stringify(values) === JSON.stringify([
    'info', 'more-info', 'toggle', 'run', 'none',
  ]);
  out.noLegacyOptions = !values.includes('') && !values.includes('cover');
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
  // card-wide tap_action игнорируется: НЕ-световое устройство остаётся на инфо
  const plain = c._devices.find((d) => !d.virtual && d.primary
    && !d.primary.startsWith('light.') && !d.tapAction && !d.marker?.controls?.length);
  if (plain) {
    c._infoCard = null;
    c._clickDevice(new MouseEvent('click'), plain);
    out.cardTapIgnored = calls.length === 0 && !!c._infoCard;
    c._infoCard = null;
  } else out.cardTapIgnored = 'no-plain-device';
  // 6) Явный none поглощает click/keyboard, но не запускает ни один эффект.
  if (dev) {
    const originalDevices = c._devices;
    const noOp = { ...dev, tapAction: 'none', marker: { ...dev.marker, tap_action: 'none' } };
    c._devices = originalDevices.map((item) => item.id === dev.id ? noOp : item);
    let bindingChecks = 0;
    let feedback = 0;
    let toasts = 0;
    let wsCalls = 0;
    let serviceCalls = 0;
    const originalBindingActive = c._deviceBindingActive;
    const originalFeedback = c._startDevicePressFeedback;
    const originalToast = c._showToast;
    const originalHass = c.hass;
    const originalCallWS = c.hass.callWS;
    const originalCallService = c.hass.callService;
    c._deviceBindingActive = () => { bindingChecks += 1; return true; };
    c._startDevicePressFeedback = () => { feedback += 1; };
    c._showToast = () => { toasts += 1; };
    c.hass = {
      ...c.hass,
      callWS: (...args) => { wsCalls += 1; return originalCallWS(...args); },
      callService: (...args) => { serviceCalls += 1; return originalCallService(...args); },
    };
    c._infoCard = null;
    c._tapConfirm = null;
    let stopped = false;
    c._clickDevice({ stopPropagation() { stopped = true; } }, noOp);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    c._keyDevice(enter, noOp);
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    c._keyDevice(space, noOp);
    out.noneConsumesActivation = stopped && enter.defaultPrevented && space.defaultPrevented;
    out.noneHasNoEffects = bindingChecks === 0 && feedback === 0 && toasts === 0
      && wsCalls === 0 && serviceCalls === 0 && c._infoCard === null && c._tapConfirm === null;
    c._devices = originalDevices;
    c._deviceBindingActive = originalBindingActive;
    c._startDevicePressFeedback = originalFeedback;
    c._showToast = originalToast;
    c.hass = originalHass;
  } else {
    out.noneConsumesActivation = false;
    out.noneHasNoEffects = false;
  }
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "virtInfo": "no-virt",
});
await finish(browser, res);
