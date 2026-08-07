import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
// Reproduce the narrow wall-tablet/mobile dialog from the field report.
await page.setViewportSize({ width: 390, height: 760 });
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];
  c.hass = { ...c.hass, callService: (d, s, data) => { calls.push([d, s, data.entity_id]); return Promise.resolve(); } };
  await c.updateComplete;
  c._setMode('view'); await c.updateComplete;
  // устройство с управляемой сущностью
  const dev = c._devices.find((d) => d.entities?.some((e) => e.startsWith('light.') || e.startsWith('switch.')));
  out.hasDev = !!dev;
  c._infoCard = dev; await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  out.infoUsesWideShell = sr().querySelector('hp-dialog')?.hasAttribute('wide') === true;
  const footer = sr().querySelector('.infofooter');
  const footerBox = footer?.getBoundingClientRect();
  const footerButtons = [...(footer?.querySelectorAll('button') || [])];
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
  out.toggles = calls.length > before && calls.at(-1)[1] === 'toggle';
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
  c._infoCard = null; await c.updateComplete;
  return out;
});
checkAll(res);
await finish(browser, res);
