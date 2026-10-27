import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseHeaderSpace, headerContentWidth } from '../test-build/header-space-select.js';

test('#1092 first header width preserves fractional content-box breakpoints', () => {
  const style = { width:'1048.25px', boxSizing:'border-box', paddingLeft:'10px',
    paddingRight:'12px', borderLeftWidth:'1px', borderRightWidth:'1px' };
  assert.equal(headerContentWidth(style), 1024.25, 'do not round a wide header into the compact range');
  assert.equal(headerContentWidth({...style, width:'1048px'}), 1024);
  assert.equal(headerContentWidth({...style, boxSizing:'content-box', width:'780.5px'}), 780.5);
  assert.equal(headerContentWidth({...style, width:'auto'}), 0);
  assert.equal(headerContentWidth({...style, width:'12px'}), 0);
});

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
