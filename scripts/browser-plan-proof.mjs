// #983: scripts-only proof validation, also loaded by archived merge tools.
export function browserPlanExecution(plan, needs) {
  if (!plan) return null;
  if (plan.schema !== 1 || !['push', 'task', 'full'].includes(plan.scope)) throw Error('invalid browser coverage plan');
  const executed = {}, skipped = {};
  for (const kind of ['smoke', 'golden']) {
    if (!plan[kind] || !['none', 'selected', 'full'].includes(plan[kind].mode) || !Array.isArray(plan[kind].ids)
      || new Set(plan[kind].ids).size !== plan[kind].ids.length
      || plan[kind].mode === 'selected' && !plan[kind].ids.length) throw Error(`invalid ${kind} coverage`);
    if (kind === 'golden' && plan[kind].intent !== undefined) {
      if (!Array.isArray(plan[kind].intent)) throw Error('invalid golden intent');
      const expected = new Map();
      for (const item of plan[kind].intent) {
        if (!plan[kind].ids.includes(item?.id) || !['change', 'new'].includes(item.expectation)
          || typeof item.reason !== 'string' || !item.reason.trim()
          || !Number.isSafeInteger(item.issue) || item.issue <= 0
          || expected.has(item.id) && expected.get(item.id) !== item.expectation) throw Error('invalid golden intent');
        expected.set(item.id, item.expectation);
      }
    }
    const selected = plan[kind].mode === 'selected';
    const job = selected ? needs?.browser_selected : needs?.[kind];
    if (plan[kind].mode === 'none') skipped[kind] = plan[kind].reason;
    else if (!selected && needs?.reuse?.outputs?.[kind] === 'true') skipped[kind] = 'complete compatible producer proof reused';
    else executed[kind] = { mode: plan[kind].mode, ids: plan[kind].ids,
      result: job?.result || 'missing', reason: plan[kind].reason };
  }
  return { planned: plan, executed, skipped };
}

