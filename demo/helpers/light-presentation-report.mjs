// Read-only paired evidence. No budget, clock or workload fitting.
export function lightPresentationComparison(base, result) {
  const failures = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const key of ['observerSha256', 'protocolSha256', 'fixtureSha256']) {
    if (!/^[a-f0-9]{64}$/.test(base?.[key] || '') || base[key] !== result?.[key]) failures.push(`${key}: unknown/mismatched`);
  }
  for (const key of ['pins', 'node', 'viewport', 'dpr', 'absoluteBudgets']) {
    if (base?.[key] == null || !same(base[key], result?.[key])) failures.push(`${key}: missing/mismatched`);
  }
  for (const key of ['platform', 'arch', 'release', 'cpuModel', 'cpuCount', 'totalMemory']) {
    if (base?.environment?.[key] == null || !same(base.environment[key], result?.environment?.[key])) failures.push(`environment.${key}: missing/mismatched`);
  }
  const rows = [];
  for (const [name, report] of [['base', base], ['result', result]]) {
    if (!report?.pass || report.error || report.material?.dirty !== false
        || !/^[a-f0-9]{40}$/.test(report.material?.sha || '')
        || !/^[a-f0-9]{40}$/.test(report.material?.tree || '')
        || report.samples?.length !== 3) failures.push(`${name}: incomplete/dirty/failed material`);
    for (const sample of report?.samples || []) {
      const scenario = sample.tickWork?.scenarios?.S2;
      if (sample.settled?.bootSoft !== false || sample.settled?.booting !== false
          || sample.settled?.continuity !== 'steady' || sample.settled?.devices !== 200 || sample.settled?.strips !== 50
          || scenario?.ticks !== 100 || scenario?.staleStripes !== 0
          || !(scenario?.presentationBuilds > 0) || scenario.rawTickMs?.length !== 100
          || scenario.rawTickMs.some((ms) => !Number.isFinite(ms) || ms < 0)
          || sample.captureSamples?.filter((row) => row.phase === 'S2').length !== 100
          || !sample.rawCpu?.S2?.nodes?.length || sample.failures?.length !== 0
          || !sample.chromium) failures.push(`${name} sample ${sample.index}: incomplete/unsettled/failed S2`);
    }
  }
  for (let index = 0; index < 3; index++) {
    const before = base?.samples?.[index], after = result?.samples?.[index];
    if (!before || !after) continue;
    if (!before.tickWork?.scenarios?.S2 || !after.tickWork?.scenarios?.S2) continue;
    if (before.chromium !== after.chromium) failures.push(`sample ${index}: browser mismatch`);
    const baseBuilds = before.tickWork.scenarios.S2.presentationBuilds;
    const resultBuilds = after.tickWork.scenarios.S2.presentationBuilds;
    const reduction = 1 - resultBuilds / baseBuilds;
    if (!Number.isFinite(reduction) || reduction < .5) failures.push(`sample ${index}: less than 50% build reduction`);
    rows.push({ index, baseBuilds, resultBuilds, reduction,
      baseTickMs: before.tickWork.scenarios.S2.tickMs, resultTickMs: after.tickWork.scenarios.S2.tickMs,
      baseCpu: before.cpu?.S2, resultCpu: after.cpu?.S2 });
  }
  return { schema: 'houseplan-light-presentation-comparison/v1',
    base: base?.material, result: result?.material, failures, pass: failures.length === 0, rows,
    limitations: 'Paired wall-time/CPU observations, not compositor or real-GPU acceptance. Official absolute seven-sample profiles remain separate mandatory gates.' };
}
