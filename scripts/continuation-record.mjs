// #856: three existing consumers of Actions completion, no generic job platform.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const continuationName = (run, attempt) => `workflow-continuation-${run}-${attempt}`;
const sha = value => /^[a-f0-9]{40}$/.test(value || '');
const id = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const paths = { merge: '.github/workflows/process.yml', night: '.github/workflows/nightly.yml',
  release: ['.github/workflows/release.yml', '.github/workflows/publish-prerelease.yml'] };
export function validContinuation(p) {
  return p?.schema === 1 && ['merge', 'night', 'release'].includes(p.kind)
    && /^[\w.-]+\/[\w.-]+$/.test(p.repo || '') && id(p.producer?.run) && id(p.producer?.attempt)
    && sha(p.producer?.sha) && [paths[p.kind]].flat().includes(p.producer?.path)
    && (['main', 'dev'].includes(p.producer.branch) || p.kind === 'release' && /^v\d+\.\d+\.\d+$/.test(p.producer.branch))
    && sha(p.candidate) && sha(p.tree) && Number.isFinite(Date.parse(p.createdAt))
    && Number.isFinite(Date.parse(p.expiresAt)) && Date.parse(p.expiresAt) - Date.parse(p.createdAt) === 86400000
    && (p.kind !== 'merge' || id(p.issue) && /^issue\/[1-9]\d+-[\w-]+$/.test(p.branch || '')
      && p.branch.startsWith(`issue/${p.issue}-`) && sha(p.material) && sha(p.dev)
      && /^[a-f0-9]{64}$/.test(p.bodyDigest || '') && typeof p.epoch === 'string' && p.epoch.length > 0
      && ['merge', 'merge-light'].includes(p.policy))
    && (p.kind !== 'night' || p.branch === 'dev')
    && (p.kind !== 'release' || /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/.test(p.tag || '')
      && ['release.yml', 'publish-prerelease.yml'].includes(p.workflow) && typeof p.stable === 'boolean'
      && p.producer.path === `.github/workflows/${p.workflow}` && p.stable === !p.tag.includes('-')
      && (p.workflow !== 'publish-prerelease.yml' || !p.stable)
      && sha(p.dispatchSha) && (p.tagSha === null || p.tagSha === p.candidate)
      && typeof p.e2eDispatched === 'boolean' && Array.isArray(p.children) && p.children.length <= 20
      && p.children.every(r => id(r.id) && id(r.attempt) && ['.github/workflows/validate.yml', '.github/workflows/performance.yml'].includes(r.path)));
}
export function sealContinuation(fields, out, env = process.env, now = new Date()) {
  const p = { ...fields, schema: 1, producer: { run: Number(env.GITHUB_RUN_ID), attempt: Number(env.GITHUB_RUN_ATTEMPT),
    sha: env.GITHUB_SHA, branch: env.GITHUB_REF_NAME, path: fields.producerPath },
    createdAt: now.toISOString(), expiresAt: new Date(+now + 86400000).toISOString() };
  delete p.producerPath;
  if (!validContinuation(p)) throw Error('invalid immutable continuation identity');
  mkdirSync(out, { recursive: true });
  const bytes = JSON.stringify(p) + '\n';
  writeFileSync(join(out, 'pending.json'), bytes, { flag: 'wx' });
  writeFileSync(join(out, 'manifest.sha256'), createHash('sha256').update(bytes).digest('hex') + '  pending.json\n', { flag: 'wx' });
  return p;
}
export function authenticatedContinuation(p, producer, event, repo, now = Date.now()) {
  return validContinuation(p) && p.repo === repo && producer?.repository?.full_name === repo
    && producer.head_repository?.full_name === repo && event?.head_repository?.full_name === repo
    && String(p.producer.run) === String(producer.id) && Number(p.producer.attempt) === Number(producer.run_attempt)
    && producer.path === p.producer.path && producer.head_sha === p.producer.sha && producer.head_branch === p.producer.branch
    && producer.status === 'completed' && producer.conclusion === 'success'
    && ['issues', 'schedule', 'workflow_dispatch', 'release'].includes(producer.event)
    && now >= Date.parse(p.createdAt) && now < Date.parse(p.expiresAt)
    && event?.repository?.full_name === repo && event.status === 'completed' && event.head_sha === p.candidate
    && ['.github/workflows/validate.yml', '.github/workflows/performance.yml'].includes(event.path)
    && (Date.parse(event.created_at) >= Date.parse(producer.created_at)
      || p.kind === 'release' && p.children.some(r => Number(r.id) === Number(event.id)
        && Number(r.attempt) === Number(event.run_attempt) && r.path === event.path));
}
