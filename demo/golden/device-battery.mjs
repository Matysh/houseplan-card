/** #792: synthetic, data-driven reference boards; no renderer/CSS substitution. */
const STATES = ['normal', 'warning', 'low', 'unknown'];
const VALUES = { normal: '80', warning: '40', low: '10', unknown: 'unavailable' };
const COLORS = { normal: [29, 194, 29], warning: [240, 160, 12], low: [240, 65, 12], unknown: [112, 119, 129] };
const SPACE = 'golden-battery';
// Independent visual oracle for the owner's four-state MDI choice.
export const BATTERY_BOARD_ICONS = Object.freeze({
  normal: 'mdi:battery', warning: 'mdi:battery-30',
  low: 'mdi:battery-outline', unknown: 'mdi:battery-unknown',
});

export function batteryBoardSamples(kind) {
  if (!['desktop', 'mobile'].includes(kind)) throw new Error(`unknown battery board: ${kind}`);
  if (kind === 'mobile') return [
    ['normal', 'none'], ['warning', 'right'], ['low', 'left'], ['unknown', 'top'],
    ['normal', 'bottom'], ['warning', 'text'], ['low', 'binary'], ['unknown', 'binary'],
  ].map(([state, arrangement], index) => ({
    id: `battery-mobile-${index}`, state, arrangement, diameter: index < 6 ? 32 : 56,
    x: index % 2 ? 0.66 : 0.22, y: 0.16 + Math.floor(index / 2) * 0.22,
  }));
  return [
    ...[32, 56, 96].flatMap((diameter, row) => STATES.map((state, column) => ({
      id: `battery-${diameter}-${state}`, state, diameter, arrangement: 'none',
      x: 0.14 + column * 0.23, y: 0.12 + row * 0.19,
    }))),
    ...['none', 'right', 'left', 'top', 'bottom'].map((arrangement, index) => ({
      id: `battery-layout-${arrangement}`, state: STATES[index % 4], diameter: 56, arrangement,
      // Opposite horizontal capsules extend toward each other. Leave room for
      // both complete shells plus the first capsule's independent battery.
      x: [0.08, 0.22, 0.56, 0.73, 0.91][index], y: 0.70,
    })),
    ...['text', 'legacy', 'binary', 'binary'].map((arrangement, index) => ({
      id: `battery-extra-${index}`, state: STATES[index], diameter: 56, arrangement,
      x: 0.13 + index * 0.23, y: 0.88,
    })),
  ];
}

