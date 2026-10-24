#!/usr/bin/env node
// A fast docs/tooling result is explicitly progress, never product authority.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CI_PROOF_SCHEMA, ciProofArtifactName, taskChecksFromNeeds } from './ci-proof.mjs';
import { ciWorkflow, CI_WORKFLOWS } from './ci-workflows.mjs';

const workflow = ciWorkflow(process.env.CI_WORKFLOW);
if (!['docs', 'tooling'].includes(CI_WORKFLOWS[workflow])) throw Error('fast proof needs a registered non-product profile');
const needs = JSON.parse(process.env.NEEDS_JSON || '{}');
const result = process.env.CI_RESULT || Object.values(needs).every(j => ['success', 'skipped'].includes(j.result)) && 'success' || 'failure';
const run = Number(process.env.GITHUB_RUN_ID), attempt = Number(process.env.GITHUB_RUN_ATTEMPT);
const proof = { schema: CI_PROOF_SCHEMA, candidate: { sha: process.env.GITHUB_SHA,
  tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim() },
  run: { id: run, attempt, workflow, event: process.env.GITHUB_EVENT_NAME },
  profile: CI_WORKFLOWS[workflow], request: { full: false, golden: false, mutants: false },
  selection: { frontend: false, integration: false, backend: false, geometry_parity: false },
  requiredChecks: ['preflight'], executedChecks: ['preflight'], reusedChecks: [],
  checks: { preflight: { mode: 'executed', result } }, taskChecks: taskChecksFromNeeds(needs) };
mkdirSync('artifacts/ci-proof', { recursive: true });
writeFileSync('artifacts/ci-proof/proof.json', JSON.stringify(proof, null, 2) + '\n');
console.log(`${ciProofArtifactName(run, attempt)}: ${proof.profile} progress, product proof still required`);
