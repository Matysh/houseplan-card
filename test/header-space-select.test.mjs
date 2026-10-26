import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseHeaderSpace } from '../test-build/header-space-select.js';

test('pending or refused navigation keeps the accepted field value before calling the guard', () => {
  const field = { value: 'second' };
  const requested = [];
  chooseHeaderSpace(field, 'first', id => {
    assert.equal(field.value, 'first', 'a dirty confirmation must never show an unaccepted floor');
    requested.push(id);
  });
  assert.deepEqual(requested, ['second']);
  assert.equal(field.value, 'first');
});

test('a navigation failure cannot leave the selector on an unaccepted floor', () => {
  const field = { value: 'retired-floor' };
  assert.throws(() => chooseHeaderSpace(field, 'first', () => { throw new Error('unavailable'); }), /unavailable/);
  assert.equal(field.value, 'first');
});
