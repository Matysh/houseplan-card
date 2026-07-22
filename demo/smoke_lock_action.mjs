import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];
  c.hass = { ...c.hass, callService: (d, s, data) => calls.push([d, s, data.entity_id]) };
  await c.updateComplete;
  // добавить дверь с замком на f1
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({
    ...s, openings: [{ id: 'op1', type: 'door', rx: 550, ry: 200, angle: 90, len_cm: 90, lock: 'lock.front_door' }] })) };
  c.requestUpdate(); await c.updateComplete;
  const op = c._spaceModel()?.openings?.[0] || { id: 'op1', type: 'door', rx: 550, ry: 200, len_cm: 90, lock: 'lock.front_door' };
  out.hasLockedDoor = !!op.lock;
  const lockId = op.lock;
  // 1) замок закрыт → кнопка "Unlock"
  c.hass = { ...c.hass, states: { ...c.hass.states, [lockId]: { state: 'locked', attributes: {} } } };
  c._openingInfo = op; await c.updateComplete;
  let btn = sr().querySelector('.btn.lockact');
  out.unlockBtnShown = !!btn && !btn.disabled;
  out.unlockBtnDanger = btn?.classList.contains('warn');
  btn.click();
  out.unlockCalled = JSON.stringify(calls.at(-1)) === JSON.stringify(['lock', 'unlock', lockId]);
  // 2) замок открыт → кнопка "Lock"
  c.hass = { ...c.hass, states: { ...c.hass.states, [lockId]: { state: 'unlocked', attributes: {} } } };
  await c.updateComplete;
  btn = sr().querySelector('.btn.lockact');
  btn.click();
  out.lockCalled = JSON.stringify(calls.at(-1)) === JSON.stringify(['lock', 'lock', lockId]);
  // 3) переходное состояние → кнопка задизейблена, сервис не зовётся
  c.hass = { ...c.hass, states: { ...c.hass.states, [lockId]: { state: 'unlocking', attributes: {} } } };
  await c.updateComplete;
  btn = sr().querySelector('.btn.lockact');
  out.pendingDisabled = !!btn && btn.disabled;
  // 4) недоступен → кнопки нет
  c.hass = { ...c.hass, states: { ...c.hass.states, [lockId]: { state: 'unavailable', attributes: {} } } };
  await c.updateComplete;
  out.noBtnWhenUnavailable = !sr().querySelector('.btn.lockact');
  // 5) тап по иконке на плане по-прежнему НЕ дёргает замок (hard block)
  const n = calls.length;
  const dev = c._devices.find((d) => d.domains?.includes('lock'));
  out.planTapStillBlocked = true;
  if (dev) {
    c._clickDevice(new MouseEvent('click'), dev); await c.updateComplete;
    out.planTapStillBlocked = !calls.slice(n).some((x) => x[0] === 'lock' && (x[1] === 'lock' || x[1] === 'unlock'));
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
