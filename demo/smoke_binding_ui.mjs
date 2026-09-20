import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('devices'); await c.updateComplete;
  // новый маркер: радио «Виртуальное» по умолчанию, списка нет
  c._openMarkerDialog(); await c.updateComplete;
  // #600: привязка — сегмент набора (те же радио с именем bmode), кнопка выбора
  // и панель в потоке (#marker-binding, .hpf-panel), «Show entities» — внутри панели (Q8)
  const radios = () => [...sr().querySelectorAll('input[name="bmode"]')];
  out.twoRadios = radios().length === 2;
  out.virtDefault = radios()[0].checked && !radios()[1].checked;
  out.noDropWhenVirtual = !sr().querySelector('#marker-binding');
  // переключить на «Из списка HA» → появляется дропдаун, открыт (нет выбора), сейв заблокирован
  radios()[1].click(); await c.updateComplete;
  out.dropShown = !!sr().querySelector('#marker-binding');
  out.panelOpen = !!sr().querySelector('hp-dialog .hpf-panel');
  const saveBtn = [...sr().querySelectorAll('hp-dialog .btn.on')].pop();
  out.saveDisabled = saveBtn?.disabled === true;
  // без чекбокса в списке нет individual-сущностей устройств
  const subs = () => [...sr().querySelectorAll('.hpf-cand small')].map((e) => e.textContent);
  const entLabel = c._t('marker.sub_entity');
  out.noDeviceEntities = !subs().some((s) => s.includes(entLabel));
  // (группы/хелперы в демо все уже размещены и потому скрыты как занятые —
  // их «всегда в списке» проверяется кодом: блок вне чекбокса)
  // включить чекбокс → сущности появились
  const cb = sr().querySelector('hp-dialog .hpf-panel #marker-show-entities');
  cb.click(); await c.updateComplete;
  out.entitiesShown = [...sr().querySelectorAll('.hpf-cand small')].some((s) => s.textContent.includes(entLabel));
  out.tooltip = sr().querySelector('hp-dialog .hpf-panel .hpf-check').getAttribute('title') === c._t('marker.show_entities_tip');
  // выбрать первый кандидат → панель закрылась, сейв разблокирован
  sr().querySelector('.hpf-cand').click(); await c.updateComplete;
  out.picked = c._markerDialog.binding !== '' && c._markerDialog.binding !== 'virtual';
  out.panelClosed = !sr().querySelector('hp-dialog .hpf-panel');
  out.saveEnabled = [...sr().querySelectorAll('hp-dialog .btn.on')].pop()?.disabled === false;
  // радио назад на «Виртуальное» → binding=virtual
  radios()[0].click(); await c.updateComplete;
  out.backToVirtual = c._markerDialog.binding === 'virtual' && c._markerDialog.bindingMode === 'virtual';
  c._markerDialog = null; await c.updateComplete;
  // редактирование существующего устройства: радио «Из списка», выбранная привязка в кнопке
  const dev = c._devices.find((d) => !d.virtual && d.bindingKind === 'device');
  c._openMarkerDialog(dev); await c.updateComplete;
  out.editHaMode = c._markerDialog.bindingMode === 'ha';
  out.editShowsCur = sr().querySelector('#marker-binding b') !== null;
  out.editPanelClosed = !sr().querySelector('hp-dialog .hpf-panel');
  c._markerDialog = null;
  return out;
});
checkAll(res);
await finish(browser, res);
