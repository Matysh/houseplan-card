// #649 п.4 (docs/ISOMETRIC.md, Stage 6): 2.5D is the installation-wide switch
// «General settings › Display», third after «Show live presence on the plan».
// Saving it changes the View at once in every space and in the kiosk; editors
// stay Flat; «Reset» turns it off; there is no card toggle and no alpha entry.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const t = window.__hpTest;
  const sr = () => c.renderRoot;
  const iso = (root = sr()) => !!root.querySelector('.stage')?.classList.contains('projection-iso');
  const dlg = () => sr().querySelector('hp-dialog[data-kind="settings"]');
  const q = (sel) => dlg()?.querySelector(sel);
  const waitFor = async (predicate, ms = 8000) => {
    const end = performance.now() + ms;
    while (!predicate()) {
      if (performance.now() > end) return false;
      await new Promise((done) => setTimeout(done, 25));
    }
    return true;
  };
  const openSettings = async () => {
    sr().querySelector('[data-hp="settings"]').click();
    await t.settled();
    return waitFor(() => !!q('#gs-volumetric-view'));
  };
  const save = async () => {
    q('[data-hp="dialog-confirm"]').click();
    await t.settled();
    await waitFor(() => !dlg());
  };

  out.noCardToggle = !sr().querySelector('[data-hp="projection-toggle"], .projection-toggle');
  out.startsFlat = !iso();
  out.dialogOpens = await openSettings();
  const display = q('.hpf-card[data-card="display"]');
  const ids = [...display.querySelectorAll('.hpf-toggle > input[type="checkbox"]')].map((i) => i.id);
  out.thirdInDisplay = JSON.stringify(ids) === JSON.stringify(['gs-room-tooltip', 'gs-radar-live', 'gs-volumetric-view']);
  const row = q('#gs-volumetric-view').closest('.hpf-toggle')?.parentElement ?? null;
  out.rowTitleAndIcon = !!row && row.textContent.includes(c._t('gs.volumetric_view'))
    && !!row.querySelector('ha-icon[icon="mdi:cube-outline"]');
  out.offByDefault = q('#gs-volumetric-view').checked === false;

  q('#gs-volumetric-view').click();
  await t.settled();
  out.previewDoesNotSwitch = !iso();
  await save();
  out.saveSwitchesAtOnce = await waitFor(() => iso());
  out.storedAsTrue = c._serverCfg.settings.volumetric_view === true;

  // Every space follows the one setting.
  await t.switchSpace('garden');
  out.otherSpaceIso = await waitFor(() => iso());
  await t.switchSpace('f1');
  out.backSpaceIso = await waitFor(() => iso());

  // Editors are Flat, View returns to 2.5D.
  await t.setMode('plan');
  out.editorFlat = !iso();
  await t.setMode('view');
  out.viewIsoAgain = await waitFor(() => iso());

  // The kiosk reads the same installation setting. The fixture does not keep
  // writes, so the saved config is published as the server's state first.
  await t.setServerConfig((cfg) => cfg);
  const kiosk = document.createElement('houseplan-card');
  kiosk.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  kiosk.hass = c.hass;
  kiosk.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:99';
  document.body.appendChild(kiosk);
  out.kioskIso = await waitFor(() => !!kiosk.renderRoot?.querySelector('.stage')
    && iso(kiosk.renderRoot), 10000);
  kiosk.remove();

  // Reset turns it off; saving returns Flat without a reload.
  await openSettings();
  out.dialogShowsOn = q('#gs-volumetric-view').checked === true;
  [...dlg().querySelectorAll('.dialog-action-footer .btn')]
    .find((b) => b.textContent.trim() === c._t('gs.reset')).click();
  await t.settled();
  out.resetUnchecks = q('#gs-volumetric-view').checked === false;
  await save();
  out.resetSavesFlat = await waitFor(() => !iso());
  out.falseNotStored = !('volumetric_view' in (c._serverCfg.settings || {}));
  return out;
});
checkAll(res);
await finish(browser, res);
