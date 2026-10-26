// Read-only lifecycle validation/diagnostics. It grants no process authority.
import { readFileSync } from 'node:fs';
import { COMPATIBILITY_BRANCHES, PUBLISHED_STABLES, sunsetUntil } from './config-compatibility-catalog.mjs';
import { CONFIG_FIELD_REGISTRY } from './config-field-registry.mjs';

export function validateLifecycle(entries = CONFIG_FIELD_REGISTRY, branches = COMPATIBILITY_BRANCHES, sequence = PUBLISHED_STABLES) {
  const errors = [];
  const seen = new Set();
  for (const branch of branches) {
    if (seen.has(branch.id)) errors.push(`duplicate branch ${branch.id}`);
    seen.add(branch.id);
    if (!branch.oldForm || !branch.newForm || !branch.selectors?.length || !branch.anchors?.length || !branch.migration || !branch.proof?.length)
      errors.push(`missing representation/anchor/migration/proof: ${branch.id}`);
    if (!branch.decision?.reason || !['keep', 'remove'].includes(branch.decision.kind)) errors.push(`missing decision: ${branch.id}`);
    if (branch.since?.kind === 'stable') {
      if (!/^[a-f0-9]{40}$/.test(branch.since.commit || '') || !sequence.includes(branch.since.release)) errors.push(`invalid provenance: ${branch.id}`);
      if (JSON.stringify(branch.until) !== JSON.stringify(sunsetUntil(branch.since, sequence))) errors.push(`invalid two-stable until: ${branch.id}`);
      if (branch.provenance?.commit !== branch.since.commit || branch.provenance?.firstStable !== branch.since.release) errors.push(`mismatched provenance: ${branch.id}`);
    } else if (branch.since?.kind !== 'unproven' || !branch.since.reason || branch.until?.kind !== 'keep' || !branch.until.reason) {
      errors.push(`missing typed since/until: ${branch.id}`);
    }
  }
  const fieldIds = new Set(entries.map((entry) => entry.id));
  for (const branch of branches) for (const field of branch.fields || []) if (!fieldIds.has(field)) errors.push(`orphan field ${field}`);
  for (const entry of entries) {
    const life = entry.lifecycle;
    if (!life?.since || !life?.until || !life?.provenance) { errors.push(`missing lifecycle: ${entry.id}`); continue; }
    if (entry.status === 'current') {
      if (life.since.kind !== 'not-applicable' || !life.since.reason || life.until.kind !== 'not-applicable' || !life.until.reason) errors.push(`current field has a sunset: ${entry.id}`);
    } else {
      const branch = branches.find((item) => item.id === life.branch);
      if (!branch) errors.push(`unowned field: ${entry.id}`);
      else for (const key of ['since', 'until', 'provenance']) {
        if (JSON.stringify(life[key]) !== JSON.stringify(branch[key])) errors.push(`invalid field ${key}: ${entry.id}`);
      }
    }
  }
  return errors;
}

export function lifecycleState(branch, sequence = PUBLISHED_STABLES, current = sequence.at(-1)) {
  const until = sunsetUntil(branch.since, sequence);
  const currentIndex = sequence.indexOf(current);
  const deadlineIndex = until.kind === 'stable' ? sequence.indexOf(until.release) : -1;
  const reached = currentIndex >= 0 && deadlineIndex >= 0 && currentIndex >= deadlineIndex;
  const after = reached && currentIndex > deadlineIndex;
  const eligible = after && branch.decision.kind === 'remove' && branch.proof.length > 0 && branch.allInputsCanonical === true;
  return { until, reached, after, eligible };
}

export function lifecycleWarnings(paths, { branches = COMPATIBILITY_BRANCHES, sequence = PUBLISHED_STABLES, current = sequence.at(-1) } = {}) {
  const affected = new Set(paths.map((path) => path.replaceAll('\\', '/')));
  return branches.flatMap((branch) => {
    if (!branch.anchors.some((anchor) => affected.has(anchor.path))) return [];
    const state = lifecycleState(branch, sequence, current);
    if (!state.reached) return [];
    return [{ id: branch.id, current, until: state.until.release, eligible: state.eligible,
      message: `${branch.id}: reached-until ${state.until.release} (current published stable ${current}); ${state.eligible ? 'eligible for retirement: migration + all-input proof recorded' : `keep: ${branch.decision.reason}`}` }];
  });
}

export function renderLifecycleTable(branches = COMPATIBILITY_BRANCHES) {
  const lines = ['| Branch | Old → current | Since / until | Migration / decision |', '|---|---|---|---|'];
  for (const branch of branches) {
    const state = lifecycleState(branch);
    const since = branch.since.kind === 'stable' ? `${branch.since.release} ([${branch.since.commit.slice(0, 8)}](https://github.com/Matysh/houseplan-card/commit/${branch.since.commit}))` : `keep/unproven: ${branch.since.reason}`;
    const until = state.until.kind === 'stable' ? state.until.release : JSON.stringify(state.until);
    const anchor = branch.anchors[0];
    lines.push(`| [${branch.id}](../${anchor.path}) | ${branch.oldForm.replaceAll('|', '/')} → ${branch.newForm.replaceAll('|', '/')} | ${since}; until **${until}** | ${branch.migration}; **${state.eligible ? 'remove' : 'keep'}**: ${branch.decision.reason} |`);
  }
  return lines.join('\n') + '\n';
}

export function verifyAnchors(root, branches = COMPATIBILITY_BRANCHES) {
  return branches.flatMap((branch) => branch.anchors.flatMap((anchor) => {
    try {
      // Compound symbols are documentary group names; each part still names
      // a real source token, not a line number that drifts on unrelated edits.
      const text = readFileSync(new URL(anchor.path, root), 'utf8');
      return anchor.symbol.split('/').some((symbol) => text.includes(symbol)) ? [] : [`missing anchor ${branch.id}: ${anchor.path}:${anchor.symbol}`];
    } catch { return [`missing source ${branch.id}: ${anchor.path}`]; }
  }));
}
