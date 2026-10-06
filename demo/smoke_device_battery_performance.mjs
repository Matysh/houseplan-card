/** #806: 200 painted battery icons, using the existing static and camera budgets. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1440, height: 1000 });
const out = {};
try {
  const measured = await page.evaluate(async () => {
    const card = window.__card;
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const longTaskWindow = () => {
      const entries = [];
      if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        return { stop: async () => ({ supported: false, count: 0, maxMs: 0, totalMs: 0 }) };
      }
      const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ type: 'longtask', buffered: false });
      return {
        stop: async () => {
          await new Promise((done) => setTimeout(done, 0));
          entries.push(...observer.takeRecords());
          observer.disconnect();
          const durations = entries.map((entry) => entry.duration);
          return {
            supported: true,
            count: durations.length,
            maxMs: durations.length ? Math.max(...durations) : 0,
            totalMs: durations.reduce((sum, duration) => sum + duration, 0),
          };
        },
      };
    };

    const states = { ...card.hass.states };
    const markers = Object.keys(card.hass.devices).map((id) => ({
      id, binding: `device:${id}`, hidden: true,
    }));
    const layout = {};
    for (let index = 0; index < 200; index++) {
      const id = `battery-perf-${index}`;
      const entityId = `sensor.battery_perf_${index}`;
      window.__addRegistryEntity(entityId, null, String(20 + (index % 81)));
      Object.assign(card.hass.entities[entityId], {
        device_class: 'battery',
        disabled_by: null,
      });
      states[entityId] = {
        entity_id: entityId,
        state: String(20 + (index % 81)),
        attributes: { device_class: 'battery', unit_of_measurement: '%' },
      };
      markers.push({
        id,
        binding: `entity:${entityId}`,
        space: 'f1',
        display: 'badge',
        value_badge: { enabled: false },
      });
      layout[id] = {
        s: 'f1',
        x: 0.025 + (index % 20) * 0.05,
        y: 0.05 + Math.floor(index / 20) * 0.095,
      };
    }
    card.hass = { ...card.hass, states };

    const staticTasks = longTaskWindow();
    const staticStarted = performance.now();
    await window.__hpTest.setServerConfig((cfg) => ({
      ...cfg,
      settings: { ...cfg.settings, show_device_battery: true, volumetric_view: false },
      markers,
    }));
    await window.__hpTest.setLayout((current) => ({ ...current, ...layout }));
    await frame();
    const staticMs = performance.now() - staticStarted;
    const staticLongTasks = await staticTasks.stop();

    const roots = [...card.shadowRoot.querySelectorAll('[data-hp="device"] .device-battery')];
    const filteredIcons = roots.filter((root) => {
      const icon = root.querySelector('ha-icon.device-battery-icon');
      return icon && getComputedStyle(icon).filter.includes('drop-shadow');
    });
    const stage = card.shadowRoot.querySelector('.stage');
    const camera = card.shadowRoot.querySelector(
      '[data-hp-live-viewbox="camera"], [data-hp-live-viewbox="floor"], .zoomwrap > svg',
    );
    const rect = stage.getBoundingClientRect();
    const beforeViewBox = camera?.getAttribute('viewBox') || '';
    const cameraTasks = longTaskWindow();
    const cameraStarted = performance.now();
    const pointerId = 806;
    stage.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: rect.left + 220, clientY: rect.top + 220, button: 0, buttons: 1,
      bubbles: true, composed: true, pointerId, pointerType: 'mouse', isPrimary: true,
    }));
    for (let index = 0; index < 20; index++) {
      stage.dispatchEvent(new PointerEvent('pointermove', {
        clientX: rect.left + 225 + index * 3, clientY: rect.top + 223 + index,
        button: 0, buttons: 1, bubbles: true, composed: true,
        pointerId, pointerType: 'mouse', isPrimary: true,
      }));
    }
    stage.dispatchEvent(new PointerEvent('pointerup', {
      clientX: rect.left + 285, clientY: rect.top + 243, button: 0, buttons: 0,
      bubbles: true, composed: true, pointerId, pointerType: 'mouse', isPrimary: true,
    }));
    stage.dispatchEvent(new WheelEvent('wheel', {
      deltaY: -120,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true,
    }));
    await window.__hpTest.settled();
    await frame();
    const cameraMs = performance.now() - cameraStarted;
    const cameraLongTasks = await cameraTasks.stop();
    const afterViewBox = camera?.getAttribute('viewBox') || '';

    return {
      roots: roots.length,
      filteredIcons: filteredIcons.length,
      staticMs,
      staticLongTasks,
      cameraMs,
      cameraLongTasks,
      cameraMoved: !!beforeViewBox && beforeViewBox !== afterViewBox,
      rootsAfterCamera: card.shadowRoot.querySelectorAll('[data-hp="device"] .device-battery').length,
    };
  });

  const checks = {};
  checks.rendersExactly200ShadowedIndicators = measured.roots === 200 && measured.filteredIcons === 200;
  checks.staticFrameStaysWithinExistingBudget = measured.staticMs <= 3400
    && (!measured.staticLongTasks.supported || (measured.staticLongTasks.maxMs <= 3000
      && measured.staticLongTasks.count <= 30 && measured.staticLongTasks.totalMs <= 12000));
  checks.panZoomStaysWithinExistingBudget = measured.cameraMoved && measured.cameraMs <= 500
    && measured.rootsAfterCamera === 200
    && (!measured.cameraLongTasks.supported || (measured.cameraLongTasks.maxMs <= 150
      && measured.cameraLongTasks.count <= 3 && measured.cameraLongTasks.totalMs <= 300));
  Object.assign(out, checks);
  out.metrics = measured;
  checkAll(checks);
} catch (error) {
  out.error = String(error?.stack || error);
  checkAll({ batteryShadowPerformanceCompleted: false });
}
await finish(browser, out);
