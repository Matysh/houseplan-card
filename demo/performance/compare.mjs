#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { evaluatePerformanceBudget, performanceSummaryMarkdown } from './evaluate.mjs';

const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = resolve(valueArg('candidate') ?? 'artifacts/performance/candidate.json');
const baselinePath = resolve(valueArg('baseline') ?? 'artifacts/performance/baseline.json');
const budgetsPath = resolve(valueArg('budgets') ?? 'demo/performance/budgets.json');
const outputPath = resolve(valueArg('output') ?? 'artifacts/performance/comparison.json');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const evaluation = evaluatePerformanceBudget({
  candidate: readJson(candidatePath),
  baseline: readJson(baselinePath),
  budgets: readJson(budgetsPath),
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evaluation, null, 2)}\n`, 'utf8');
const markdown = performanceSummaryMarkdown(evaluation);
process.stdout.write(markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
if (!evaluation.pass) {
  console.error(`Performance budget failed: ${evaluation.failures.map((item) => item.id).join(', ')}`);
  process.exitCode = 1;
}
