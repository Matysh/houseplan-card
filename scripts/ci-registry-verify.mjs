// #981: registry JSON is an index, never an authority.
import { createHash } from 'node:crypto';
export const REGISTRY_SCHEMA = 'houseplan-job-proof/v1';
export const REGISTRY_TTL_MS = 7 * 86400000;
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
export const sameRecord = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
export const recordDigest = record => createHash('sha256').update(JSON.stringify(stable(record))).digest('hex');
const hex = (s, size) => typeof s === 'string' && new RegExp('^[a-f0-9]{' + size + '}$').test(s);
export const registryPath = (job, key) => {
  if (!/^(?:frontend|backend|geometry_parity|smoke|golden|performance_smoke)$/.test(job) || !hex(key, 64)) throw Error('invalid registry address');
  return 'proofs/' + job + '/' + key + '.json';
};

/** Only direct successful execution on the exact source attempt is reusable. */
export function verifyRegistryRecord(record, { plan, job, repo, run, jobs = [], proof, artifact,
  jobNames = [], now = Date.now(), companionsGreen = true, sourceEquivalent = false, actualWorkflowRecipe = null } = {}) {
  const fail = reason => ({ accepted: false, reason });
  if (!record || record.schema !== REGISTRY_SCHEMA || record.outcome !== 'success' || record.reused !== false)
    return fail('not a direct successful producer');
  if (record.job !== job || record.key !== plan?.keys?.[job] || record.treeId !== plan?.treeId || record.mode !== plan?.mode
    || !hex(record.key, 64) || !hex(record.treeId, 64)) return fail('different product tree or job key');
  const expectedRecipe = plan.workflowRecipes?.[record.workflow?.split('/').at(-1)]?.[job] || plan.recipes?.[job];
  if (!sameRecord(record.toolchain, plan.toolchain) || record.workflow_sha !== expectedRecipe)
    return fail('different toolchain or execution recipe');
  if (!sourceEquivalent || actualWorkflowRecipe !== record.workflow_sha) return fail('actual Git inputs/workflow do not authenticate the producer claim');
  if (record.repo !== repo || run?.repository?.full_name !== repo || run?.head_repository?.full_name !== repo
    || !['.github/workflows/validate.yml', '.github/workflows/validate-product.yml'].includes(run?.path))
    return fail('foreign repository or workflow');
  if (!/^(?:dev|main|issue\/[1-9]\d+-[\w-]+)$/.test(run.head_branch || '')) return fail('untrusted producer branch');
  if (run.status !== 'completed' || run.conclusion !== 'success' || !companionsGreen) return fail('source incomplete or red');
  if (!Number.isSafeInteger(record.run) || record.run < 1 || record.run !== Number(run.id)
    || !Number.isSafeInteger(record.attempt) || record.attempt < 1 || record.attempt !== Number(run.run_attempt)
    || !hex(record.sha, 40) || record.sha !== run.head_sha || record.workflow !== run.path)
    return fail('different source attempt/SHA/workflow');
  if (!hex(record.workflow_revision, 40) || record.workflow_revision !== record.sha) return fail('foreign workflow revision');
  if (!jobNames.length || !jobNames.every(name => {
    const rows = jobs.filter(j => j.name === name);
    return rows.length === 1 && rows[0].status === 'completed' && rows[0].conclusion === 'success';
  })) return fail('actual producer job absent or not green');
  const created = Date.parse(record.created), producedAt = Date.parse(artifact?.created_at);
  if (!Number.isFinite(created) || !Number.isFinite(producedAt) || now < created || now < producedAt
    || now - created > REGISTRY_TTL_MS || now - producedAt > REGISTRY_TTL_MS
    || created < Date.parse(run.run_started_at || run.created_at) - 30000 || created > producedAt + 30000)
    return fail('source expired or impossible creation time');
  if (!artifact || artifact.expired !== false || artifact.name !== 'ci-proof-' + record.run + '-' + record.attempt
    || artifact.workflow_run?.head_sha && artifact.workflow_run.head_sha !== record.sha)
    return fail('immutable source artifact absent');
  if (proof?.schema !== 'houseplan-ci-proof/v1' || proof.registry?.schema !== 1 || proof.run?.id !== record.run || proof.run?.attempt !== record.attempt
    || proof.candidate?.sha !== record.sha || proof.checks?.[job]?.mode !== 'executed' || proof.checks[job].result !== 'success'
    || !proof.registry?.produced?.some(item => sameRecord(item, record)))
    return fail('registry differs from immutable execution evidence');
  for (const [id, name] of [['bundle', 'Упаковка: свежие артефакты кандидата'],
    ['product_guards', 'Продукт: свежие проверки диапазона и упаковки']]) {
    const rows = jobs.filter(row => row.name === name);
    if (proof.checks[id]?.mode !== 'executed' || proof.checks[id].result !== 'success'
      || rows.length !== 1 || rows[0].status !== 'completed' || rows[0].conclusion !== 'success')
      return fail('fresh source guards/packaging absent');
  }
  if (job === 'frontend' && (!hex(record.inventory?.dist, 64) || !hex(record.inventory?.testBuild, 64)
    || !hex(record.inventory?.fingerprint, 64))) return fail('missing immutable frontend inventories');
  if (['smoke', 'golden', 'performance_smoke'].includes(job) && proof.request?.full !== true)
    return fail('selected/partial browser execution');
  return { accepted: true, reason: 'immutable successful producer verified', record };
}

/** Night and stable remain fresh even if an index entry happens to match. */
export function registryPolicy({ fresh = false, night = false, stable = false, candidate = false } = {}) {
  return { allowed: !(fresh || night || stable), mode: candidate ? 'candidate' : 'exact',
    reason: fresh || night || stable ? 'fresh policy: night/stable/explicit' : 'content-addressed reuse' };
}
