// #564 AC2: real rendered Icon/Text/Double/legacy faces must own every
// painted cardinal point even when the invisible 44 px floor of a neighbouring
// marker overlaps it. Synthetic rectangles cannot prove the CSS/DOM geometry.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 780, height: 720 });

const setup = await page.evaluate(async () => {
  const card = window.__card;
  const marker = (id, patch) => ({
    ...(card._serverCfg.markers || []).find((item) => item.id === id),
    id, binding: `device:${id}`, tap_action: 'info', ...patch,
  });
  const replacements = new Map([
    ['d_light1', marker('d_light1', { display: 'static_icon' })],
    ['d_tv', marker('d_tv', { display: 'value' })],
    ['d_temp', marker('d_temp', {
      display: 'badge',
      value_badge: {
        enabled: true,
        source: { kind: 'entity_state', entity_id: 'sensor.living_temp' },
        position: 'right',
      },
    })],
    // No explicit value_badge: temperature plus humidity must take the legacy
    // two-reading route and produce .with-legacy in the real renderer.
    ['d_window', marker('d_window', { display: 'badge' })],
  ]);
  card._serverCfg.markers = [
    ...(card._serverCfg.markers || []).filter((item) => !replacements.has(item.id)
      && item.id !== 'hit-neighbour'),
    ...replacements.values(),
    {
      id: 'hit-neighbour', name: 'Neighbour floor', binding: 'virtual',
      display: 'static_icon', tap_action: 'info', space: card._space,
    },
  ];
  card._layout = {
    ...card._layout,
    'hit-neighbour': { s: card._space, x: 0.5, y: 0.5 },
  };
  card.hass = {
    ...card.hass,
    entities: {
      ...card.hass.entities,
      'sensor.window_temperature': {
        entity_id: 'sensor.window_temperature', device_id: 'd_window',
        platform: 'demo', disabled_by: null,
      },
      'sensor.window_humidity': {
        entity_id: 'sensor.window_humidity', device_id: 'd_window',
        platform: 'demo', disabled_by: null,
      },
    },
    states: {
      ...card.hass.states,
      'binary_sensor.window': {
        entity_id: 'binary_sensor.window', state: '47',
        attributes: {
          friendly_name: 'Window humidity', device_class: 'humidity',
          unit_of_measurement: '%',
        },
      },
      'sensor.window_temperature': {
        entity_id: 'sensor.window_temperature', state: '21.5',
        attributes: {
          friendly_name: 'Window temperature', device_class: 'temperature',
          unit_of_measurement: '°C',
        },
      },
      'sensor.window_humidity': {
        entity_id: 'sensor.window_humidity', state: '47',
        attributes: {
          friendly_name: 'Window humidity', device_class: 'humidity',
          unit_of_measurement: '%',
        },
      },
    },
  };
  card._regSignature = '';
  card._cfgEpoch++;
  card._maybeRebuildDevices();
  // Keep the browser fixture inside the already-authoritative demo registry:
  // project two existing active entities into one production-shaped legacy
  // DevItem, with humidity as primary and the thermometer icon. That is the
  // exact old two-reading condition consumed by renderDeviceFace().
  const legacyDevice = card._devices.find((device) => device.id === 'd_window');
  if (legacyDevice) {
    legacyDevice.primary = 'binary_sensor.window';
    legacyDevice.entities = ['binary_sensor.window', 'sensor.living_temp'];
    legacyDevice.icon = 'mdi:thermometer';
  }
  card._visibleDeviceSnapshot = null;
  card._candidateDeviceSnapshot = null;
  card._renderLife.invalidate();
  card._planHassMemo = null;
  card.requestUpdate();
  await card.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const shell = (id) => card.renderRoot
    .querySelector(`[data-hp="device"][data-id="${id}"] .device-shell`);
  return {
    icon: shell('d_light1')?.className || '',
    text: shell('d_tv')?.className || '',
    double: shell('d_temp')?.className || '',
    legacy: shell('d_window')?.className || '',
  };
});

const ids = {
  icon: 'd_light1',
  text: 'd_tv',
  double: 'd_temp',
  legacy: 'd_window',
};
const directions = ['right', 'bottom', 'left', 'top'];
const cases = [];

