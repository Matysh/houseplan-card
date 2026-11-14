import assert from 'node:assert/strict';
import test from 'node:test';
import { renderHeaderActions, renderHiddenDevicesToggle } from '../test-build/header-menu.js';
const templates = result => [result, ...result.values.filter(value => value?.strings && value?.values).flatMap(templates)];

test('#1184 direct header actions retain their targets and callbacks', () => {
  const handlers = { settings() {}, pdf() {}, support() {} };
  const actions = renderHeaderActions(key => key, handlers);
  for (const handler of Object.values(handlers)) assert.ok(templates(actions).some(result => result.values.includes(handler)));
  for (const key of ['settings', 'pdf', 'support']) assert.ok(templates(actions).some(result => result.strings.join('').includes('data-hp="' + key + '"')));
  const limited = renderHeaderActions(key => key, { settings: handlers.settings, support: handlers.support });
  assert.equal(templates(limited).some(result => result.strings.join('').includes('data-hp="pdf"')), false);
  const toggle = () => {};
  for (const shown of [false,true]) {
    const result = renderHiddenDevicesToggle(key => key, shown, toggle);
    assert.ok(result.values.includes(toggle));
    assert.ok(result.values.includes(String(shown)));
  }
});
