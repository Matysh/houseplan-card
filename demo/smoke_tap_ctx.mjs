import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
// The entityless branch needs an actual saved virtual marker; the ordinary
// demo no longer guarantees one. Seed it through the public server/layout API.
await page.evaluate(async () => {
  let space;
  await window.__hpTest.setServerConfig(cfg => {
    space = cfg.spaces[0].id;
    return { ...cfg, markers: [...cfg.markers, {
      id: 'ctx_virtual', binding: 'virtual', space, name: 'Virtual context target',
      tap_action: 'settings',
    }] };
  });
  await window.__hpTest.setLayout(layout => ({ ...layout,
    ctx_virtual: { s: space, x: 0.35, y: 0.45 },
  }));
  await window.__hpTest.switchSpace(space);
});
const prepared = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) Единый селектор содержит ровно шесть актуальных действий;
  // legacy cover и пустая авто-опция в UI не возвращаются.
  c._setMode('devices'); await c.updateComplete;
  // v1.39.0: у ЛАМП дефолт 'toggle', поэтому для проверки дефолта 'info'
  // берём заведомо не-световое устройство
  const dev = c._devices.find((d) => !d.virtual && d.primary && !d.primary.startsWith('light.'));
  c._openMarkerDialog(dev); await c.updateComplete;
  const sel = sr().querySelector('#marker-tap-action');
  const values = sel ? [...sel.options].map((o) => o.value) : [];
  out.sixCurrentOptions = JSON.stringify(values) === JSON.stringify([
    'info', 'more-info', 'settings', 'toggle', 'run', 'none',
  ]);
  out.noLegacyOptions = !values.includes('') && !values.includes('cover');
  out.defaultInfo = sel && sel.value === 'info';
  c._markerDialog = null; await c.updateComplete;
  // #1089: View context menu precedes its explicit Settings command.
  c._setMode('view'); await c.updateComplete;
  window.__tapCtx = {moreInfo:null,prevented:[]};
  c._openMoreInfo = eid => { window.__tapCtx.moreInfo = eid; };
  c.addEventListener('contextmenu', event => {
    // Keep the native event; inspect its final state after dispatch, even if bubbling stops.
    window.__tapCtx.prevented.push(event);
  },true);
  return {out,devId:dev.id};
});
const res=prepared.out;
const card=page.locator('houseplan-card');
const marker=id=>card.locator(`.dev[data-id="${id}"] .device-core`);
const menu=card.locator('[data-hp="device-context-menu"]:not([inert])');
const settle=()=>page.evaluate(()=>window.__hpTest.settled());
for(const [id,key] of [[prepared.devId,'ctxSettings'],['ctx_virtual','virtSettings']]) {
  await marker(id).click({button:'right'});await menu.waitFor({state:'visible'});
  res[`${key}Menu`]=await menu.locator('[data-action="view-device-settings"]').isEnabled()
    &&await page.evaluate(()=>!window.__card._markerDialog&&window.__tapCtx.moreInfo===null);
  await menu.locator('[data-action="view-device-settings"]').click();
  await card.locator('#marker-dialog').waitFor({state:'visible'});
  res[key]=await page.evaluate(id=>window.__card._markerDialog?.devId===id&&window.__tapCtx.moreInfo===null,id);
  await card.locator('#marker-dialog [data-hp="dialog-cancel"]').first().click();await settle();
}
await page.evaluate(()=>window.__hpTest.setMode('devices'));await settle();
await marker(prepared.devId).click({button:'right'});
await card.locator('[data-hp="device-copy"]').waitFor({state:'visible'});
res.editorCopyMenu=await page.evaluate(()=>window.__tapCtx.moreInfo===null);
res.ctxPrevented=await page.evaluate(()=>window.__tapCtx.prevented.length===3&&window.__tapCtx.prevented.every(event=>event.defaultPrevented));
await page.keyboard.press('Escape');await page.evaluate(()=>window.__hpTest.setMode('view'));await settle();
Object.assign(res,await page.evaluate(async devId=>{
  const out={},c=window.__card;
  const dev=c._devices.find(d=>d.id===devId);
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
},prepared.devId));
checkAll(res);
await finish(browser, res);
