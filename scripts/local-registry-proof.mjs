// #981: same authenticated index for pre-push; real local tools, no image spoofing.
import { execFileSync } from 'node:child_process';
import { registryInputs, cleanRegistryInputs } from './ci-registry-inputs.mjs';
import { fetchRegistry, probeRegistry, registryApi } from './ci-proof-registry.mjs';
import { restoreRegistryBuild } from './ci-registry-build.mjs';
export async function restoreLocalRegistry(root, { repo = 'Matysh/houseplan-card' } = {}) {
  try {
    const plan = registryInputs(root, { mode: 'exact' });
    if (!cleanRegistryInputs(root, plan)) return { reused: false, reason: 'dirty/unproven local inputs' };
    const store = fetchRegistry(root), record = store.read('frontend', plan.keys.frontend);
    if (!record) return { reused: false, reason: 'no producer for the actual local toolchain' };
    const token = process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
    const result = await probeRegistry({ root, repo, plan, jobs: ['frontend'], store,
      source: registryApi({ repo, token, candidateSnapshot: plan._snapshot, mode: plan.mode }) });
    if (!result.results.frontend.accepted) return { reused: false, reason: result.results.frontend.reason };
    restoreRegistryBuild({ root, record, repo });
    return { reused: true, record };
  } catch { return { reused: false, reason: 'registry unavailable; run fresh' }; }
}
