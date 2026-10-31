#!/usr/bin/env node
// #1146: offline UI Kit census. This records candidates, never accepts goldens
// or deletes CSS. Real pinned HA components; synthetic UI Lab fixture only.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, expect } from 'playwright/test';
import { createLabServer } from './server.mjs';
import { attestLaunchedBrowser } from '../../scripts/browser-attestation.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
import { parseCss } from '../../scripts/css-lex.mjs';
import { largePlanFile } from '../helpers/large-plan-file.mjs';
import { waitForUiKitPaint } from '../helpers/ui-kit-paint.mjs';
import { loadForeignCss, assertForeignCssWitness } from '../../scripts/css-foreign.mjs';

const { values } = parseArgs({ options: { output: { type: 'string', default: 'artifacts/ui-kit-audit' },
  'ha-cache': { type: 'string' }, width: { type: 'string' }, theme: { type: 'string' } } });
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, values.output);
const widths = values.width ? [Number(values.width)] : [1280, 1024, 390];
const themes = values.theme ? [values.theme] : ['light', 'dark'];
assert.ok(widths.every(width => Number.isInteger(width) && width >= 320));
assert.ok(themes.every(theme => ['light', 'dark'].includes(theme)));
mkdirSync(output, { recursive: true });
const server = createLabServer({ port: 0, ...(values['ha-cache'] ? { haCache: values['ha-cache'] } : {}) });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const profiles = [], sheets = new Map(), errors = [];
const foreign = loadForeignCss(root);
const modalForeign = { ...foreign, entries: foreign.entries.filter(row => row.file === 'src/ha-dialog-motion.ts') };
const hash = text => createHash('sha256').update(text).digest('hex');
try {
  const attestation = await attestLaunchedBrowser(browser, { reason: '#1146 UI Kit CSS coverage and control measurements' });
  for (const theme of themes) for (const width of widths) {
    const id = `${theme}-${width}`, profile = { id, theme, width, stages: [], controls: [], fingerprints: [], matchedSummaryButtons: [] };
    profiles.push(profile);
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
      });
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      // Read-only genuine-component vocabulary witness, including short exit
      // states that have gone by the time a settled screenshot is taken.
      await page.addInitScript(() => {
        const observed = new Set();
        window.__uiKitForeignClasses = observed;
        const sample = root => {
          for (const element of root.querySelectorAll('*')) {
            if (element.localName === 'wa-dialog') for (const node of element.shadowRoot?.querySelectorAll('*') ?? [])
              for (const name of node.classList) observed.add(name);
            if (element.shadowRoot) sample(element.shadowRoot);
          }
        };
        const tick = () => { sample(document); requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      page.on('pageerror', error => errors.push({ profile: id, message: error.message }));
      const headers = new Map(), cache = new Map(), pending = new Set(), usage = [];
      const readSheet = async styleSheetId => {
        try { const result = await cdp.send('CSS.getStyleSheetText', { styleSheetId }); cache.set(styleSheetId, result.text); }
        catch { /* A retired shell can remove its sheet; retain the last observed text. */ }
      };
      cdp.on('CSS.styleSheetAdded', ({ header }) => {
        headers.set(header.styleSheetId, header);
        const task = readSheet(header.styleSheetId); pending.add(task); task.finally(() => pending.delete(task));
      });
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('CSS.startRuleUsageTracking');
      await page.goto(origin); await page.waitForFunction(() => window.__lab?.card?._devices?.length > 0);
      profile.fingerprints.push(await assertFreshDemoBundle(page, root));
      await page.locator('#lab-launcher').click(); await page.locator('#lab-theme').selectOption(theme); await page.locator('#lab-close').click();
      await page.mouse.move(0, 0);
      const capture = async name => {
        await waitForUiKitPaint(page);
        const file = `${id}-${name}.png`;
        await page.screenshot({ path: resolve(output, file) });
        profile.stages.push({ name, frame: file });
        usage.push(...(await cdp.send('CSS.takeCoverageDelta')).coverage);
      };
      const shortcut = async (name, kind = name) => {
        if (name === 'support') await page.locator('[data-hp="support"]').first().click();
        else { await page.locator('#lab-launcher').click(); await page.locator(`[data-open="${name}"]`).click(); }
        const shell = page.locator(`hp-dialog[data-kind="${kind}"]`); await expect(shell).toBeVisible(); return shell;
      };
      const close = async shell => {
        await shell.locator('[data-hp="dialog-cancel"]').first().click(); await expect(shell).toHaveCount(0);
      };
      // Devices can resolve before View is presented. Genuine cold boot is
      // captured by capture_ui_kit_transients; this matrix starts at ready View.
      await page.waitForFunction(() => {
        const card = window.__lab?.card, root = card?.shadowRoot;
        return root?.querySelector('ha-card[data-hp-state="ready"]')
          && !root.querySelector('.bootveil') && !root.querySelector('.stage.hpboot');
      });
      await page.mouse.move(0, 0);
      await capture('view');
      await page.locator('houseplan-card button[data-hp-tooltip]').filter({ visible: true }).first().hover();
      await expect(page.locator('.hp-chrome-tooltip')).toBeVisible(); await capture('chrome-tooltip');
      await page.mouse.move(0, 0);
      const general = await shortcut('settings');
      const sections = await general.locator('[data-hp="settings-section"]').evaluateAll(els => els.map(el => el.dataset.section));
      for (const section of sections) {
        const button = general.locator(`[data-hp="settings-section"][data-section="${section}"]`);
        if (await button.isVisible()) await button.click();
        else await general.locator('[data-field="settings-section"]').selectOption(section);
        await capture(`general-${section}`);
      }
      await close(general);
      const summary = await shortcut('summary'); await capture('summary');
      await summary.locator('[data-summary-source-owner]').first().click();
      await expect(summary.locator('[data-summary-picker-search]')).toBeVisible();
      await capture('summary-source-picker');
      // CDP matching means selector usage, not winning declarations. Preserve
      // matched declaration stacks and computed paint for the duplication audit.
      await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
      const remote = await cdp.send('Runtime.evaluate', { expression: `(() => {
        const find = root => { for(const e of root.querySelectorAll('*')) {
          if(e.matches('hp-dialog[data-kind="summary"]')) return e.querySelector('.summary-source.btn');
          if(e.shadowRoot) {const found=find(e.shadowRoot);if(found)return found;}
        }}; return find(document);
      })()` });
      if (remote.result.objectId) {
        const { nodeId } = await cdp.send('DOM.requestNode', { objectId: remote.result.objectId });
        profile.matchedSummaryButtons.push({
          matched: await cdp.send('CSS.getMatchedStylesForNode', { nodeId }),
          computed: await cdp.send('CSS.getComputedStyleForNode', { nodeId }),
        });
        await cdp.send('Runtime.releaseObject', { objectId: remote.result.objectId });
      } else throw Error('summary button missing for cascade evidence');
      await close(summary);
      for (const [name, kind] of [['space', 'space'], ['pdf', 'pdf'], ['support', 'support']]) {
        let shell = await shortcut(name, kind); await capture(kind);
        if (name === 'space') {
          const planTab = shell.locator('[data-section-target="basics"]');
          if (await planTab.isVisible()) await planTab.click();
          else await shell.locator('[data-field="settings-section"]').selectOption('basics');
          const sourceControl = shell.locator('hp-settings-select:has(select[name$="-plan-source"])');
          const source = await sourceControl.locator('select').inputValue();
          const chooseSource = async value => {
            await sourceControl.locator('[data-hp="select-trigger"]').click();
            await sourceControl.locator(`[role="option"][data-id="${value}"]`).click();
          };
          await chooseSource('file');
          await shell.locator('[data-hp="image-upload"]').setInputFiles(await largePlanFile(page));
          const guard = page.locator('hp-dialog[data-kind="decor"]'); await expect(guard).toBeVisible();
          await capture('backdrop-guard'); await close(guard);
          await chooseSource(source);
          await shell.locator('[data-action="space-copy"]').click();
          shell = page.locator('hp-dialog[data-kind="space"]'); await expect(shell.locator('#space-copy-name')).toBeVisible();
          await capture('space-copy');
          await shell.locator('[data-hp="dialog-cancel"]').click();
          await expect(shell.locator('[data-action="space-copy"]')).toBeVisible();
        }
        await close(shell);
      }
      for (const mode of ['plan', 'devices', 'decor']) {
        await page.locator(`[data-hp="mode-tab"][data-mode="${mode}"]`).click();
        await expect(page.locator('.editbar .btn').first()).toBeVisible();
        profile.controls.push({ mode, items: await page.locator('.editbar .btn,.editor-close-slot .closex').evaluateAll(elements =>
          elements.filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
            return { action: e.getAttribute('data-hp'), tool: e.getAttribute('data-tool'), width: r.width, height: r.height,
              padding: s.padding, border: s.borderWidth, radius: s.borderRadius, font: s.font, lineHeight: s.lineHeight }; })) });
        await capture(`${mode}-toolbar`);
        if (mode === 'devices') {
          for (const [tool, kind] of [['device-inbox', 'device-inbox'], ['icon-rules', 'rules']]) {
            await page.locator(`.editbar [data-tool="${tool}"]`).click();
            const shell = page.locator(`hp-dialog[data-kind="${kind}"]`); await expect(shell).toBeVisible();
            await capture(kind); await close(shell);
          }
        } else {
          for (const tool of mode === 'plan' ? ['rooms', 'opening', 'stairs'] : ['shapes', 'furniture', 'image']) {
            await page.locator(`.editbar [data-tool="${tool}"]`).click();
            await expect(page.locator('[data-hp="tray"]')).toBeVisible(); await capture(`${mode}-tray-${tool}`);
            await page.locator('.editbar [data-tool="select"]').click();
          }
        }
      }
      profile.foreignModalClasses = await page.evaluate(() => [...window.__uiKitForeignClasses].sort());
      if (modalForeign.entries.length) assertForeignCssWitness(modalForeign, server.provenance,
        profile.foreignModalClasses.map(name => ({ component:'wa-dialog', name })));
      usage.push(...(await cdp.send('CSS.stopRuleUsageTracking')).ruleUsage);
      await Promise.all([...pending]);
      for (const styleSheetId of headers.keys()) await readSheet(styleSheetId);
      for (const [styleSheetId, text] of cache) {
        const key = hash(text); let sheet = sheets.get(key);
        if (!sheet) {
          sheet = { sha256: key, text, urls: new Set(), profiles: new Set(), usedRanges: [], rules: [], parseError: null };
          try { sheet.rules = parseCss(text).filter(rule => rule.kind === 'rule'); }
          catch (error) { sheet.parseError = error.message; }
          sheets.set(key, sheet);
        }
        sheet.profiles.add(id); sheet.urls.add(headers.get(styleSheetId)?.sourceURL || '(constructed)');
        sheet.usedRanges.push(...usage.filter(rule => rule.styleSheetId === styleSheetId && rule.used)
          .map(({ startOffset: start, endOffset: end }) => ({ start, end, profile: id })));
      }
      console.log(`PASS ${id}: ${profile.stages.length} stages, ${cache.size} stylesheets`);
    } catch (error) { profile.error = error.stack; errors.push({ profile: id, message: error.message }); }
    finally { await context.close(); }
  }
  const rows = [...sheets.values()].map(sheet => ({ ...sheet, profiles: [...sheet.profiles], urls: [...sheet.urls],
    productCandidate: /--hp-|--hpf-|\.summary-editor|\.editbar/.test(sheet.text),
    rules: sheet.rules.map(rule => ({ selector: rule.header, scope: rule.scope, start: rule.start, end: rule.end,
      used: sheet.usedRanges.some(range => range.start < rule.end && range.end > rule.start) })) }));
  writeFileSync(resolve(output, 'coverage.json'), JSON.stringify({ schema: 1, kind: 'candidate-only',
    method: 'CSS.startRuleUsageTracking + takeCoverageDelta at every native UI stage; union by stylesheet SHA-256. Selector usage is not a winning-declaration proof. Unsupported CSS is never labelled unused.',
    attestation, browserVersion: await browser.version(), profiles, errors, sheets: rows }, null, 2) + '\n');
  writeFileSync(resolve(output, 'unused-candidates.json'), JSON.stringify(rows.filter(s => s.productCandidate && !s.parseError)
    .flatMap(sheet => sheet.rules.filter(rule => !rule.used).map(rule => ({ stylesheet: sheet.sha256, profiles: sheet.profiles, ...rule }))), null, 2) + '\n');
  assert.equal(errors.length, 0, JSON.stringify(errors));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
