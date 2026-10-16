#!/usr/bin/env node
// #926: bounded Actions configuration, never issue/diff/handoff instructions.
// This is a routing policy, not a capability sandbox or a severity waiver.
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { TextDecoder } from 'node:util';
import { isMainModule } from './spawn-portable.mjs';

export const FINDINGS_VARIABLE = 'HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES';
export const FINDINGS_FILE = 'outside-findings.md';
const SCHEMA = 'houseplan-outside-findings-policy/v1';
const KEYS = ['schema', 'source', 'variable', 'repo', 'issue', 'stage', 'round', 'mode', 'path'].sort();
const positive = value => Number.isSafeInteger(value) && value > 0;

export function configuredIssues(raw = '') {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 4096) throw new Error('findings configuration: size/type');
  if (!raw.trim()) return [];
  const values = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > 100 || !values.every(positive))
    throw new Error('findings configuration: expected at most 100 positive integer issue IDs');
  return [...new Set(values)].sort((a, b) => a - b);
}

function identity({ repo, issue, stage, round }) {
  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)
    || !positive(issue) || !['spec', 'code'].includes(stage) || !positive(round))
    throw new Error('findings policy: invalid review identity');
}

export function findingsPolicy(raw, target) {
  identity(target);
  const mode = configuredIssues(raw).includes(target.issue) ? 'file' : 'issues';
  return { schema: SCHEMA, source: 'actions-variable', variable: FINDINGS_VARIABLE,
    repo: target.repo, issue: target.issue, stage: target.stage, round: target.round, mode,
    path: mode === 'file' ? `docs/reviews/findings/${target.issue}-${target.stage}-r${target.round}.md` : null };
}

export function readFindingsPolicy(snapshot, target) {
  identity(target);
  if (typeof snapshot !== 'string' || Buffer.byteLength(snapshot) > 2048)
    throw new Error('findings policy: missing/oversized snapshot');
  const policy = JSON.parse(snapshot);
  if (!policy || Object.keys(policy).sort().join(',') !== KEYS.join(',')
    || !['file', 'issues'].includes(policy.mode)) throw new Error('findings policy: unknown fields/mode');
  const derived = findingsPolicy(policy.mode === 'file' ? JSON.stringify([target.issue]) : '', target);
  if (JSON.stringify(policy) !== JSON.stringify(derived)) throw new Error('findings policy: identity/path/source mismatch');
  return policy;
}

export function findingsTextProblems(text) {
  if (typeof text !== 'string' || !text.trim() || text.includes('\0') || Buffer.byteLength(text) > 262144)
    return ['outside findings: empty, NUL or larger than 256 KiB'];
  return [];
}

function readFindingsFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 262144) throw new Error('outside findings: expected regular file at most 256 KiB');
  const bytes = readFileSync(path);
  if (bytes.length > 262144) throw new Error('outside findings: larger than 256 KiB');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const problems = findingsTextProblems(text);
  if (problems.length) throw new Error(problems.join('; '));
  return text;
}

function statOrMissing(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Source and destination are runner-owned paths. The document cannot select its
// repository destination; that comes only from the trusted frozen snapshot.
export function sealFindings(policy, source, directory) {
  if (policy.mode === 'file') {
    const text = readFindingsFile(source);
    writeFileSync(join(directory, FINDINGS_FILE), text);
  } else if (existsSync(source)) throw new Error('outside findings file without file-mode authorization');
}

export function publishFindings(policy, source, root = '.') {
  if (policy.mode !== 'file') return null;
  const text = readFindingsFile(source);
  let parent = root;
  for (const part of policy.path.split('/').slice(0, -1)) {
    parent = join(parent, part);
    const stat = statOrMissing(parent);
    if (stat && !stat.isDirectory())
      throw new Error('outside findings: destination parent is not a real directory');
  }
  const path = join(root, policy.path);
  const stat = statOrMissing(path);
  if (stat && !stat.isFile()) throw new Error('outside findings: destination is not a regular file');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# Outside findings — #${policy.issue}, ${policy.stage}, r${policy.round}\n\n`
    + 'Routing: trusted Actions configuration; no new issues for out-of-scope findings.\n\n' + text);
  return policy.path;
}

if (isMainModule(import.meta.url)) {
  try {
    const target = { repo: process.env.REPO, issue: Number(process.env.NUM),
      stage: process.env.STAGE, round: Number(process.env.CYCLE) };
    const command = process.argv[2];
    if (command === 'collect') {
      const policy = findingsPolicy(process.env[FINDINGS_VARIABLE] ?? '', target);
      appendFileSync(process.env.GITHUB_OUTPUT, `snapshot=${JSON.stringify(policy)}\n`);
    } else {
      const policy = readFindingsPolicy(process.env.FINDINGS_POLICY_SNAPSHOT, target);
      if (command === 'model') writeFileSync(process.env.REVIEW_FINDINGS_POLICY, JSON.stringify(policy) + '\n');
      else if (command === 'seal') sealFindings(policy, process.env.REVIEW_FINDINGS, process.env.RESULT_DIR);
      else if (command === 'publish') {
        const path = publishFindings(policy, process.env.REVIEW_FINDINGS);
        if (path) console.log(path);
      } else throw new Error('expected collect/model/seal/publish');
    }
  } catch (error) { console.error(`::error::${error.message}`); process.exitCode = 1; }
}
