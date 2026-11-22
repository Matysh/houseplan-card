import test from 'node:test';
import assert from 'node:assert/strict';

import { invalidDefaultFloor, fullCardPresentationConfig, invalidFullCardPresentation } from '../test-build/card-editor-validation.js';

const spaces = [{ value: 'home', label: 'Home' }];

test('issue 244 default_floor warning waits for authoritative spaces and preserves raw id', () => {
  const config = { type: 'custom:houseplan-card', default_floor: 'gone', kiosk: true };
  assert.equal(invalidDefaultFloor(config, null, false), null);
  assert.equal(invalidDefaultFloor(config, [], false), null);
  assert.equal(invalidDefaultFloor(config, spaces, true), 'gone');
  assert.equal(config.default_floor, 'gone');
  assert.equal(config.kiosk, true);
});

test('issue 244 default_floor warning is absent for empty and valid values', () => {
  assert.equal(invalidDefaultFloor({}, spaces, true), null);
  assert.equal(invalidDefaultFloor({ default_floor: '' }, spaces, true), null);
  assert.equal(invalidDefaultFloor({ default_floor: 'home' }, spaces, true), null);
});


test('#1516 editing an unrelated Lovelace field retains legacy rotation and rotation inheritance', () => {
  for(const legacy of [undefined, 0, 90]){
    const previous = { type: 'custom:houseplan-card', ...(legacy===undefined?{}:{rotation:legacy}) };
    const updated = fullCardPresentationConfig(previous, { title: 'New', view: '', plan_rotation: '' });
    assert.deepEqual(updated,{...previous,title:'New'});
  }
});
test('#1516 explicit zero, inherited removal and clockwise wrap preserve legacy fallback', () => {
  const base = { rotation: 90 };
  assert.deepEqual(fullCardPresentationConfig(base,{view:'flat',plan_rotation:'0'}),
    {...base,view:'flat',plan_rotation:0});
  assert.deepEqual(fullCardPresentationConfig({...base,view:'iso',plan_rotation:315},{view:'flat'}),
    {...base,view:'flat',plan_rotation:0});
  assert.deepEqual(fullCardPresentationConfig({...base,view:'iso',plan_rotation:45},{view:'',plan_rotation:''}),base);
  assert.equal(invalidFullCardPresentation({view:'flat',plan_rotation:45}),true);
  assert.equal(invalidFullCardPresentation({plan_rotation:45}),false);
});
