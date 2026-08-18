import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';
import { fixtureWallKey, makeVisualMatrixFixture } from '../fixtures/visual-matrix.mjs';

const fixtureFor = (scenario) => scenario.fixture === 'large'
  ? makeLargeHouseFixture()
  : makeVisualMatrixFixture({ applianceLifecycle: !!scenario.applianceLifecycle });

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
  const fixture = fixtureFor(scenario);
  if (scenario.cornerSplitWall) {
    const stage = scenario.cornerSplitWall;
    if (!['before', 'thin', 'thick', 'zero-taper'].includes(stage))
      throw new Error(`unknown cornerSplitWall stage: ${stage}`);
    if (stage === 'zero-taper') {
      const a = [0.10, 0.10], tr = [0.90, 0.10], split = [0.90, 0.405];
      const br = [0.90, 0.80], notchBottom = [0.60, 0.80];
      const notch = [0.60, 0.40], bl = [0.10, 0.40];
      const entry = (from, to, cm) => ({
        key: fixtureWallKey(from, to), a: [...from], b: [...to], cm,
      });
      fixture.config.spaces.push({
        id: scenario.space,
        name: 'Zero-depth angled Split',
        rooms: [
          { id: 'zero-divider-main', name: 'Main room', area: null,
            poly: [a, tr, split, notch, bl] },
          { id: 'zero-divider-child', name: 'New room', area: null,
            poly: [split, br, notchBottom, notch] },
        ],
        walls: [
          entry(a, tr, 15), entry(tr, split, 15), entry(split, br, 15),
          entry(br, notchBottom, 15), entry(notchBottom, notch, 15),
          entry(notch, bl, 15), entry(bl, a, 15),
        ],
        settings: {
          show_borders: true, show_names: false,
          fill_mode: 'custom', custom_fill: { c: '#536b82', a: 0.42 },
        },
      });
      return fixture;
    }
    const a = [0.10, 0.10], tr = [0.90, 0.10], split = [0.90, 0.50];
    const br = [0.90, 0.90], bl = [0.10, 0.90];
    const entry = (from, to, cm) => ({
      key: fixtureWallKey(from, to), a: [...from], b: [...to], cm,
    });
    const before = stage === 'before';
    fixture.config.spaces.push({
      id: scenario.space,
      name: 'Corner Split',
      rooms: before
        ? [{ id: 'corner-source', name: 'Before Split', area: null, poly: [a, tr, br, bl] }]
        : [
          { id: 'corner-source', name: 'Main room', area: null, poly: [a, tr, split] },
          { id: 'corner-fresh', name: 'New room', area: null, poly: [split, br, bl, a] },
        ],
      walls: before
        ? [entry(a, tr, 15), entry(tr, br, 15), entry(br, bl, 15), entry(bl, a, 15)]
        : [
          entry(a, tr, 15), entry(tr, split, 15), entry(split, br, 15),
          entry(br, bl, 15), entry(bl, a, 15), entry(a, split, stage === 'thin' ? 15 : 100),
        ],
      settings: { show_borders: true, fill_mode: 'custom', custom_fill: { c: '#536b82', a: 0.42 } },
    });
  }
  if (scenario.wallJunctions) {
    const a = [0.06, 0.06], tr = [0.94, 0.06], br = [0.94, 0.94], bl = [0.06, 0.94];
    const entry = (from, to, cm) => ({
      key: fixtureWallKey(from, to), a: [...from], b: [...to], cm,
    });
    fixture.config.spaces.push({
      id: scenario.space,
      title: 'Wall junctions',
      plan_url: null,
      view_box: [0, 0, 1, 1],
      cell_cm: 5,
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
      rooms: [{ id: 'junction-room', name: 'Room', area: null, poly: [a, tr, br, bl] }],
      walls: [entry(a, tr, 10), entry(tr, br, 10), entry(br, bl, 10), entry(bl, a, 10)],
      partitions: [
        { id: 'junction-l-a', a: [0.16, 0.25], b: [0.38, 0.25], cm: 18 },
        { id: 'junction-l-b', a: [0.38, 0.25], b: [0.38, 0.46], cm: 30 },
        { id: 'junction-oblique-a', a: [0.58, 0.22], b: [0.78, 0.38], cm: 22 },
        { id: 'junction-oblique-b', a: [0.78, 0.38], b: [0.62, 0.52], cm: 14 },
        { id: 'junction-t-through', a: [0.18, 0.70], b: [0.78, 0.70], cm: 24 },
        { id: 'junction-t-branch', a: [0.50, 0.54], b: [0.50, 0.70], cm: 16 },
        { id: 'junction-room-branch', a: [0.30, 0.82], b: [0.30, 0.94], cm: 18 },
      ],
      room_drafts: [{
        id: 'junction-draft', points: [[0.16, 0.54], [0.30, 0.54], [0.30, 0.64]],
        segments: [{ cm: 12 }, { cm: 20 }],
      }],
      wall_columns: [],
    });
  }
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
  if (scenario.fillMode || scenario.bgMode || typeof scenario.glowEnabled === 'boolean'
      || typeof scenario.sunRays === 'boolean' || typeof scenario.showBorders === 'boolean'
      || typeof scenario.northDeg === 'number') {
    const space = requireSpace();
    space.settings = {
      ...(space.settings || {}),
      ...(scenario.fillMode ? { fill_mode: scenario.fillMode } : {}),
      ...(scenario.bgMode ? { bg_mode: scenario.bgMode } : {}),
      ...(typeof scenario.glowEnabled === 'boolean' ? { glow_enabled: scenario.glowEnabled } : {}),
      ...(typeof scenario.sunRays === 'boolean' ? { sun_rays: scenario.sunRays } : {}),
      ...(typeof scenario.showBorders === 'boolean' ? { show_borders: scenario.showBorders } : {}),
      ...(typeof scenario.northDeg === 'number' ? { north_deg: scenario.northDeg } : {}),
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
  if (scenario.openingGeometry) {
    const space = requireSpace();
    const opening = (space.openings || []).find(
      (item) => item.id === scenario.openingGeometry.id,
    );
    if (!opening || opening.type !== scenario.openingGeometry.type
        || Math.abs(Number(opening.angle) - scenario.openingGeometry.angle) > 0.001) {
      throw new Error(
        `golden openingGeometry references a missing/mismatched opening: `
        + `${scenario.openingGeometry.id}`,
      );
    }
    // This scenario must not remain byte-identical to the generic geometry
    // capture: isolate the intended diagonal symbol in the rendered fixture.
    space.openings = [opening];
  }
  if (scenario.wallReplacements?.length) {
    const space = requireSpace();
    const samePoint = (a, b) => Array.isArray(a) && Array.isArray(b)
      && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
    for (const replacement of scenario.wallReplacements) {
      const index = (space.walls || []).findIndex((wall) => (
        samePoint(wall.a, replacement.match?.a) && samePoint(wall.b, replacement.match?.b)
      ) || (
        samePoint(wall.a, replacement.match?.b) && samePoint(wall.b, replacement.match?.a)
      ));
      if (index < 0 || !replacement.segments?.length)
        throw new Error(`golden wallReplacement cannot find a valid wall in ${space.id}`);
      space.walls.splice(index, 1, ...structuredClone(replacement.segments));
    }
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
    // Runtime devices without explicit marker settings are still valid saved
    // marker targets. A visual scenario may materialize their first setting,
    // just like the real device dialog does on save.
    const known = new Set([
      ...(fixture.config.markers || []).map((marker) => marker.id),
      ...Object.keys(fixture.devices || {}),
    ]);
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
    const settleMode = async (card) => {
      await until(() => !card._modeTransitionBusy);
      await card.updateComplete;
      await frame();
    };
    window.__goldenCard?.remove?.();
    window.__card?.remove?.();
    localStorage.clear();
    history.replaceState(null, '', scenario.labs?.length
      ? `?hp-labs=${encodeURIComponent(scenario.labs.join(','))}` : location.pathname);
    if (scenario.labs?.length) {
      localStorage.setItem('houseplan_card_labs_v1', JSON.stringify(scenario.labs));
    }
    if (scenario.projection && scenario.space) {
      localStorage.setItem('houseplan_card_view_v1', JSON.stringify({
        [scenario.space]: scenario.projection,
      }));
    }
    const host = document.getElementById('host');
    const cardConfig = {
      type: 'custom:houseplan-card', title: `Golden ${scenario.id}`, icon_size: 3.4,
      language: scenario.language || 'en',
      ...(scenario.kiosk ? { kiosk: true } : {}),
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
      if (scenario.testOnlyLabsSnapshot) {
        if (!scenario.labs?.length || typeof card._onLabsSnapshot !== 'function') {
          throw new Error(`invalid test-only Labs contract: ${scenario.id}`);
        }
        // connectedCallback has already received the real (expired) registry
        // snapshot. Inject only the renderer fixture before hass/model boot so
        // fit and warm-remount follow the former live-Labs lifecycle exactly.
        card._onLabsSnapshot({ active: Object.freeze([...scenario.labs]), space: '' });
      }
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
      await settleMode(card);
    }
    if (scenario.projection === 'iso' && typeof card._setProjection === 'function') {
      card._setProjection('iso');
      await card.updateComplete;
      await frame();
      await until(() => card._renderProjection === 'iso');
    }
    if (Number.isFinite(scenario.zoom)) {
      card._applyView(scenario.zoom, 500, 500);
      card.requestUpdate();
      await card.updateComplete;
    }
    if (scenario.wallJunctionPreview) {
      const { path, pointer, cms, cm } = scenario.wallJunctionPreview;
      const validPoint = (point) => Array.isArray(point) && point.length === 2
        && point.every(Number.isFinite);
      if (!Array.isArray(path) || !path.length || !path.every(validPoint)
          || !validPoint(pointer) || !Array.isArray(cms) || !cms.every(Number.isFinite)
          || !(Number(cm) > 0)) {
        throw new Error(`invalid golden wallJunctionPreview contract: ${scenario.id}`);
      }
      card._tool = 'draw';
      card._activeDraftId = null;
      card._path = path.map((point) => [point[0] * 1000, point[1] * card._spaceH]);
      card._draftSegmentCms = [...cms];
      card._drawWallField = String(cm);
      card._cursorPt = [pointer[0] * 1000, pointer[1] * card._spaceH];
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      if (!card.renderRoot.querySelector('.drawwall-preview'))
        throw new Error(`golden wall junction preview did not render: ${scenario.id}`);
    }
    if (scenario.planSnap) {
      const { tool, anchor, pointer, expectedKind } = scenario.planSnap;
      const validPoint = (point) => Array.isArray(point) && point.length === 2
        && point.every(Number.isFinite);
      if (!['draw', 'partition'].includes(tool) || !validPoint(pointer)
          || (anchor != null && !validPoint(anchor))
          || !['endpoint', 'line'].includes(expectedKind)) {
        throw new Error(`invalid golden planSnap contract: ${scenario.id}`);
      }
      card._tool = tool;
      card._activeDraftId = null;
      card._path = anchor ? [[anchor[0] * 1000, anchor[1] * card._spaceH]] : [];
      card._clearPlanSnapHover();
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      const svgRoot = card.renderRoot.querySelector('.stage svg');
      const stage = card.renderRoot.querySelector('.stage');
      const screen = new DOMPoint(pointer[0] * 1000, pointer[1] * card._spaceH)
        .matrixTransform(svgRoot.getScreenCTM());
      stage.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, composed: true, pointerId: 992, pointerType: 'mouse',
        clientX: screen.x, clientY: screen.y,
      }));
      await card.updateComplete;
      await frame();
      const overlay = card.renderRoot.querySelector('[data-hp="plan-snap-overlay"]');
      const active = overlay?.querySelector('.plan-snap-node[data-active="true"]');
      if (!overlay || active?.getAttribute('data-kind') !== expectedKind
          || overlay.querySelectorAll('.plan-snap-node[data-active="true"]').length !== 1) {
        throw new Error(`golden plan snap candidate did not render: ${scenario.id}`);
      }
    }
    if (scenario.openingPreview) {
      const { type, pointer } = scenario.openingPreview;
      if (!['window', 'door', 'gate'].includes(type)
        || !Array.isArray(pointer) || pointer.length !== 2
        || !pointer.every(Number.isFinite)) {
        throw new Error(`invalid golden openingPreview: ${scenario.id}`);
      }
      card._activateOpeningPlacement(type);
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      // Exercise the production pointer path after the toolbar update has
      // settled. Writing `_cursorPt` before that update is racy: replacing the
      // stage under Chromium's real pointer legitimately emits pointerleave
      // and clears the preview before capture.
      const svgRoot = card.renderRoot.querySelector('.stage svg');
      const stage = card.renderRoot.querySelector('.stage');
      const screen = new DOMPoint(pointer[0] * 1000, pointer[1] * card._spaceH)
        .matrixTransform(svgRoot.getScreenCTM());
      stage.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, composed: true, pointerId: 991, pointerType: 'mouse',
        clientX: screen.x, clientY: screen.y,
      }));
      await card.updateComplete;
      await frame();
      const preview = card.renderRoot.querySelector(`.opening-preview[data-kind="${type}"]`);
      if (!preview || !preview.querySelector('.op-leaf')) {
        const intervals = card._openingPlacementIntervalsCache?.value || [];
        const nearest = intervals.map((interval) => {
          const [px, py] = card._cursorPt || [0, 0];
          const [ax, ay] = interval.a, [bx, by] = interval.b;
          const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
          return {
            a: interval.a, b: interval.b, cm: interval.cm, open: interval.open,
            kind: interval.kind,
            distance: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)),
          };
        }).sort((a, b) => a.distance - b.distance).slice(0, 3);
        throw new Error(`golden opening preview did not render: ${scenario.id}; `
          + `cursor=${JSON.stringify(card._cursorPt)} nearest=${JSON.stringify(nearest)}`);
      }
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
      await settleMode(card);
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
        const roleGroup = dialog?.querySelector('input[name="marker-light-role"]')?.closest('fieldset');
        const glowGroup = dialog?.querySelector('input[name="marker-glow-mode"]')?.closest('fieldset');
        const roleInputs = roleGroup?.querySelectorAll('input[name="marker-light-role"]');
        const glowInputs = glowGroup?.querySelectorAll('input[name="marker-glow-mode"]');
        const color = glowGroup?.querySelector('hp-color-opacity');
        const brightness = glowGroup?.querySelector('input[type="range"]');
        const radius = dialog?.querySelector('#marker-glow-radius');
        if (!body || !roleGroup || !glowGroup || roleInputs?.length !== 3 || glowInputs?.length !== 3
          || !roleInputs[1]?.checked || !glowInputs[2]?.checked
          || !color || color.disabled || !brightness || brightness.disabled || !radius || radius.disabled)
          throw new Error('golden device light-source controls are incomplete');
        const bodyRect = body.getBoundingClientRect();
        const roleRect = roleGroup.getBoundingClientRect();
        body.scrollTop += roleRect.top - bodyRect.top - 8;
        await frame();
        const visibleBody = body.getBoundingClientRect();
        const visibleRole = roleGroup.getBoundingClientRect();
        const visibleRadius = radius.getBoundingClientRect();
        if (visibleRole.top < visibleBody.top - 1 || visibleRadius.bottom > visibleBody.bottom + 1)
          throw new Error('golden viewport does not show the complete device light-source controls');
      }
      if (scenario.deviceToggleEntity) {
        const dialog = card.renderRoot.querySelector('hp-dialog');
        const body = dialog?.querySelector('.body');
        const select = dialog?.querySelector('#marker-toggle-entity');
        const warning = dialog?.querySelector('.markertoggleentity [role="status"]');
        const childLock = 'switch.golden_washer_child_lock';
        if (!body || !select || select.options.length !== 3)
          throw new Error('golden toggle-entity selector is incomplete');
        if (scenario.deviceToggleEntity === 'selected'
            && (select.value !== childLock || warning))
          throw new Error('golden selected toggle entity is not projected');
        if (scenario.deviceToggleEntity === 'stale'
            && (select.value !== '' || !warning?.textContent?.includes('switch.golden_washer_removed')))
          throw new Error('golden stale toggle entity warning is missing');
        const bodyRect = body.getBoundingClientRect();
        const selectRect = select.getBoundingClientRect();
        body.scrollTop += selectRect.top - bodyRect.top - 12;
        await frame();
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
    } else if (scenario.dialog === 'backup-export-plan-only') {
      card._openBackupExport();
      card._backupExportDialog = {
        ...card._backupExportDialog, kind: 'space', planOnly: true,
      };
      card.requestUpdate();
      await card.updateComplete;
    } else if (scenario.dialog === 'backup-full' || scenario.dialog === 'backup-space') {
      const full = scenario.dialog === 'backup-full';
      card._backupImportDialog = {
        filename: full ? 'houseplan-full-2026-08-11.json' : 'houseplan-space-ground.json',
        size: 12345,
        token: 'golden-token',
        preview: {
          kind: full ? 'full' : 'space', plan_only: !full,
          source: full ? 'foreign' : 'same',
          created_at: '2026-08-11T10:00:00Z', space_title: 'Ground (2)',
          counts: { spaces: 1, rooms: 4, markers: full ? 12 : 0, layout: full ? 15 : 4 },
          duplicates: 0,
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
      await settleMode(card);
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
    if (scenario.dayCycle) {
      const environment = card.renderRoot.querySelector('.hp-day-cycle-env');
      const active = card.renderRoot.querySelector('.hp-day-cycle-bg.active');
      const paper = card.renderRoot.querySelector('.hp-paperg');
      if (environment?.dataset.dayCyclePhase !== scenario.dayCycle.phase
          || active?.dataset.dayCycleLayer !== scenario.dayCycle.phase
          || !active?.getAttribute('style')?.includes(scenario.dayCycle.top)
          || !paper) {
        throw new Error(`golden day-cycle contract did not render: ${scenario.id}`);
      }
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
      ...(scenario.sunRayPixels ? { sun: {
        raw: card.hass?.states?.['sun.sun']?.attributes || null,
        plan: card._planHass?.states?.['sun.sun']?.attributes || null,
        render: card._renderPlanHass?.states?.['sun.sun']?.attributes || null,
        north: card._effNorth(),
        enabled: card._effSunRays(),
        editing: card._editing,
        cachedRays: card._sunRaysCache?.rays?.length || 0,
      } } : {}),
    };
  }, { fixture, scenario });
}

export async function goldenClip(page, capture) {
  if (capture === 'page') return null;
  return page.evaluate((captureKind) => {
    const card = window.__goldenCard;
    const target = card?.renderRoot?.querySelector('.stage');
    if (!target) throw new Error('golden stage capture target missing');
    const rect = target.getBoundingClientRect();
    if (captureKind === 'sun-window') {
      // Stable crop around the exterior window and the first part of its ray:
      // deliberately excludes room labels and device markers, whose font/icon
      // rasterisation would add noise unrelated to the visual contract.
      return {
        x: Math.max(0, Math.floor(rect.left + rect.width * 0.10)),
        y: Math.max(0, Math.floor(rect.top + rect.height * 0.02)),
        width: Math.max(1, Math.ceil(rect.width * 0.35)),
        height: Math.max(1, Math.ceil(rect.height * 0.25)),
      };
    }
    const pad = 2;
    const x = Math.max(0, Math.floor(rect.left - pad));
    const y = Math.max(0, Math.floor(rect.top - pad));
    const right = Math.min(window.innerWidth, Math.ceil(rect.right + pad));
    const bottom = Math.min(window.innerHeight, Math.ceil(rect.bottom + pad));
    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  }, capture);
}
