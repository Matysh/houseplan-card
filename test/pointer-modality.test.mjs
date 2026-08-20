import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextPointerModality, pointerHoverAllowed, pointerModalityOf, PointerModalityController,
} from '../test-build/pointer-modality.js';

const harness = () => {
  const host = {
    enabled: false,
    toggleAttribute(_name, enabled) { this.enabled = enabled; },
  };
  const listeners = new Set();
  const media = {
    matches: true,
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); },
  };
  return {
    host,
    media,
    win: { matchMedia: () => media },
    change(matches) {
      media.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
  };
};

test('pointer modality accepts only explicit pointer types', () => {
  assert.equal(pointerModalityOf('mouse'), 'mouse');
  assert.equal(pointerModalityOf('touch'), 'touch');
  assert.equal(pointerModalityOf('pen'), 'pen');
  assert.equal(pointerModalityOf(''), null);
  assert.equal(pointerModalityOf(undefined), null);
});

test('touch compatibility input cannot restore mouse hover', () => {
  assert.equal(nextPointerModality('unknown', { pointerType: 'touch' }), 'touch');
  assert.equal(nextPointerModality('touch', {
    pointerType: 'mouse', sourceCapabilities: { firesTouchEvents: true },
  }), 'touch');
  assert.equal(nextPointerModality('touch', { pointerType: 'mouse' }), 'mouse');
  assert.equal(nextPointerModality('mouse', { pointerType: 'pen' }), 'pen');
});

test('hover requires both a real mouse authority and hover-capable hardware', () => {
  assert.equal(pointerHoverAllowed('mouse', true), true);
  assert.equal(pointerHoverAllowed('mouse', false), false);
  assert.equal(pointerHoverAllowed('unknown', true), false);
  assert.equal(pointerHoverAllowed('touch', true), false);
  assert.equal(pointerHoverAllowed('pen', true), false);
});

test('controllers isolate card instances and revalidate hybrid input', () => {
  const a = harness();
  const b = harness();
  const first = new PointerModalityController(a.host);
  const second = new PointerModalityController(b.host);
  first.connect(a.win);
  second.connect(b.win);

  first.note({ pointerType: 'touch' });
  second.note({ pointerType: 'mouse' });
  assert.equal(a.host.enabled, false);
  assert.equal(b.host.enabled, true);

  first.note({ pointerType: 'mouse' });
  assert.equal(a.host.enabled, true);
  a.change(false);
  assert.equal(a.host.enabled, false);
  a.change(true);
  assert.equal(a.host.enabled, true);
  first.suspend();
  assert.equal(a.host.enabled, false);
  first.disconnect();
  second.disconnect();
});
