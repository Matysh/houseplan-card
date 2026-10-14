import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceEditorAllowed, roomAreaAffordance } from '../test-build/device-editor-access.js';

test('#844 Houseplan writer outside kiosk may edit regardless of HA admin', () => {
  for (const writer of [false, true]) for (const kiosk of [false, true])
    assert.equal(deviceEditorAllowed(writer, kiosk), writer && !kiosk);
});

test('#844 HA administration gates links; Plan keeps the writer drag affordance', () => {
  for (const admin of [false, true]) for (const writer of [false, true])
    for (const kiosk of [false, true]) for (const plan of [false, true]) {
      const result = roomAreaAffordance({ admin, writer, kiosk, plan });
      assert.equal(result.interactive, admin && !kiosk && !plan);
      assert.equal(result.visible, !kiosk && (plan ? writer : admin));
    }
});
