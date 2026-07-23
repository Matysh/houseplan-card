import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('devices'); await c.updateComplete;
  // новый маркер: радио «Виртуальное» по умолчанию, списка нет
  c._openMarkerDialog(); await c.updateComplete;
  const radios = () => [...sr().querySelectorAll('.bindsel input[type="radio"]')];
  out.twoRadios = radios().length === 2;
  out.virtDefault = radios()[0].checked && !radios()[1].checked;
  out.noDropWhenVirtual = !sr().querySelector('.dropbtn');
  // переключить на «Из списка HA» → появляется дропдаун, открыт (нет выбора), сейв заблокирован
  radios()[1].click(); await c.updateComplete;
  out.dropShown = !!sr().querySelector('.dropbtn');
  out.panelOpen = !!sr().querySelector('.droppanel');
  const saveBtn = [...sr().querySelectorAll('.dialog .btn.on')].pop();
  out.saveDisabled = saveBtn?.disabled === true;
  // без чекбокса в списке нет individual-сущностей устройств
  const subs = () => [...sr().querySelectorAll('.cand .cs')].map((e) => e.textContent);
  const entLabel = c._t('marker.sub_entity');
  out.noDeviceEntities = !subs().some((s) => s.includes(entLabel));
  // (группы/хелперы в демо все уже размещены и потому скрыты как занятые —
  // их «всегда в списке» проверяется кодом: блок вне чекбокса)
  // включить чекбокс → сущности появились
  const cb = sr().querySelector('.entcheck input');
  cb.click(); await c.updateComplete;
  out.entitiesShown = [...sr().querySelectorAll('.cand .cs')].some((s) => s.textContent.includes(entLabel));
  out.tooltip = sr().querySelector('.entcheck').getAttribute('title') === c._t('marker.show_entities_tip');
  // выбрать первый кандидат → панель закрылась, сейв разблокирован
  sr().querySelector('.cand').click(); await c.updateComplete;
  out.picked = c._markerDialog.binding !== '' && c._markerDialog.binding !== 'virtual';
  out.panelClosed = !sr().querySelector('.droppanel');
  out.saveEnabled = [...sr().querySelectorAll('.dialog .btn.on')].pop()?.disabled === false;
  // радио назад на «Виртуальное» → binding=virtual
  radios()[0].click(); await c.updateComplete;
  out.backToVirtual = c._markerDialog.binding === 'virtual' && c._markerDialog.bindingMode === 'virtual';
  c._markerDialog = null; await c.updateComplete;
  // редактирование существующего устройства: радио «Из списка», выбранная привязка в кнопке
  const dev = c._devices.find((d) => !d.virtual && d.bindingKind === 'device');
  c._openMarkerDialog(dev); await c.updateComplete;
  out.editHaMode = c._markerDialog.bindingMode === 'ha';
  out.editShowsCur = sr().querySelector('.dropbtn b') !== null;
  out.editPanelClosed = !sr().querySelector('.droppanel');
  c._markerDialog = null;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
