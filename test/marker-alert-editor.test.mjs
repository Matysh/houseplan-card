/** Execute the callbacks emitted by the real Lit form, including retired DOM actions. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { MarkerAlertsEditor } from '../test-build/editors/marker-alerts.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';
import { rememberMarkerBaseline, forgetMarkerBaseline } from '../test-build/editors/marker-form-state.js';

function callback(template, marker, event = 'click') {
  if (Array.isArray(template)) {
    for (const item of template) { const found = callback(item, marker, event); if (found) return found; }
  } else if (template?.strings && template.values) {
    let source = '';
    for (let i = 0; i < template.strings.length; i++) {
      source += template.strings[i];
      const open = source.slice(source.lastIndexOf(event === 'input' ? '<input' : '<button'));
      if (template.strings[i].endsWith(`@${event}=`) && open.includes(marker)) return template.values[i];
      const nested = callback(template.values[i], marker, event); if (nested) return nested;
    }
  }
}
function fixture() {
  const hass = { states: { 'sensor.co2': { state: '1500', attributes: {} } },
    entities: { 'sensor.co2': { entity_id: 'sensor.co2', device_id: 'd' } }, devices: {},
    callWS() { throw Error('Nested form attempted a server write'); }, connection: {}, user: { id: 'owner' } };
  const context = new ConfigWriteContext(); context.observe(hass);
  const host = { hass, _planHass: hass, _fullRegistryHass: hass, _config: { language: 'en' },
    _canEdit: true, _kiosk: false, _connectionWasLost: false, isConnected: true, _configWriteContext: context,
    _markerDialog: { name: 'Device', binding: 'device:d', busy: false }, _markers: [],
    requestUpdate() {}, addController() {}, _t: key => key };
  const runtime = { host, _markerPreviewDevice: draft => ({ id: 'd', name: 'Device', space: 'floor',
    bindingKind: 'device', bindingRef: 'd', bindingStatus: { kind: 'active' },
    marker: { id: 'd', binding: draft.binding, alert_sources: draft.alertSources } }) };
  rememberMarkerBaseline(host, host._markerDialog);
  const editor = new MarkerAlertsEditor(runtime);
  const action = (view, id) => { const fn = callback(view, `data-hp="${id}"`); assert.equal(typeof fn, 'function', id); return fn; };
  const enter = value => { const fn = callback(editor.renderConstructor(), 'data-field="alarm-value"', 'input');
    assert.equal(typeof fn, 'function'); fn({ target: { value } }); };
  return { host, editor, action, enter, open: () => action(editor.renderSection(), 'alarm-create')(),
    ok: () => action(editor.renderConstructor(), 'alarm-ok')(), cancel: () => action(editor.renderConstructor(), 'alarm-cancel')() };
}

test('#1000 retired constructor OK/Cancel cannot mutate or close a newly opened draft', () => {
  const f = fixture(); f.open(); f.enter('1000');
  const staleOK = f.action(f.editor.renderConstructor(), 'alarm-ok');
  const staleCancel = f.action(f.editor.renderConstructor(), 'alarm-cancel');
  f.cancel(); assert.equal(callback(f.editor.renderConstructor(), 'data-hp="alarm-ok"'), undefined);
  f.open(); f.enter('900');
  staleOK(); staleCancel();
  assert.equal(f.host._markerDialog.alertSources, undefined);
  f.ok(); assert.equal(f.host._markerDialog.alertSources[0].value, 900);
  assert.equal(callback(f.editor.renderConstructor(), 'data-hp="alarm-ok"'), undefined);
  f.editor.close();
});

test('#1000 table actions retain outer session and current authority, not a later reopened marker', () => {
  const f = fixture(); f.open(); f.enter('1000'); f.ok();
  const staleRemove = f.action(f.editor.renderSection(), 'alarm-remove');
  forgetMarkerBaseline(f.host); f.host._markerDialog = structuredClone(f.host._markerDialog);
  rememberMarkerBaseline(f.host, f.host._markerDialog);
  staleRemove(); assert.equal(f.host._markerDialog.alertSources.length, 1);
  f.action(f.editor.renderSection(), 'alarm-remove')(); assert.equal(f.host._markerDialog.alertSources, undefined);
  const staleCreate = f.action(f.editor.renderSection(), 'alarm-create');
  f.host._canEdit = false; staleCreate(); f.host._canEdit = true;
  assert.equal(callback(f.editor.renderConstructor(), 'data-hp="alarm-ok"'), undefined);
  f.open(); f.enter('1100'); const staleOK = f.action(f.editor.renderConstructor(), 'alarm-ok');
  f.host.hass = { ...f.host.hass, connection: {} }; f.host._configWriteContext.observe(f.host.hass);
  staleOK(); assert.equal(f.host._markerDialog.alertSources, undefined);
  f.editor.close();
});
