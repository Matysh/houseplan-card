import assert from 'node:assert/strict';
import test from 'node:test';
import { clampedWheelVerdict } from '../demo/helpers/clamped-wheel-lease.mjs';

const samples = () => {
  const full = { scale: 8, cache: 'unchanged', coarse: false };
  return { before: { ...full, coarse: true }, during: { ...full, coarse: true },
    deadline: { ...full }, idle: { ...full } };
};
test('#825 clamp oracle separately rejects early cancellation and deadline renewal', () => {
  const good = samples();
  assert.ok(Object.values(clampedWheelVerdict(good)).every(Boolean));
  const early = samples(); early.during.coarse = false;
  assert.equal(clampedWheelVerdict(early)['clamped wheel during coarse does not cancel the current lease'], false);
  const renewal = samples(); renewal.deadline.coarse = true;
  assert.equal(clampedWheelVerdict(renewal)['clamped wheel does not extend the original lease'], false);
  const restarted = samples(); restarted.idle.coarse = true;
  assert.equal(clampedWheelVerdict(restarted)['clamped wheel neither enters coarse nor extends its deadline'], false);
  for (const field of ['scale', 'cache']) {
    const changed = samples(); changed.during[field] = 'changed';
    assert.equal(clampedWheelVerdict(changed)['clamped wheel leaves scale unchanged'], false);
  }
});
