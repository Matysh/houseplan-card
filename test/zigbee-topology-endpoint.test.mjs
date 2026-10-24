import test from 'node:test';
import assert from 'node:assert/strict';
import { zigbeeLedProjection, zigbeeEndpointClearance, ZIGBEE_LED_HALO_RADIUS } from '../test-build/zigbee-topology-endpoint.js';
import { zigbeeArrowGeometry } from '../test-build/zigbee-topology-geometry.js';
import { zigbeeTopologyOverlayRequested } from '../test-build/zigbee-topology-overlay-bridge.js';

test('#1004 SVG representation preserves the full-card admin/View/enabled/non-kiosk eligibility', () => {
  const allowed = { hass: { user: { is_admin: true } }, view: true, kiosk: false,
    settings: { zigbee_topology: { enabled: true } } };
  assert.equal(zigbeeTopologyOverlayRequested(allowed), true);
  for (const changed of [
    { hass: { user: { is_admin: false } } }, { hass: {} }, { view: false },
    { kiosk: true }, { settings: {} }, { settings: { zigbee_topology: { enabled: false } } },
  ]) assert.equal(zigbeeTopologyOverlayRequested({ ...allowed, ...changed }), false);
});

test('#1004 a lifted/skewed SVG path projects through the current HTML camera once', () => {
  const matrix = { a: 2, b: 1, c: -.5, d: 1, e: 170, f: 95 };
  const layer = { left: 30, top: 15, width: 800, height: 450 };
  const p = zigbeeLedProjection(matrix, layer, 400, 300);
  assert.ok(p);
  const at = { x: 40, y: 60 };
  const local = { x: p.a * at.x + p.c * at.y + p.e, y: p.b * at.x + p.d * at.y + p.f };
  assert.equal(local.x * p.scaleX + layer.left, matrix.a * at.x + matrix.c * at.y + matrix.e);
  assert.equal(local.y * p.scaleY + layer.top, matrix.b * at.x + matrix.d * at.y + matrix.f);
  assert.equal(p.scaleX, 2); assert.equal(p.scaleY, 1.5);
});

test('#1004 invalid/unpainted/singular geometry cannot become a fake origin', () => {
  const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const r = { left: 0, top: 0, width: 500, height: 300 };
  for (const [matrix, rect, width, height] of [
    [m, r, 0, 300], [m, r, 500, -1], [m, { ...r, width: 0 }, 500, 300],
    [{ ...m, d: 0 }, r, 500, 300], [{ ...m, e: NaN }, r, 500, 300],
  ]) assert.equal(zigbeeLedProjection(matrix, rect, width, height), null);
});

test('#1004 LED arrow clearance remains a fixed screen distance at unequal camera scales', () => {
  for (const [scaleX, scaleY] of [[.5, .5], [2, 2], [2, 1.5]]) {
    const origin = { x: 10, y: 20, width: 14, height: 14, led: { scaleX, scaleY } };
    const destination = { x: 130, y: 110 };
    const clearance = zigbeeEndpointClearance(origin, destination);
    const arrow = zigbeeArrowGeometry(origin, destination, clearance, 0, 'toward-origin');
    const screenDistance = Math.hypot((arrow.tip.x - origin.x) * scaleX, (arrow.tip.y - origin.y) * scaleY);
    assert.ok(Math.abs(screenDistance - ZIGBEE_LED_HALO_RADIUS - 3) < 1e-10);
    assert.equal(zigbeeArrowGeometry(origin, origin, clearance, 0, 'toward-origin'), null);
  }
  assert.equal(zigbeeEndpointClearance({ x: 0, y: 0, width: 20, height: 30 }), 30 * .61 + 3);
});
