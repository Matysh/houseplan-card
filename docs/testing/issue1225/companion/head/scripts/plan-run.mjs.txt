#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { githubOps, planRun } from './release-plan.mjs';

try {
  const plan = await planRun({ event: process.env.EVENT, targetRef: process.env.HP_REF,
    upgradeFrom: process.env.UPGRADE_FROM, haVersion: process.env.HA_VERSION }, githubOps());
  console.log(JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(plan.matrix)}\nstable_tag=${plan.stableTag}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Resolved upgrade pair\n\n- Source: \`${plan.upgrade.source.ref}\` (${plan.upgrade.source.version})\n`
    + `- Target: \`${plan.upgrade.target.ref}\` (${plan.upgrade.target.version})\n`
    + `- Stable baseline after a green run: ${plan.stableTag ? `\`evidence/stable/${plan.stableTag}\`` : 'no (not a stable gate)'}\n`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
