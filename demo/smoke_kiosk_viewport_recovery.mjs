// #894 AC5/AC6: a real document reload, not a seam that only counts a callback.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('894 isolated enlarged kiosk recovery');
const out = {}, ATTEMPT = 'houseplan-card:version-reload-target:v1';
const fixtureSource = readFileSync(new URL('./srv/demo.html', import.meta.url), 'utf8');
const anchor = "card.setConfig({type:'custom:houseplan-card', title:'House Plan', icon_size:3.4});";
const storeAnchor = 'const server=createFixtureStore(CFG,LAYOUT,';
if ([anchor, storeAnchor].some(value => fixtureSource.split(value).length !== 2)) throw Error('894 demo boot anchor changed');
// #896 clones the initial wire store. Seed the next document through that
// constructor, not an assignment to the unrelated old CFG constant.
const bootSource = fixtureSource.replace(storeAnchor,
  "const server=createFixtureStore(JSON.parse(sessionStorage.getItem('hp894-server'))||CFG,LAYOUT,")
  .replace(anchor, "card.setConfig(JSON.parse(sessionStorage.getItem('hp894-options')));");
for (const kind of ['ordinary', 'fixed', 'single', 'deleted', 'carousel', 'same-version']) {
  const { page, browser } = await launchColdView({ width: 1000, height: 850 });
  try {
    await page.route('**/demo.html', route => route.fulfill({ status: 200, contentType: 'text/html', body: bootSource }));
    await page.evaluate(async ({ kind, attempt }) => {
      const c = window.__card;
      await window.__hpTest.waitForWrites();
      await window.__hpTest.switchSpace('garden');
      const options = { ...c._config, kiosk: true, cycle: kind === 'carousel' || kind === 'fixed' || kind === 'single' ? 10 : 0,
        ...(kind === 'fixed' ? { floor: 'garden' } : {}) };
      c.setConfig(options);
      if (kind === 'single') await window.__hpTest.setServerConfig(cfg => { cfg.spaces = cfg.spaces.filter(s => s.id === 'garden'); return cfg; });
      await window.__hpTest.waitForWrites();
      sessionStorage.setItem('hp894-options', JSON.stringify(options));
      const server = structuredClone(c._serverCfg);
      if (kind === 'deleted') server.spaces = server.spaces.filter(s => s.id !== 'garden');
      sessionStorage.setItem('hp894-server', JSON.stringify(server));
      sessionStorage.removeItem(attempt);
    }, { kind, attempt: ATTEMPT });
    await page.waitForFunction(() => window.__card._continuity.state === 'steady' && !window.__card._loading && !window.__card._booting);
    const stage = await page.locator('#host houseplan-card .stage').boundingBox();
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    for (let step = 0; step < 7; ++step) {
      await page.mouse.wheel(0, -100); await page.waitForTimeout(180);
    }
    await page.mouse.move(stage.x + 20, stage.y + 20); await page.mouse.down();
    await page.mouse.move(stage.x + 75, stage.y + 60, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => {
      const c = window.__card; return { space: c._space, zoom: c._zoom, view: { ...c._view } };
    });
    out[`${kind}:enlarged-camera-fixture`] = before.space === 'garden' && before.zoom > 2;
    await page.clock.install();
    let reloads = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) ++reloads; });
    await page.evaluate(kind => {
      const c = window.__card;
      c._adoptConfigCapabilities({ integration_version: kind === 'same-version' ? c._versionRecovery._input.frontendVersion : `894-${kind}` });
    }, kind);
    await page.clock.runFor(1000);
    out[`${kind}:interaction-pause-blocks`] = reloads === 0;
    if (kind === 'carousel' || kind === 'same-version') {
      await page.clock.runFor(61000);
      out[`${kind}:no-enlarged-auto-reload`] = reloads === 0;
    } else {
      await page.clock.runFor(61000);
      await page.waitForFunction(() => window.__card?._loadOk && window.__card._continuity.state === 'steady' && !window.__card._booting);
      const after = await page.evaluate(() => {
        const c = window.__card;
        return { space: c._space, zoom: c._zoom, view: c._view,
          editor: !!c._editorRuntime || c._mode !== 'view', popup: !!c.renderRoot.querySelector('hp-dialog'),
          ownMemos: Object.keys(sessionStorage).filter(k => k.startsWith('houseplan_kiosk_recovery_v1:')).length };
      });
      out[`${kind}:one-real-reload-no-modal`] = reloads === 1 && !after.editor && !after.popup && after.ownMemos === 0;
      out[`${kind}:exact-camera-or-deleted-fallback`] = kind === 'deleted'
        ? after.space !== 'garden' && JSON.stringify(after.view) !== JSON.stringify(before.view)
        : after.space === before.space && Math.abs(after.zoom - before.zoom) < 1e-6
          && ['x', 'y', 'w', 'h'].every(key => Math.abs(after.view[key] - before.view[key]) < 1e-4);
    }
  } finally { await browser.close(); }
}
checkAll(out); await finish(null, out);
