/** #792: production-shaped registry/config inputs, no private card writes. */
export async function installBatteryFixture(page) {
  await page.evaluate(async () => {
    const card = window.__card;
    const sources = [
      ['sensor.aaa_hp_battery', 'd_temp', '80'],
      ['sensor.zzz_hp_battery', 'd_temp', '5'],
      ['sensor.hp_light_battery', 'd_light1', '80'],
    ];
    const states = { ...card.hass.states };
    for (const [id, device, state] of sources) {
      window.__addRegistryEntity(id, null, state);
      Object.assign(card.hass.entities[id], { device_id: device, device_class: 'battery' });
      states[id] = { entity_id: id, state, attributes: { device_class: 'battery', unit_of_measurement: '%' } };
      window.__setRegistryArea('entity', id, null);
    }
    card.hass = { ...card.hass, states };
    card.setConfig({ type: 'custom:houseplan-card', title: 'Battery witness', icon_size: 5, language: 'en' });
    await window.__hpTest.setMode('view');
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, volumetric_view: false, show_device_battery: true, moon: false },
      markers: [
        ...Object.keys(card.hass.devices).filter(id => !['d_temp', 'd_light1', 'd_leak'].includes(id))
          .map(id => ({ id, binding: `device:${id}`, hidden: true })),
        { id: 'd_temp', binding: 'device:d_temp', space: 'f1', display: 'badge',
          value_badge: { enabled: false }, size: 1.4, tap_action: 'info' },
        { id: 'd_light1', binding: 'device:d_light1', space: 'f1', display: 'badge',
          value_badge: { enabled: false }, tap_action: 'info' },
        { id: 'd_leak', binding: 'device:d_leak', space: 'f1', display: 'badge', value_badge: { enabled: false } },
      ],
    }));
    await window.__hpTest.setLayout(layout => ({ ...layout,
      d_temp: { s: 'f1', x: 0.34, y: 0.34 },
      d_light1: { s: 'f1', x: 0.7, y: 0.65 },
      d_leak: { s: 'f1', x: 0.78, y: 0.3 },
    }));
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => window.__card.shadowRoot
    .querySelector('[data-hp="device"][data-id="d_temp"] .device-battery[data-state="normal"]'));
}

export async function setBatteryState(page, state, source = 'sensor.aaa_hp_battery') {
  await page.evaluate(async ({ state, source }) => {
    const card = window.__card;
    card.hass = { ...card.hass, states: { ...card.hass.states,
      [source]: { ...card.hass.states[source], state },
    } };
    for (const secondary of document.querySelectorAll('houseplan-space-card')) secondary.hass = card.hass;
    await window.__hpTest.settled();
  }, { state, source });
}

export async function patchBatteryMarker(page, patch) {
  await page.evaluate(patch => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    markers: cfg.markers.map(marker => marker.id === 'd_temp' ? { ...marker, ...patch } : marker),
  })), patch);
}

export async function batteryGeometry(page, id = 'd_temp') {
  return page.evaluate(id => {
    const node = window.__card.shadowRoot.querySelector(`[data-hp="device"][data-id="${id}"]`);
    const rect = selector => {
      const r = node?.querySelector(selector)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null;
    };
    return { shell: rect('.device-shell-frame'), core: rect('.device-core'), badge: rect('.value-badge'),
      lqi: rect('.lqi'), battery: rect('.device-battery'),
      state: node?.querySelector('.device-battery')?.dataset.state || null,
    };
  }, id);
}

/** Owner-approved MDI mapping, independently pinned from the production renderer. */
const BATTERY_MDI_ICONS = {
  normal: 'mdi:battery', warning: 'mdi:battery-30',
  low: 'mdi:battery-outline', unknown: 'mdi:battery-unknown',
};

export async function batteryMdiIcon(page, state, id = 'd_temp') {
  return page.evaluate(({ state, id, expected }) => {
    const battery = window.__card.shadowRoot
      .querySelector(`[data-hp="device"][data-id="${id}"] .device-battery`);
    const icon = battery?.querySelector('ha-icon.device-battery-icon');
    const path = icon?.shadowRoot?.querySelector('svg path');
    const box = path?.getBBox();
    return battery?.dataset.state === state && icon?.getAttribute('icon') === expected
      && !!window.__ICONS?.[expected] && path?.getAttribute('d') === window.__ICONS[expected]
      && box?.width > 0 && box?.height > 0;
  }, { state, id, expected: BATTERY_MDI_ICONS[state] });
}

/** Count painted colour, not just the ha-icon attribute or a nonempty path. */
export async function batteryColorPixels(page, rectangle, rgb) {
  await page.waitForFunction(() => {
    const batteries = [...window.__card.shadowRoot.querySelectorAll('.device-battery')];
    return batteries.length > 0 && batteries.every(battery => {
      const icon = battery.querySelector('ha-icon.device-battery-icon');
      const path = icon?.shadowRoot?.querySelector('svg path');
      const box = path?.getBBox();
      return !!path?.getAttribute('d') && box.width > 0 && box.height > 0;
    });
  });
  await page.evaluate(() => window.__hpTest.settled());
  const png = await page.screenshot({ animations: 'disabled', clip: {
    x: Math.floor(rectangle.x), y: Math.floor(rectangle.y),
    width: Math.ceil(rectangle.width) + 1, height: Math.ceil(rectangle.height) + 1,
  } });
  const count = await page.evaluate(async ({ data, rgb }) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (rgb.every((channel, index) => Math.abs(channel - pixels[i + index]) <= 8)) count++;
    }
    return count;
  }, { data: png.toString('base64'), rgb });
  if (!count) console.log('Battery missing raster ink:', await page.evaluate(() => {
    const node = window.__card.shadowRoot.querySelector('[data-id="d_temp"] .device-battery');
    const icon = node?.querySelector('ha-icon.device-battery-icon');
    return { html: node?.outerHTML, icon: icon?.getAttribute('icon'),
      path: icon?.shadowRoot?.querySelector('path')?.getAttribute('d'),
      assets: [icon, icon?.shadowRoot?.querySelector('svg')].filter(Boolean).map(asset => {
      const css = getComputedStyle(asset), box = asset.getBoundingClientRect();
      return { tag: asset.tagName, display: css.display, visibility: css.visibility,
        opacity: css.opacity, width: box.width, height: box.height };
    }) };
  }));
  return count;
}