export function makeBatteryBoardFixture(kind) {
  const fixture = {
    config: {
      model_version: 7,
      spaces: [{ id: SPACE, title: 'Battery reference', plan_url: null, view_box: [0, 0, 1, 1],
        cell_cm: 5, rooms: [{ id: 'battery-room', name: '', area: 'battery_area',
          poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
        walls: [], wall_segments: [], partitions: [], openings: [], wall_columns: [], decor: [],
        settings: { fill_mode: 'none', show_names: false, show_borders: false, glow_enabled: false },
      }],
      markers: [], settings: { bg_mode: 'static', sun_rays: false, marker_area_snapshot: {} },
    },
    devices: {}, entities: {}, states: {}, layout: {},
    areas: { battery_area: { area_id: 'battery_area', name: 'Battery reference' } },
  };
  const addEntity = (id, entityId, state, attributes, diagnostic = false) => {
    fixture.entities[entityId] = { entity_id: entityId, device_id: id, platform: 'houseplan_golden',
      config_entry_id: 'golden_entry', disabled_by: null,
      original_device_class: attributes.device_class,
      ...(diagnostic ? { entity_category: 'diagnostic' } : {}),
    };
    fixture.states[entityId] = { entity_id: entityId, state, attributes };
  };
  for (const sample of batteryBoardSamples(kind)) {
    const { id, diameter, arrangement, state } = sample;
    const stem = id.replaceAll('-', '_');
    const valueId = `sensor.${stem}_measurement`;
    const batteryId = `${arrangement === 'binary' ? 'binary_sensor' : 'sensor'}.${stem}_battery`;
    fixture.devices[id] = { id, name: id, model: 'GOLDEN-BATTERY', area_id: 'battery_area',
      identifiers: [['houseplan_golden', id]], config_entries: ['golden_entry'], disabled_by: null,
    };
    addEntity(id, valueId, arrangement === 'text' ? '498' : '21.5', {
      device_class: arrangement === 'legacy' ? 'humidity' : 'temperature',
      unit_of_measurement: arrangement === 'text' ? 'ppm' : arrangement === 'legacy' ? '%' : '°C',
    });
    addEntity(id, batteryId, arrangement === 'binary'
      ? state === 'low' ? 'on' : state === 'normal' ? 'off' : 'unavailable'
      : VALUES[state], { device_class: 'battery', ...(arrangement === 'binary' ? {} : { unit_of_measurement: '%' }) }, true);
    const marker = { id, binding: `device:${id}`, space: SPACE, size: diameter / 16,
      icon: 'mdi:thermometer', value_badge: { enabled: false },
    };
    if (['right', 'left', 'top', 'bottom'].includes(arrangement)) marker.value_badge = {
      enabled: true, position: arrangement, source: { kind: 'entity_state', entity_id: valueId },
    };
    if (arrangement === 'text') {
      marker.display = 'value';
      marker.value_source = { kind: 'entity_state', entity_id: valueId };
    }
    if (arrangement === 'legacy') {
      // A humidity-led legacy marker with a diagnostic climate temperature:
      // the preserved second metric widens the same shell as the primary badge.
      marker.icon = 'mdi:water-percent';
      marker.use_climate_temp = true;
      delete marker.value_badge;
      addEntity(id, `climate.${stem}_diagnostic`, 'idle', { current_temperature: 22.4 }, true);
    }
    fixture.config.markers.push(marker);
    fixture.config.settings.marker_area_snapshot[id] = { binding: marker.binding, area: 'battery_area' };
    fixture.layout[id] = { s: SPACE, x: sample.x, y: sample.y };
  }
  return fixture;
}

/** Calibrate the public icon-size option once; never force a face's CSS size. */
export async function prepareBatteryBoard(page, scenario) {
  return page.evaluate(async ({ samples, scenario, colors, icons }) => {
    const card = window.__goldenCard;
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const marker = (id) => card.renderRoot.querySelector(`[data-hp="device"][data-id="${CSS.escape(id)}"]`);
    const reference = samples[0];
    const initial = marker(reference.id)?.querySelector('.device-shell-frame')?.getBoundingClientRect().width;
    if (!(initial > 0)) throw new Error('battery golden calibration has no round shell');
    const iconSize = (scenario.iconSize || 3.4) * reference.diameter / initial;
    if (!(iconSize > 0 && iconSize <= 8)) throw new Error(`battery golden invalid icon size ${iconSize}`);
    card.setConfig({ type: 'custom:houseplan-card', title: `Golden ${scenario.id}`,
      icon_size: iconSize, language: scenario.language || 'en', show_temperature: true, show_signal: false,
    });
    await card.updateComplete;
    await frame();
    const stage = card.renderRoot.querySelector('.stage').getBoundingClientRect();
    const near = (actual, expected, detail) => {
      if (!Number.isFinite(actual) || Math.abs(actual - expected) > 0.5)
        throw new Error(`battery golden ${detail}: ${actual} != ${expected}`);
    };
    const loadedIcons = new Set();
    const measured = [];
    for (const sample of samples) {
      const device = marker(sample.id);
      const shell = device?.querySelector('.device-shell-frame');
      const battery = device?.querySelector('.device-battery');
      if (!shell || !battery) throw new Error(`battery golden missing face: ${sample.id}`);
      const iconNodes = battery.querySelectorAll('ha-icon.device-battery-icon');
      if (iconNodes.length !== 1) throw new Error(`battery golden icon count: ${sample.id}`);
      const icon = iconNodes[0];
      await icon.updateComplete;
      const expectedIcon = icons[sample.state];
      if (icon.icon !== expectedIcon) throw new Error(`battery golden wrong MDI: ${sample.id}`);
      const artwork = icon.shadowRoot?.querySelector('svg');
      const paths = artwork?.querySelectorAll('path');
      const expectedPath = window.__ICONS?.[expectedIcon];
      if (!artwork || artwork.getAttribute('viewBox') !== '0 0 24 24'
        || paths.length !== 1 || typeof expectedPath !== 'string' || !expectedPath
        || paths[0].getAttribute('d') !== expectedPath)
        throw new Error(`battery golden missing MDI path: ${sample.id}`);
      const inkBounds = paths[0].getBBox();
      if (!(inkBounds.width > 0 && inkBounds.height > 0))
        throw new Error(`battery golden empty MDI geometry: ${sample.id}`);
      loadedIcons.add(expectedIcon);
      const expectedFrame = { 32: 19, 56: 33, 96: 56 }[sample.diameter];
      const expectedGap = { 32: 2, 56: 4, 96: 7 }[sample.diameter];
      const rect = battery.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const artworkRect = artwork.getBoundingClientRect();
      const whole = shell.getBoundingClientRect();
      const core = device.querySelector('.device-core').getBoundingClientRect();
      near(core.height * 101.5 / 80, sample.diameter, `${sample.id} base diameter`);
      near(rect.width, expectedFrame, `${sample.id} frame width`);
      near(rect.height, expectedFrame, `${sample.id} frame height`);
      near(iconRect.width, expectedFrame, `${sample.id} MDI host width`);
      near(iconRect.height, expectedFrame, `${sample.id} MDI host height`);
      near(artworkRect.width, expectedFrame, `${sample.id} painted SVG width`);
      near(artworkRect.height, expectedFrame, `${sample.id} painted SVG height`);
      near(rect.left - whole.right, expectedGap, `${sample.id} whole-shell gap`);
      near(rect.top + rect.height / 2, whole.top + whole.height / 2, `${sample.id} whole-shell center`);
      if (battery.dataset.state !== sample.state) throw new Error(`battery golden wrong state: ${sample.id}`);
      if (rect.left < stage.left || rect.right > stage.right || rect.top < stage.top || rect.bottom > stage.bottom)
        throw new Error(`battery golden clipped battery: ${sample.id}`);
      if (sample.arrangement === 'legacy' && !device.querySelector('.legacy-secondary'))
        throw new Error('battery golden legacy second metric is absent');
      if (sample.arrangement === 'text' && !(whole.width > sample.diameter))
        throw new Error('battery golden Text shell is not expanded');
      measured.push({ id: sample.id, state: sample.state, color: colors[sample.state],
        x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    }
    await frame();
    return { iconSize, loadedIcons: loadedIcons.size, samples: measured };
  }, { samples: batteryBoardSamples(scenario.batteryBoard), scenario, colors: COLORS, icons: BATTERY_BOARD_ICONS });
}

/** Real screenshot ink, not DOM presence: empty/broken/invisible SVG fails. */
export async function inspectBatteryBoardPixels(page, png, clip, board) {
  const samples = await page.evaluate(async ({ png64, clip, samples }) => {
    const bytes = Uint8Array.from(atob(png64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    image.close();
    return samples.map((sample) => {
      const left = Math.floor(sample.x - (clip?.x || 0));
      const top = Math.floor(sample.y - (clip?.y || 0));
      const right = Math.ceil(left + sample.width);
      const bottom = Math.ceil(top + sample.height);
      let matching = 0;
      for (let y = Math.max(0, top); y < Math.min(canvas.height, bottom); y++) {
        for (let x = Math.max(0, left); x < Math.min(canvas.width, right); x++) {
          const offset = (y * canvas.width + x) * 4;
          if (sample.color.every((channel, index) => Math.abs(pixels[offset + index] - channel) <= 12)) matching++;
        }
      }
      return { id: sample.id, matching, minimum: Math.max(8, Math.floor(sample.width * sample.height * 0.035)) };
    });
  }, { png64: png.toString('base64'), clip, samples: board.samples });
  const failures = samples.filter((sample) => sample.matching < sample.minimum);
  if (failures.length) throw new Error(`semantic battery golden ink missing: ${JSON.stringify(failures)}`);
  return samples;
}

export const BATTERY_ZIGBEE_MARKER = 'battery-56-normal';

/** Same natural unplaced-parent arrangement as smoke_device_battery_zigbee. */
export function makeBatteryZigbeeFixture() {
  const fixture = makeBatteryBoardFixture('desktop');
  fixture.config.markers = fixture.config.markers.filter((marker) => marker.id === BATTERY_ZIGBEE_MARKER);
  fixture.config.markers[0].size = 1.4;
  fixture.config.settings = { ...fixture.config.settings, volumetric_view: false,
    show_device_battery: true, moon_enabled: false, zigbee_topology: { enabled: true },
    marker_area_snapshot: { [BATTERY_ZIGBEE_MARKER]: fixture.config.settings.marker_area_snapshot[BATTERY_ZIGBEE_MARKER] },
  };
  fixture.devices = { [BATTERY_ZIGBEE_MARKER]: fixture.devices[BATTERY_ZIGBEE_MARKER] };
  fixture.entities = Object.fromEntries(Object.entries(fixture.entities)
    .filter(([, entity]) => entity.device_id === BATTERY_ZIGBEE_MARKER));
  fixture.states = Object.fromEntries(Object.entries(fixture.states).filter(([id]) => fixture.entities[id]));
  fixture.layout = { [BATTERY_ZIGBEE_MARKER]: { s: SPACE, x: 0.34, y: 0.34 } };
  fixture.zhaDevices = [
    { ieee: '00124b0000000001', nwk: 1, device_reg_id: BATTERY_ZIGBEE_MARKER, device_type: 'EndDevice',
      neighbors: [{ ieee: '00124b0000000002', relationship: 'Parent', lqi: 50 }] },
    { ieee: '00124b0000000002', nwk: 2, device_reg_id: 'not_on_plan', device_type: 'Router',
      name: 'Upstairs parent relay',
      neighbors: [{ ieee: '00124b0000000001', relationship: 'Child', lqi: 50 }] },
  ];
  return fixture;
}

export async function batteryZigbeeProbe(page) {
  return page.evaluate((id) => {
    const root = window.__goldenCard.renderRoot;
    const marker = root.querySelector(`[data-hp="device"][data-id="${CSS.escape(id)}"]`);
    const overlay = root.querySelector('hp-zigbee-topology-overlay')?.shadowRoot;
    const rect = (node) => {
      if (!node) throw new Error('battery Zigbee golden missing rendered geometry');
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const battery = rect(marker?.querySelector('.device-battery'));
    const caption = rect(overlay?.querySelector('[data-hp="zigbee-topology-parent-bubble"]'));
    const core = rect(marker?.querySelector('.device-core'));
    return { battery, caption, core, overlap: {
      x: Math.max(battery.x, caption.x), y: Math.max(battery.y, caption.y),
      right: Math.min(battery.right, caption.right), bottom: Math.min(battery.bottom, caption.bottom),
    } };
  }, BATTERY_ZIGBEE_MARKER);
}

/** Fixed, core-anchored focus: tiny layering changes cannot hide in a full page. */
export function batteryZigbeeClip(probe, viewport) {
  const clip = { x: Math.floor(probe.core.x - 16),
    y: Math.floor(probe.core.y + probe.core.height / 2 - 70), width: 420, height: 140 };
  if (clip.x < 0 || clip.y < 0 || clip.x + clip.width > viewport.width
    || clip.y + clip.height > viewport.height || [probe.core, probe.battery, probe.caption].some((rect) =>
      rect.x < clip.x || rect.y < clip.y || rect.right > clip.x + clip.width || rect.bottom > clip.y + clip.height))
    throw new Error(`battery Zigbee golden focused clip truncates the witness: ${JSON.stringify({ clip, probe, viewport })}`);
  return clip;
}

/** Executable pixel oracle shared with unit negative cases, not a z-index check. */
export function inspectBatteryZigbeePixels(images, probe, clip) {
  if (probe.overlap.right - probe.overlap.x < 4 || probe.overlap.bottom - probe.overlap.y < 6)
    throw new Error('battery Zigbee golden caption does not overlap battery');
  const at = (image, x, y) => {
    const ix = Math.floor(x - clip.x), iy = Math.floor(y - clip.y);
    if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height)
      throw new Error('battery Zigbee golden pixel outside capture');
    const index = (iy * image.width + ix) * 4;
    return image.data.slice(index, index + 3);
  };
  const changed = (a, b) => a.some((value, index) => Math.abs(value - b[index]) > 12);
  const green = (pixel) => COLORS.normal.every((value, index) => Math.abs(value - pixel[index]) < 8);
  let ink = 0, covered = 0, coreChanged = 0, exposedRoute = 0;
  const centreY = probe.caption.y + probe.caption.height / 2;
  for (let y = Math.ceil(Math.max(probe.overlap.y + 2, centreY - 5));
    y < Math.min(probe.overlap.bottom - 2, centreY + 5); y++) {
    for (let x = Math.ceil(probe.overlap.x + 2); x < probe.overlap.right - 2; x++) {
      const baseline = at(images.captionHidden, x, y), painted = at(images.active, x, y);
      if (!green(baseline)) continue;
      ink++;
      if (changed(baseline, painted) && painted[1] - Math.max(painted[0], painted[2]) < 50) covered++;
    }
  }
  const cx = probe.core.x + probe.core.width / 2, cy = probe.core.y + probe.core.height / 2;
  for (let x = Math.ceil(cx); x < probe.caption.x - 3; x++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (!changed(at(images.active, x, cy + dy), at(images.routesHidden, x, cy + dy))) continue;
      if (x < probe.core.right - 5) coreChanged++;
      else if (x > probe.core.right + 3) exposedRoute++;
    }
  }
  const evidence = { ink, covered, coreChanged, exposedRoute };
  // Keep the smoke's differential thresholds; the focused zero-diff golden
  // additionally catches a one-pixel edge leak that a ratio alone could miss.
  if (ink < 3 || covered / ink < 0.9)
    throw new Error(`battery Zigbee golden caption does not cover real battery ink: ${JSON.stringify(evidence)}`);
  if (coreChanged > 2 || exposedRoute < 3)
    throw new Error(`battery Zigbee golden route/core paint order is missing: ${JSON.stringify(evidence)}`);
  return evidence;
}

export async function prepareBatteryZigbeeOverlap(page) {
  // Open/refresh/close the real General Settings UI; __hpTest still points at
  // the old demo card after golden remounts and must not seed this scene.
  await page.evaluate(() => window.__goldenCard.renderRoot.querySelector('[data-hp="settings"]').click());
  await page.waitForFunction(() => [...(window.__goldenCard.renderRoot
    .querySelector('hp-zigbee-topology-settings')?.shadowRoot?.querySelectorAll('button') || [])]
    .some((button) => button.querySelector('ha-icon[icon="mdi:access-point-network"]') && !button.disabled));
  await page.evaluate(() => [...window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-settings')
    .shadowRoot.querySelectorAll('button')]
    .find((button) => button.querySelector('ha-icon[icon="mdi:access-point-network"]')).click());
  await page.waitForFunction(() => /Received/i.test(window.__goldenCard.renderRoot
    .querySelector('hp-zigbee-topology-settings')?.shadowRoot?.textContent || ''));
  await page.evaluate(() => window.__goldenCard.renderRoot.querySelector('hp-dialog [data-hp="dialog-cancel"]').click());
  await page.waitForFunction(() => !window.__goldenCard.renderRoot.querySelector('hp-dialog'));
  const face = await page.evaluate(async (id) => {
    const marker = window.__goldenCard.renderRoot.querySelector(`[data-hp="device"][data-id="${CSS.escape(id)}"]`);
    const battery = marker?.querySelector('.device-battery');
    const icon = battery?.querySelector('ha-icon.device-battery-icon');
    await icon?.updateComplete;
    const svg = icon?.shadowRoot?.querySelector('svg'), path = svg?.querySelector('path');
    const rect = battery?.getBoundingClientRect(), core = marker?.querySelector('.device-core')?.getBoundingClientRect();
    if (battery?.dataset.state !== 'normal' || icon?.icon !== 'mdi:battery'
      || !path || path.getAttribute('d') !== window.__ICONS?.['mdi:battery']
      || !(path.getBBox().width > 0) || !(path.getBBox().height > 0)
      || svg.getAttribute('viewBox') !== '0 0 24 24'
      || !(rect.width > 0) || Math.abs(svg.getBoundingClientRect().width - rect.width) > 0.5
      || Math.abs(svg.getBoundingClientRect().height - rect.height) > 0.5)
      throw new Error('battery Zigbee golden lacks a full-size official MDI battery');
    return { x: core.x + core.width / 2, y: core.y + core.height / 2,
      battery: { id, state: 'normal', color: [29, 194, 29], x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  }, BATTERY_ZIGBEE_MARKER);
  // Before hover the very same MDI must paint. Empty glyphs cannot make the
  // subsequent caption control vacuously green.
  await inspectBatteryBoardPixels(page, await page.screenshot({ scale: 'css', animations: 'disabled' }),
    null, { samples: [face.battery] });
  await page.mouse.move(face.x, face.y);
  await page.waitForFunction(() => window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-overlay')
    ?.shadowRoot?.querySelector('[data-hp="zigbee-topology-parent-bubble"]')?.getBoundingClientRect().width > 0);
  await page.evaluate(() => {
    const caption = window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot
      .querySelector('[data-hp="zigbee-topology-parent-bubble"]');
    if (!caption.textContent.includes('Upstairs parent relay'))
      throw new Error('battery Zigbee golden expected real parent caption text');
  });
  await page.evaluate(async () => {
    await window.__goldenCard.updateComplete;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const probe = await batteryZigbeeProbe(page), clip = batteryZigbeeClip(probe, page.viewportSize());
  const screenshot = () => page.screenshot({ clip, scale: 'css', animations: 'disabled', caret: 'hide' });
  const controls = async (hidden) => page.evaluate((hidden) => {
    const overlay = window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot;
    for (const [name, selector] of [['caption', 'zigbee-topology-parent-bubble'], ['routes', 'zigbee-topology-lines']]) {
      const node = overlay.querySelector(`[data-hp="${selector}"]`);
      if (!node) throw new Error(`battery Zigbee golden missing ${name}`);
      if (hidden === name) node.style.visibility = 'hidden';
      else node.style.removeProperty('visibility');
    }
  }, hidden);
  let active, captionHidden, routesHidden;
  try {
    active = await screenshot();
    await controls('caption');
    captionHidden = await screenshot();
    await controls('routes');
    routesHidden = await screenshot();
  } finally {
    await controls(null);
  }
  const images = await page.evaluate(async (encoded) => Object.fromEntries(await Promise.all(
    Object.entries(encoded).map(async ([name, base64]) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close();
      return [name, { width: image.width, height: image.height, data: Array.from(image.data) }];
    }))), { active: active.toString('base64'), captionHidden: captionHidden.toString('base64'),
    routesHidden: routesHidden.toString('base64') });
  return { ...inspectBatteryZigbeePixels(images, probe, clip), clip, overlap: probe.overlap };
}
