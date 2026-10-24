import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
globalThis.window = { customCards: [] };
after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; });
const { HouseplanEditorRuntime } = await import('../test-build/houseplan-editor-runtime.js');

test('#844 the real runtime refuses a forbidden entry before acknowledgement or draft mutation', () => {
  for (const [writer, kiosk] of [[false, false], [false, true], [true, true]]) {
    const acknowledgements = [], notices = [];
    const host = { _canEdit: writer, _kiosk: kiosk, _norm: false,
      _vacAllCamerasFor: 'retained', _vacAllCameraCache: 'retained',
      _markerDialog: null, _ackNewDevice: id => acknowledgements.push(id),
      _showToast: key => notices.push(key), _t: key => key };
    const runtime = Object.create(HouseplanEditorRuntime.prototype);
    runtime.host = host;
    runtime._openMarkerDialog({ id: 'new-device' });
    assert.deepEqual(acknowledgements, [], `${writer}/${kiosk}: no acknowledgement`);
    assert.equal(host._markerDialog, null);
    assert.equal(host._vacAllCamerasFor, 'retained');
    assert.equal(host._vacAllCameraCache, 'retained');
    assert.deepEqual(notices, []);
  }
});

test('#1050 actual dialog owner rechecks a retired current-target resolver after deferred Properties',()=>{
  const acknowledgements=[],selected=[];
  const initial={id:'current',name:'old'},fresh={id:'current',name:'fresh'};
  let current=initial,retry;
  const host={_canEdit:true,_kiosk:false,_norm:false,_markerDialog:null,
    _vacAllCamerasFor:'retained',_vacAllCameraCache:'retained',
    _ackNewDevice:id=>acknowledgements.push(id),_showToast:()=>{},_t:key=>key};
  const runtime=Object.create(HouseplanEditorRuntime.prototype);runtime.host=host;
  runtime.properties={beforeIntent:callback=>{retry=callback;return false;},selectDevice:d=>{selected.push(d);return true;}};
  runtime._openMarkerDialog(initial,()=>current);
  assert.equal(typeof retry,'function');
  assert.deepEqual(acknowledgements,[]);
  current=null;retry();
  assert.deepEqual(selected,[]);assert.deepEqual(acknowledgements,[]);
  assert.equal(host._vacAllCamerasFor,'retained');assert.equal(host._markerDialog,null);
  current=fresh;runtime.properties.beforeIntent=()=>true;
  runtime._openMarkerDialog(initial,()=>current);
  assert.deepEqual(selected,[fresh]);assert.deepEqual(acknowledgements,['current']);
});
