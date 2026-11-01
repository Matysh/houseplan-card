// #1150: same-input editor field/host evidence on genuine pinned HA components.
// Selection is fixture setup; ordinary selection/writes are covered by product smokes.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from 'playwright/test';

const arg = name => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const authorRoot = fileURLToPath(new URL('../../', import.meta.url));
const root = resolve(arg('root') || authorRoot), output = resolve(arg('output') || 'artifacts/editor-kit-audit');
const fixture = resolve(arg('fixture') || `${authorRoot}/demo/ui-lab/fixtures/editor-kit.json`);
const comparison = process.argv.includes('--comparison');
const assets = resolve(arg('assets') || `${authorRoot}/demo/ui-lab/fixtures/editor-assets`);
const fromRoot = path => import(pathToFileURL(resolve(root, path)).href);
const { createLabServer } = await fromRoot('demo/ui-lab/server.mjs');
const { assertFreshDemoBundle } = await fromRoot('demo/bundle-freshness.mjs');
const { waitForUiKitPaint } = await fromRoot('demo/helpers/ui-kit-paint.mjs');
const { attestLaunchedBrowser } = await fromRoot('scripts/browser-attestation.mjs');
const seed = JSON.parse(readFileSync(fixture, 'utf8')), first = seed.config.spaces[0];
const scenes = [
  ['wall', 'plan', 'partition', first.partitions[0].id],
  ['column', 'plan', 'column', first.wall_columns[0].id],
  ['window', 'plan', 'opening', first.openings.find(x => x.type === 'window').id],
  ['door', 'plan', 'opening', first.openings.find(x => x.type === 'door').id],
  ['contour', 'plan', 'contour', first.wall_segments[0].id],
  ['rectangle', 'decor', 'rect', 'kit-rectangle'], ['text', 'decor', 'text', 'kit-text'],
  ['image', 'decor', 'image', 'kit-image'], ['backdrop', 'decor', 'backdrop', first.id],
  ['device', 'devices', 'device', 'kit-device', 'virtual'],
  ['led', 'devices', 'led', 'kit-led', 'kit-led-marker'],
];
mkdirSync(output, { recursive: true });
const server = createLabServer({ port: 0, repoRoot: root, labRoot: resolve(root, 'demo/ui-lab'), fixture, assets });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch();
const profiles = [], errors = [], sha = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const attestation = await attestLaunchedBrowser(browser, { reason: '#1150 editor fields and nested standard-density surfaces' });
  for (const theme of ['light', 'dark']) for (const width of [1280, 1024, 390]) {
    const profile = { id: `${theme}-${width}`, frames: [] }; profiles.push(profile);
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push({ profile: profile.id, message: e.message }));
      await page.goto(origin); await page.waitForFunction(() => window.__lab?.card?.shadowRoot?.querySelector('ha-card[data-hp-state=ready]'));
      profile.fingerprint = await assertFreshDemoBundle(page, root);
      await page.locator('#lab-launcher').click(); await page.locator('#lab-theme').selectOption(theme); await page.locator('#lab-close').click();
      const panel = page.locator('[data-hp=properties-panel]');
      const mode = async value => {
        if (value === 'view') await page.locator('[data-hp=editor-close]').filter({ visible:true }).first().click(); else await page.locator(`[data-hp=mode-tab][data-mode=${value}]`).click();
        await page.waitForFunction(value => { const c=window.__lab.card; return c._mode===value && !c._modeTransitionBusy && (value=== 'view' || !!c._editorRuntime); }, value);
      };
      const capture = async state => {
        await waitForUiKitPaint(page); await page.mouse.move(0, 0);
        await page.evaluate(() => { window.getSelection()?.removeAllRanges(); window.__lab.card.shadowRoot.getSelection?.()?.removeAllRanges(); });
        const controls = await panel.evaluateAll(nodes => nodes.flatMap(panel => {
          const top = panel.getBoundingClientRect(), box = el => { const r = el.getBoundingClientRect(); return { x:r.x-top.x, y:r.y-top.y, width:r.width, height:r.height }; };
          return [{ panel:box(panel), groups:[...panel.querySelectorAll('.hp-prop-group')].map(el => ({ name:el.className, box:box(el) })),
            fields:[...panel.querySelectorAll('.hp-prop-control,.hpf-unit,.hpf-colorfield,.hp-prop-text,.hp-prop-choice,.hp-prop-settings,.hp-prop-variable,.hp-prop-action')]
              .filter(el => el.getBoundingClientRect().height > 0).map(el => ({ key:el.closest('[data-property]')?.dataset.property || el.dataset.action, class:el.className,
                box:box(el), radius:getComputedStyle(el).borderRadius, disabled:el.matches(':disabled,[aria-disabled=true]') })),
            palette:{ background:getComputedStyle(panel).backgroundColor, ink:getComputedStyle(panel).color },
            overflow:panel.scrollWidth > panel.clientWidth + 1 }];
        }));
        for (const data of controls) {
          assert.equal(data.panel.width, 360); assert.equal(data.overflow, false);
          for (const f of data.fields.filter(f => /hp-prop-control|hpf-unit|hpf-colorfield/.test(f.class))) {
            assert.equal(f.box.height, 36, `${state} ${f.key} field height`); assert.equal(f.radius, '5px');
          }
        }
        const file = `${profile.id}-${state}.png`; await page.screenshot({ path:resolve(output, file) });
        profile.frames.push({ state, file, sha256:sha(readFileSync(resolve(output, file))), controls });
      };
      await mode('plan');
      profile.toolbarGroup = await page.locator('.editbar .wallsgroup').evaluate(group => {
        const r=group.getBoundingClientRect(), owner=group.closest('.editbar-tools').getBoundingClientRect();
        return { width:r.width, ownerWidth:owner.width, buttons:[...group.querySelectorAll('button')].map(button => {
          const b=button.getBoundingClientRect(); return { tool:button.dataset.tool, width:b.width, height:b.height,
            contained:b.left>=owner.left-1 && b.right<=owner.right+1 };
        }) };
      });
      if (!comparison) {
        assert.ok(profile.toolbarGroup.buttons.every(b => b.contained), 'narrow tool group must remain inside its owner');
        assert.ok(profile.toolbarGroup.buttons.every(b => Math.abs(b.height-31.0625)<.02), 'pinned native toolbar height');
      }
      const services = await page.evaluate(() => window.__lab.safety.services.length);
      if (width < 1024) { await mode('plan'); await expect(panel).toHaveCount(0); await capture('properties-absent'); }
      else {
        for (const [state, editor, kind, id, entity] of scenes) {
          await mode(editor);
          await page.evaluate(async ({ kind, id, entity }) => {
            const c=window.__lab.card;
            if (kind === 'backdrop') c._decorTool='backdrop'; else if (c._mode === 'decor') c._decorTool='select';
            c._editorRuntime.properties.select(kind,id,entity); c.requestUpdate(); await c.updateComplete;
          }, { kind, id, entity });
          await expect(panel).toBeVisible(); await capture(state);
          if (state === 'rectangle') {
            // A theme may omit the HA error token. Destructive actions still need
            // their semantic ink; this changes host theme input, not product code.
            profile.dangerFallback = await page.evaluate(async () => {
              const card=window.__lab.card, root=card.shadowRoot, owner=card.style;
              const prior=owner.getPropertyValue('--error-color');
              owner.setProperty('--error-color', 'initial');
              await new Promise(done => setTimeout(done, 220));
              try {
                const button=root.querySelector('[data-action=properties-delete]');
                if (!button) throw Error('Missing real Properties delete action');
                const probe=document.createElement('span');
                probe.style.cssText='position:absolute;color:var(--hpf-danger,var(--error-color,#db543d))';
                button.append(probe);
                const expected=getComputedStyle(probe).color; probe.remove();
                return { ink:getComputedStyle(button).color, border:getComputedStyle(button).borderTopColor, expected };
              } finally {
                if (prior) owner.setProperty('--error-color',prior); else owner.removeProperty('--error-color');
              }
            });
            console.log('DANGER_THEME',profile.id,JSON.stringify(profile.dangerFallback));
            if (!comparison) {
              assert.equal(profile.dangerFallback.ink,profile.dangerFallback.expected,'destructive ink survives a missing HA error token');
              assert.equal(profile.dangerFallback.border,profile.dangerFallback.expected,'destructive border survives a missing HA error token');
            }
          }
          if (state === 'rectangle') {
            const color = panel.locator('[data-property=stroke] hp-color-opacity,[data-property=color] hp-color-opacity').first();
            if (await color.count()) {
              await color.locator('.trigger').click();
              const popup = color.locator('.picker'); await expect(popup).toBeVisible();
              profile.colorFields = await popup.locator('input[type=text],input[type=number],button[data-action=colour-confirm]').evaluateAll(nodes => nodes.map(el => ({ height:el.getBoundingClientRect().height, width:el.getBoundingClientRect().width })));
              assert.ok(profile.colorFields.length > 0 && profile.colorFields.every(f => f.height >= 44));
              await capture('nested-color'); await page.keyboard.press('Escape'); await expect(popup).toBeHidden();
            }
          }
        }
      }
      await mode('view'); await expect(panel).toHaveCount(0);
      profile.viewTargets = await page.locator('.zoomctl button').filter({ visible:true }).evaluateAll(nodes => nodes.map(el => ({ width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height })));
      assert.ok(profile.viewTargets.length > 0 && profile.viewTargets.every(r => r.width >= 44 && r.height >= 44));
      assert.equal(await page.evaluate(() => window.__lab.safety.services.length), services);
      await capture('view'); console.log(`PASS ${profile.id}: ${profile.frames.length} frames`);
    } finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'captures.json'), JSON.stringify({ schema:1, phase:arg('phase') || 'candidate', kind:'native-computed-fixture-selection', comparison,
    fixtureSha256:sha(readFileSync(fixture)), scriptSha256:sha(readFileSync(fileURLToPath(import.meta.url))), attestation, profiles, errors }, null, 2)+'\n');
  assert.equal(errors.length, 0, JSON.stringify(errors));
} finally { await browser.close(); await new Promise(done => server.close(done)); }
