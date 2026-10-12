/** #863: keep every paired sample; invalid measurement is not a product PASS. */
export const PAN_STEPS = 60;
export const SAMPLE_ROUNDS = 3;
export const RATIO_CEILING = 2.0;
export const DAYCYCLE_FIXTURE = 'demo-default-1400x900-dpr1-eight-pan60';
export const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export function measurementProblems(report) {
  const errors = [];
  if (report?.schema !== 1 || report?.fixture !== DAYCYCLE_FIXTURE) errors.push('unknown report schema/fixture');
  const env = report?.environment;
  if (!env?.ok || env?.actual?.version !== env?.expected?.version
    || env?.actual?.mode !== 'headless-shell' || !env?.actual?.resolvedExecutable
    || !env?.playwright?.installed || env.playwright.installed !== env.playwright.pinned)
    errors.push('unconfirmed pinned browser environment');
  if (!/^[a-f0-9]{40}$/.test(report?.materialSha || '')) errors.push('missing material SHA');
  if (report?.materialClean !== true) errors.push('measurement inputs differ from committed material');
  if (report?.ceiling !== RATIO_CEILING) errors.push('ratio ceiling changed');
  for (const [mode, samples] of [['static', report?.staticSamples], ['daynight', report?.dayCycleSamples]]) {
    if (!Array.isArray(samples) || samples.length !== SAMPLE_ROUNDS) { errors.push(`${mode}: incomplete pairs`); continue; }
    samples.forEach((row, i) => {
      if (!row || typeof row !== 'object') { errors.push(`${mode}/${i}: missing sample`); return; }
      if (row.mode !== mode || row.round !== i || row.order !== i * 2 + (mode === 'static' ? 0 : 1)
        || row.steps !== PAN_STEPS || row.ready?.ok !== true || row.ready?.mode !== mode
        || ![row.wallMs, row.startedAt, row.endedAt].every(Number.isFinite)
        || !(row.wallMs > 0) || !(row.endedAt > row.startedAt)
        || Math.abs(row.endedAt - row.startedAt - row.wallMs) > .01
        || !(row.ms > 0) || !Number.isFinite(row.ms)) errors.push(`${mode}/${i}: missing readiness/order/timing`);
      const tasks = row.rasterTasks;
      if (!Array.isArray(tasks) || !tasks.length || row.tasks !== tasks.length
        || tasks.some(task => !Number.isFinite(task?.dur) || task.dur < 0 || !Number.isFinite(task?.ts))
        || Math.abs(tasks.reduce((sum, task) => sum + task.dur / 1000, 0) - row.ms) > 1e-6)
        errors.push(`${mode}/${i}: incomplete raw RasterTask evidence`);
    });
  }
  return errors;
}

export function pairedMeasurementReport(input) {
  const report = { schema: 1, ceiling: RATIO_CEILING, ...input };
  const problems = measurementProblems(report);
  if (problems.length) return { ...report, problems, measurementValid: false, rasterRatioWithinBudget: false };
  const ratios = report.dayCycleSamples.map((row, i) => row.ms / report.staticSamples[i].ms);
  const ratio = median(ratios);
  return { ...report, problems, measurementValid: true, pairedRatios: ratios, ratio,
    staticMedianMs: median(report.staticSamples.map(row => row.ms)),
    dayCycleMedianMs: median(report.dayCycleSamples.map(row => row.ms)),
    rasterRatioWithinBudget: ratio <= RATIO_CEILING };
}
