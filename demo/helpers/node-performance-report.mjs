// Derived diagnostics only. No clock fitting, input pacing, retries or budget changes.
import { createHash } from 'node:crypto';

export function nodeQuantiles(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return { count: sorted.length, median: sorted[Math.ceil(sorted.length * .5) - 1] || 0,
    p95: sorted[Math.ceil(sorted.length * .95) - 1] || 0, max: sorted.at(-1) || 0 };
}

export function nodeBudgetVerdict(report) {
  const limits = [['mainThread', 'p95', 'mainThreadP95Ms'], ['inputToPaint', 'p95', 'inputToPaintP95Ms'],
    ['longTasks', 'max', 'longTaskMaxMs']];
  const budgetFailures = [];
  for (const [group, statistic, key] of limits) {
    const actual = report[group]?.[statistic], limit = report.budgets?.[key];
    if (!Number.isFinite(actual) || !Number.isFinite(limit) || limit < 0 || actual < 0
      || group !== 'longTasks' && !(report[group]?.count > 0)) {
      budgetFailures.push({ metric: `${group}.${statistic}`, budget: key, actual: Number.isFinite(actual) ? actual : null,
        limit: Number.isFinite(limit) ? limit : null, reason: 'missing-or-invalid-measurement', unit: 'ms' });
    } else if (actual > limit) budgetFailures.push({ metric: `${group}.${statistic}`, budget: key,
      actual, limit, excess: actual - limit, reason: 'budget-exceeded', unit: 'ms' });
  }
  const failures = [...new Set([...(report.failures || []), ...(report.error ? [`${report.error.name || 'Error'}: ${report.error.message || 'incomplete smoke'}`] : []),
    ...budgetFailures.map(f => f.reason === 'budget-exceeded'
    ? `${f.metric}: ${f.actual} ms > ${f.limit} ms (${f.budget})`
    : `${f.metric}: missing/invalid measurement or limit (${f.budget})`)])];
  if (report.pass === false && !failures.length) failures.push('original smoke failed without a recorded reason; diagnosis unknown');
  return { budgetFailures, failures, pass: failures.length === 0 };
}

/** Join by exact source/observation/sample identities, not nearest timestamps.
 * The source->native interval for superseded inputs includes their wait for a
 * later matching native input; it is NOT a pure CDP transport measurement.
 * candidateWallMs is delegated flush wall-time, NOT OS CPU accounting. */
export function nodeLatencyAttribution(report) {
  try {
    const rows = [];
    for (const gesture of report.raw.filter(g => g.kind === 'measured')) {
      const owners = new Map();
      gesture.samples.forEach((sample, sampleIndex) => {
        for (const id of sample.events) {
          if (owners.has(id)) throw Error('ambiguous sample owner');
          owners.set(id, { sample, sampleIndex });
        }
      });
      let through = -1, observationThrough = -1;
      for (const match of gesture.sourceMatches) {
        const event = gesture.events[match.observationIndex], owner = owners.get(match.observationId);
        if (!event || event.id !== match.observationId || !owner || !Number.isInteger(match.sourceId)
          || match.sourceId <= through || !Number.isInteger(match.observationIndex) || match.observationIndex <= observationThrough)
          throw Error('unresolved source/sample identity');
        const { sample, sampleIndex } = owner;
        for (let source = through + 1; source <= match.sourceId; source++) {
          const input = gesture.inputs[source];
          if (!input || input.id !== source) throw Error('source ledger is incomplete');
          const stages = { sourceToNativeMs: event.eventTime - input.eventTime,
            nativeDispatchMs: event.dispatched - event.eventTime,
            frameSchedulingMs: sample.began - event.dispatched, candidateWallMs: sample.mainThreadMs,
            afterCandidateToPaintMs: event.paintOpportunity - (sample.began + sample.mainThreadMs) };
          // This tolerance only judges floating arithmetic in derived diagnostics;
          // it never changes clocks, budget values or the original gate verdict.
          if (!Object.values(stages).every(v => Number.isFinite(v) && v >= -1e-6)) throw Error('non-monotone phase timestamps');
          const total = Object.values(stages).reduce((sum, v) => sum + v, 0);
          if (!Number.isFinite(input.inputToPaintMs) || Math.abs(total - input.inputToPaintMs) > 1e-6)
            throw Error('phase sum differs from recorded source latency');
          rows.push({ gesture: gesture.index, source, settledBySource: match.sourceId,
            observation: match.observationId, sample: sampleIndex, disposition: input.disposition,
            sourceSuperseded: source !== match.sourceId, coalesced: input.coalesced,
            invalidCandidate: Boolean(sample.invalid), validateCalls: sample.validateCalls,
            inputToPaintMs: input.inputToPaintMs, ...stages });
        }
        through = match.sourceId; observationThrough = match.observationIndex;
      }
      if (through !== gesture.inputs.length - 1) throw Error('final source has no sample');
    }
    if (!rows.length || rows.length !== report.inputToPaint?.count) throw Error('attribution coverage differs from measured inputs');
    const names = ['sourceToNativeMs', 'nativeDispatchMs', 'frameSchedulingMs', 'candidateWallMs', 'afterCandidateToPaintMs'];
    const ordered = rows.slice().sort((a, b) => a.inputToPaintMs - b.inputToPaintMs);
    return { status: 'observed', limitations: 'Intervals locate observed wall-time, not CPU/descheduling cause or compositor presentation. Superseded source->native includes waiting for its matching later input. Phase quantiles are per source (candidate intervals may repeat), not per flush. Component p95 values must not be added.',
      count: rows.length, phases: Object.fromEntries(names.map(name => [name, nodeQuantiles(rows.map(row => row[name]))])),
      p95Input: ordered[Math.ceil(ordered.length * .95) - 1], tail: ordered.slice(-15), rows };
  } catch (error) {
    return { status: 'unknown', reason: error.message, limitations: 'Incomplete phase evidence; original gate outcome is unchanged.' };
  }
}

