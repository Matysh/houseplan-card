// review CR-1: exercise EVERY actuation path and prove locks/alarms are safe
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const calls = [];
  c.hass = { ...c.hass, callService: (d, s, data) => { calls.push(`${d}.${s}:${data.entity_id}`); return Promise.resolve(); },
    states: { ...c.hass.states,
      'lock.front_door': { state: 'locked', attributes: { friendly_name: 'Front door' } },
      'alarm_control_panel.home': { state: 'armed_away', attributes: {} } } };
  await c.updateComplete;
  c._setMode('view'); await c.updateComplete;
  const lockCalls = () => calls.filter((x) => x.includes('lock.') || x.includes('alarm_control_panel.'));
  // 1) тап по значку устройства с замком
  const lockDev = c._devices.find((d) => d.entities?.some((e) => e.startsWith('lock.'))) || c._devices[0];
  const fake = { ...lockDev, primary: 'lock.front_door', tapAction: 'toggle',
    marker: { ...(lockDev.marker || {}), tap_action: 'toggle' } };
  c._clickDevice(new MouseEvent('click'), fake);
  out.iconTapSafe = lockCalls().length === 0;
  // 2) controls[] с замком внутри
  const withControls = { ...fake, tapAction: 'toggle',
    marker: { controls: ['lock.front_door', 'alarm_control_panel.home'], tap_action: 'toggle' } };
  c._clickDevice(new MouseEvent('click'), withControls);
  out.controlsSafe = lockCalls().length === 0;
  // 3) карточка устройства: замок отдаётся в more-info, а не тумблером
  const kinds = c._cardEntities({ ...fake, entities: ['lock.front_door', 'alarm_control_panel.home'] });
  out.cardNoToggleForLocks = kinds.every((k) => k.kind !== 'toggle');
  c._cardToggle('lock.front_door');
  c._cardToggle('alarm_control_panel.home');
  out.cardToggleRefuses = lockCalls().length === 0;
  // 4) кнопка в карточке двери — единственная разрешённая поверхность, и спрашивает подтверждение
  let asked = null;
  window.confirm = (msg) => { asked = msg; return false; };
  c._lockAction('lock.front_door', 'unlock');
  out.unlockAsksConfirm = asked !== null && lockCalls().length === 0;
  window.confirm = () => true;
  c._lockAction('lock.front_door', 'unlock');
  out.unlockAfterConfirm = calls.at(-1) === 'lock.unlock:lock.front_door';
  // запирание не спрашивает
  asked = null;
  window.confirm = (m) => { asked = m; return true; };
  c._lockAction('lock.front_door', 'lock');
  out.lockNoConfirm = asked === null && calls.at(-1) === 'lock.lock:lock.front_door';
  return out;
});
checkAll(res);
await finish(browser, res);
