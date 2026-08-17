// AC-13 for #157. Usage:
//   node demo/downgrade_open_passage.mjs --bundle=/absolute/v1.64.0/dist/houseplan-card.js
// The v1.64.0 frontend does not understand `passage`; this executable fixture
// pins its documented best-effort fallback (door symbol) and, critically,
// rejects any pageerror/unhandled exception while reading the newer literal.
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';

const value = process.argv.find((arg) => arg.startsWith('--bundle='))?.slice('--bundle='.length);
if (!value) {
  console.error('usage: node demo/downgrade_open_passage.mjs --bundle=/absolute/v1.64.0/houseplan-card.js');
  process.exit(2);
}
const bundle = isAbsolute(value) ? value : resolve(value);
if (!existsSync(bundle)) {
  console.error(`v1.64.0 bundle not found: ${bundle}`);
  process.exit(2);
}

const currentDemo = fileURLToPath(new URL('./srv', import.meta.url));
const serveRoot = mkdtempSync(join(tmpdir(), 'hp-157-downgrade-'));
let browser;
try {
  cpSync(currentDemo, serveRoot, { recursive: true });
  cpSync(bundle, join(serveRoot, 'assets', 'houseplan-card.js'));
  const launched = await launch(undefined, 1, [], {}, serveRoot);
  browser = launched.browser;
  const out = await launched.page.evaluate(async () => {
    const card = window.__card;
    const root = () => card.shadowRoot || card.renderRoot;
    const space = card._serverCfg.spaces.find((item) => item.id === card._space);
    space.openings = [{
      id: 'future-passage', type: 'passage', x: 0.3, y: 0.14,
      angle: 0, length: 0.09, future_material: 'stone',
    }];
    card._setMode('plan');
    card._cfgEpoch++;
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    const opening = root().querySelector('[data-hp="opening"][data-id="future-passage"]');
    const stored = space.openings[0];
    return {
      newerLiteralLoads: !!opening,
      documentedDoorFallback: !!opening?.querySelector('.op-leaf,.op-arc'),
      readDoesNotRewriteConfig: stored.type === 'passage'
        && stored.future_material === 'stone' && space.openings.length === 1,
    };
  });
  checkAll(out);
  await finish(browser, out);
  browser = undefined;
} finally {
  await browser?.close?.();
  rmSync(serveRoot, { recursive: true, force: true });
}