for (const [type, targetId] of Object.entries(ids)) {
  for (const direction of directions) {
    const prepared = await page.evaluate(async ({ type, targetId, direction }) => {
      const card = window.__card;
      const root = card.renderRoot;
      const target = root.querySelector(`[data-hp="device"][data-id="${targetId}"]`);
      const neighbour = root.querySelector('[data-hp="device"][data-id="hit-neighbour"]');
      const shell = target?.querySelector('.device-shell');
      const badge = target?.querySelector('.value-badge');
      const stage = root.querySelector('.stage');
      const cardinalDirections = ['right', 'bottom', 'left', 'top'];
      if (!target || !neighbour || !shell || !stage) return { ready: false };

      // Put the invisible competitor first in DOM/index order. A resolver
      // regressed to "first candidate wins" must therefore fail this smoke.
      neighbour.parentElement.prepend(neighbour);
      for (const node of root.querySelectorAll('[data-hp="device"]')) {
        node.style.display = node === target || node === neighbour ? '' : 'none';
      }
      for (const name of cardinalDirections) {
        shell.classList.remove(`pos-${name}`);
        badge?.classList.remove(`pos-${name}`);
      }
      // Icon/Text have no directional section, so the direction selects the
      // tested side of their painted core. Double/legacy additionally rotate
      // their real flex capsule through every production CSS direction.
      if (shell.classList.contains('with-values')) {
        shell.classList.add(`pos-${direction}`);
        badge?.classList.add(`pos-${direction}`);
      }

      const stageRect = stage.getBoundingClientRect();
      target.style.left = `${stageRect.width / 2}px`;
      target.style.top = `${stageRect.height / 2}px`;
      neighbour.style.left = `${stageRect.width / 2}px`;
      neighbour.style.top = `${stageRect.height / 2}px`;
      card._deviceHits.invalidate();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const frame = target.querySelector('.device-shell-frame').getBoundingClientRect();
      const unit = {
        right: [1, 0], bottom: [0, 1], left: [-1, 0], top: [0, -1],
      }[direction];
      const inset = 3;
      const point = {
        x: unit[0] > 0 ? frame.right - inset
          : unit[0] < 0 ? frame.left + inset : frame.left + frame.width / 2,
        y: unit[1] > 0 ? frame.bottom - inset
          : unit[1] < 0 ? frame.top + inset : frame.top + frame.height / 2,
      };

      const neighbourFrame = neighbour.querySelector('.device-shell-frame').getBoundingClientRect();
      const floorStyle = getComputedStyle(neighbour, '::before');
      const floorRadius = Math.max(parseFloat(floorStyle.width), parseFloat(floorStyle.height)) / 2;
      const paintedRadius = Math.max(neighbourFrame.width, neighbourFrame.height) / 2;
      const distance = Math.min(floorRadius - 2, paintedRadius + 3);
      const desired = {
        x: point.x + unit[0] * distance,
        y: point.y + unit[1] * distance,
      };
      neighbour.style.left = `${desired.x - stageRect.left}px`;
      neighbour.style.top = `${desired.y - stageRect.top}px`;
      card._deviceHits.invalidate();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const finalNeighbourFrame = neighbour.querySelector('.device-shell-frame').getBoundingClientRect();
      const neighbourCore = neighbour.querySelector('.device-core').getBoundingClientRect();
      const centre = {
        x: neighbourCore.left + neighbourCore.width / 2,
        y: neighbourCore.top + neighbourCore.height / 2,
      };
      const overlapDistance = Math.hypot(point.x - centre.x, point.y - centre.y);
      const deepElementFromPoint = (x, y) => {
        let node = document.elementFromPoint(x, y);
        while (node?.shadowRoot?.elementFromPoint) {
          const deeper = node.shadowRoot.elementFromPoint(x, y);
          if (!deeper || deeper === node) break;
          node = deeper;
        }
        return node;
      };
      const native = deepElementFromPoint(point.x, point.y)
        ?.closest?.('[data-hp="device"]')?.dataset?.id || null;
      return {
        ready: true, type, direction, targetId, point,
        semantic: card._deviceHitOwnerAt(point.x, point.y)?.id || null,
        native,
        neighbourBeforeTarget: !!(neighbour.compareDocumentPosition(target)
          & Node.DOCUMENT_POSITION_FOLLOWING),
        targetPainted: point.x >= frame.left && point.x <= frame.right
          && point.y >= frame.top && point.y <= frame.bottom,
        neighbourFloor: overlapDistance <= floorRadius,
        neighbourPainted: point.x >= finalNeighbourFrame.left
          && point.x <= finalNeighbourFrame.right
          && point.y >= finalNeighbourFrame.top
          && point.y <= finalNeighbourFrame.bottom,
      };
    }, { type, targetId, direction });

    if (prepared.ready) {
      await page.mouse.click(prepared.point.x, prepared.point.y);
      prepared.clicked = await page.evaluate(async () => {
        const card = window.__card;
        await card.updateComplete;
        const id = card._infoCard?.id || null;
        card._infoCard = null;
        card.requestUpdate();
        await card.updateComplete;
        return id;
      });
    }
    cases.push(prepared);
  }
}

const out = {
  realFaceKinds: setup.icon.includes('device-shell')
    && !setup.icon.includes('with-values') && !setup.icon.includes('text-shell')
    && setup.text.includes('text-shell') && !setup.text.includes('with-values')
    && setup.double.includes('with-values') && !setup.double.includes('with-legacy')
    && setup.legacy.includes('with-values') && setup.legacy.includes('with-legacy'),
  allSixteenCasesRan: cases.length === 16 && cases.every((entry) => entry.ready),
  everyPaintedPointOwnsNativeAndSemanticHit: cases.every((entry) =>
    entry.neighbourBeforeTarget && entry.targetPainted
    && entry.neighbourFloor && !entry.neighbourPainted
    && entry.native === entry.targetId && entry.semantic === entry.targetId),
  everyPaintedPointOwnsClick: cases.every((entry) => entry.clicked === entry.targetId),
};

if (Object.values(out).some((value) => value !== true)) {
  console.error(JSON.stringify({ setup, cases }, null, 2));
}
await finish(browser, checkAll(out));
