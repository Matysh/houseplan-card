/** #792 AC7: real caption pixels cover battery ink; route pixels stay below core.
 * #808 AC2: a local link's route pixels paint over the battery ink of the
 * hovered endpoint and of the neighbour endpoint, in Flat and 2.5D.
 * #809: the core of the unhovered neighbour endpoint paints over the routes in
 * Flat and 2.5D; non-endpoints keep their 2.5D layers (2, hovered 5).
 * #813 AC5: keyboard focus in 2.5D lifts an ordinary marker to the hover layer
 * (5) and never pulls a Zigbee endpoint, the #809 neighbour included, off 8;
 * focusing starts no scan, no service and no dialog.
 * #829 AC1: the arrowhead paints over the value badge of the neighbour and of
 * the hovered endpoint, Flat and 2.5D; the line beyond it stays under the badge.
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
    await window.__hpTest.setLayout(layout => ({ ...layout,
      d_light1: { s: 'f1', x: 0.6, y: 0.72 }, d_leak: { s: 'f1', x: 0.88, y: 0.72 } }));
    await window.__hpTest.settled();
  });
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
        // #808: a local link whose line crosses a whole battery frame.
        { ieee: '00124b0000000003', nwk: 3, device_reg_id: 'd_light1', device_type: 'EndDevice',
          neighbors: [{ ieee: '00124b0000000004', relationship: 'Parent', lqi: 50 }] },
        { ieee: '00124b0000000004', nwk: 4, device_reg_id: 'd_leak', device_type: 'Router',
          neighbors: [{ ieee: '00124b0000000003', relationship: 'Child', lqi: 50 }] },
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
      for (const layer of overlay.querySelectorAll('[data-hp^="zigbee-topology-lines"]')) layer.style.visibility = 'hidden';
    });
    const routesHidden = await screenshot('routes-hidden-control');
    await page.evaluate(() => {
      for (const layer of window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot
        .querySelectorAll('[data-hp^="zigbee-topology-lines"]')) layer.style.removeProperty('visibility');
    });
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
  // #808 AC2: the line of a local link crosses a whole battery frame — the
  // hovered device's own (d_light1 -> d_leak) and a neighbour endpoint's
  // (hovering d_leak, the line ends in d_light1). Both markers are endpoints.
  for (const iso of [false, true]) {
    const mode = iso ? 'iso' : 'flat';
    await page.evaluate(iso => window.__hpTest.setVolumetricView(iso), iso);
    for (const [hovered, neighbor, role] of [['d_light1', 'd_leak', 'own'], ['d_leak', 'd_light1', 'neighbour']]) {
      const owner = 'd_light1';
      const start = await batteryGeometry(page, hovered);
      await page.mouse.move(start.core.x + start.core.width / 2, start.core.y + start.core.height / 2);
      await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')?.shadowRoot
        ?.querySelector('[data-hp="zigbee-topology-line"]'));
      await page.evaluate(() => window.__hpTest.settled());
      const battery = (await batteryGeometry(page, owner)).battery;
      // #809 AC1: the unhovered neighbour endpoint (d_light1 while d_leak is
      // hovered) and the hovered core, both measured after the hover settled.
      const ends = role === 'neighbour' ? { core: (await batteryGeometry(page, neighbor)).core,
        hoveredCore: (await batteryGeometry(page, hovered)).core } : null;
      // The drawn route, not the lifted 2.5D cores: its endpoints in viewport px.
      // The ordinary device tooltip may sit over the hovered battery; it is
      // hidden in both frames, so only the route layers differ.
      const route = await page.evaluate(() => {
        const root = window.__card.shadowRoot;
        root.querySelector('[data-hp-live-tip]')?.style.setProperty('visibility', 'hidden');
        const overlay = root.querySelector('hp-zigbee-topology-overlay');
        const line = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-line"]');
        const layer = overlay.getBoundingClientRect();
        const sx = layer.width / overlay.clientWidth, sy = layer.height / overlay.clientHeight;
        const point = (x, y) => ({ x: layer.left + Number(line.getAttribute(x)) * sx,
          y: layer.top + Number(line.getAttribute(y)) * sy });
        return { from: point('x1', 'y1'), to: point('x2', 'y2') };
      });
      const shot = name => page.screenshot({ animations: 'disabled',
        path: fileURLToPath(new URL(`${mode}-local-${role}-${name}.png`, artifacts)) });
      const active = await shot('active');
      const toggleRoutes = hidden => page.evaluate(hidden => {
        for (const layer of window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot
          .querySelectorAll('[data-hp^="zigbee-topology-lines"]')) {
          if (hidden) layer.style.visibility = 'hidden'; else layer.style.removeProperty('visibility');
        }
      }, hidden);
      await toggleRoutes(true);
      const routesHidden = await shot('routes-hidden-control');
      await toggleRoutes(false);
      await page.evaluate(() => window.__card.shadowRoot.querySelector('[data-hp-live-tip]')
        ?.style.removeProperty('visibility'));
      const evidence = await page.evaluate(async ({ active, routesHidden, route, battery, ends }) => {
        const decode = async data => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        };
        const [a, hidden] = await Promise.all([decode(active), decode(routesHidden)]);
        const at = (image, x, y) => {
          const index = (Math.floor(y * devicePixelRatio) * image.width + Math.floor(x * devicePixelRatio)) * 4;
          return [image.data[index], image.data[index + 1], image.data[index + 2]];
        };
        const green = pixel => Math.abs(pixel[0] - 29) < 8 && Math.abs(pixel[1] - 194) < 8 && Math.abs(pixel[2] - 29) < 8;
        const changed = (first, second) => first.some((value, index) => Math.abs(value - second[index]) > 12);
        const p = route.from, q = route.to;
        const length = Math.hypot(q.x - p.x, q.y - p.y), seen = new Set();
        let ink = 0, over = 0;
        for (let step = 0; step <= length * 2; step++) {
          const x = p.x + (q.x - p.x) * step / (length * 2), y = p.y + (q.y - p.y) * step / (length * 2);
          if (x < battery.x + 1 || x > battery.right - 1 || y < battery.y + 1 || y > battery.bottom - 1) continue;
          const key = `${Math.floor(x)},${Math.floor(y)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const baseline = at(hidden, x, y), painted = at(a, x, y);
          if (!green(baseline)) continue;
          ink++;
          if (changed(baseline, painted) && !green(painted)) over++;
        }
        // #809 AC1: along the same line, inside the neighbour's core the route
        // layers change nothing; outside both cores they do. The battery frame
        // may reach into the core and the #808 copy paints over it there, so
        // the frame (plus the clip padding) is skipped. The core sample is the
        // inscribed ellipse: a round Flat core paints no bounding-box corners.
        let core = null;
        if (ends) {
          const near = (r, x, y, margin) => x >= r.x - margin && x <= r.right + margin
            && y >= r.y - margin && y <= r.bottom + margin;
          const inCore = (r, x, y) => {
            const rx = r.width / 2 - 2, ry = r.height / 2 - 2;
            return rx > 0 && ry > 0 && ((x - r.x - r.width / 2) / rx) ** 2 + ((y - r.y - r.height / 2) / ry) ** 2 <= 1;
          };
          const visited = new Set();
          let inside = 0, insideChanged = 0, outside = 0, exposed = 0;
          for (let step = 0; step <= length * 2; step++) {
            const x = p.x + (q.x - p.x) * step / (length * 2), y = p.y + (q.y - p.y) * step / (length * 2);
            const key = `${Math.floor(x)},${Math.floor(y)}`;
            if (visited.has(key) || near(battery, x, y, 4)) continue;
            visited.add(key);
            const routeShows = changed(at(a, x, y), at(hidden, x, y));
            if (inCore(ends.core, x, y)) {
              inside++;
              if (routeShows) insideChanged++;
            } else if (!near(ends.core, x, y, 3) && !near(ends.hoveredCore, x, y, 3)) {
              outside++;
              if (routeShows) exposed++;
            }
          }
          core = { inside, insideChanged, outside, exposed,
            paintsOver: inside >= 6 && insideChanged <= 2 && exposed >= 3 };
        }
        return { ink, over, covers: ink >= 6 && over / ink >= 0.8, core };
      }, { active: active.toString('base64'), routesHidden: routesHidden.toString('base64'), route, battery, ends });
      console.log(`Battery Zigbee ${mode} local ${role} route evidence:`, evidence);
      out[`${mode}_localRoutePaintsOver${role === 'own' ? 'Own' : 'Neighbour'}Battery`] = evidence.covers;
      if (ends) out[`${mode}_neighbourCorePaintsOverRoutes`] = evidence.core.paintsOver;
      await page.mouse.move(10, 10);
    }
  }
  // #809 AC2: the endpoint lift must not reach other markers in 2.5D. A plug
  // outside the Zigbee topology is the hovered non-endpoint (z-index 5); the
  // unlinked d_temp stays on the base 2.5D layer (2) in both hovers.
  await page.evaluate(async () => {
    await window.__hpTest.setVolumetricView(true);
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      markers: cfg.markers.map(marker => marker.id === 'd_kettle' ? { id: 'd_kettle', binding: 'device:d_kettle',
        space: 'f1', display: 'badge', value_badge: { enabled: false } } : marker) }));
    await window.__hpTest.setLayout(layout => ({ ...layout, d_kettle: { s: 'f1', x: 0.15, y: 0.2 } }));
    await window.__hpTest.settled();
  });
  const layers = () => page.evaluate(() => Object.fromEntries(['d_temp', 'd_light1', 'd_leak', 'd_kettle'].map(id => {
    const node = window.__card.shadowRoot.querySelector(`[data-hp="device"][data-id="${id}"]`);
    return [id, { z: node ? getComputedStyle(node).zIndex : null,
      endpoint: !!node?.hasAttribute('data-hp-zigbee-topology-endpoint'),
      hovered: !!node?.hasAttribute('data-hp-device-hover') }];
  })));
  const hoverCore = async id => {
    const { core } = await batteryGeometry(page, id);
    await page.mouse.move(core.x + core.width / 2, core.y + core.height / 2);
    await page.waitForFunction(id => window.__card.shadowRoot
      .querySelector(`[data-hp="device"][data-id="${id}"][data-hp-device-hover]`), id);
    await page.evaluate(() => window.__hpTest.settled());
  };
  await hoverCore('d_leak');
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-hp="zigbee-topology-line"]'));
  const linked = await layers();
  await hoverCore('d_kettle');
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('[data-hp-zigbee-topology-endpoint]'));
  const plain = await layers();
  console.log('Battery Zigbee iso marker layers:', { linked, plain });
  out.iso_nonEndpointKeepsBaseLayer = linked.d_light1.endpoint && linked.d_leak.endpoint
    && !linked.d_temp.endpoint && linked.d_temp.z === '2' && !linked.d_kettle.endpoint && linked.d_kettle.z === '2'
    && plain.d_temp.z === '2' && plain.d_light1.z === '2' && plain.d_leak.z === '2';
  out.iso_hoveredNonEndpointKeepsHoverLayer = plain.d_kettle.hovered && !plain.d_kettle.endpoint
    && plain.d_kettle.z === '5';
  // #813 AC5: real keyboard focus while d_leak is hovered (its local link ends
  // in d_light1). The focused neighbour endpoint stays on 8; a focused ordinary
  // marker rises to 5, above the ordinary 2 and under both endpoints.
  await page.evaluate(() => {
    const card = window.__card;
    const hass = card.hass;
    window.__hpFocusCalls = { zha: 0, service: 0 };
    card.hass = { ...hass,
      callWS: (message) => {
        if (message?.type === 'zha/devices') window.__hpFocusCalls.zha += 1;
        return hass.callWS(message);
      },
      callService: (...args) => {
        window.__hpFocusCalls.service += 1;
        return hass.callService(...args);
      } };
  });
  await page.evaluate(() => window.__hpTest.settled());
  /** Keyboard focus: from the neighbouring marker in tab order, one Tab step. */
  const keyboardFocus = async (id) => {
    const step = await page.evaluate((markerId) => {
      const all = [...window.__card.shadowRoot.querySelectorAll('.devlayer [data-hp="device"][tabindex="0"]')];
      const at = all.findIndex((node) => node.dataset.id === markerId);
      const from = all[at + 1] || all[at - 1];
      from.focus();
      return from === all[at + 1] ? 'Shift+Tab' : 'Tab';
    }, id);
    await page.keyboard.press(step);
    await page.evaluate(() => window.__hpTest.settled());
  };
  const focusLayers = () => page.evaluate(() => {
    const root = window.__card.shadowRoot;
    return { focused: root.activeElement?.dataset?.id ?? null,
      focusVisible: !!root.activeElement?.matches?.(':focus-visible'),
      ...Object.fromEntries(['d_temp', 'd_light1', 'd_leak', 'd_kettle'].map(id => {
        const node = root.querySelector(`[data-hp="device"][data-id="${id}"]`);
        return [id, { z: node ? getComputedStyle(node).zIndex : null,
          endpoint: !!node?.hasAttribute('data-hp-zigbee-topology-endpoint') }];
      })) };
  });
  await hoverCore('d_leak');
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-hp="zigbee-topology-line"]'));
  await keyboardFocus('d_light1');
  const focusedEndpoint = await focusLayers();
  await keyboardFocus('d_temp');
  const focusedOrdinary = await focusLayers();
  console.log('Battery Zigbee iso focus layers:', { focusedEndpoint, focusedOrdinary });
  out.iso_focusedNeighbourEndpointStaysOnEndpointLayer = focusedEndpoint.focused === 'd_light1'
    && focusedEndpoint.focusVisible && focusedEndpoint.d_light1.endpoint && focusedEndpoint.d_light1.z === '8'
    && focusedEndpoint.d_leak.z === '8';
  out.iso_focusedOrdinaryMarkerRisesBetweenLayers = focusedOrdinary.focused === 'd_temp'
    && focusedOrdinary.focusVisible && !focusedOrdinary.d_temp.endpoint && focusedOrdinary.d_temp.z === '5'
    && focusedOrdinary.d_kettle.z === '2' && focusedOrdinary.d_light1.z === '8' && focusedOrdinary.d_leak.z === '8';
  out.iso_focusStartsNoScanServiceOrDialog = await page.evaluate(() => {
    const calls = window.__hpFocusCalls;
    return calls.zha === 0 && calls.service === 0 && !window.__card.shadowRoot.querySelector('hp-dialog')
      || JSON.stringify(calls);
  });
  await page.evaluate(() => window.__card.shadowRoot.activeElement?.blur());
  await page.mouse.move(10, 10);
  // #829 AC1: the parent endpoint d_leak shows a value badge on the side that
  // faces its child d_light1, so the arrowhead of their local link lands on
  // that badge: a neighbour endpoint's badge while d_light1 is hovered, the
  // hovered endpoint's own badge while d_leak is. Inside the shared area the
  // arrow pixels must paint over the badge, in Flat and 2.5D; the line beyond
  // the arrowhead stays under the badge as before.
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      markers: cfg.markers.map(marker => marker.id === 'd_leak' ? { ...marker, value_badge: { enabled: true,
        source: { kind: 'entity_attribute', entity_id: 'binary_sensor.sink_leak', attribute: 'linkquality' },
        position: 'left' } } : marker) }));
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => window.__card.shadowRoot
    .querySelector('[data-hp="device"][data-id="d_leak"] .value-badge.pos-left.available'));
  for (const iso of [false, true]) {
    const mode = iso ? 'iso' : 'flat';
    await page.evaluate(iso => window.__hpTest.setVolumetricView(iso), iso);
    for (const [hovered, role, direction] of [['d_light1', 'Neighbour', 'toward-neighbor'],
      ['d_leak', 'Own', 'toward-origin']]) {
      await page.mouse.move(10, 10);
      await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
        ?.shadowRoot?.querySelector('[data-hp="zigbee-topology-arrow"]'));
      await hoverCore(hovered);
      await page.waitForFunction(direction => window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
        ?.shadowRoot?.querySelector(`[data-hp="zigbee-topology-arrow"][data-direction="${direction}"]`), direction);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const geometry = await page.evaluate(() => {
        const root = window.__card.shadowRoot;
        root.querySelector('[data-hp-live-tip]')?.style.setProperty('visibility', 'hidden');
        const overlay = root.querySelector('hp-zigbee-topology-overlay');
        const layer = overlay.getBoundingClientRect();
        const sx = layer.width / overlay.clientWidth, sy = layer.height / overlay.clientHeight;
        const toViewport = (x, y) => ({ x: layer.left + x * sx, y: layer.top + y * sy });
        const polygon = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-arrow"]');
        const line = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-line"]');
        const badge = root.querySelector('[data-hp="device"][data-id="d_leak"] .value-badge').getBoundingClientRect();
        const fill = polygon.getAttribute('fill').match(/\d+/g).map(Number);
        const radius = Number.parseFloat(getComputedStyle(root
          .querySelector('[data-hp="device"][data-id="d_leak"] .value-badge')).borderTopLeftRadius);
        return {
          arrow: polygon.getAttribute('points').trim().split(/\s+/)
            .map(pair => pair.split(',').map(Number)).map(([x, y]) => toViewport(x, y)),
          line: [toViewport(Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))),
            toViewport(Number(line.getAttribute('x2')), Number(line.getAttribute('y2')))],
          badge: { x: badge.x, y: badge.y, right: badge.right, bottom: badge.bottom,
            width: badge.width, height: badge.height,
            radius: Number.isFinite(radius) ? Math.min(radius, badge.height / 2) : badge.height / 2 },
          fill,
        };
      });
      const shot = name => page.screenshot({ animations: 'disabled',
        path: fileURLToPath(new URL(`${mode}-badge-${role.toLowerCase()}-${name}.png`, artifacts)) });
      const active = await shot('active');
      await page.evaluate(() => {
        for (const layer of window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot
          .querySelectorAll('[data-hp^="zigbee-topology-lines"]')) layer.style.visibility = 'hidden';
      });
      const routesHidden = await shot('routes-hidden-control');
      await page.evaluate(() => {
        const root = window.__card.shadowRoot;
        for (const layer of root.querySelector('hp-zigbee-topology-overlay').shadowRoot
          .querySelectorAll('[data-hp^="zigbee-topology-lines"]')) layer.style.removeProperty('visibility');
        root.querySelector('[data-hp-live-tip]')?.style.removeProperty('visibility');
      });
      const evidence = await page.evaluate(async ({ active, routesHidden, arrow, line, badge, fill }) => {
        const decode = async data => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        };
        const [a, hidden] = await Promise.all([decode(active), decode(routesHidden)]);
        const at = (image, x, y) => {
          const index = (Math.floor(y * devicePixelRatio) * image.width + Math.floor(x * devicePixelRatio)) * 4;
          return [image.data[index], image.data[index + 1], image.data[index + 2]];
        };
        const changed = (first, second) => first.some((value, index) => Math.abs(value - second[index]) > 12);
        const arrowInk = pixel => pixel.every((value, index) => Math.abs(value - fill[index]) <= 40);
        // Signed distance inside the arrowhead (positive inside, either winding).
        const area = (arrow[1].x - arrow[0].x) * (arrow[2].y - arrow[0].y)
          - (arrow[1].y - arrow[0].y) * (arrow[2].x - arrow[0].x);
        const inArrow = (x, y, margin) => arrow.every((p, index) => {
          const q = arrow[(index + 1) % 3];
          const length = Math.hypot(q.x - p.x, q.y - p.y);
          return Math.sign(area) * ((q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x)) / length >= margin;
        });
        // The badge's own rounded box (a pill in Flat, a rounded tile in
        // 2.5D), inset past its anti-aliased edge: a sample there is on badge ink.
        const inBadge = (x, y, inset) => {
          const left = badge.x + inset, right = badge.right - inset, top = badge.y + inset, bottom = badge.bottom - inset;
          const radius = Math.max(0, Math.min(badge.radius - inset, (right - left) / 2, (bottom - top) / 2));
          if (x < left || x > right || y < top || y > bottom) return false;
          const cx = Math.max(left + radius, Math.min(x, right - radius));
          const cy = Math.max(top + radius, Math.min(y, bottom - radius));
          return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
        };
        let shared = 0, arrowOver = 0;
        const xs = arrow.map(point => point.x), ys = arrow.map(point => point.y);
        for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
          for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
            const px = x + 0.5, py = y + 0.5;
            if (!inArrow(px, py, 1) || !inBadge(px, py, 1.5)) continue;
            shared++;
            const painted = at(a, px, py);
            if (changed(painted, at(hidden, px, py)) && arrowInk(painted)) arrowOver++;
          }
        }
        const [p, q] = line, length = Math.hypot(q.x - p.x, q.y - p.y), seen = new Set();
        let lineSamples = 0, lineShows = 0;
        for (let step = 0; step <= length * 2; step++) {
          const x = p.x + (q.x - p.x) * step / (length * 2), y = p.y + (q.y - p.y) * step / (length * 2);
          const key = `${Math.floor(x)},${Math.floor(y)}`;
          if (seen.has(key) || !inBadge(x, y, 2) || inArrow(x, y, -3)) continue;
          seen.add(key);
          lineSamples++;
          if (changed(at(a, x, y), at(hidden, x, y))) lineShows++;
        }
        return { shared, arrowOver, lineSamples, lineShows,
          arrowOverBadge: shared >= 10 && arrowOver / shared >= 0.9,
          lineUnderBadge: lineSamples >= 6 && lineShows <= 1 };
      }, { active: active.toString('base64'), routesHidden: routesHidden.toString('base64'), ...geometry });
      console.log(`Battery Zigbee ${mode} value badge (${role.toLowerCase()} endpoint) evidence:`, evidence, geometry);
      out[`${mode}_arrowPaintsOver${role}ValueBadge`] = evidence.arrowOverBadge;
      out[`${mode}_lineStaysUnder${role}ValueBadge`] = evidence.lineUnderBadge;
    }
  }
  await page.mouse.move(10, 10);
  checkAll(out);
} catch (error) {
  check('batteryZigbeeSmokeCompleted', false);
  out.error = String(error?.stack || error);
}
await finish(browser, out);
