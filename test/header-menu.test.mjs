import assert from 'node:assert/strict';
import test from 'node:test';
import { renderHeaderActions, renderHiddenDevicesToggle } from '../test-build/header-menu.js';

test('#1184 direct header actions retain their targets and callbacks', () => {
  const handlers = { settings() {}, pdf() {}, support() {} };
  const actions = renderHeaderActions(key => key, handlers);
  for (const handler of Object.values(handlers)) assert.ok(actions.values.includes(handler));
  for (const key of ['settings', 'pdf', 'support']) assert.ok(actions.strings.join('').includes('data-hp="' + key + '"'));
  const toggle = () => {};
  for (const shown of [false,true]) {
    const result = renderHiddenDevicesToggle(key => key, shown, toggle);
    assert.ok(result.values.includes(toggle));
    assert.ok(result.values.includes(String(shown)));
  }
});
