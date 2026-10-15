import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceDragRetirement } from '../test-build/device-drag-retirement.js';

test('#893 cancellation tails are inert until deliberate input, and an old id never owns a new drag', () => {
  const owner = new DeviceDragRetirement();
  assert.equal(owner.blocksClick({ pointerId: 1 }), false);
  owner.retire(1);
  assert.equal(owner.blocksClick({}), true, 'delayed compatibility MouseEvent');
  assert.equal(owner.blocksClick({ pointerId: 1 }), true);
  owner.begin(2);
  assert.equal(owner.blocksClick({ pointerId: 2 }), false, 'first deliberate next gesture is immediate');
  assert.equal(owner.blocksClick({ pointerId: 1 }), true, 'late old click cannot borrow the new owner');
  owner.retire(2); owner.key('Escape');
  assert.equal(owner.blocksClick({}), true, 'cancellation key is not an activation');
  owner.key('Enter');
  assert.equal(owner.blocksClick({}), false, 'new explicit keyboard action');
  assert.equal(owner.blocksClick({ pointerId: 2 }), true, 'keyboard does not revive an old physical click');
  owner.begin(1);
  assert.equal(owner.blocksClick({ pointerId: 1 }), false, 'real down retires an old contact with reused mouse id');
});
