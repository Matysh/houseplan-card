// #983: scripts-only proof validation, also loaded by archived merge tools.
export const isTaskBrowserPlan = plan => plan?.scope === 'task'
  || plan?.scope === 'push' && plan?.coverageScope === 'task';

export function browserPlanExecution(plan, needs) {
  if (!plan) return null;
  if (plan.schema !== 1 || !['push', 'task', 'full'].includes(plan.scope)) throw Error('invalid browser coverage plan');
  if (plan.coverageScope !== undefined && (plan.coverageScope !== 'task' || !['push', 'task'].includes(plan.scope)))
    throw Error('invalid browser coverage scope');
  const executed = {}, skipped = {}, reused = {};
  const selectedClaim = needs?.browser_selected?.outputs?.task_check
    ? JSON.parse(needs.browser_selected.outputs.task_check) : null;
  for (const kind of ['smoke', 'golden']) {
    if (!plan[kind] || !['none', 'selected', 'full'].includes(plan[kind].mode) || !Array.isArray(plan[kind].ids)
      || new Set(plan[kind].ids).size !== plan[kind].ids.length
      || plan[kind].mode === 'selected' && !plan[kind].ids.length) throw Error(`invalid ${kind} coverage`);
    if (isTaskBrowserPlan(plan) && plan[kind].mode === 'full') throw Error('task coverage cannot claim a full browser matrix');
    if (kind === 'golden' && plan[kind].intent !== undefined) {
      if (!Array.isArray(plan[kind].intent)) throw Error('invalid golden intent');
      const expected = new Map();
      for (const item of plan[kind].intent) {
        if (!plan[kind].ids.includes(item?.id) || !(['change', 'new'].includes(item.expectation)
          || item.expectation === 'unchanged' && isTaskBrowserPlan(plan) && plan[kind].mode === 'selected')
          || typeof item.reason !== 'string' || !item.reason.trim()
          || !Number.isSafeInteger(item.issue) || item.issue <= 0
          || expected.has(item.id) && expected.get(item.id) !== item.expectation) throw Error('invalid golden intent');
        expected.set(item.id, item.expectation);
      }
    }
    const selected = plan[kind].mode === 'selected';
    const job = selected ? needs?.browser_selected : needs?.[kind];
    if (plan[kind].mode === 'none') skipped[kind] = plan[kind].reason;
    else if (selected && selectedClaim?.mode === 'reused') reused[kind] = {
      mode: 'selected', ids: plan[kind].ids, result: job?.result || 'missing',
      sourceRun: selectedClaim.record?.run, sourceAttempt: selectedClaim.record?.attempt,
    };
    else if (!selected && needs?.reuse?.outputs?.[kind] === 'true') skipped[kind] = 'complete compatible producer proof reused';
    else executed[kind] = { mode: plan[kind].mode, ids: plan[kind].ids,
      result: job?.result || 'missing', reason: plan[kind].reason };
  }
  // The protected dev controller must read a task's proof before that task can
  // update it. Keep the v1 selected-plan wire scope understood by old readers;
  // the additive marker preserves task semantics for current readers. Neither
  // scope grants a complete-matrix receipt or changes request.full/golden.
  const planned = plan.scope === 'task' ? { ...plan, scope: 'push', coverageScope: 'task' } : plan;
  return { planned, executed, skipped, ...(Object.keys(reused).length ? { reused } : {}) };
}

