/** #792 AC7: real caption pixels cover battery ink; route pixels stay below core.
 * Controls hide only the rendered test layer for a differential raster probe.
 * Registry, settings, provider fetch and hover enter through public surfaces.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, check, checkAll, finish } from './serve.mjs';
import { batteryColorPixels, batteryGeometry, batteryMdiIcon, installBatteryFixture } from './helpers/device-battery-fixture.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 }, 1);
const artifacts = new URL('../artifacts/device-battery-zigbee/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const out = {};
try {
  await installBatteryFixture(page);
  await page.evaluate(async () => {
    const card = window.__card;
    const originalCallWS = card.hass.callWS;
    card.hass = { ...card.hass, callWS: async message => {
      if (message.type === 'zha/devices') return [
        { ieee: '00124b0000000001', nwk: 1, device_reg_id: 'd_temp', device_type: 'EndDevice',
          neighbors: [{ ieee: '00124b0000000002', relationship: 'Parent', lqi: 50 }] },
        { ieee: '00124b0000000002', nwk: 2, device_reg_id: 'not_on_plan', device_type: 'Router',
          name: 'Upstairs parent relay', neighbors: [
            { ieee: '00124b0000000001', relationship: 'Child', lqi: 50 },
          ] },
      ];
      return originalCallWS(message);
    } };
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, zigbee_topology: { enabled: true } },
    }));
    card.shadowRoot.querySelector('[data-hp="settings"]').click();
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => {
    const root = window.__card.shadowRoot.querySelector('hp-zigbee-topology-settings')?.shadowRoot;
    return [...(root?.querySelectorAll('button') || [])]
      .some(button => button.querySelector('ha-icon[icon="mdi:access-point-network"]') && !button.disabled);
  });
  await page.evaluate(() => {
    const root = window.__card.shadowRoot.querySelector('hp-zigbee-topology-settings').shadowRoot;
    [...root.querySelectorAll('button')].find(button => button.querySelector('ha-icon[icon="mdi:access-point-network"]')).click();
  });
  await page.waitForFunction(() => /Received/i.test(window.__card.shadowRoot
    .querySelector('hp-zigbee-topology-settings')?.shadowRoot?.textContent || ''));
  await page.evaluate(() => window.__hpTest.close(undefined, { via: 'cancel' }));

  for (const iso of [false, true]) {
    const mode = iso ? 'iso' : 'flat';
    await page.evaluate(iso => window.__hpTest.setVolumetricView(iso), iso);
    const geometry = await batteryGeometry(page);
    out[`${mode}_batteryHasRealGreenInk`] = await batteryColorPixels(page, geometry.battery, [29, 194, 29]) >= 8;
    out[`${mode}_batteryUsesOfficialMdi`] = await batteryMdiIcon(page, 'normal');
    await page.mouse.move(geometry.core.x + geometry.core.width / 2, geometry.core.y + geometry.core.height / 2);
    await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')?.shadowRoot
      ?.querySelector('[data-hp="zigbee-topology-parent-bubble"]'));
    await page.evaluate(() => window.__hpTest.settled());
    const probe = await page.evaluate(() => {
      const root = window.__card.shadowRoot;
      const overlay = root.querySelector('hp-zigbee-topology-overlay').shadowRoot;
      const marker = root.querySelector('[data-id="d_temp"]');
      const rect = node => { const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const battery = rect(marker.querySelector('.device-battery'));
      const caption = rect(overlay.querySelector('[data-hp="zigbee-topology-parent-bubble"]'));
      const core = rect(marker.querySelector('.device-core'));
      return { battery, caption, core, dpr: devicePixelRatio,
        overlap: { x: Math.max(battery.x, caption.x), y: Math.max(battery.y, caption.y),
          right: Math.min(battery.right, caption.right), bottom: Math.min(battery.bottom, caption.bottom) } };
    });
    out[`${mode}_captionActuallyOverlapsBattery`] = probe.overlap.right - probe.overlap.x >= 4
      && probe.overlap.bottom - probe.overlap.y >= 6;
    const screenshot = name => page.screenshot({ animations: 'disabled',
      path: fileURLToPath(new URL(`${mode}-${name}.png`, artifacts)) });
    const active = await screenshot('active');
    await page.evaluate(() => {
      const overlay = window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot;
      overlay.querySelector('[data-hp="zigbee-topology-parent-bubble"]').style.visibility = 'hidden';
    });
    const captionHidden = await screenshot('caption-hidden-control');
    await page.evaluate(() => {
      const overlay = window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot;
      overlay.querySelector('[data-hp="zigbee-topology-parent-bubble"]').style.removeProperty('visibility');
      overlay.querySelector('[data-hp="zigbee-topology-lines"]').style.visibility = 'hidden';
    });
    const routesHidden = await screenshot('routes-hidden-control');
    await page.evaluate(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot
      .querySelector('[data-hp="zigbee-topology-lines"]').style.removeProperty('visibility'));
    const evidence = await page.evaluate(async ({ active, captionHidden, routesHidden, probe }) => {
      const decode = async data => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [a, hidden, noRoutes] = await Promise.all([decode(active), decode(captionHidden), decode(routesHidden)]);
      const at = (image, x, y) => {
        const index = (Math.floor(y * probe.dpr) * image.width + Math.floor(x * probe.dpr)) * 4;
        return [image.data[index], image.data[index + 1], image.data[index + 2]];
      };
      const changed = (first, second) => first.some((value, index) => Math.abs(value - second[index]) > 12);
      let ink = 0, covered = 0, coreChanged = 0, exposedRoute = 0;
      // A rounded caption does not paint its bounding-box corners. Sample its
      // central band, where the actual dark fill/border/text must cover ink.
      const centreY = probe.caption.y + probe.caption.height / 2;
      for (let y = Math.ceil(Math.max(probe.overlap.y + 2, centreY - 5));
        y < Math.min(probe.overlap.bottom - 2, centreY + 5); y++) {
        for (let x = Math.ceil(probe.overlap.x + 2); x < probe.overlap.right - 2; x++) {
          const baseline = at(hidden, x, y), painted = at(a, x, y);
          if (Math.abs(baseline[0] - 29) < 8 && Math.abs(baseline[1] - 194) < 8 && Math.abs(baseline[2] - 29) < 8) {
            ink++;
            if (changed(baseline, painted) && painted[1] - Math.max(painted[0], painted[2]) < 50) covered++;
          }
        }
      }
      const cx = probe.core.x + probe.core.width / 2, cy = probe.core.y + probe.core.height / 2;
      for (let x = Math.ceil(cx); x < probe.caption.x - 3; x++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (!changed(at(a, x, cy + dy), at(noRoutes, x, cy + dy))) continue;
          if (x < probe.core.right - 5) coreChanged++;
          else if (x > probe.core.right + 3) exposedRoute++;
        }
      }
      return { ink, covered, coreChanged, exposedRoute,
        captionCoversInk: ink >= 3 && covered / ink >= 0.9,
        coreCoversRoute: coreChanged <= 2 && exposedRoute >= 3 };
    }, { active: active.toString('base64'), captionHidden: captionHidden.toString('base64'),
      routesHidden: routesHidden.toString('base64'), probe });
    out[`${mode}_captionPaintsOverBattery`] = evidence.captionCoversInk;
    out[`${mode}_coreStillPaintsOverRoutes`] = evidence.coreCoversRoute;
    console.log(`Battery Zigbee ${mode} pixel evidence:`, evidence, probe);
    await page.mouse.move(10, 10);
  }
  checkAll(out);
} catch (error) {
  check('batteryZigbeeSmokeCompleted', false);
  out.error = String(error?.stack || error);
}
await finish(browser, out);
