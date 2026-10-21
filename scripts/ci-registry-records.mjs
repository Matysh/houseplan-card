// Immutable records embedded in proof.json BEFORE their index is published.
import { REGISTRY_SCHEMA, sameRecord } from './ci-registry-verify.mjs';
import { REGISTRY_JOBS } from './ci-registry-inputs.mjs';
const json = value => { try { return JSON.parse(value); } catch { return null; } };
export function producedRegistryRecords({ plans, proof, needs, repo, workflowRevision, created = new Date().toISOString() }) {
  const records = [];
  for (const plan of plans) for (const job of REGISTRY_JOBS) {
    if (proof.checks[job]?.mode !== 'executed' || proof.checks[job].result !== 'success') continue;
    if (['smoke', 'golden', 'performance_smoke'].includes(job) && proof.request.full !== true) continue;
    const outputs = needs[job]?.outputs || {}, stamps = job === 'smoke'
      ? [1, 2, 3].map(n => json(outputs['toolchain_' + n])) : [json(outputs.toolchain)];
    if (!stamps.every(stamp => sameRecord(stamp, plan.toolchain))) continue;
    const recipes = job === 'smoke' ? [1, 2, 3].map(n => outputs['recipe_' + n]) : [outputs.recipe];
    const actualRecipe = plan.workflowRecipes?.[proof.run.workflow]?.[job] || plan.recipes[job];
    if (!recipes.every(recipe => recipe === actualRecipe)) continue;
    const inventory = job === 'frontend' ? json(outputs.inventory) : undefined;
    if (job === 'frontend' && (!inventory?.dist || !inventory?.testBuild || !inventory?.fingerprint)) continue;
    records.push({ schema: REGISTRY_SCHEMA, job, key: plan.keys[job], mode: plan.mode, treeId: plan.treeId,
      outcome: 'success', reused: false, repo, workflow: '.github/workflows/' + proof.run.workflow,
      run: proof.run.id, attempt: proof.run.attempt, sha: proof.candidate.sha, toolchain: plan.toolchain,
      workflow_sha: actualRecipe, workflow_revision: workflowRevision, created, ...(inventory ? { inventory } : {}) });
  }
  return records;
}
