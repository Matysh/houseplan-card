import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resolve } from 'node:path';
import { buildNativeReviewInvocation, NATIVE_REVIEW_VERSION, NATIVE_REVIEW_SHA256 } from '../scripts/review-native-runner.mjs';

// Check the actual native invocation produced from workflow configuration,
// not model names mentioned in prose or a provider's current default.
const argument = (args, name) => {
  assert.equal(args.filter(value => value === `--${name}`).length, 1, `exactly one explicit --${name}`);
  return args[args.indexOf(`--${name}`) + 1];
};

for (const [file, maxTurns] of [['_process.yml', '150'], ['_ship-review.yml', '150'], ['release-review.yml', '200']]) {
  test(`#1063 ${file} pins the review model and effort consistently`, () => {
    const workflow = parse(readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'));
    const reviews = Object.values(workflow.jobs).flatMap(job => job.steps || [])
      .filter(step => step.name === 'Review');
    assert.equal(reviews.length, 1, 'one model entrypoint is covered by this contract');
    const review = reviews[0], root = resolve('fixture-review-material');
    assert.match(review.run, /review-native-runner\.mjs"$/);
    assert.equal(review.uses, undefined);
    assert.equal(String(review.env.REVIEW_MAX_TURNS), maxTurns);
    const args = buildNativeReviewInvocation({ cliPath: resolve('fixture-cli'), policyPath: resolve('fixture-policy'),
      promptPath: resolve('fixture-prompt'), executionDir: resolve('fixture-output'),
      kind: review.env.REVIEW_KIND, maxTurns: Number(review.env.REVIEW_MAX_TURNS), jsonSchema: review.env.REVIEW_JSON_SCHEMA },
    { root, schema: 2, kind: review.env.REVIEW_KIND, sha: 'a'.repeat(40),
      cliVersion: NATIVE_REVIEW_VERSION, cliSha256: NATIVE_REVIEW_SHA256 }).args;
    assert.equal(argument(args, 'model'), 'claude-sonnet-5');
    assert.equal(argument(args, 'effort'), 'high');
    assert.equal(argument(args, 'max-turns'), maxTurns, 'existing stage budgets stay unchanged');
    assert.equal(args.includes('--fallback-model'), false, 'no alternative reviewer is requested');
  });
}
