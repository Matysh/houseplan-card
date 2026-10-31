// Native variable-dialog evidence on genuine pinned HA components; synthetic data only.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from 'playwright/test';
import { createLabServer } from './server.mjs';
import { attestLaunchedBrowser } from '../../scripts/browser-attestation.mjs';
import { waitForUiKitPaint } from '../helpers/ui-kit-paint.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(arg('repo-root') || fileURLToPath(new URL('../../', import.meta.url)));
const output = resolve(arg('output') || 'artifacts/ui-kit-variable-dialog');
const comparison = process.argv.includes('--comparison');
const scratch = mkdtempSync(resolve(tmpdir(), 'hp-variable-dialog-'));
const fixturePath = resolve(scratch, 'fixture.json');
const fixture = JSON.parse(readFileSync(resolve(root, 'demo/ui-lab/fixture.json'), 'utf8'));
fixture.config.spaces[0].decor.push({ id: 'variable-audit', kind: 'text', x: .4, y: .5,
  text: 'Value', color: '#526871', size_cm: 22.5 });
writeFileSync(fixturePath, JSON.stringify(fixture));
mkdirSync(output, { recursive: true });
const server = createLabServer({ port: 0, repoRoot: root, labRoot: resolve(root, 'demo/ui-lab'), fixture: fixturePath });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch();
const profiles = [], errors = [];
try {
  const attestation = await attestLaunchedBrowser(browser, { reason: '#1148 variable dialog native footer and writer contract' });
  // Properties and this entry point exist only at card widths >=1024 (#931).
  for (const theme of (arg('theme') ? [arg('theme')] : ['light', 'dark'])) for (const width of (arg('width') ? [Number(arg('width'))] : [1280, 1024])) {
    const profile = { id: `${theme}-${width}`, frames: [] }; profiles.push(profile);
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    try {
      await context.route('**/*', route => { const url = new URL(route.request().url());
        return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort(); });
      const page = await context.newPage(); page.on('pageerror', error => errors.push({ profile: profile.id, error: error.message }));
      await page.goto(origin); await page.waitForFunction(() => window.__lab?.card?.shadowRoot?.querySelector('ha-card[data-hp-state=ready]'));
      await page.locator('#lab-launcher').click(); await page.locator('#lab-theme').selectOption(theme); await page.locator('#lab-close').click();
      await page.locator('[data-hp=mode-tab][data-mode=decor]').click();
      await page.locator('[data-hp=decor][data-id=variable-audit]').click();
      const panel = page.locator('[data-hp=properties-panel]'), text = panel.locator('textarea');
      await expect(text).toHaveValue('Value'); await text.fill('Value: '); await text.press('End');
      await panel.locator('.hp-prop-variable').click();
      const dialog = page.locator('hp-dialog[data-kind=properties-variable]'); await expect(dialog).toBeVisible();
      const capture = async state => {
        await expect(dialog.locator('ha-icon[icon="mdi:close"] path')).toHaveCount(1);
        await waitForUiKitPaint(page);
        const controls = await dialog.evaluate(shell => {
          const token = getComputedStyle(shell).getPropertyValue('--hpf-accent').trim();
          const reference = document.createElement('span'); reference.style.color = token;
          return { expectedAccent: reference.style.color, footer: [...shell.querySelectorAll('.hp-prop-variable-footer button')].map(button => {
            const rect = button.getBoundingClientRect(), style = getComputedStyle(button);
            return { width: rect.width, height: rect.height, radius: style.borderRadius, background: style.backgroundColor,
              color: style.color, opacity: style.opacity, disabled: button.disabled, right: rect.right, bottom: rect.bottom };
          }) };
        });
        if (!comparison) {
          assert.equal(controls.footer.length, 2);
          assert.ok(controls.footer.every(button => button.width >= 44 && button.height >= 44 && button.right <= width && button.bottom <= 1000));
          assert.ok(controls.footer.every(button => button.radius === '7px'));
          assert.equal(controls.footer[1].background, controls.expectedAccent);
        }
        const file = `${profile.id}-${state}.png`; await page.screenshot({ path: resolve(output, file) }); profile.frames.push({ state, file, ...controls });
      };
      await expect(dialog.locator('[data-hp=dialog-confirm]')).toBeDisabled(); await capture('disabled');
      const choose = async () => { await dialog.locator('.hpf-pick').click();
        await dialog.locator('.hpf-panel input').fill('sensor.lab_co2');
        await dialog.locator('.hpf-cand').filter({ hasText: 'sensor.lab_co2' }).click(); };
      await choose(); await expect(dialog.locator('[data-hp=dialog-confirm]')).toBeEnabled(); await capture('enabled');
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(text).toHaveValue('Value: ');
      const stored = () => page.evaluate(async () => (await window.__lab.mock.hass.callWS({ type: 'houseplan/config/get' })).config.spaces[0].decor.find(shape => shape.id === 'variable-audit').text);
      assert.equal(await stored(), 'Value', 'Escape must not write the text draft');
      await text.press('End'); await waitForUiKitPaint(page);
      profile.caret = await text.evaluate(input => ({ start: input.selectionStart, end: input.selectionEnd, value: input.value }));
      const inserted = profile.caret.value.slice(0, profile.caret.start) + '{sensor.lab_co2}' + profile.caret.value.slice(profile.caret.end);
      await panel.locator('.hp-prop-variable').click(); await choose(); await dialog.locator('[data-hp=dialog-confirm]').click();
      await expect(dialog).toHaveCount(0); await expect(text).toHaveValue(inserted);
      assert.equal(await stored(), inserted, 'native insertion must complete at the observed caret through the local fixture writer');
      console.log(`PASS ${profile.id}: disabled/enabled footer, Escape/no write and insertion`);
    } catch (error) { profile.error = error.stack; errors.push({ profile: profile.id, error: error.message }); console.log(`FAIL ${profile.id}: ${error.message}`); }
    finally { await context.close(); }
    writeFileSync(resolve(output, 'captures.json'), JSON.stringify({ kind: 'synthetic native comparison; no golden acceptance', comparison,
      fingerprint: JSON.parse(readFileSync(resolve(root, 'dist/houseplan-assets.json'), 'utf8')).fingerprint, attestation, profiles, errors }, null, 2) + '\n');
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
} finally { await browser.close(); await new Promise(done => server.close(done)); unlinkSync(fixturePath); rmdirSync(scratch); }