const signature = report => {
  const fields = ['material', 'harnessSha256', 'fixtureSha256', 'bundleFingerprint', 'chromium', 'node', 'counts',
    'viewport', 'dpr', 'warmupGestures', 'measuredGestures', 'latencyDefinition', 'clockDefinition', 'budgets'];
  const envKeys = ['platform', 'arch', 'release', 'cpuModel', 'cpuCount', 'totalMemory', 'imageOS', 'imageVersion'];
  const environment = Object.fromEntries(envKeys.map(key => [key, report.environment?.[key] ?? null]));
  if (fields.some(key => report[key] == null) || !/^[a-f0-9]{40}$/.test(report.material?.sha || '')
    || !/^[a-f0-9]{40}$/.test(report.material?.tree || '') || report.material.dirty !== false
    || ['harnessSha256', 'fixtureSha256', 'bundleFingerprint'].some(key => !/^[a-f0-9]{64}$/.test(report[key] || ''))
    || envKeys.slice(0, 4).some(key => typeof environment[key] !== 'string' || !environment[key])
    || !(environment.cpuCount > 0) || !(environment.totalMemory > 0)
    || report.functionalChecks !== 'passed' || report.error && report.error.stage !== 'budget-verdict'
    || report.warmupGestures !== 3 || report.measuredGestures !== 5
    || report.raw?.length !== 8 || report.raw.filter(g => g.kind === 'warmup').length !== 3
    || report.raw.filter(g => g.kind === 'measured').length !== 5
    || report.raw.some(g => g.inputs?.length !== 60 || !g.samples?.length || !g.clockCalibration || !g.clockAfter)
    || report.inputToPaint?.count !== 300 || !(report.mainThread?.count > 0)
    || !Number.isFinite(report.mainThread.p95) || !Number.isFinite(report.inputToPaint.p95)
    || nodeLatencyAttribution(report).status !== 'observed') return null;
  return createHash('sha256').update(JSON.stringify([...fields.map(key => report[key]), environment])).digest('hex');
};

export function nodeSeriesSummary(reports) {
  const keys = reports.map(signature), comparable = reports.length >= 3 && keys.every(key => key && key === keys[0]);
  return { schema: 'houseplan-node-series/v1', comparable,
    reason: comparable ? 'fixed material, protocol, workload, recorded environment identity and budgets; bounded observations, not proof of flakiness'
      : 'fewer than three complete material/protocol/environment receipts or mismatched inputs; no causal comparison',
    cause: 'unknown', observations: reports.map(report => ({ material: report.material ?? null, environment: report.environment ?? null,
      originalPass: report.pass ?? null, budgets: report.budgets, mainThread: report.mainThread,
      inputToPaint: report.inputToPaint, longTasks: report.longTasks,
      budgetVerdict: nodeBudgetVerdict(report), attribution: nodeLatencyAttribution(report) })),
    ...(comparable ? { ranges: Object.fromEntries(['mainThread', 'inputToPaint'].map(name => [name,
      { minP95: Math.min(...reports.map(r => r[name].p95)), maxP95: Math.max(...reports.map(r => r[name].p95)) }])) } : {}) };
}
