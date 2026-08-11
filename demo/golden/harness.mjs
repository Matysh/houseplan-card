import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';
import { makeVisualMatrixFixture } from '../fixtures/visual-matrix.mjs';

const fixtureFor = (name) => name === 'large' ? makeLargeHouseFixture() : makeVisualMatrixFixture();

const themeVars = {
  dark: {
    '--primary-color': '#3ea6ff', '--primary-text-color': '#e6e7eb',
    '--secondary-text-color': '#9aa4ad', '--card-background-color': '#202126',
    '--ha-card-background': '#202126', '--divider-color': '#3a3d45',
  },
  light: {
    '--primary-color': '#0b73b8', '--primary-text-color': '#202124',
    '--secondary-text-color': '#5f6368', '--card-background-color': '#ffffff',
    '--ha-card-background': '#ffffff', '--divider-color': '#d7d9de',
  },
};

async function stableEnvironment(page, scenario) {
  await page.setViewportSize(scenario.viewport);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scenario.theme });
  await page.evaluate(({ variables, theme }) => {
    let style = document.getElementById('hp-golden-stability');
    if (!style) {
      style = document.createElement('style');
      style.id = 'hp-golden-stability';
      style.textContent = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
        }
        html, body { width: 100%; min-height: 100%; overflow: hidden; }
        body { background: var(--hp-golden-page-bg) !important;
          font-family: Arial, sans-serif !important; }
        #host { width: min(100%, 1120px) !important; margin: 0 auto !important;
          padding: 8px !important; box-sizing: border-box !important; }
      `;
      document.head.appendChild(style);
    }
    for (const [name, value] of Object.entries(variables))
      document.documentElement.style.setProperty(name, value);
    document.documentElement.style.setProperty(
      '--hp-golden-page-bg', theme === 'light' ? '#eef1f4' : '#11151b',
    );
    document.documentElement.style.colorScheme = theme;
  }, { variables: themeVars[scenario.theme] || themeVars.dark, theme: scenario.theme });
}

/** Apply every data-only scenario override before the fixture crosses into the browser. */
export function prepareGoldenFixture(scenario) {
  const fixture = fixtureFor(scenario.fixture);
  const requireSpace = () => {
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    if (!space) throw new Error(`golden override references missing space: ${scenario.space}`);
    return space;
  };
  if (scenario.deviceName) {
    if (!scenario.deviceId || !fixture.devices?.[scenario.deviceId])
      throw new Error(`golden deviceName references missing device: ${scenario.deviceId || '<empty>'}`);
    fixture.devices[scenario.deviceId].name = scenario.deviceName;
  }
  if (scenario.fillMode || typeof scenario.glowEnabled === 'boolean'
      || typeof scenario.sunRays === 'boolean') {
    const space = requireSpace();
    space.settings = {
      ...(space.settings || {}),
      ...(scenario.fillMode ? { fill_mode: scenario.fillMode } : {}),
      ...(typeof scenario.glowEnabled === 'boolean' ? { glow_enabled: scenario.glowEnabled } : {}),
      ...(typeof scenario.sunRays === 'boolean' ? { sun_rays: scenario.sunRays } : {}),
      ...(scenario.customFill ? { custom_fill: scenario.customFill } : {}),
    };
  }
  if (scenario.extraOpenings?.length) {
    const space = requireSpace();
    const known = new Set((space.openings || []).map((opening) => opening.id));
    for (const opening of scenario.extraOpenings) {
      if (!opening?.id || known.has(opening.id))
        throw new Error(`golden extraOpening has missing/duplicate id: ${opening?.id || '<empty>'}`);
      if (!['door', 'window', 'gate'].includes(opening.type))
        throw new Error(`golden extraOpening has unknown type: ${opening.type}`);
      known.add(opening.id);
    }
    space.openings = [...(space.openings || []), ...structuredClone(scenario.extraOpenings)];
  }
  if (scenario.hideOpenings) {
    const space = requireSpace();
    space.settings = { ...(space.settings || {}), hide_openings: true };
  }
  if (scenario.roomGlow) {
    const space = requireSpace();
    const unknown = new Set(Object.keys(scenario.roomGlow));
    for (const room of space.rooms) {
      if (!(room.id in scenario.roomGlow)) continue;
      unknown.delete(room.id);
      room.settings = { ...(room.settings || {}), glow: scenario.roomGlow[room.id] };
    }
    if (unknown.size) throw new Error(`golden roomGlow references missing room(s): ${[...unknown].join(', ')}`);
  }
  if (scenario.roomCustomFill) {
    const space = requireSpace();
    const unknown = new Set(Object.keys(scenario.roomCustomFill));
    for (const room of space.rooms) {
      if (!(room.id in scenario.roomCustomFill)) continue;
      unknown.delete(room.id);
      room.settings = { ...(room.settings || {}), custom_fill: scenario.roomCustomFill[room.id] };
    }
    if (unknown.size)
      throw new Error(`golden roomCustomFill references missing room(s): ${[...unknown].join(', ')}`);
  }
  if (scenario.allLightsOff) {
    for (const [entityId, state] of Object.entries(fixture.states || {})) {
      if (!entityId.startsWith('light.')) continue;
      fixture.states[entityId] = { ...state, state: 'off' };
    }
  }
  if (scenario.stateOverrides) {
    for (const [entityId, override] of Object.entries(scenario.stateOverrides)) {
      const current = fixture.states?.[entityId];
      if (!current) throw new Error(`golden stateOverride references missing entity: ${entityId}`);
      fixture.states[entityId] = {
        ...current,
        ...structuredClone(override),
        attributes: { ...(current.attributes || {}), ...(override.attributes || {}) },
      };
    }
  }
  if (scenario.markerOverrides) {
    const ids = new Set(scenario.markerOverrides.map((marker) => marker.id));
    const known = new Set((fixture.config.markers || []).map((marker) => marker.id));
    const missing = [...ids].filter((id) => !known.has(id));
    if (missing.length) throw new Error(`golden markerOverrides reference missing marker(s): ${missing.join(', ')}`);
    fixture.config.markers = [
      ...(fixture.config.markers || []).filter((marker) => !ids.has(marker.id)),
      ...structuredClone(scenario.markerOverrides),
    ];
  }
  if (scenario.layoutOverrides) {
    const missing = Object.keys(scenario.layoutOverrides).filter((id) => !(id in (fixture.layout || {})));
    if (missing.length) throw new Error(`golden layoutOverrides reference missing item(s): ${missing.join(', ')}`);
    fixture.layout = { ...(fixture.layout || {}), ...structuredClone(scenario.layoutOverrides) };
  }

  return fixture;
}

export async function prepareGoldenScenario(page, scenario) {
  await stableEnvironment(page, scenario);
  const fixture = prepareGoldenFixture(scenario);

  return page.evaluate(async ({ fixture, scenario }) => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const until = async (predicate, timeout = 10000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error(`golden scenario timed out: ${scenario.id}`);
        await wait(15);
      }
    };
    window.__goldenCard?.remove?.();
    window.__card?.remove?.();
    localStorage.clear();
    const host = document.getElementById('host');
    const cardConfig = {
      type: 'custom:houseplan-card', title: `Golden ${scenario.id}`, icon_size: 3.4,
      language: scenario.language || 'en',
    };
    const hassFor = () => ({
      language: scenario.language || 'en', locale: { language: scenario.language || 'en' },
      user: { id: 'golden', name: 'Golden fixture', is_admin: true },
      devices: fixture.devices || {}, entities: fixture.entities || {},
      areas: fixture.areas || {}, states: fixture.states || {},
      floors: {
        one: { floor_id: 'one', name: 'One', level: 0 },
        two: { floor_id: 'two', name: 'Two', level: 1 },
        three: { floor_id: 'three', name: 'Three', level: 2 },
      },
      callWS: async (message) => {
        if (message.type === 'houseplan/config/get')
          return { config: structuredClone(fixture.config), rev: 1, can_write: true };
        if (message.type === 'houseplan/layout/get')
          return { layout: structuredClone(fixture.layout || {}), rev: 1 };
        if (message.type === 'config/device_registry/list') return Object.values(fixture.devices || {});
        if (message.type === 'config/entity_registry/list') return Object.values(fixture.entities || {});
        if (message.type === 'config_entries/get')
          return [{ entry_id: 'golden_entry', domain: 'houseplan_golden', title: 'Golden fixture' }];
        if (message.type === 'manifest/list')
          return [{ domain: 'houseplan_golden', name: 'House Plan Golden' }];
        return { ok: true };
      },
      callService: async () => undefined,
      connection: { subscribeEvents: async () => () => undefined, subscribeMessage: async () => () => undefined },
      localize: () => null,
      formatEntityState: (state) => state.state,
      config: { unit_system: { length: 'km' } },
    });
    const mount = async () => {
      const card = document.createElement('houseplan-card');
      card.setConfig(cardConfig);
      host.replaceChildren(card);
      card.hass = hassFor();
      await until(() => card._loadOk && card._model?.length === fixture.config.spaces.length);
      await card.updateComplete;
      const expectedDevices = Object.keys(fixture.devices || {}).length;
      if (expectedDevices) await until(() => card._devices?.length >= expectedDevices);
      await until(() => card._booting === false);
      await frame();
      return card;
    };

    let card = await mount();
    if (scenario.warmRemount) {
      card.remove();
      await wait(0);
      card = await mount();
    }
    window.__goldenCard = card;
    if (scenario.space && card._space !== scenario.space) {
      card._pickSpace(scenario.space);
      await card.updateComplete;
    }
    if (scenario.mode) {
      card._setMode(scenario.mode);
      await card.updateComplete;
    }
    if (Number.isFinite(scenario.zoom)) {
      card._applyView(scenario.zoom, 500, 500);
      card.requestUpdate();
      await card.updateComplete;
    }
    if (scenario.editorTray) {
      let expectedKind = '';
      if (scenario.editorTray === 'plan-selection') {
        card._physicalSel = { kind: 'partition', id: 'geo-partition-h' };
        expectedKind = 'selection';
      } else if (scenario.editorTray === 'plan-tool') {
        card._physicalSel = null;
        card._tool = 'draw';
        expectedKind = 'tool';
      } else if (scenario.editorTray === 'decor-selection') {
        card._decorTool = 'select';
        card._decorSel = 'geo-axis-h';
        expectedKind = 'selection';
      } else if (scenario.editorTray === 'decor-tool') {
        card._decorSel = null;
        card._decorTool = 'line';
        expectedKind = 'tool';
      } else if (scenario.editorTray === 'furniture-palette') {
        card._decorSel = null;
        card._furnPalette = null;
        card._editorSecondary.openPalette();
        card._decorTool = 'furniture';
        expectedKind = 'palette';
      } else if (scenario.editorTray === 'group') {
        const group = {
          id: 'golden-group', label: 'Arrange', icon: 'mdi:shape-outline', items: [
            { id: 'align', label: 'Align', icon: 'mdi:format-align-center', role: 'command', invoke: () => undefined },
            { id: 'distribute', label: 'Distribute', icon: 'mdi:format-horizontal-align-center', role: 'command', invoke: () => undefined },
          ],
        };
        Object.defineProperty(card, '_editorToolbarGroups', {
          configurable: true,
          get: () => [group],
        });
        card.requestUpdate();
        await card.updateComplete;
        card._editorSecondary.toggleGroup(card._editorToolbarGroups, group.id);
        expectedKind = 'group';
      } else {
        throw new Error(`unknown golden editor tray: ${scenario.editorTray}`);
      }
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      const tray = card.renderRoot.querySelector(
        `.editor-secondary-host.open .editor-secondary.kind-${expectedKind}`,
      );
      if (!tray) throw new Error(`golden editor tray did not open: ${scenario.editorTray}`);
    }
    if (scenario.hoverRoom) {
      const room = card._spaceModel().rooms.find((item) => item.id === scenario.hoverRoom);
      if (!room) throw new Error(`golden hover room missing: ${scenario.hoverRoom}`);
      card._hoverRoom = { space: card._space, room };
      card.requestUpdate();
      await card.updateComplete;
    }
    if (scenario.dialog === 'device') {
      card._setMode('devices');
      await card.updateComplete;
      const device = card._devices.find((item) => item.id === scenario.deviceId);
      if (!device) throw new Error(`golden device missing: ${scenario.deviceId}`);
      card._openMarkerDialog(device);
      await card.updateComplete;
      if (scenario.deviceLightControls) {
        card._setMarkerLightRole('always');
        await card.updateComplete;
        card._setMarkerGlowMode('fixed');
        await card.updateComplete;
        const dialog = card.renderRoot.querySelector('hp-dialog');
        const body = dialog?.querySelector('.body');
        const groups = [...(dialog?.querySelectorAll('.markerlightgroup') || [])];
        const roleInputs = groups[0]?.querySelectorAll('input[name="marker-light-role"]');
        const glowInputs = groups[1]?.querySelectorAll('input[name="marker-glow-mode"]');
        const color = groups[1]?.querySelector('hp-color-opacity');
        const brightness = groups[1]?.querySelector('input[type="range"]');
        const radius = dialog?.querySelector('#marker-glow-radius');
        if (!body || groups.length !== 2 || roleInputs?.length !== 3 || glowInputs?.length !== 3
          || !roleInputs[1]?.checked || !glowInputs[2]?.checked
          || !color || color.disabled || !brightness || brightness.disabled || !radius || radius.disabled)
          throw new Error('golden device light-source controls are incomplete');
        const bodyRect = body.getBoundingClientRect();
        const roleRect = groups[0].getBoundingClientRect();
        body.scrollTop += roleRect.top - bodyRect.top - 8;
        await frame();
        const visibleBody = body.getBoundingClientRect();
        const visibleRole = groups[0].getBoundingClientRect();
        const visibleRadius = radius.getBoundingClientRect();
        if (visibleRole.top < visibleBody.top - 1 || visibleRadius.bottom > visibleBody.bottom + 1)
          throw new Error('golden viewport does not show the complete device light-source controls');
      }
      if (scenario.openHelp) {
        const help = card.renderRoot.querySelector(`hp-help[data-help-key="${scenario.openHelp}"]`);
        await help?.updateComplete;
        const trigger = help?.renderRoot?.querySelector('.trigger');
        if (!trigger) throw new Error(`golden help trigger missing: ${scenario.openHelp}`);
        trigger.click();
        await help.updateComplete;
        await frame();
        const surface = help.renderRoot?.querySelector('.tooltip:popover-open')
          || card.renderRoot.querySelector('hp-dialog')?.renderRoot
            ?.querySelector('[data-hp-overlay="help"]')?.shadowRoot?.querySelector('.tooltip');
        if (trigger.getAttribute('aria-expanded') !== 'true' || !surface?.getBoundingClientRect().width)
          throw new Error(`golden help surface did not open: ${scenario.openHelp}`);
      }
      if (scenario.focusDialogClose) {
        const dialog = card.renderRoot.querySelector('hp-dialog');
        await dialog?.updateComplete;
        dialog?.renderRoot?.querySelector('.close')?.focus();
      }
    } else if (scenario.dialog === 'backup-full' || scenario.dialog === 'backup-space') {
      const full = scenario.dialog === 'backup-full';
      card._backupImportDialog = {
        filename: full ? 'houseplan-full-2026-08-11.json' : 'houseplan-space-ground.json',
        size: 12345,
        token: 'golden-token',
        preview: {
          kind: full ? 'full' : 'space', source: full ? 'foreign' : 'same',
          created_at: '2026-08-11T10:00:00Z', space_title: 'Ground (2)',
          counts: { spaces: 1, rooms: 4, markers: 12, layout: 15 },
          duplicates: full ? 0 : 2,
          confirmation_required: full,
          content: full
            ? [{ url: '/api/houseplan/content/plans/_/ground.svg', state: 'detach_required' }]
            : [{ url: 'https://example.test/ground.svg', state: 'external' }],
        },
        expectedConfigRev: 1, expectedLayoutRev: 1,
        duplicatePolicy: 'skip', confirmMissing: false, busy: false, error: '',
      };
      card.requestUpdate();
      await card.updateComplete;
    } else if (scenario.dialog === 'decor-color') {
      card._setMode('decor');
      card._decorTool = 'select';
      await card.updateComplete;
      const shape = card._decorList.find((item) => item.kind === 'line');
      if (!shape) throw new Error('golden decor line missing');
      card._decorShapeDbl(new MouseEvent('dblclick'), shape);
      await card.updateComplete;
      const dialog = card.renderRoot.querySelector('hp-dialog');
      const picker = dialog?.querySelector('hp-color-opacity');
      await picker?.updateComplete;
      const trigger = picker?.renderRoot?.querySelector('.trigger');
      if (!trigger) throw new Error('golden decor color trigger missing');
      trigger.click();
      await picker.updateComplete;
    }
    await document.fonts?.ready;
    await frame();
    return {
      space: card._space,
      mode: card._mode,
      devices: card._devices.length,
      dialog: !!card.renderRoot.querySelector('hp-dialog'),
      helpOpen: [...card.renderRoot.querySelectorAll('hp-help')]
        .some((help) => help.renderRoot?.querySelector('.trigger')?.getAttribute('aria-expanded') === 'true'),
      editorTray: card.renderRoot.querySelector('.editor-secondary-host.open .editor-secondary')
        ?.className || '',
    };
  }, { fixture, scenario });
}

export async function goldenClip(page, capture) {
  if (capture === 'page') return null;
  return page.evaluate(() => {
    const card = window.__goldenCard;
    const target = card?.renderRoot?.querySelector('.stage');
    if (!target) throw new Error('golden stage capture target missing');
    const rect = target.getBoundingClientRect();
    const pad = 2;
    const x = Math.max(0, Math.floor(rect.left - pad));
    const y = Math.max(0, Math.floor(rect.top - pad));
    const right = Math.min(window.innerWidth, Math.ceil(rect.right + pad));
    const bottom = Math.min(window.innerHeight, Math.ceil(rect.bottom + pad));
    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  });
}
