// #649 AC12: product frames for docs/design/649-25d-stage6/ACCEPTANCE.md.
// Diagnostic, not golden (#455): run on a built bundle, compare by eye with the
// lab frames of sketch 07.
//
//   npm run build && npm run bundle:sync
//   node demo/capture_stage6_acceptance_649.mjs [out-dir]
import { mkdirSync } from 'node:fs';
import { launch } from './serve.mjs';
import { goldenClip, prepareGoldenScenario } from './golden/harness.mjs';
import { STAGE6_ACCEPTANCE_SCENARIOS } from './golden/matrix.mjs';

const out = process.argv[2] || 'artifacts/stage6-acceptance';
mkdirSync(out, { recursive: true });
const { page, browser } = await launch({ width: 1000, height: 900 }, 1);
for (const scenario of STAGE6_ACCEPTANCE_SCENARIOS) {
  await prepareGoldenScenario(page, scenario);
  await page.waitForTimeout(2600); // the sun wash fades in over 2 s
  await page.screenshot({ path: `${out}/${scenario.id}.png`, clip: await goldenClip(page, scenario.capture) });
  console.log('captured', scenario.id);
}
await browser.close();
