// #983: scripts-only proof validation, also loaded by archived merge tools.
export function browserPlanExecution(plan, needs) {
  if (!plan) return null;
  if (plan.schema !== 1 || !['push', 'full'].includes(plan.scope)) throw Error('invalid browser coverage plan');
  const executed = {}, skipped = {};
  for (const kind of ['smoke', 'golden']) {
    if (!plan[kind] || !['none', 'selected', 'full'].includes(plan[kind].mode) || !Array.isArray(plan[kind].ids)
      || plan[kind].mode === 'selected' && !plan[kind].ids.length) throw Error(`invalid ${kind} coverage`);
    const selected = plan[kind].mode === 'selected';
    const job = selected ? needs?.browser_selected : needs?.[kind];
    if (plan[kind].mode === 'none') skipped[kind] = plan[kind].reason;
    else if (!selected && needs?.reuse?.outputs?.[kind] === 'true') skipped[kind] = 'complete compatible producer proof reused';
    else executed[kind] = { mode: plan[kind].mode, ids: plan[kind].ids,
      result: job?.result || 'missing', reason: plan[kind].reason };
  }
  return { planned: plan, executed, skipped };
}

