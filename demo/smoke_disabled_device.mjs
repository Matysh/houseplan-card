// HA-disabled lifecycle: saved marker -> forced hidden -> service ghost and
// blocked Show -> same marker restored after reactivation, without config writes.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const paint = async () => { c.requestUpdate(); await c.updateComplete; };

  c._serverCfg = {
    ...c._serverCfg,
    markers: [
      ...(c._serverCfg.markers || []).filter((marker) => marker.id !== 'd_light1'),
      { id: 'd_light1', binding: 'device:d_light1' },
    ],
  };
  c._cfgEpoch++;
  c._regSignature = '';
  c._maybeRebuildDevices();
  c._setMode('view');
  await paint();
  const configBefore = JSON.stringify(c._serverCfg);
  const layoutBefore = JSON.stringify(c._layout);
  const visibleBefore = !!sr().querySelector('.dev[data-id="d_light1"]');

  window.__setRegistryDisabled('device', 'd_light1', 'user');
  c.hass = window.__mkHass();
  await wait(220);
  await paint();
  const hiddenInView = !sr().querySelector('.dev[data-id="d_light1"]');

  c._showHidden = true;
  c._setMode('devices');
  c._regSignature = '';
  c._maybeRebuildDevices();
  await paint();
  const ghost = sr().querySelector('.dev[data-id="d_light1"][data-binding-status="ha-disabled"]');
  const disabledDevice = c._devices.find((device) => device.id === 'd_light1');
  c._openMarkerDialog(disabledDevice);
  await paint();
  const hiddenBeforeShow = c._markerDialog?.hideFromPlan;
  c._toggleMarkerDialogVisibility();
  await paint();
  const showBlocked = /disabled|deactiv/i.test(c._toast)
    && c._markerDialog?.hideFromPlan === hiddenBeforeShow
    && sr().querySelector('.toast')?.getAttribute('role') === 'alert';
  c._markerDialog = null;

  window.__setRegistryDisabled('device', 'd_light1', null);
  c.hass = window.__mkHass();
  await wait(220);
  c._showHidden = false;
  c._setMode('view');
  await paint();

  return {
    visibleBefore,
    hiddenInView,
    labelledGhost: !!ghost,
    showBlocked,
    restored: !!sr().querySelector('.dev[data-id="d_light1"]'),
    configUnchanged: JSON.stringify(c._serverCfg) === configBefore,
    layoutUnchanged: JSON.stringify(c._layout) === layoutBefore,
  };
});

checkAll(res);
await finish(browser, res);
