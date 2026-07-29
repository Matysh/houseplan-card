import { launch, check, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) кнопка настроек комнаты в редакторе плана: заметная, фиксированного размера
  c._setMode('plan'); await c.updateComplete;
  const btn = sr().querySelector('.rlgearbtn');
  out.gearButtonShown = !!btn;
  const cs = btn ? getComputedStyle(btn) : null;
  // 2026-07-29: владелец вдвое уменьшил кнопку — контракт теперь не «не
  // меньше N px», а «размер от иконки устройства и кликабельность»
  out.gearReadable = cs ? parseFloat(cs.fontSize) > 0 && cs.pointerEvents === 'auto' : null;
  out.gearHasLabel = btn ? btn.textContent.trim().length > 0 : null;
  const box = btn?.getBoundingClientRect();
  // (в редакторе плана .dev скрыты display:none — сравнивать не с чем)
  out.gearTapTarget = box ? box.height > 6 && box.height < 40 : null;
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await c.updateComplete;
  out.gearOpensDialog = c._roomDialog === true && !!c._roomEditId;
  c._roomDialogCancel(); await c.updateComplete;
  // 2) комната без имени тоже получает кнопку (её там и называют)
  const room = c._curSpaceCfg.rooms[0];
  const savedName = room.name;
  room.name = '';
  c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  out.unnamedStillHasGear = sr().querySelectorAll('.rlgearbtn').length >= 1;
  room.name = savedName; c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  // 3) метрики стали крупнее: 0.75em вместо 0.62em
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
    ...s, settings: { ...(s.settings || {}), show_names: true, label_temp: true } })) };
  c._setMode('view'); c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 150));
  const lbl = [...sr().querySelectorAll('.roomlabel')].find((l) => l.querySelector('.rlmetrics'));
  if (lbl) {
    const nameSz = parseFloat(getComputedStyle(lbl.querySelector('.rlname')).fontSize);
    const metaSz = parseFloat(getComputedStyle(lbl.querySelector('.rlmetrics')).fontSize);
    out.metricsRatio = Math.round((metaSz / nameSz) * 100) / 100;
  } else out.metricsRatio = 'no-metrics';
  // 4) касание помечает сессию как тач и гасит тултип
  c._tip = { x: 1, y: 1, title: 't', meta: 'm' };
  c._notePointer(new PointerEvent('pointerdown', { pointerType: 'touch' }));
  out.touchClearsTip = c._tip === null;
  c._showTip(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }), 'x', 'y');
  out.noTipAfterTouch = !c._tip;
  return out;
});
check('metricsRatio 0.75', res.metricsRatio, 0.75);
delete res.metricsRatio;
checkAll(res);
await finish(browser, res);
