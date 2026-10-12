#!/usr/bin/env node
// #856: producers record intent; only existing release workflows publish.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { sealContinuation } from './continuation-record.mjs';
import { probeGreenWorkflow } from './release-gate.mjs';
import { probeE2e, realOps as e2eOps } from './e2e-gate.mjs';
import { isMainModule } from './spawn-portable.mjs';
const gh = args => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
const api = path => JSON.parse(gh(['api', path]));
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
export function tagCommit(repo, tag, request = api) {
  let ref;
  try { ref = request(`repos/${repo}/git/ref/tags/${tag}`); }
  catch (error) { if (/404|Not Found/i.test(String(error?.message || error))) return null; throw error; }
  let object = ref.object;
  for (let i = 0; object.type === 'tag' && i < 4; i++) object = request(`repos/${repo}/git/tags/${object.sha}`).object;
  if (object.type !== 'commit' || !/^[a-f0-9]{40}$/.test(object.sha || '')) throw Error('invalid tag target');
  return object.sha;
}
export async function prepareReleasePending({ repo, candidate, tag, stable, workflow, out,
  probe = probeGreenWorkflow, e2e = probeE2e, external = e2eOps(), request = api, seal = sealContinuation } = {}) {
  const tree = git(['rev-parse', `${candidate}^{tree}`]);
  const validate = await probe({ repo, sha: candidate, tree, token: process.env.GH_TOKEN });
  const performance = stable ? await probe({ repo, sha: candidate, workflow: 'performance.yml', token: process.env.GH_TOKEN }) : { status: 'green' };
  if ([validate, performance].some(v => v.status === 'failed')) throw Error('release proof is red; owner must repair/re-run, no automatic publish');
  const integration = stable && validate.status === 'green' && performance.status === 'green'
    ? await e2e({ tag, ref: candidate, ops: external, dispatch: true }) : { status: stable ? 'pending' : 'green' };
  if (integration.status === 'failed') throw Error('E2E is red; no automatic retry/publish');
  if ([validate, performance, integration].every(v => v.status === 'green')) return { proceed: true, pending: false };
  const dispatchSha = request(`repos/${repo}/git/ref/heads/${stable ? 'main' : 'dev'}`).object.sha;
  const tagSha = tagCommit(repo, tag, request);
  if (tagSha && tagSha !== candidate) throw Error('tag moved before pending record');
  const children = ['validate.yml', ...(stable ? ['performance.yml'] : [])].flatMap(name =>
    (request(`repos/${repo}/actions/workflows/${name}/runs?head_sha=${candidate}&per_page=10`).workflow_runs || [])
      .filter(r => r.head_sha === candidate && r.repository?.full_name === repo && r.head_repository?.full_name === repo)
      .map(r => ({ id: r.id, attempt: r.run_attempt, path: r.path })));
  seal({ kind: 'release', repo, candidate, tree, tag, stable, workflow, dispatchSha, tagSha, children,
    e2eDispatched: integration.dispatched === true,
    producerPath: `.github/workflows/${workflow}` }, out);
  return { proceed: false, pending: true, validate: validate.status, performance: performance.status, e2e: integration.status };
}
if (isMainModule(import.meta.url)) {
  const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  try {
    const repo = arg('repo') || process.env.GITHUB_REPOSITORY, out = arg('out');
    let result;
    if (arg('kind') === 'night') {
      // Pin before dispatch. A concurrent dev push invalidates this intent at resume.
      const candidate = api(`repos/${repo}/git/ref/heads/dev`).object.sha;
      const tree = api(`repos/${repo}/git/commits/${candidate}`).tree.sha;
      sealContinuation({ kind: 'night', repo, branch: 'dev', candidate, tree, producerPath: '.github/workflows/nightly.yml' }, out);
      gh(['workflow', 'run', 'validate.yml', '--repo', repo, '--ref', 'dev', '-f', 'full=true']);
      result = { pending: true, candidate, note: 'queued, not a green night; follow exact full Validate' };
    } else result = await prepareReleasePending({ repo, candidate: arg('sha'), tag: arg('tag'), stable: arg('stable') === 'true', workflow: arg('workflow'), out });
    console.log(JSON.stringify(result));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result)
      .filter(([, v]) => typeof v === 'boolean').map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nWorkflow intent: ${JSON.stringify(result)}\n`);
  } catch (error) { console.error(String(error?.message || error)); process.exitCode = 1; }
}
