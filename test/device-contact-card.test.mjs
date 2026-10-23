import assert from 'node:assert/strict';
import test from 'node:test';
import { contactValueFrameChanged,syncHouseplanDeviceContacts } from '../test-build/device-contact-card.js';
import { spaceModels } from '../test-build/space-geometry.js';
import { floorGeometryKeyReader } from '../test-build/floor-geometry-key.js';

test('#1003 only the held component value rows bypass ordinary gesture deferral',()=>{
  const before={states:{'sensor.a':{state:'23'},'sensor.other':{state:'0'}}};
  const host={_deviceDrag:{id:'a'},_renderDevices:[{id:'a',entities:['sensor.a']}],
    _devicePresentation:()=>({valueBadge:{source:{kind:'entity_state',entity_id:'sensor.a'}}})};
  const renderer={scene:{component:()=>['a']}};
  assert.equal(contactValueFrameChanged(host,renderer,before,{states:{...before.states,'sensor.a':{state:'123'}}}),true);
  assert.equal(contactValueFrameChanged(host,renderer,before,{states:{...before.states,'sensor.other':{state:'1'}}}),false);
  host._deviceDrag=null;
  assert.equal(contactValueFrameChanged(host,renderer,before,{states:{'sensor.a':{state:'123'}}}),false);
});

test('#935 contact walls stay warm for decor edits, but follow every architectural input', () => {
  const raw = { id: 'floor', cell_cm: 5, rooms: [], partitions: [],
    decor: [{ id: 'rect', kind: 'rect', x: .2, y: .2, w: .1, h: .1 }] };
  const host = {
    _cfgEpoch: 1, _renderCfg: { spaces: [raw] }, _curSpaceCfg: raw,
    _renderProjection: 'flat', _mode: 'decor', _markup: false,
    _kioskScale: { icon: 1 }, _renderDevices: [], _deviceHits: {}, renderRoot: {},
    _spaceModel: () => spaceModels(host._renderCfg)[0],
    _spaceDisplayForRender: () => ({ showBorders: true }),
    _wallUnionGeometry: () => { builds++; return { components: [] }; },
    _zeroWalls: () => ({ lines: [] }),
    _invalidateDeviceHitGeometry: () => {},
  };
  host._floorKey = floorGeometryKeyReader(host);
  let builds = 0, frame;
  const renderer = { hit: () => {}, sync: (_, next) => { frame = next; return false; }, clear: () => {} };
  const sync = () => { host._cfgEpoch++; syncHouseplanDeviceContacts(host, renderer); return frame.key; };
  const initial = sync();
  for (let i = 0; i < 40; i++) { raw.decor[0].w += .01; assert.equal(sync(), initial); }
  raw.decor = structuredClone(raw.decor); assert.equal(sync(), initial);
  delete raw.decor; assert.equal(sync(), initial);
  assert.equal(builds, 1, 'decor preview and cancel must not rebuild physical walls');
  for (const [field, value] of [
    ['rooms', [{ id: 'r', x: .1, y: .1, w: .4, h: .4 }]],
    ['wall_segments', [{ id: 'w', a: [.1,.1], b: [.5,.1], cm: 20 }]],
    ['partitions', [{ id: 'p', a: [.2,.2], b: [.4,.2], cm: 0 }]],
    ['openings', [{ id: 'door', x: .3, y: .1, length: .1 }]],
    ['cell_cm', 10], ['zero_wall_style', 'solid'], ['future_geometry', { retained: true }],
  ]) {
    const before = frame.key, count = builds;
    raw[field] = value;
    assert.notEqual(sync(), before, `${field} invalidates the wall input`);
    assert.equal(builds, count + 1);
  }
  const before = frame.key;
  host._curSpaceCfg = { ...raw, cell_cm: 20 };
  assert.notEqual(sync(), before, 'a different current/preview record is still part of the key');
  const updated = frame.key;
  host._renderCfg = { spaces: [{ ...raw, cell_cm: 30 }] };
  assert.notEqual(sync(), updated, 'a replaced model source is still part of the key');
  const count = builds;
  host._spaceDisplayForRender = () => ({ showBorders: false });
  sync(); assert.deepEqual(frame.walls, []); assert.equal(builds, count);
  host._renderProjection = 'iso';
  let cleared = false; renderer.clear = () => { cleared = true; };
  syncHouseplanDeviceContacts(host, renderer); assert.equal(cleared, true);
});
