/** Additional #789 window: do not let deferred quality restoration escape
 * the existing camera observer. Dependencies are passed explicitly so this
 * exact function runs in the page and has a deterministic Node witness.
 * Two rAFs are a paint opportunity, never proof of compositor presentation. */
export async function finishLedCameraCycle({ fullQuality, input, frame, now, sleep }) {
  const marks = {};
  const restored = async (name) => {
    const started = now();
    marks[`${name}RestoreStart`] = started;
    while (!fullQuality()) {
      if (now() - started >= 1000) throw new Error('LED zoom quality did not restore within 1000 ms');
      await sleep(5);
    }
    marks[`${name}FullQuality`] = now();
    await frame();
    if (!fullQuality()) throw new Error('LED zoom quality changed during the final paint opportunity');
    marks[`${name}PaintOpportunity`] = now();
  };
  await restored('first');
  marks.restartInput = now();
  await input();
  await frame();
  marks.restartSettled = now();
  await restored('final');
  await sleep(500);
  await frame();
  if (!fullQuality()) throw new Error('LED zoom quality regressed in the restore tail');
  marks.tailEnd = now();
  return marks;
}

/** The new full-cycle metric inherits, never relaxes, the old camera limit.
 * Missing/nonfinite observations are failures even in a partial local run. */
export function cameraCycleFailures(metrics, limit) {
  const failures = [];
  for (const stat of ['median', 'p95']) {
    const value = metrics?.[stat];
    if (!Number.isFinite(value)) failures.push(`cameraFullCycleLongTaskMaxMs ${stat} missing`);
    else if (Number.isFinite(limit) && value > limit) failures.push(`cameraFullCycleLongTaskMaxMs ${stat} ${value} > ${limit}`);
  }
  return failures;
}

/** Check every raw sample before aggregation: filtering missing values out of
 * a median/p95 must not make a partial or old report pass --merge. */
export function cameraCycleSampleFailures(rows) {
  const failures = [];
  const phases = ['seriesEnd', 'firstRestoreStart', 'firstFullQuality', 'firstPaintOpportunity',
    'restartInput', 'restartSettled', 'finalRestoreStart', 'finalFullQuality',
    'finalPaintOpportunity', 'tailEnd'];
  rows.forEach((row, index) => {
    const cycle = row?.cameraFullCycle;
    const times = [cycle?.startTime, ...phases.map(key => cycle?.phases?.[key]), cycle?.endTime];
    const invalidTimes = times.some((time, i) => !Number.isFinite(time) || (i > 0 && time < times[i - 1]));
    const entries = cycle?.entries;
    if (invalidTimes || !Array.isArray(entries)
      || entries.some(entry => !Number.isFinite(entry.startTime) || !Number.isFinite(entry.duration) || entry.duration < 0)
      || !Number.isFinite(row.cameraFullCycleLongTaskMaxMs)) {
      failures.push(`sample ${index}: missing or invalid camera full-cycle evidence`);
      return;
    }
    if (cycle.phases.tailEnd - cycle.phases.finalPaintOpportunity < 500) {
      failures.push(`sample ${index}: camera full-cycle tail shorter than 500 ms`);
    }
    const maximum = Number(Math.max(0, ...entries.map(entry => entry.duration)).toFixed(2));
    if (row.cameraFullCycleLongTaskMaxMs !== maximum) {
      failures.push(`sample ${index}: camera full-cycle maximum differs from raw Long Tasks`);
    }
  });
  return failures;
}
