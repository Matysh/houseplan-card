import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
// Reproduce the narrow wall-tablet/mobile dialog from the field report.
await page.setViewportSize({ width: 390, height: 760 });
await page.evaluate(async () => {
  const c = window.__card;
  c.hass = { ...c.hass,
    entities: { ...c.hass.entities, 'lock.front_door': {
      entity_id: 'lock.front_door', device_id: 'd_light1', platform: 'demo', disabled_by: null,
    } },
    states: { ...c.hass.states, 'lock.front_door': {
      entity_id: 'lock.front_door', state: 'locked', attributes: { friendly_name: 'Front door' },
    } },
  };
  await window.__hpTest.setServerConfig(cfg => {
    cfg.markers = (cfg.markers || []).filter(marker => marker.id !== 'd_light1');
    cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', tap_action: 'info', space: 'f1' });
    return cfg;
  });
});
// A real user entry rather than inventing a private informational snapshot.
await page.locator('[data-hp="device"][data-id="d_light1"]').click();
await page.locator('hp-dialog[data-kind="info"]').waitFor();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];
  c.hass = { ...c.hass, callService: (d, s, data) => { calls.push([d, s, data.entity_id]); return Promise.resolve(); } };
  await c.updateComplete;
  // устройство с управляемой сущностью
  const dev = c._devices.find((d) => d.id === 'd_light1');
  out.hasDev = !!dev;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  out.infoUsesWideShell = sr().querySelector('hp-dialog')?.hasAttribute('wide') === true;
  const footer = sr().querySelector('.infofooter');
  const footerBox = footer?.getBoundingClientRect();
  const footerButtons = [...(footer?.querySelectorAll('button') || [])];
  // #505 release gate: this minimum must not depend on loading summary-panel CSS.
  // Its design rewrite once shrank unrelated dialog actions from 44px to 30px.
  out.footerActionTapTargets = footerButtons.length >= 2
    && footerButtons.every((button) => button.getBoundingClientRect().height >= 44);
  out.footerActionsContained = !!footerBox && footerButtons.length >= 2 && footerButtons.every((button) => {
    const rect = button.getBoundingClientRect();
    return rect.left >= footerBox.left - 1 && rect.right <= footerBox.right + 1;
  });
  // 1) блок сущностей идёт ПЕРВЫМ, до модели/ссылок
  const body = sr().querySelector('hp-dialog .body');
  out.entListFirst = body.firstElementChild?.classList.contains('entlist')
    || body.querySelector('.entlist') === body.children[0];
  const rows = [...sr().querySelectorAll('.entrow')];
  out.rows = rows.length > 0;
  // 2) у переключаемой сущности — кнопка с крупной зоной нажатия
  const btn = sr().querySelector('.entbtn');
  out.hasButton = !!btn;
  const box = btn?.getBoundingClientRect();
  out.tapTarget = box ? box.height >= 30 && box.width >= 60 : null;
  // 3) кнопка реально переключает
  const before = calls.length;
  btn.click(); await c.updateComplete;
  out.toggles = calls.length === before + 1
    && JSON.stringify(calls.at(-1)) === JSON.stringify(['light', 'turn_off', 'light.ceiling']);
  // 4) замок никогда не переключается из карточки
  const n = calls.length;
  c._cardToggle('lock.front_door');
  out.lockNeverToggles = calls.length === n;
  // 5) диагностические/конфиг-сущности не засоряют список
  const ents = c._cardEntities(dev).map((e) => e.eid);
  out.noConfigEntities = ents.every((e) => {
    const cat = c.hass.entities[e]?.entity_category;
    return cat !== 'config' && cat !== 'diagnostic';
  });
  return out;
});
checkAll(res);
await finish(browser, res);
