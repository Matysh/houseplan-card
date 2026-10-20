import assert from 'node:assert/strict';
import test from 'node:test';

import { EditorSecondaryController } from '../test-build/editor-secondary.js';

const host = {
  root: () => ({}),
  requestUpdate() {},
  async updateComplete() {},
  clearTip() {},
};

test('editor secondary context returns the current action result and rejects stale actions (#405)', async () => {
  const controller = new EditorSecondaryController(host);

  assert.equal(controller.runContext('current', 'current', () => 42), 42);

  const pending = Promise.resolve('finished');
  assert.equal(controller.runContext('current', 'current', () => pending), pending);
  assert.equal(await controller.runContext('current', 'current', () => pending), 'finished');

  let staleCalled = false;
  assert.equal(controller.runContext('old', 'current', () => {
    staleCalled = true;
    return 'unexpected';
  }), undefined);
  assert.equal(staleCalled, false);
});

function dismissFixture(t) {
  const previous = globalThis.window;
  globalThis.window = {
    addEventListener() {}, removeEventListener() {},
    setTimeout, clearTimeout,
  };
  const controller = new EditorSecondaryController(host);
  t.after(() => { controller.reset(); globalThis.window = previous; });
  const groups = [{ id: 'shapes', label: 'Shapes', icon: '', items: [] }];
  const button = ({ intent = false, disabled = false, inert = false } = {}) => ({
    matches: selector => selector.includes(':disabled') && disabled,
    hasAttribute: name => name === 'data-editor-tool-intent' && intent,
    closest: () => inert ? {} : null,
    classList: { contains: () => false }, dataset: {},
  });
  const event = (type, target) => ({
    type, target, prevented: false, stopped: false,
    composedPath: () => [target],
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  });
  return { controller, groups, button, event };
}

test('#976 direct tool pointer and keyboard intents dismiss without swallowing their activation', t => {
  const { controller, groups, button, event } = dismissFixture(t);
  for (const type of ['pointerdown', 'click']) {
    controller.toggleGroup(groups, 'shapes');
    const input = event(type, button({ intent: true }));
    assert.equal(controller.handleOutsideDismiss(input), false);
    assert.equal(controller.hasOpenGroup, false);
    assert.equal(input.prevented, false);
    assert.equal(input.stopped, false);
  }
});

test('#976 palette dismisses once before a direct tool and retires an earlier swallowed-click tail', t => {
  const { controller, groups, button, event } = dismissFixture(t);
  const target = button({ intent: true });
  controller.toggleGroup(groups, 'shapes');
  const canvas = button();
  assert.equal(controller.handleOutsideDismiss(event('pointerdown', canvas)), true);
  let dismissals = 0;
  controller.render({ contextId: 'furniture', kind: 'palette', content: '', dismiss: () => dismissals++ }, false);
  assert.equal(controller.handleOutsideDismiss(event('pointerdown', target)), false);
  assert.equal(dismissals, 1);
  assert.equal(controller.handleOutsideDismiss(event('click', target)), false);
  assert.equal(dismissals, 1);
  assert.equal(controller.handleOutsideDismiss(event('click', canvas)), false);
});

test('#976 canvas keeps dismiss-only protection, including its compatibility click', t => {
  const { controller, groups, button, event } = dismissFixture(t);
  controller.toggleGroup(groups, 'shapes');
  const target = button();
  const down = event('pointerdown', target);
  const click = event('click', target);
  assert.equal(controller.handleOutsideDismiss(down), true);
  assert.equal(controller.handleOutsideDismiss(click), true);
  assert.equal(down.prevented && click.prevented, true);
  assert.equal(controller.handleOutsideDismiss(event('click', target)), false);
});

test('#976 disabled or inert tools do not gain the explicit-tool exception', t => {
  const { controller, groups, button, event } = dismissFixture(t);
  for (const state of [{ disabled: true }, { inert: true }]) {
    controller.toggleGroup(groups, 'shapes');
    const input = event('pointerdown', button({ intent: true, ...state }));
    assert.equal(controller.handleOutsideDismiss(input), true);
    assert.equal(input.prevented, true);
  }
});
