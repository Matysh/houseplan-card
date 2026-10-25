import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

// The pinned action gives ANTHROPIC_MODEL precedence over --model; the CLI
// can ignore an unknown effort value. Check actual step configuration, not
// model names mentioned in the review prompt or a provider's current default.
const argument = (args, name) => {
  const occurrences = args.match(new RegExp(`(?:^|\\s)--${name}(?=[=\\s]|$)`, 'g')) || [];
  assert.equal(occurrences.length, 1, `exactly one explicit --${name}`);
  const line = args.match(new RegExp(`^\\s*--${name} ([^\\r\\n]+)$`, 'm'));
  assert.ok(line, `--${name} must have one literal value`);
  return line[1].trim();
};

for (const [file, maxTurns] of [['_process.yml', '150'], ['_ship-review.yml', '150'], ['release-review.yml', '200']]) {
  test(`#1063 ${file} pins the review model and effort consistently`, () => {
    const workflow = parse(readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'));
    const reviews = Object.values(workflow.jobs).flatMap(job => job.steps || [])
      .filter(step => /^anthropics\/claude-code-action@/.test(step.uses || ''));
    assert.equal(reviews.length, 1, 'one model entrypoint is covered by this contract');
    const review = reviews[0], args = review.with?.claude_args;
    assert.match(review.uses, /^anthropics\/claude-code-action@[a-f0-9]{40}$/);
    assert.equal(review.env?.ANTHROPIC_MODEL, 'claude-sonnet-5');
    assert.equal(review.env?.CLAUDE_CODE_EFFORT_LEVEL, 'high');
    assert.equal(typeof args, 'string');
    assert.equal(argument(args, 'model'), review.env.ANTHROPIC_MODEL);
    assert.equal(argument(args, 'effort'), review.env.CLAUDE_CODE_EFFORT_LEVEL);
    assert.equal(argument(args, 'max-turns'), maxTurns, 'existing stage budgets stay unchanged');
    assert.doesNotMatch(args, /--fallback-model(?:[=\s]|$)/, 'no alternative reviewer is requested');
  });
}
