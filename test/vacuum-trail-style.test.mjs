import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VACUUM_TRAIL_DEFAULT,
  vacuumTrailStyle, previewVacuumTrailStyle, vacuumTrailWriteFields, vacuumTrailCss,
} from '../test-build/vacuum-trail-style.js';

test('#1002 AC1 legacy/null/default and independent fields, including zero alpha', () => {
  for (const input of [undefined, null, {}, { trail_color: null, trail_opacity: null }])
    assert.deepEqual(vacuumTrailStyle(input), { color: '#64B5F6', opacity: 0.7 });
  assert.deepEqual(vacuumTrailStyle({ trail_color: '#ff00aa' }), { color: '#FF00AA', opacity: 0.7 });
  assert.deepEqual(vacuumTrailStyle({ trail_opacity: 0 }), { color: '#64B5F6', opacity: 0 });
  assert.ok(Object.isFrozen(VACUUM_TRAIL_DEFAULT));
  assert.equal(vacuumTrailCss(vacuumTrailStyle({ trail_color: '#abcdef', trail_opacity: 0 })),
    '--hp-vacuum-trail-color:#ABCDEF;--hp-vacuum-trail-opacity:0');
});

test('#1002 AC1/AC3 malformed read fields cannot become CSS or alpha coercions', () => {
  for (const trail_color of ['red', '#fff', 'url(https://example.invalid/a)', '#123456;opacity:0', '', 3, true])
    assert.equal(vacuumTrailStyle({ trail_color }).color, '#64B5F6');
  for (const trail_opacity of [true, false, '0.7', NaN, Infinity, -0.1, 1.1])
    assert.equal(vacuumTrailStyle({ trail_opacity }).opacity, 0.7);
});

test('#1002 AC2 preview belongs to one exact marker and disappears with the dialog', () => {
  const a = { trail_color: '#ff0000', trail_opacity: 0.2 };
  const b = { trail_color: '#0000ff', trail_opacity: 0.8 };
  const draft = { devId: 'a', vacuumTrail: { color: '#00ff00', opacity: 1 } };
  const before = JSON.stringify([a,b]);
  assert.deepEqual(previewVacuumTrailStyle('a', a, draft), { color: '#00FF00', opacity: 1 });
  assert.deepEqual(previewVacuumTrailStyle('b', b, draft), { color: '#0000FF', opacity: 0.8 });
  for (const closed of [null, undefined, { devId: 'a' }, { devId: 'b', vacuumTrail: draft.vacuumTrail }])
    assert.deepEqual(previewVacuumTrailStyle('a', a, closed), { color: '#FF0000', opacity: 0.2 });
  assert.equal(JSON.stringify([a,b]), before, 'preview never mutates stored config');
});

test('#1002 AC2/AC3 write is explicit, merges latest route/source and keeps unknown fields', () => {
  const latest = { source:'camera.new', live:false, map_routes:[{id:'new'}], calibration:{old:[1,0,0,1,0,0]}, future:{v:4} };
  const before = structuredClone(latest);
  assert.deepEqual(vacuumTrailWriteFields(latest, {}), {});
  assert.deepEqual(vacuumTrailWriteFields(undefined, {}), {}, 'no default materialisation');
  const result = vacuumTrailWriteFields(latest, { devId:'v', vacuumTrail:{color:'#aBc123',opacity:0} });
  assert.deepEqual(result.vacuum, {...latest,trail_color:'#ABC123',trail_opacity:0});
  assert.deepEqual(latest, before);
  for (const value of [{color:'red',opacity:1},{color:'#abcdef',opacity:true},{color:'#abcdef',opacity:Infinity}])
    assert.throws(()=>vacuumTrailWriteFields(latest,{vacuumTrail:value}), /Invalid/);
});
