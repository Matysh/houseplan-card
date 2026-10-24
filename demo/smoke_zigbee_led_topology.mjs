// #1004: real mouse input and public config/provider fixtures. No product patch.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { fixtureWallKey } from './fixtures/wall-key.mjs';

requirePinnedBrowser('smoke_zigbee_led_topology');
const artifacts = new URL('../artifacts/zigbee-led-1004/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const { page, browser } = await launch({ width: 1100, height: 900 });
const root = page.locator('#host > houseplan-card');
const samples = [];
try {
  await page.evaluate(async () => {
    const card = window.__card, original = card.hass;
    card.setConfig({ ...card._config, language: 'en' });
    const calls = { zha: 0, writes: 0, service: 0 };
    window.__ledTopologyCalls = calls;
    const zha = [
      { ieee: '00124b0000000001', nwk: 1, device_reg_id: 'd_light1', device_type: 'Router',
        routes: [{ dest_nwk: 0, next_hop: 0, route_status: 'Active' }], neighbors: [] },
      { ieee: '00124b0000000002', nwk: 0, device_reg_id: 'd_lamp', device_type: 'Coordinator', neighbors: [] },
      { ieee: '00124b0000000003', nwk: 3, device_reg_id: 'd_bedlight', device_type: 'EndDevice',
        neighbors: [{ ieee: '00124b0000000001', relationship: 'Parent', lqi: 150 }] },
    ];
    card.hass = { ...original,
      callWS: async message => {
        if (message.type === 'config_entries/get') return [{ entry_id: 'led-topology-zha',
          domain: 'zha', title: 'ZHA', state: 'loaded' }];
        if (message.type === 'zha/devices') { calls.zha++; return zha; }
        if (/houseplan\/(config|layout)\/(set|update)/.test(message.type)) calls.writes++;
        return original.callWS(message);
      },
      callService: (...args) => { calls.service++; return original.callService(...args); },
    };
    await window.__hpTest.setServerConfig(cfg => {
      cfg.settings = { ...cfg.settings, volumetric_view: false,
        zigbee_topology: { enabled: true, z2m_base_topics: [] } };
      const space = cfg.spaces.find(s => s.id === 'f1');
      space.plan_url = null;
      space.view_box = [0, 0, 1, .8];
      space.settings = { ...space.settings, show_names: false, glow_enabled: false };
      space.led_strips = [
        { id: 'led-router', marker: 'd_light1', active: true,
          points: [[.15, .25], [.40, .25], [.40, .45]] },
      ];
      cfg.markers = cfg.markers.map(m => ({ ...m,
        hidden: !['d_light1', 'd_lamp', 'd_bedlight'].includes(m.id) }));
      // The demo also auto-places HA devices without a persisted marker. Give
      // those unrelated devices an explicit hidden marker; otherwise an
      // invisible 44px icon floor can legitimately win over this fixture LED.
      const present = new Set(cfg.markers.map(m => m.id));
      for (const id of Object.keys(original.devices || {})) if (!present.has(id)) cfg.markers.push({
        id, binding: `device:${id}`, space: 'f1', hidden: !['d_light1', 'd_lamp', 'd_bedlight'].includes(id),
      });
    });
    await window.__hpTest.setLayout({ ...window.__card._pos,
      d_lamp: { s: 'f1', x: .75, y: .28 }, d_bedlight: { s: 'f1', x: .65, y: .65 } });
    await window.__hpTest.setMode('plan');
  });
  await root.locator('[data-hp="settings"]').click();
  await root.locator('[data-section-target="zigbee"]').click();
  await root.locator('hp-zigbee-topology-settings').getByRole('button', { name: /Read ZHA/ }).click();
  await page.waitForFunction(() => window.__ledTopologyCalls.zha === 1);
  await page.evaluate(async () => { await window.__hpTest.close(); await window.__hpTest.setMode('view'); });
  await root.locator('.led-hit[data-id="d_light1"]').waitFor();
  const hover = async (id, strip = false) => {
    await page.mouse.move(2, 2);
    const point = await root.locator(`[data-hp="device"][data-id="${id}"]`).evaluate((node, strip) => {
      if (strip) {
        const closed = node.closest('[data-led-strip]').dataset.closed === 'true';
        const p = node.getPointAtLength(node.getTotalLength() * (closed ? .85 : .3)).matrixTransform(node.getScreenCTM());
        return { x: p.x, y: p.y };
      }
      const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, strip);
    await page.mouse.move(point.x, point.y);
    await page.evaluate(() => window.__hpTest.settled());
    await page.waitForTimeout(160);
    const sample = await root.locator('hp-zigbee-topology-overlay').evaluate((node, point) => ({
      lines: node.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]').length,
      arrows: [...node.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-arrow"]')].map(n => n.dataset.direction),
      hoverOwner: node.getAttribute('data-tooltip-owner'),
      markedOwner: window.__card.renderRoot.querySelector('[data-hp-device-hover]')?.getAttribute('data-id'),
      actualHit: window.__card.renderRoot.elementFromPoint(point.x, point.y)?.outerHTML.slice(0, 180),
    }), point);
    samples.push({ id, point, ...sample }); return sample;
  };
  const fromIcon = await hover('d_lamp');
  check('icon hover draws confirmed route to LED', fromIcon.lines, 1);
  const fromLed = await hover('d_light1', true);
  check('LED hover draws its outgoing and confirmed incoming routes', fromLed.lines, 2);
  check('LED hover draws both data-directed arrows', fromLed.arrows.length, 2);
  // A wide tube can cover a small fixed-size halo if it paints a level above
  // that halo. Ordinary hover on/off pixels must change inside the ring itself.
  await page.evaluate(() => window.__card.setConfig({ ...window.__card._config, icon_size: 8 }));
  await hover('d_light1', true);
  let thickness = 0;
  for (let i = 0; i < 12; i++) {
    thickness = await root.locator('[data-marker="d_light1"] .led-outline').evaluate(node =>
      Number(node.getAttribute('stroke-width')) * Math.hypot(node.getScreenCTM().a, node.getScreenCTM().b));
    if (thickness > 24) break;
    const point = await root.locator('.led-hit[data-id="d_light1"]').evaluate(node => {
      const p = node.getPointAtLength(node.getTotalLength() * .3).matrixTransform(node.getScreenCTM());
      return { x: p.x, y: p.y };
    });
    await page.mouse.move(point.x, point.y - 60); // empty scene, not the LED action target
    await page.mouse.wheel(0, -450);
    await page.waitForTimeout(180);
  }
  await hover('d_light1', true);
  const halo = root.locator('[data-hp="zigbee-topology-led-anchor"][data-id="d_light1"]');
  const haloBox = await halo.boundingBox();
  const painted = await page.screenshot({ scale: 'css', animations: 'disabled' });
  await page.mouse.move(2, 2);
  await halo.waitFor({ state: 'detached' });
  await page.evaluate(() => window.__hpTest.settled());
  const hidden = await page.screenshot({ scale: 'css', animations: 'disabled' });
  await hover('d_light1', true);
  const ringPixels = await page.evaluate(async ({ painted, hidden, box }) => {
    const pixels = async png => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(image.width, image.height), ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0); const data = ctx.getImageData(0, 0, image.width, image.height);
      image.close(); return data;
    };
    const a = await pixels(painted), b = await pixels(hidden);
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    let changed = 0;
    for (let y = Math.floor(cy - 8); y <= cy + 8; y++) for (let x = Math.floor(cx - 8); x <= cx + 8; x++) {
      const radius = Math.hypot(x + .5 - cx, y + .5 - cy);
      if (radius < 4 || radius > 7.5) continue;
      const p = (y * a.width + x) * 4;
      if ([0, 1, 2].some(k => Math.abs(a.data[p + k] - b.data[p + k]) > 6)) changed++;
    }
    return changed;
  }, { painted: painted.toString('base64'), hidden: hidden.toString('base64'), box: haloBox });
  samples.push({ wideTube: { thickness, haloBox, ringPixels } });
  check('wide tube is genuinely larger than the small fixed halo', thickness > 24);
  check('wide tube retains actual visible halo ring pixels', ringPixels >= 12);
  await page.evaluate(() => window.__card.setConfig({ ...window.__card._config, icon_size: 2.5 }));
  await root.locator('[data-hp="zoom-fit"]').click();
  await page.evaluate(() => window.__hpTest.settled());

  const inspect = () => root.locator('hp-zigbee-topology-overlay').evaluate(overlay => {
    const cardRoot = window.__card.renderRoot;
    const project = (node, x, y) => {
      const p = new DOMPoint(Number(x), Number(y)).matrixTransform(node.getScreenCTM());
      return { x: p.x, y: p.y };
    };
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const anchors = [...overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-led-anchor"]')].map(halo => {
      const path = [...cardRoot.querySelectorAll('.led-hit')].find(n => n.dataset.id === halo.dataset.id);
      const half = path.getPointAtLength(path.getTotalLength() / 2);
      const expected = project(path, half.x, half.y), r = halo.getBoundingClientRect();
      const centre = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      const paint = [...overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-led-participant"]')]
        .find(n => n.dataset.id === halo.dataset.id);
      return { id: halo.dataset.id, expected, centre, aligned: distance(expected, centre) < .8,
        width: r.width, height: r.height,
        realShape: [...paint.querySelectorAll(':scope > path')].every(n => n.getAttribute('d') === path.getAttribute('d')),
        inert: [...paint.querySelectorAll('path')].every(n => getComputedStyle(n).pointerEvents === 'none')
          && !paint.querySelector('[data-hp="device"], [tabindex], [role="button"]'),
        bodyBorrowed: getComputedStyle(path.closest('[data-led-strip]').querySelector('.led-core')).visibility === 'hidden',
      };
    });
    const lines = [...overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]')].map(line => ({
      start: project(line, line.getAttribute('x1'), line.getAttribute('y1')),
      end: project(line, line.getAttribute('x2'), line.getAttribute('y2')),
    }));
    const arrows = [...overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-arrow"]')].map(arrow =>
      project(arrow, arrow.points[0].x, arrow.points[0].y));
    return { anchors, lines: lines.length,
      localEndpoints: anchors.every(a => lines.some(line => Math.min(distance(a.expected, line.start), distance(a.expected, line.end)) < .8)),
      ledArrow: anchors.some(a => arrows.some(tip => Math.abs(distance(a.centre, tip) - 10) < .8)),
      layers: [...overlay.shadowRoot.querySelectorAll('svg')].map(n => ({ name: n.className.baseVal, z: getComputedStyle(n).zIndex })),
    };
  });
  await page.evaluate(async () => window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.find(s => s.id === 'f1').led_strips.push({ id: 'led-coordinator', marker: 'd_lamp',
      active: true, points: [[.68, .15], [.84, .15], [.84, .42], [.68, .42], [.68, .15]] });
  }));
  const callsBeforeCamera = await page.evaluate(() => ({ ...window.__ledTopologyCalls }));
  for (const iso of [false, true]) for (const theme of ['light', 'dark']) {
    await page.evaluate(async ({ iso, theme }) => {
      await window.__hpTest.setVolumetricView(iso);
      const c = window.__card;
      c.hass = { ...c.hass, themes: { ...c.hass.themes, darkMode: theme === 'dark' } };
    }, { iso, theme });
    await hover('d_light1', true);
    const geometry = await inspect(), name = `${iso ? 'iso' : 'flat'}-${theme}`;
    samples.push({ name, geometry });
    check(`${name} LED-to-LED and LED-to-icon routes remain directed`, geometry.lines, 2);
    check(`${name} both real LED endpoints are aligned`, geometry.anchors.length === 2 && geometry.anchors.every(a => a.aligned));
    check(`${name} halo remains fourteen screen pixels`, geometry.anchors.every(a => Math.abs(a.width - 14) < .25 && Math.abs(a.height - 14) < .25));
    check(`${name} visible paths rather than bounding boxes are highlighted`, geometry.anchors.every(a => a.realShape && a.inert && a.bodyBorrowed));
    check(`${name} line ends reach real LED anchors`, geometry.localEndpoints);
    check(`${name} incoming arrow stops at the fixed LED halo`, geometry.ledArrow);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, artifacts)), scale: 'css' });
  }
  check('hover/camera/theme do not fetch topology, write or call services', await page.evaluate(() => window.__ledTopologyCalls), callsBeforeCamera);
  await hover('d_lamp', true);
  const fromOtherEnd = await inspect();
  check('closed LED hover uses the same two local anchors', fromOtherEnd.anchors.length === 2 && fromOtherEnd.anchors.every(a => a.aligned));
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.find(s => s.id === 'f1').led_strips[0].points = [[.15, .25], [.45, .25]];
  }));
  await hover('d_light1', true);
  check('straight LED uses its visible half-length with the same confirmed routes', (await inspect()).lines === 2
    && (await inspect()).anchors.every(a => a.aligned));
  await page.setViewportSize({ width: 1000, height: 820 });
  await hover('d_light1', true);
  check('container resize updates the projected endpoints and fixed-screen halos', (await inspect()).anchors.every(a => a.aligned
    && Math.abs(a.width - 14) < .25 && Math.abs(a.height - 14) < .25));
  await page.mouse.move(950, 740);
  await page.mouse.down();
  await page.mouse.move(910, 715, { steps: 5 });
  await page.mouse.up();
  await hover('d_light1', true);
  check('native camera pan preserves current-path endpoint geometry', (await inspect()).lines === 2
    && (await inspect()).anchors.every(a => a.aligned));
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.evaluate(() => window.__hpTest.setVolumetricView(false));
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    const space = cfg.spaces.find(s => s.id === 'f1');
    space.led_strips[1].points = space.led_strips[0].points.map(([x, y]) => [x, y + .008]);
  }));
  const nearest = await hover('d_light1', true);
  check('nearest LED owner wins over the later-painted overlapping hit floor', nearest.hoverOwner, 'd_light1');
  check('nearest LED keeps its two actual data routes', nearest.lines, 2);
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    const source = Object.values(window.__card.hass.entities || {}).find(e => e.device_id === 'd_light1' && e.entity_id.startsWith('light.'));
    cfg.markers.find(m => m.id === 'd_light1').value_badge = { enabled: true, position: 'bottom',
      source: { kind: 'entity_state', entity_id: source.entity_id } };
  }));
  await hover('d_light1', true);
  check('passive value badge does not control LED topology eligibility', (await inspect()).lines, 2);
  check('enabled badge is real passive paint', await root.locator('[data-led-badge="d_light1"] .value-badge').count(), 1);
  const room = { id: 'led-wall-oracle', name: 'Wall offset',
    poly: [[.195, .175], [.505, .175], [.505, .485], [.195, .485]] };
  const walls = room.poly.map((a, i) => { const b = room.poly[(i + 1) % room.poly.length];
    return { a, b, key: fixtureWallKey(a, b), cm: 12 }; });
  await page.evaluate(({ room, walls }) => window.__hpTest.setServerConfig(cfg => {
    const space = cfg.spaces.find(s => s.id === 'f1');
    Object.assign(space, { cell_cm: 5, rooms: [room], walls, wall_segments: [], partitions: [], wall_columns: [], openings: [], decor: [] });
    space.led_strips[0].points = [[.2, .18], [.2, .48], [.5, .48]];
    space.led_strips[1].points = [[.68, .15], [.84, .15], [.84, .42], [.68, .42], [.68, .15]];
    cfg.markers.find(m => m.id === 'd_light1').room_id = room.id;
  }), { room, walls });
  await hover('d_light1', true);
  const offset = await root.locator('.led-hit[data-id="d_light1"]').evaluate(path => {
    const half = path.getPointAtLength(path.getTotalLength() / 2);
    return { x: half.x, y: half.y, d: path.getAttribute('d') };
  });
  samples.push({ wallOffset: offset });
  check('endpoint follows the analytic 1.5-unit wall inset rather than stored vertices', Math.abs(offset.x - 201.5) < .05 && Math.abs(offset.y - 478.5) < .05);
  check('wall-offset halo and routes remain on the real painted path', (await inspect()).anchors.every(a => a.aligned) && (await inspect()).localEndpoints);
  await page.evaluate(() => {
    const c = window.__card;
    c.hass = { ...c.hass, states: Object.fromEntries(Object.entries(c.hass.states).map(([id, row]) =>
      [id, id.startsWith('light.') ? { ...row, state: 'off' } : row])) };
  });
  await hover('d_light1', true);
  check('off participant keeps its transparent core without double alpha', await root.locator('hp-zigbee-topology-overlay').evaluate(overlay => {
    const paint = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-led-participant"][data-id="d_light1"]');
    const core = paint?.querySelector(':scope > path:last-child');
    return Number(core?.getAttribute('stroke-opacity')) === .7
      && !!paint.querySelector(':scope > path[mask]')
      && [...paint.querySelectorAll('mask')].every(mask => Number(mask.getAttribute('width')) < 1000 && Number(mask.getAttribute('height')) < 1000);
  }));
  // The hovered source is replaced while the mouse stays at its old path.
  // Its newly visible icon is elsewhere; no fresh pointer intent owns it.
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.find(s => s.id === 'f1').led_strips[0].active = false;
  }));
  await page.waitForTimeout(120);
  check('retired source path cannot retain hover on a different-position icon', await root.locator('hp-zigbee-topology-overlay').evaluate(overlay =>
    !overlay.shadowRoot.querySelector('line,[data-hp="zigbee-topology-led-anchor"]')));
  await hover('d_light1');
  check('LED-to-icon switch keeps the icon-to-LED route', (await inspect()).lines, 2);
  check('retired LED geometry leaves only the current closed LED participant', (await inspect()).anchors.map(a => a.id).join(), 'd_lamp');
  await page.evaluate(() => window.__hpTest.setMode('devices'));
  check('editor removes the topology overlay', await root.locator('hp-zigbee-topology-overlay').count(), 0);
  check('editor restores original LED core paint', await root.locator('[data-marker="d_lamp"] .led-core').evaluate(n => getComputedStyle(n).visibility), 'visible');
  await page.evaluate(() => window.__hpTest.setMode('view'));
  await hover('d_light1');
  await page.evaluate(() => {
    const c = window.__card; c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: false } };
  });
  await page.evaluate(() => window.__hpTest.settled());
  check('non-admin has no topology entry', await root.locator('hp-zigbee-topology-overlay').count(), 0);
  await page.evaluate(() => {
    const c = window.__card; c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: true } };
  });
  await hover('d_light1');
  await page.mouse.move(2, 2);
  await page.evaluate(() => window.__hpTest.settled());
  check('pointer departure restores original body and clears every endpoint owner', await page.evaluate(() =>
    !window.__card.renderRoot.querySelector('[data-hp-zigbee-topology-endpoint]')
    && [...window.__card.renderRoot.querySelectorAll('.led-core')].every(n => getComputedStyle(n).visibility === 'visible')));
  for (let cycle = 0; cycle < 2; cycle++) {
    await hover('d_light1');
    const detached = await page.evaluate(async () => {
      const card = window.__card, parent = card.parentElement;
      card.remove();
      await Promise.resolve();
      const cleared = !card.renderRoot.querySelector('[data-hp-zigbee-topology-endpoint]');
      parent.append(card);
      await window.__hpTest.settled();
      return cleared;
    });
    check(`detach ${cycle + 1} clears transient LED and HTML ownership`, detached);
    await hover('d_light1');
    check(`remount ${cycle + 1} accepts fresh native hover without stale LED geometry`, (await inspect()).lines === 2
      && (await inspect()).anchors.every(a => a.aligned));
  }
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    cfg.settings.zigbee_topology.enabled = false;
  }));
  check('disabled topology releases the LED body and all endpoint ownership', await page.evaluate(() =>
    !window.__card.renderRoot.querySelector('hp-zigbee-topology-overlay,[data-hp-zigbee-topology-endpoint]')
    && [...window.__card.renderRoot.querySelectorAll('.led-core')].every(n => getComputedStyle(n).visibility === 'visible')));
  check('only the explicit provider read occurred', await page.evaluate(() => window.__ledTopologyCalls.zha), 1);
  check('hover never actuated an HA service', await page.evaluate(() => window.__ledTopologyCalls.service), 0);
  writeFileSync(new URL('samples.json', artifacts), JSON.stringify(samples, null, 2));
  console.log(JSON.stringify(samples));
} finally {
  await finish(browser);
}
