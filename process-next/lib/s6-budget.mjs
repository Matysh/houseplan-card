import { digest } from './storage.mjs';

// The product slot owns its own budgets. These estimates were calibrated in
// prepared WSL with jobs=2 for #1613. They are independent of the old jobs=4
// cost snapshot and never make an executed check pass.
export const S6_LIMITS = Object.freeze({
  ship: Object.freeze({ steps: 16, ms: 120_000 }),
  show: Object.freeze({ steps: 36, ms: 420_000 }),
  ask: Object.freeze({ steps: 80, ms: 900_000 }),
});
export const HOSTED_S6_WAIT = 60 * 60_000;
export const EXPANDED_S6_WAIT = 120 * 60_000;
const PREPARATION = new Map([
  ['product-build', 75_000], ['test-build', 15_000], ['demo-assets', 1_000],
]);
const CALIBRATED = new Map([
  ...PREPARATION, ['critical-data-rights', 750], ['startup-view', 3_000],
  ['smoke:smoke_space_settings_form', 10_000],
  ['smoke:smoke_device_icon_picker', 120_000],
  ['smoke:smoke_standalone_entry', 100_000],
  ['smoke:smoke_binding_picker', 4_000],
  ['smoke:smoke_standalone_presentation', 80_000],
  ['smoke:smoke_editor_preload', 10_000],
  ['smoke:smoke_lazy_editor_chunk', 45_000],
  ['smoke:smoke_mode_transition', 25_000],
  ['smoke:smoke_room_fill_transitions', 15_000],
  ['smoke:smoke_view_edit_permissions', 65_000],
  ['smoke:smoke_wall_node_move', 8_000],
  ['smoke:smoke_geometry_history_refusal', 28_000],
]);
export const s6StepIdentity = steps => digest(JSON.stringify(steps.map(step => step.id).sort()));

export function s6PlanIdentity(plan) {
  return digest(JSON.stringify(plan.steps.map(step => ({
    id: step.id, command: step.command, requires: step.requires, after: step.after,
    inputs: step.inputs, env: step.env, exclusive: step.exclusive, diagnostic: step.diagnostic,
  }))));
}

const group = id => PREPARATION.has(id) ? 'preparation'
  : id.startsWith('affected-backend:') ? 'backend'
    : id.startsWith('smoke:') || id === 'startup-view' ? 'browser' : 'node';
const fallbackMs = { preparation: 15_000, node: 3_000, backend: 5_000, browser: 62_000 };

export function estimateS6(steps, { jobs = 2, reused = new Set(), observed = new Map() } = {}) {
  const done = new Set(), running = new Map(), pending = new Set(steps);
  const groups = {};
  let time = 0, unknown = 0, preparationMs = 0;
  for (const step of steps) {
    if (!reused.has(step.id)) groups[group(step.id)] = (groups[group(step.id)] ?? 0) + 1;
  }
  while (pending.size || running.size) {
    const countBefore = pending.size;
    for (const step of pending) {
      if ([...(step.requires ?? []), ...(step.after ?? [])].some(id => !done.has(id))) continue;
      if (running.size >= jobs || [...running.keys()].some(item => item.exclusive) || step.exclusive && running.size) break;
      pending.delete(step);
      if (reused.has(step.id)) { done.add(step.id); continue; }
      const kind = group(step.id);
      const known = observed.get(step.id) ?? CALIBRATED.get(step.id);
      if (known === undefined) unknown++;
      const cost = known ?? fallbackMs[kind];
      if (kind === 'preparation') preparationMs += cost;
      running.set(step, time + cost);
    }
    if (!running.size) {
      if (!pending.size) break;
      if (pending.size === countBefore) throw Error('Invalid S6 schedule');
      continue;
    }
    time = Math.min(...running.values());
    for (const [step, finish] of running) if (finish === time) {
      done.add(step.id); running.delete(step);
    }
  }
  return { ms: Math.ceil(time * 1.1), steps: steps.length - reused.size, reused: reused.size,
    unknown, groups, preparationMs };
}

export function budgetForS6(plan, { mode = 'wsl', jobs = 2, reused = new Set(), observed = new Map() } = {}) {
  if (plan.event !== 'task' || plan.layer !== 'product') return null;
  const limit = S6_LIMITS[plan.scope.track];
  const mandatory = plan.steps.filter(step => !step.s6Optional);
  const estimate = estimateS6(mandatory, {
    jobs, observed, reused: new Set(mandatory.filter(step => reused.has(step.id)).map(step => step.id)),
  });
  const reasons = [];
  if (estimate.steps > limit.steps) reasons.push(`${estimate.steps} обязательных запусков при лимите ${limit.steps}`);
  if (mode === 'wsl' && estimate.ms > limit.ms) reasons.push(`прогноз ${Math.ceil(estimate.ms / 1000)} с при лимите ${limit.ms / 1000} с`);
  return { limit, estimate, mode, reasons, mandatory: mandatory.length };
}

export function optionalFitsS6(steps, optional, { track, jobs = 2 } = {}) {
  const { steps: count, ms } = S6_LIMITS[track];
  return CALIBRATED.has(optional.id) && steps.length < count
    && estimateS6([...steps, optional], { jobs }).ms <= ms;
}
