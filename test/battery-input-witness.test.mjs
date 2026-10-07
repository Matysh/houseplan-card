import assert from 'node:assert/strict';
import test from 'node:test';
import { batteryPointerReachedPlan } from '../demo/helpers/device-battery-fixture.mjs';

test('#815: missing, synthetic, wrong-modality or intercepted input is not plan delivery', () => {
  for (const pointerType of ['mouse', 'touch']) {
    const event = { trusted: true, pointerType, plan: true, battery: false, device: false };
    assert.equal(batteryPointerReachedPlan([event], pointerType), true);
    assert.equal(batteryPointerReachedPlan([], pointerType), false, 'no vacuous success');
    assert.equal(batteryPointerReachedPlan([event, event], pointerType), false, 'ambiguous sequence');
    for (const patch of [{ trusted: false }, { pointerType: 'pen' }, { plan: false }, { plan: undefined },
      { battery: true }, { device: true }]) {
      assert.equal(batteryPointerReachedPlan([{ ...event, ...patch }], pointerType), false, JSON.stringify(patch));
    }
  }
});
