import assert from 'node:assert/strict';
import test from 'node:test';
import { colorResolver, safeImageReference, readingSource, readingToken,
  markerTap, literalCaption } from '../scripts/sh3d-convert/easy-style.mjs';

test('#937 stored colours are literal six-digit hex, never CSS/URL or an evaluated variable', () => {
  const color = colorResolver([{ name: 'Living', color: '#3aF' },
    { name: 'Loop', color: 'var(--fp-color-loop)' }]);
  assert.equal(color('var(--fp-color-living)'), '#33aaff');
  assert.equal(color('rgb(1, 2, 255)'), '#0102ff');
  assert.equal(color('RED'), '#ff0000');
  for (const value of ['url(https://example.org/a)', 'var(--primary-color)',
    'var(--fp-color-loop)', 'rgb(256,0,0)', '<svg onload=alert(1)>']) assert.equal(color(value), null);
});

test('#937 image references preserve safe URLs but never source credentials or unsafe schemes', () => {
  for (const value of ['/local/plan.png', 'https://example.org/plan.png?v=1', 'http://example.org/p.png'])
    assert.equal(safeImageReference(value), value);
  for (const value of ['//example.org/x', '/local/../api/auth', 'file:///tmp/a', 'javascript:alert(1)',
    'data:image/svg+xml,<svg/>', 'https://user:password@example.org/a',
    'https://example.org/a?access_token=secret', 'https://example.org/a#token=secret'])
    assert.equal(safeImageReference(value), null);
});

test('#941 only bounded image selectors survive; signatures and unknown parameters are omitted', () => {
  for (const value of [
    '/local/plan.png?v=2026-10-17&w=1200&h=800&format=webp',
    'https://example.org/plan.png?version=a1b2c3&width=640&height=480',
    'https://example.org/plan.png?q=80&dpr=2&fit=contain',
  ]) assert.equal(safeImageReference(value), value);
  for (const suffix of [
    '?sig=synthetic', '?signature=synthetic', '?X-Amz-Credential=synthetic&X-Amz-Signature=synthetic',
    '?sv=2026-01-01&sp=r&sig=synthetic', '?session=synthetic', '?ticket=synthetic',
    '?unknown=synthetic', '?s%2569g=synthetic', '?w=9999999', '?w=640&w=320',
    '?format=unrecognized', '?v=one%26sig%3Dsynthetic', '?width=-1', '?q=101', '?dpr=9',
    '#sig=synthetic', '#arbitrary',
  ]) assert.equal(safeImageReference(`https://example.org/plan.png${suffix}`), null, suffix);
});

test('#937 readings stay exact, static text cannot turn into an unintended HA template', () => {
  assert.deepEqual(readingSource('sensor.room', 'value'), { kind: 'entity_attribute', entity_id: 'sensor.room', attribute: 'value' });
  assert.equal(readingToken(readingSource('sensor.room')), '{sensor.room}');
  assert.equal(readingSource('sensor.room', 'bad attribute'), null);
  const notes = [];
  assert.equal(literalCaption('{sensor.unrelated}', 't', notes), '❴sensor.unrelated❵');
  assert.equal(notes[0].code, 'literal_braces_escaped');
});

test('#937 actions use HP allowlists, explicit none survives and service payloads never become toggle', () => {
  const notes = [];
  assert.equal(markerTap({ entity: 'light.test' }, notes).tap_action, 'toggle');
  assert.equal(markerTap({ entity: 'cover.test' }, notes).tap_action, 'info');
  assert.deepEqual(markerTap({ entity: 'light.test', tap_action: { action: 'none' } }, notes), { tap_action: 'none' });
  assert.deepEqual(markerTap({ entity: 'light.test', tap_action: { action: 'toggle', confirmation: true } }, notes),
    { tap_action: 'toggle', tap_confirm: true });
  for (const action of [{ action: 'call-service', service: 'lock.unlock' },
    { action: 'toggle', entity: 'lock.other' }, { action: 'toggle', target: { entity_id: 'lock.other' } }])
    assert.equal(markerTap({ entity: 'light.test', tap_action: action }, notes).tap_action, 'info');
  assert.ok(notes.some(n => n.code === 'action_fallback_info'));
});
