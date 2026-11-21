import test from 'node:test';
import assert from 'node:assert/strict';
import { planStableCycle, verifyReleaseCycle } from '../lib/release-cycle.mjs';

const candidate = { kind: 'stable', tag: 'v1.86.0' };
const milestone = (number, title, state = 'open') => ({ number, title, state });
const plan = (cycle, rows, release = candidate) => planStableCycle({ candidate: release,
  git: { remoteHead: async () => 'dev-sha', git: async () => JSON.stringify(cycle) },
  api: { listOpenMilestones: async () => rows } });

test('stable cycle selects only future open release milestones in version order', async () => {
  const result = await plan({ baseStable: 'v1.85.2', milestone: { number: 16 } }, [
    milestone(20, '3.0.0'), milestone(16, '1.86.0', 'closed'), milestone(18, '2.0.0'),
    milestone(1, 'Notes'), milestone(2, '1.85.0'), milestone(3, '2.0.0-beta.1'), milestone(4, '1.99.0', 'closed'),
  ]);
  assert.deepEqual(result, { schema: 1, baseStable: 'v1.86.0', targetStable: 'v2.0.0', milestone: { number: 18, title: '2.0.0' } });
});

test('an explicit future target survives rollover; absent future milestones leave an unassigned new cycle', async () => {
  assert.equal((await plan({ baseStable: 'v1.85.2', milestone: { number: 20 } }, [
    milestone(18, '2.0.0'), milestone(20, '3.0.0')])).milestone.number, 20);
  assert.deepEqual(await plan({ baseStable: 'v1.85.2' }, []),
    { schema: 1, baseStable: 'v1.86.0', targetStable: null, milestone: null });
});

test('retries and old stable completions never rewind a current or newer cycle; beta/hotfix do not advance it', async () => {
  for (const baseStable of ['v1.86.0', 'v2.0.0']) assert.equal(await plan({ baseStable }), null);
  for (const kind of ['beta', 'hotfix']) assert.equal(await plan(undefined, undefined, { ...candidate, kind }), null);
  await assert.rejects(plan({ baseStable: 'invalid' }, []), /no valid stable base/);
});

test('return verification accepts reviewed targets and newer valid cycles without accepting an old base', async () => {
  const expected = { baseStable: 'v1.86.0' };
  const verify = actual => verifyReleaseCycle({ git: async () => JSON.stringify(actual) }, 'commit', expected);
  const corrected = { milestone: { number: 19, title: '3.0.0' }, targetStable: 'v3.0.0', baseStable: 'v1.86.0' };
  assert.deepEqual(await verify(corrected), corrected);
  const newer = { baseStable: 'v2.0.0', targetStable: null, milestone: null };
  assert.deepEqual(await verify(newer), newer);
  await assert.rejects(verify({ ...corrected, baseStable: 'v1.85.2' }), /without a valid next release cycle/);
  await assert.rejects(verify({ ...corrected, milestone: { number: 19, title: '2.0.0' } }), /without a valid next release cycle/);
});
