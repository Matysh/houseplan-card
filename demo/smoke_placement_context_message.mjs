// #907: a real registry-Area queue reaches the early point-write refusal.
// Public HA gap + rejected first transport, never a private guard/ACK patch.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('placement context message');

for (const language of ['ru', 'en']) {
  const { page, browser } = await launch({ width: 1000, height: 850 }, 1);
  const result = await page.evaluate(async language => {
    const c = window.__card, hp = window.__hpTest;
    const pause = () => new Promise(resolve => setTimeout(resolve, 20));
    const until = async predicate => {
      const deadline = performance.now() + 6000;
      while (!predicate()) {
        if (performance.now() > deadline) throw new Error('#907 relocation did not start');
        await pause();
      }
    };
    c.setConfig({ ...c._config, language });
    await hp.setServerConfig(cfg => {
      cfg.settings.marker_area_snapshot = { ...cfg.settings.marker_area_snapshot,
        d_light1: { binding: 'device:d_light1', area: 'living_room' },
        d_lamp: { binding: 'device:d_lamp', area: 'living_room' } };
      return cfg;
    });
    await hp.setLayout(layout => ({ ...layout,
      d_light1: { s: 'f1', x: .22, y: .22 }, d_lamp: { s: 'f1', x: .42, y: .5 } }));
    const original = c.hass, callWS = original.callWS;
    const saved = await callWS({ type: 'houseplan/layout/get' });
    const calls = [];
    let rejectFirst, entered = false;
    const held = new Promise((_resolve, reject) => { rejectFirst = reject; });
    c.hass = { ...original, callWS: async message => {
      if (/houseplan\/(layout\/(update|delete)|config\/set)$/.test(message.type)) calls.push(message);
      if (!entered && message.type === 'houseplan/layout/delete') {
        entered = true;
        await held;
      }
      return callWS(message);
    } };
    window.__setRegistryArea('device', 'd_light1', 'kitchen');
    window.__setRegistryArea('device', 'd_lamp', 'kitchen');
    await until(() => entered);
    // The first point request rejects normally. The next real relocation
    // decision hits the early guard while HA is temporarily absent.
    c.hass = null;
    rejectFirst(new Error('first relocation fixture refusal'));
    await c._areaRelocationWrite;
    const interruptedCalls = calls.map(message => ({ type: message.type, id: message.device_id }));
    const after = await callWS({ type: 'houseplan/layout/get' });
    c.hass = original;
    await window.__hpTest.settled();
    const toast = window.__hpTest.toast()?.textContent.trim() || '';
    const expected = language === 'ru'
      ? 'Контекст Home Assistant изменился. Повторите действие.'
      : 'Home Assistant context changed. Try again.';
    return {
      toast, interruptedCalls,
      humanMessage: toast.includes(expected),
      noRawContext: !/config authority changed|context-changed|err\./.test(toast),
      earlyRefusalMadeNoAdditionalWrite: interruptedCalls.length === 1
        && interruptedCalls[0].type === 'houseplan/layout/delete',
      serverUnchangedWhileRefused: JSON.stringify(after) === JSON.stringify(saved),
      noSuccess: !/successfully|Сохранено|Saved/.test(toast),
    };
  }, language);
  const { toast, interruptedCalls, ...checks } = result;
  console.log(JSON.stringify({ language, toast, interruptedCalls }));
  checkAll(checks);
  await finish(browser, checks);
}
