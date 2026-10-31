// #1146: opt-in checkpoints for existing offline smoke fixtures. These are
// comparison frames, not golden acceptance or evidence of a live HA session.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { waitForUiKitPaint } from './ui-kit-paint.mjs';
let sequence = 0;

export async function installUiKitCapture(page) {
  const directory = process.env.HP_UI_KIT_CAPTURE_DIR;
  if (!directory) return;
  const output = resolve(directory); mkdirSync(output, { recursive: true });
  const wanted = process.env.HP_UI_KIT_CAPTURE_SURFACES?.split(',').filter(Boolean);
  const captured = new Set();
  // Attach before navigation, so short-lived sheets are observed too. Coverage
  // is opt-in and candidate-only: a matched selector is not winning paint.
  const cdp = await page.context().newCDPSession(page);
  const headers = new Map(), sheets = new Map(), pending = new Set(), used = [];
  const read = async styleSheetId => {
    try { sheets.set(styleSheetId, (await cdp.send('CSS.getStyleSheetText', { styleSheetId })).text); }
    catch { /* A retired component may already have removed its sheet. */ }
  };
  cdp.on('CSS.styleSheetAdded', ({ header }) => {
    headers.set(header.styleSheetId, header);
    const task = read(header.styleSheetId); pending.add(task); task.finally(() => pending.delete(task));
  });
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('CSS.startRuleUsageTracking');
  await page.exposeFunction('__hpUiCapture', async (surface, selector) => {
    if (wanted && !wanted.includes(surface)) return;
    if (captured.has(surface)) return;
    if (!/^[a-z][a-z0-9-]+$/.test(surface) || typeof selector !== 'string' || !selector) throw Error('Invalid UI Kit capture checkpoint');
    const target = page.locator(selector).filter({ visible: true }).first();
    await target.waitFor({ state: 'visible', timeout: 5000 });
    await waitForUiKitPaint(page);
    const viewport = page.viewportSize(), number = ++sequence;
    const name = `${surface}-${viewport.width}-${process.pid}-${number}`;
    const frame = `${name}.png`;
    const paint = await target.evaluate(element => { const s = getComputedStyle(element); return { color: s.color, background: s.backgroundColor }; });
    await page.screenshot({ path: resolve(output, frame) });
    if (!await target.isVisible()) throw Error(`UI Kit capture lost its surface: ${surface}`);
    used.push(...(await cdp.send('CSS.takeCoverageDelta')).coverage.filter(rule => rule.used));
    await Promise.all([...pending]);
    await Promise.all([...headers.keys()].map(read));
    const coverage = `${name}.coverage.json`;
    writeFileSync(resolve(output, coverage), JSON.stringify({ schema:1, kind:'candidate-only', surface,
      method:'CSS.startRuleUsageTracking before navigation; cumulative used ranges at this native smoke checkpoint. Selector usage is not winning-declaration proof.',
      sheets:[...sheets].map(([id, text]) => ({ sha256:createHash('sha256').update(text).digest('hex'),
        source:headers.get(id)?.sourceURL || '(constructed)', text,
        usedRanges:used.filter(rule => rule.styleSheetId === id).map(({ startOffset:start, endOffset:end }) => ({ start,end })) })) }, null, 2) + '\n');
    writeFileSync(resolve(output, `${name}.json`), JSON.stringify({ schema: 1, surface, selector, frame, coverage, viewport, paint,
      renderer: 'existing offline smoke fixture', browserVersion: await page.context().browser().version(),
      note: 'Comparison candidate only; no golden accepted and no live HA connection.' }, null, 2) + '\n');
    captured.add(surface);
  });
}

export const captureUiKitSurface = (page, surface, selector) => page.evaluate(
  ({ surface, selector }) => window.__hpUiCapture?.(surface, selector), { surface, selector });
