/** #1066: summaries of retained evidence, never a replacement verdict or a sample filter. */
const quantile = (values, fraction) => values.length
  ? [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] : null;
const gaps = values => values.slice(1).map((value, index) => value - values[index]);
const distribution = values => ({ count: values.length, min: values.length ? Math.min(...values) : null,
  median: quantile(values, .5), p95: quantile(values, .95), max: values.length ? Math.max(...values) : null });

export function analyzeDaycycleSample(sample) {
  const diagnostic = sample.diagnostics;
  if (!diagnostic?.page) return { mode: sample.mode, round: sample.round,
    status: 'unavailable', reason: 'historical report has no page observations', rasterTasks: sample.tasks };
  const page = diagnostic.page;
  const frames = page.frames || [];
  const moves = page.pointers.filter(row => row.type === 'pointermove' && row.buttons === 1);
  const problems = [];
  if (moves.length !== sample.steps || moves.some(row => row.trusted !== true)) problems.push('native pan steps incomplete/untrusted');
  if (frames.length !== sample.steps * 2 || frames.some((row, index) =>
    row.step !== Math.floor(index / 2) + 1 || row.raf !== index % 2 + 1
    || !Number.isFinite(row.timestamp) || (row.raf === 2 && (!Array.isArray(row.geometry)
      || !row.geometry.some(node => node.role === 'plan')
      || (sample.mode === 'daynight' && !row.geometry.some(node => node.role === 'outline')))))) problems.push('two-rAF observations incomplete');
  const viewBoxWrites = role => page.mutations.filter(row => row.role === role && row.attribute === 'viewBox');
  const outline = viewBoxWrites('outline'), plan = viewBoxWrites('plan');
  const alignment = diagnostic.clockAlignment;
  // These are bins between trusted pointer deliveries, not alleged frame
  // boundaries or a claim that an input caused the asynchronous raster task.
  const temporalBins = alignment?.status === 'available' ? moves.map((move, index) => {
    const end = moves[index + 1]?.at ?? page.stoppedAt;
    const tasks = sample.rasterTasks.filter(task => {
      const at = (task.ts - alignment.traceOriginMicros) / 1000;
      return at >= move.at && at < end;
    });
    return { step: index + 1, startPageMs: move.at, endPageMs: end,
      rasterTasksStartingInInterval: tasks.length, rasterElapsedMs: tasks.reduce((sum, task) => sum + task.dur / 1000, 0) };
  }) : null;
  const knownLayerIds = new Set((diagnostic.layers?.events || []).flatMap(event => (event.layers || []).map(layer => layer.layerId)));
  return { mode: sample.mode, round: sample.round, status: problems.length ? 'incomplete' : 'observed', problems,
    pointerMoves: moves.length, rafCallbacks: frames.length,
    inputIntervalMs: distribution(gaps(moves.map(row => row.at))),
    rafIntervalMs: distribution(gaps(frames.map(row => row.timestamp))),
    outlineViewBoxWrites: outline.length, planViewBoxWrites: plan.length,
    outlineWriteDeliveryIntervalMs: distribution(gaps(outline.map(row => row.observedAt))),
    planWriteDeliveryIntervalMs: distribution(gaps(plan.map(row => row.observedAt))),
    observationOverheadMs: page.overheadMs,
    cameraSnapshots: frames.filter(row => row.raf === 2).length,
    rasterTasks: sample.tasks, rasterElapsedMs: sample.ms,
    rasterCpuClock: diagnostic.rasterCpuClock,
    clockAlignment: alignment?.status ?? 'unavailable',
    layerStatus: diagnostic.layers?.status ?? 'unavailable', observedLayerIds: [...knownLayerIds],
    layerNodes: diagnostic.layerNodes ?? null, temporalBins,
  };
}

export function analyzeDaycycleReport(report) {
  return { schema: 1, materialSha: report.materialSha, materialTree: report.materialTree ?? null,
    fixture: report.fixture, environment: report.environment,
    diagnosticEnvironment: report.diagnosticEnvironment ?? null,
    originalVerdict: { measurementValid: report.measurementValid,
      rasterRatioWithinBudget: report.rasterRatioWithinBudget, ceiling: report.ceiling,
      ratio: report.ratio ?? null, pairedRatios: report.pairedRatios ?? null },
    samples: [...report.staticSamples, ...report.dayCycleSamples].map(analyzeDaycycleSample),
    limitations: ['RasterTask.dur is elapsed time, not inferred CPU time.',
      'MutationObserver timestamps are delivery upper bounds, not exact write timestamps.',
      'Layer notification timestamps use Node receipt time; they are not frame boundaries.',
      'Observation has measured overhead; it does not establish zero observer effect.',
      'A missing historical observation cannot be recovered or replaced by a later PASS.'] };
}

export function compareDaycycleReports(left, right) {
  const same = (a, b) => a != null && b != null && a === b;
  return { schema: 1, matching: {
    source: same(left.materialSha, right.materialSha), tree: same(left.materialTree, right.materialTree),
    fixture: same(left.fixture, right.fixture), ceiling: same(left.ceiling, right.ceiling),
    chromium: same(left.environment?.actual?.version, right.environment?.actual?.version),
    playwright: same(left.environment?.playwright?.installed, right.environment?.playwright?.installed),
  }, left: analyzeDaycycleReport(left), right: analyzeDaycycleReport(right),
  conclusion: 'Compare observed input/refresh/layer evidence explicitly; equal pins or a later PASS alone do not identify a cause.' };
}
