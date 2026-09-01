import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';
import { fixtureWallKey, makeVisualMatrixFixture } from '../fixtures/visual-matrix.mjs';
import { readFileSync } from 'node:fs';

const junctionArtifactsFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/302-junction-artifacts.json', import.meta.url), 'utf8',
));
const sharpApexFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/329-sharp-apex.json', import.meta.url), 'utf8',
));
const junctionTeethFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/309-junction-teeth.json', import.meta.url), 'utf8',
));
const junctionPatchFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/197-junction-patch.json', import.meta.url), 'utf8',
));
const multiWallJunctionFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/249-multiwall-junction.json', import.meta.url), 'utf8',
));
const orthogonalStripFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/275-orthogonal-strip-containment.json', import.meta.url), 'utf8',
));
const wallKeyRoundtripFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/258-wall-key-roundtrip.json', import.meta.url), 'utf8',
));
const coincidentPartitionFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/276-coincident-partition.json', import.meta.url), 'utf8',
));
const spanOverDoorFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/316-span-over-door-migrated.json', import.meta.url), 'utf8',
));
const wallUnionIsolationFixture = JSON.parse(readFileSync(
  new URL('../../test/fixtures/278-wall-union-isolation.json', import.meta.url), 'utf8',
));
const cardVersion = JSON.parse(readFileSync(
  new URL('../../package.json', import.meta.url), 'utf8',
)).version;

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
  if (scenario.spanOverDoor) {
    // #316 §3.1: the scene renders the MIGRATED document — the door keeps its
    // carrying atom while the former span is zero (dashed) on both sides. The
    // fixture is produced by the real writer and pinned byte-for-byte by the
    // wall-segment-model unit test, so it cannot drift from the migration.
    const migrated = structuredClone(spanOverDoorFixture.migrated);
    fixture.config.model_version = migrated.model_version;
    fixture.config.spaces.push(...migrated.spaces);
  }
  if (scenario.coincidentPartition) {
    const state = scenario.coincidentPartition;
    if (!['before', 'thin', 'thick', 'virtual'].includes(state))
      throw new Error(`unknown coincidentPartition state: ${state}`);
    const space = structuredClone(coincidentPartitionFixture.spaces[0]);
    space.id = scenario.space;
    space.title = `Coincident partition ${state}`;
    space.settings = {
      fill_mode: 'none', show_borders: true, show_names: true,
    };
    if (scenario.hiddenWallDiagnostics) {
      space.room_drafts = [{
        id: 'hidden-saved-chain',
        points: [[0, 0], [0, 1]],
        segments: [{ cm: 15 }],
      }];
    }
    if (state !== 'before') {
      delete space.partitions;
      space.walls[0].cm = state === 'thin' ? 10 : state === 'thick' ? 30 : 20;
      const opening = space.openings[0];
      delete opening.host;
      opening.x = 0.504166667;
      opening.y = 0.5;
      opening.angle = -90;
      if (state === 'virtual') {
        space.open_spans = [{
          a: [0.5041666666666667, 0.004166666666666667],
          b: [0.5041666666666667, 0.9958333333333333],
        }];
      }
    }
    fixture.config.spaces.push(space);
  }
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
  if (scenario.safeResizeFixture) {
    const edge = (a, b, cm = 15) => ({
      key: fixtureWallKey(a, b), a: [...a], b: [...b], cm,
    });
    const l0 = [0.08, 0.12], lm0 = [0.50, 0.12], lm1 = [0.50, 0.55], l1 = [0.08, 0.55];
    const r0 = [0.92, 0.12], r1 = [0.92, 0.55];
    const d0 = [0.35, 0.70], d1 = [0.50, 0.62], d2 = [0.65, 0.70], d3 = [0.50, 0.82];
    fixture.config.spaces.push({
      id: scenario.space,
      title: 'Safe Resize contract',
      plan_url: null,
      view_box: [0, 0, 1, 1],
      cell_cm: 1,
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
      rooms: [
        { id: 'resize-left', name: 'Resizable A', area: null, poly: [l0, lm0, lm1, l1] },
        { id: 'resize-right', name: 'Resizable B', area: null, poly: [lm0, r0, r1, lm1] },
        { id: 'resize-diagonal', name: 'Disabled diagonal', area: null, poly: [d0, d1, d2, d3] },
      ],
      walls: [
        edge(l0, lm0), edge(lm0, r0), edge(r0, r1), edge(r1, lm1),
        edge(lm1, l1), edge(l1, l0), edge(lm0, lm1),
        edge(d0, d1), edge(d1, d2), edge(d2, d3), edge(d3, d0),
      ],
      openings: [{
        id: 'resize-side-door', type: 'door', x: 0.38, y: 0.12,
        angle: 0, length: 0.08,
      }],
      partitions: [], room_drafts: [], wall_columns: [], decor: [],
    });
  }
  if (scenario.junctionNode) {
    // #302: a close-up star node. Pie-slice rooms around the centre; every
    // arm is a shared edge carrying its own thickness; a virtual arm is the
    // same edge released by an open span.
    const spec = scenario.junctionNode;
    const C = [0.5, 0.5];
    const R = 0.3;
    const arms = spec.arms
      .map((arm) => ({ ...arm, rad: (arm.deg * Math.PI) / 180 }))
      .sort((a, b) => a.deg - b.deg);
    const endOf = (arm) => [
      C[0] + Math.cos(arm.rad) * R, C[1] + Math.sin(arm.rad) * R,
    ];
    const rooms = [];
    for (let index = 0; index < arms.length; index++) {
      const a = arms[index];
      const b = arms[(index + 1) % arms.length];
      const sweep = ((b.deg - a.deg + 360) % 360) || 360;
      const arc = [];
      const steps = Math.max(1, Math.ceil(sweep / 60));
      for (let step = 0; step <= steps; step++) {
        const rad = ((a.deg + (sweep * step) / steps) * Math.PI) / 180;
        arc.push([C[0] + Math.cos(rad) * R, C[1] + Math.sin(rad) * R]);
      }
      rooms.push({
        id: `junction-slice-${index}`, name: `S${index}`, area: null,
        poly: [C.map((v) => v), ...arc],
      });
    }
    const walls = arms.map((arm) => {
      const end = endOf(arm);
      return { key: fixtureWallKey(C, end), a: [...C], b: [...end], cm: arm.cm };
    });
    const space = {
      id: scenario.space, title: 'Junction node', view_box: [0, 0, 1, 1],
      cell_cm: 5,
      rooms, walls,
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
    };
    const virtual = arms.filter((arm) => arm.virtual);
    if (virtual.length) {
      space.open_spans = virtual.map((arm) => {
        const end = endOf(arm);
        return { a: [...C], b: [...end] };
      });
    }
    if (spec.column) {
      space.wall_columns = [{
        id: 'junction-column', center: [...C], shape: 'circle', size_cm: 40,
      }];
    }
    if (spec.draft) {
      space.room_drafts = [{
        id: 'junction-draft',
        points: [[0.5, 0.5], [0.75, 0.62]],
        segments: [{ cm: 15 }],
      }];
    }
    fixture.config.spaces.push(space);
  }
  if (scenario.junctionArtifacts) {
    fixture.config.spaces.push({
      ...structuredClone(junctionArtifactsFixture),
      id: scenario.space,
      title: 'Junction artifacts repro',
      view_box: [0, 0, 1, 1],
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
    });
  }
  if (scenario.sharpApex) {
    // #329 §4: легаси-план, где вершина ≈9.9° раньше распадалась на
    // «трезубец». Сцена смотрит вплотную на остриё — фаска, складка-«бабочка»
    // и микро-ступеньки на гранях обязаны быть видимы как регресс.
    fixture.config.spaces.push({
      id: scenario.space,
      title: 'Sharp apex (legacy)',
      cell_cm: sharpApexFixture.cell_cm,
      model_version: sharpApexFixture.model_version,
      rooms: structuredClone(sharpApexFixture.rooms),
      walls: structuredClone(sharpApexFixture.walls),
      wall_segments: structuredClone(sharpApexFixture.wall_segments),
      openings: [], room_drafts: [], partitions: [], wall_columns: [],
      view_box: [3.58, 0.20, 0.40, 0.40],
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
    });
  }
  if (scenario.junctionTeeth) {
    fixture.config.spaces.push({
      id: scenario.space,
      title: 'Junction teeth repro',
      cell_cm: junctionTeethFixture.cell_cm,
      partitions: structuredClone(junctionTeethFixture.partitions),
      rooms: [],
      view_box: [0.1, 0.65, 3.05, 1.75],
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
    });
  }
  if (scenario.junctionPatchResilience) {
    if (!Array.isArray(scenario.retainedWedgeProbe)
        || scenario.retainedWedgeProbe.length !== 2
        || !scenario.retainedWedgeProbe.every(Number.isFinite)
        || !Array.isArray(scenario.absentWallProbes)
        || scenario.absentWallProbes.length < 1
        || scenario.absentWallProbes.some((point) => !Array.isArray(point)
          || point.length !== 2 || !point.every(Number.isFinite))) {
      throw new Error(`invalid golden retainedWedgeProbe: ${scenario.id}`);
    }
    fixture.config.spaces.push({
      ...structuredClone(junctionPatchFixture),
      id: scenario.space,
      title: 'Junction patch resilience',
      view_box: [0, 0, 1, 1],
      settings: {
        ...(junctionPatchFixture.settings || {}),
        fill_mode: 'none',
        show_borders: true,
        show_names: false,
      },
    });
  }
  if (scenario.wallUnionIsolation) {
    const source = wallUnionIsolationFixture.config.spaces[0];
    fixture.config.spaces.push({
      ...structuredClone(source),
      id: scenario.space,
      title: 'Wall union isolation',
      settings: {
        ...(source.settings || {}), fill_mode: 'none', show_borders: true, show_names: false,
      },
    });
  }
  if (scenario.multiWallJunction) {
    const contract = scenario.multiWallJunction;
    const validPoint = (point) => Array.isArray(point) && point.length === 2
      && point.every(Number.isFinite);
    if (!validPoint(contract.node) || !validPoint(contract.retainedOverlapProbe)
        || !Number.isInteger(contract.rays) || contract.rays < 3
        || !Number.isInteger(contract.enclosedHoles) || contract.enclosedHoles < 0) {
      throw new Error(`invalid golden multiWallJunction: ${scenario.id}`);
    }
    fixture.config.spaces.push({
      ...structuredClone(multiWallJunctionFixture),
      id: scenario.space,
      title: 'Multi-wall bevel',
      view_box: [0.27, 0.07, 0.20, 0.21],
      settings: {
        ...(multiWallJunctionFixture.settings || {}),
        fill_mode: 'none', show_borders: true, show_names: false,
      },
    });
  }
  if (scenario.orthogonalStripContainment) {
    const contract = scenario.orthogonalStripContainment;
    const source = orthogonalStripFixture.cases.find((item) => item.id === contract.caseId);
    if (!source || !Number.isInteger(contract.minSamples) || contract.minSamples < 1
        || !Array.isArray(source.nodes) || !source.nodes.length) {
      throw new Error(`invalid golden orthogonalStripContainment: ${scenario.id}`);
    }
    const xs = source.rooms.flatMap((room) => room.poly.map((point) => point[0]));
    const ys = source.rooms.flatMap((room) => room.poly.map((point) => point[1]));
    const pad = 0.08;
    fixture.config.spaces.push({
      ...structuredClone(source),
      id: scenario.space,
      title: 'Orthogonal strip containment',
      view_box: [
        Math.min(...xs) - pad,
        Math.min(...ys) - pad,
        Math.max(...xs) - Math.min(...xs) + pad * 2,
        Math.max(...ys) - Math.min(...ys) + pad * 2,
      ],
      settings: {
        ...(source.settings || {}),
        fill_mode: 'none', show_borders: true, show_names: false,
      },
    });
  }
  if (scenario.wallKeyRoundtrip) {
    const contract = scenario.wallKeyRoundtrip;
    const validPoint = (point) => Array.isArray(point) && point.length === 2
      && point.every(Number.isFinite);
    if (contract.variant !== 'affected' || !validPoint(contract.node)
        || !validPoint(contract.incidentArm)) {
      throw new Error(`invalid golden wallKeyRoundtrip: ${scenario.id}`);
    }
    const space = structuredClone(wallKeyRoundtripFixture.space);
    space.id = scenario.space;
    space.title = 'Wall key storage round-trip';
    space.walls[0].key = wallKeyRoundtripFixture.affected_key;
    fixture.config.spaces.push(space);
  }
  if (scenario.openingSymbolContract) {
    const contract = scenario.openingSymbolContract;
    if (!['room', 'partition'].includes(contract.kind)
        || !['flat', 'iso'].includes(contract.surface)
        || !(contract.wallCm > 0)
        || !Array.isArray(contract.openings) || !contract.openings.length) {
      throw new Error(`invalid golden openingSymbolContract: ${scenario.id}`);
    }
    const seen = new Set();
    for (const opening of contract.openings) {
      if (!opening?.id || seen.has(opening.id)
          || !['door', 'window', 'gate'].includes(opening.type)
          || !Number.isFinite(opening.at) || !Number.isFinite(opening.length)
          || !(opening.length > 0) || opening.offset !== 'center'
          || typeof opening.flipV !== 'boolean') {
        throw new Error(`invalid golden opening symbol entry: ${opening?.id || '<empty>'}`);
      }
      seen.add(opening.id);
    }
    const tl = [0.08, 0.08], tr = [0.92, 0.08];
    const mr = [0.92, 0.50], br = [0.92, 0.92];
    const bl = [0.08, 0.92], ml = [0.08, 0.50];
    const wall = (a, b, cm = 15) => ({
      key: fixtureWallKey(a, b), a: [...a], b: [...b], cm,
    });
    let rooms;
    let walls;
    let partitions;
    let openings;
    if (contract.kind === 'room') {
      rooms = [
        { id: 'golden-opening-upper', name: 'Upper', area: null,
          poly: [tl, tr, mr, ml].map((point) => [...point]) },
        { id: 'golden-opening-lower', name: 'Lower', area: null,
          poly: [ml, mr, br, bl].map((point) => [...point]) },
      ];
      walls = [
        wall(tl, tr), wall(tr, mr), wall(mr, ml, contract.wallCm), wall(ml, tl),
        wall(mr, br), wall(br, bl), wall(bl, ml),
      ];
      partitions = [];
      openings = contract.openings.map((opening) => ({
        id: opening.id, type: opening.type,
        x: opening.at, y: 0.50, angle: 0, length: opening.length,
        flip_v: opening.flipV,
      }));
    } else {
      if (!Array.isArray(contract.a) || !Array.isArray(contract.b)
          || contract.a.length !== 2 || contract.b.length !== 2
          || ![...contract.a, ...contract.b].every(Number.isFinite)) {
        throw new Error(`invalid golden diagonal partition: ${scenario.id}`);
      }
      rooms = [{ id: 'golden-opening-room', name: 'Opening symbols', area: null,
        poly: [tl, tr, br, bl].map((point) => [...point]) }];
      walls = [wall(tl, tr), wall(tr, br), wall(br, bl), wall(bl, tl)];
      const a = contract.a, b = contract.b;
      partitions = [{
        id: 'golden-opening-partition', a: [...a], b: [...b], cm: contract.wallCm,
      }];
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      openings = contract.openings.map((opening) => ({
        id: opening.id, type: opening.type,
        x: a[0] + (b[0] - a[0]) * opening.at,
        y: a[1] + (b[1] - a[1]) * opening.at,
        angle, length: opening.length, flip_v: opening.flipV,
        host: { kind: 'partition', id: 'golden-opening-partition', t: opening.at },
      }));
    }
    fixture.config.spaces.push({
      id: scenario.space,
      title: 'Opening symbol contract',
      plan_url: null,
      view_box: [0, 0, 1, 1],
      cell_cm: 5,
      settings: { fill_mode: 'none', show_borders: true, show_names: false },
      rooms, walls, partitions, openings, wall_columns: [], decor: [],
    });
  }
  const requireSpace = () => {
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    if (!space) throw new Error(`golden override references missing space: ${scenario.space}`);
    return space;
  };
  if (scenario.roomLabelParity) {
    const space = requireSpace();
    if (space.id !== 'golden-lighting' || space.rooms.length !== 2)
      throw new Error(`golden roomLabelParity requires the two-room lighting fixture: ${space.id}`);
    space.settings = {
      ...(space.settings || {}),
      show_names: true,
      label_temp: true,
      label_hum: true,
      label_lqi: true,
      label_light: true,
    };
    fixture.layout = {
      ...(fixture.layout || {}),
      'rl_light-left': { s: space.id, x: 0.28, y: 0.24 },
      'rl_light-right': { s: space.id, x: 0.72, y: 0.24 },
    };
  }
  if (scenario.deviceName) {
    if (!scenario.deviceId || !fixture.devices?.[scenario.deviceId])
      throw new Error(`golden deviceName references missing device: ${scenario.deviceId || '<empty>'}`);
    fixture.devices[scenario.deviceId].name = scenario.deviceName;
  }
  if (scenario.fillMode || scenario.bgMode || typeof scenario.glowEnabled === 'boolean'
      || typeof scenario.sunRays === 'boolean' || typeof scenario.showBorders === 'boolean'
      || typeof scenario.showNames === 'boolean'
      || typeof scenario.northDeg === 'number') {
    const space = requireSpace();
    space.settings = {
      ...(space.settings || {}),
      ...(scenario.fillMode ? { fill_mode: scenario.fillMode } : {}),
      ...(scenario.bgMode ? { bg_mode: scenario.bgMode } : {}),
      ...(typeof scenario.glowEnabled === 'boolean' ? { glow_enabled: scenario.glowEnabled } : {}),
      ...(typeof scenario.sunRays === 'boolean' ? { sun_rays: scenario.sunRays } : {}),
      ...(typeof scenario.showBorders === 'boolean' ? { show_borders: scenario.showBorders } : {}),
      ...(typeof scenario.showNames === 'boolean' ? { show_names: scenario.showNames } : {}),
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
  if (scenario.decorOverride) {
    const space = requireSpace();
    const known = new Set();
    for (const shape of scenario.decorOverride) {
      if (!shape?.id || known.has(shape.id))
        throw new Error(`golden decorOverride has missing/duplicate id: ${shape?.id || '<empty>'}`);
      if (!['line', 'rect', 'ellipse', 'text', 'furniture'].includes(shape.kind))
        throw new Error(`golden decorOverride has unknown kind: ${shape.kind}`);
      known.add(shape.id);
    }
    space.decor = structuredClone(scenario.decorOverride);
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
  if (scenario.markerAreaSnapshot) {
    fixture.config.settings = {
      ...(fixture.config.settings || {}),
      marker_area_snapshot: structuredClone(scenario.markerAreaSnapshot),
    };
  }
  if (scenario.layoutOverrides) {
    const missing = Object.keys(scenario.layoutOverrides).filter((id) => !(id in (fixture.layout || {})));
    if (missing.length) throw new Error(`golden layoutOverrides reference missing item(s): ${missing.join(', ')}`);
    fixture.layout = { ...(fixture.layout || {}), ...structuredClone(scenario.layoutOverrides) };
  }
  if (scenario.vacuumTrail) {
    const deviceId = 'golden-vacuum-trail';
    const vacuumEntity = 'vacuum.golden_vacuum_trail';
    const sourceEntity = 'camera.golden_vacuum_trail_map';
    fixture.devices[deviceId] = {
      id: deviceId, name: 'Golden vacuum trail', model: 'GOLDEN-VACUUM-TRAIL',
      area_id: 'golden_geo_sw', identifiers: [['houseplan_golden', deviceId]],
      config_entries: ['golden_entry'], entry_type: null, via_device_id: null, disabled_by: null,
    };
    fixture.entities[vacuumEntity] = {
      entity_id: vacuumEntity, device_id: deviceId, platform: 'houseplan_golden',
      config_entry_id: 'golden_entry', disabled_by: null,
    };
    fixture.entities[sourceEntity] = {
      entity_id: sourceEntity, device_id: deviceId, platform: 'houseplan_golden',
      config_entry_id: 'golden_entry', disabled_by: null,
    };
    fixture.states[vacuumEntity] = {
      entity_id: vacuumEntity, state: 'cleaning',
      attributes: { friendly_name: 'Golden vacuum trail' },
    };
    fixture.states[sourceEntity] = {
      entity_id: sourceEntity, state: 'idle', attributes: {
        friendly_name: 'Golden vacuum trail map', map_name: 'golden-trail',
        vacuum_position: { x: 850, y: 760, a: 0 },
        path: { path: structuredClone(scenario.vacuumTrail.current) },
      },
    };
    fixture.layout[deviceId] = { s: scenario.space, x: 0.12, y: 0.84 };
    fixture.config.markers = [...(fixture.config.markers || []), {
      id: deviceId, binding: `device:${deviceId}`, space: scenario.space,
      area: 'golden_geo_sw',
      vacuum: {
        source: sourceEntity, trail_mode: 'always',
        calibration: { 'golden-trail': [1, 0, 0, 0, 1, 0] },
      },
    }];
  }

  return fixture;
}

export async function prepareGoldenScenario(page, scenario) {
  await stableEnvironment(page, scenario);
  // Scenarios share one Playwright page, including its pointer position. A
  // scenario that deliberately hovers a marker must not leave the next one
  // capturing an unrelated room hover at the same viewport coordinates.
  await page.mouse.move(0, 0);
  const fixture = prepareGoldenFixture(scenario);

  const result = await page.evaluate(async ({ fixture, scenario, cardVersion }) => {
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
    const settleCamera = async (card) => {
      await until(() => !card._cameraTransition?.active, 1500);
      await card.updateComplete;
      await frame();
    };
    window.__goldenCard?.remove?.();
    window.__goldenEditor?.remove?.();
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
      type: 'custom:houseplan-card', title: `Golden ${scenario.id}`,
      icon_size: Number.isFinite(scenario.iconSize) ? scenario.iconSize : 3.4,
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
        if (message.type === 'houseplan/trail/get') return scenario.vacuumTrail ? {
          trails: { 'golden-vacuum-trail': {
            previous: {
              map_id: 'golden-trail', started: 1, ended: 2,
              points: structuredClone(scenario.vacuumTrail.previous),
            },
          } },
        } : { trails: {} };
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
      // Golden scenarios intentionally call internal editor commands directly.
      // Preload the lazy runtime for that legacy harness contract; cold-View
      // loading and retry semantics are covered by smoke_lazy_editor_chunk.
      if (!(await card._ensureEditorRuntime())) {
        throw new Error(`golden editor runtime failed to load: ${scenario.id}`);
      }
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
    // #304: the two existing hidden-wall golden scenes also guard the static
    // architectural overlay in every Plan tool. Finish in draw so the reviewed
    // pixels stay stable; a missing/changed tool projection fails before capture.
    if (scenario.hiddenWallDiagnostics) {
      const tools = [
        'select', 'draw', 'column', 'merge', 'split', 'resize',
        'opening', 'boundary', 'wallthick', 'delroom',
      ];
      const snapshot = () => {
        const overlay = card.renderRoot.querySelector('[data-hp="plan-snap-overlay"]');
        if (!overlay || overlay.getAttribute('pointer-events') !== 'none') return null;
        return JSON.stringify({
          lines: [...overlay.querySelectorAll('.plan-snap-line')].map((line) => [
            line.getAttribute('data-key'), line.getAttribute('x1'), line.getAttribute('y1'),
            line.getAttribute('x2'), line.getAttribute('y2'),
          ]),
          endpoints: [...overlay.querySelectorAll('.plan-snap-node[data-kind="endpoint"]')]
            .map((node) => [node.getAttribute('data-key'), node.getAttribute('cx'), node.getAttribute('cy')]),
        });
      };
      let expected = null;
      for (const tool of tools) {
        card._tool = tool;
        card._clearPlanSnapHover();
        card.requestUpdate();
        await card.updateComplete;
        const current = snapshot();
        if (expected == null) expected = current;
        if (!current || current !== expected) {
          throw new Error(`golden plan-axis parity failed for ${tool}: ${scenario.id}`);
        }
      }
      card._tool = 'draw';
      card.requestUpdate();
      await card.updateComplete;
      await frame();
    }
    if (scenario.wallUnionIsolation) {
      const result = card._wallUnionGeometry?.();
      const paths = [...card.renderRoot.querySelectorAll('[data-hp="wall"]')];
      // The stored #278 fixture deliberately contains near-lattice noise so
      // its unit test can exercise degraded-extra isolation. In the mounted
      // product, #291's write barrier canonicalizes that noise before this
      // integration frame: the same masonry must now unite normally.
      if (result?.status !== 'ok' || result.paths?.length !== 1
          || paths.length !== 1
          || new Set(paths.map((path) => path.dataset.component)).size !== 1) {
        throw new Error(`golden wall-union isolation contract failed: ${scenario.id}; `
          + `status=${result?.status || 'missing'}; geometryPaths=${result?.paths?.length ?? 'missing'}; `
          + `domPaths=${paths.length}; domComponents=${new Set(paths.map((path) => path.dataset.component)).size}`);
      }
    }
    if (scenario.multiWallJunction) {
      const { node, retainedOverlapProbe, enclosedHoles } = scenario.multiWallJunction;
      const wall = card.renderRoot.querySelector('[data-hp="wall"]');
      const at = (point) => new DOMPoint(point[0] * 1000, point[1] * card._spaceH);
      if (!wall?.isPointInFill?.(at(node))
          || !wall.isPointInFill(at(retainedOverlapProbe))) {
        throw new Error(`golden multi-wall bevel contract failed: ${scenario.id}`);
      }
      // A pixel threshold missed the reported triangles because they occupy a
      // tiny fraction of the whole screenshot. Inventory empty components in
      // a local window instead: flood-fill from its edge marks real room/floor
      // background, and every remaining component is an enclosed wall hole.
      const SPAN = 0.02;
      const STEP = 0.0002;
      const side = Math.round((SPAN * 2) / STEP) + 1;
      const empty = new Uint8Array(side * side);
      for (let iy = 0; iy < side; iy++) {
        for (let ix = 0; ix < side; ix++) {
          const point = [node[0] - SPAN + ix * STEP, node[1] - SPAN + iy * STEP];
          if (!wall.isPointInFill(at(point))) empty[iy * side + ix] = 1;
        }
      }
      const seen = new Uint8Array(side * side);
      const stack = [];
      const push = (ix, iy) => {
        if (ix < 0 || iy < 0 || ix >= side || iy >= side) return;
        const index = iy * side + ix;
        if (seen[index] || !empty[index]) return;
        seen[index] = 1;
        stack.push(index);
      };
      for (let index = 0; index < side; index++) {
        push(index, 0); push(index, side - 1);
        push(0, index); push(side - 1, index);
      }
      while (stack.length) {
        const index = stack.pop();
        const ix = index % side, iy = (index - ix) / side;
        push(ix + 1, iy); push(ix - 1, iy); push(ix, iy + 1); push(ix, iy - 1);
      }
      let holes = 0;
      for (let start = 0; start < empty.length; start++) {
        if (!empty[start] || seen[start]) continue;
        let size = 0;
        seen[start] = 1;
        stack.push(start);
        while (stack.length) {
          const index = stack.pop();
          size++;
          const ix = index % side, iy = (index - ix) / side;
          push(ix + 1, iy); push(ix - 1, iy); push(ix, iy + 1); push(ix, iy - 1);
        }
        if (size >= 2) holes++;
      }
      if (holes !== enclosedHoles) {
        throw new Error(`golden enclosed-hole inventory failed: ${scenario.id}`
          + ` — expected ${enclosedHoles}, found ${holes}`);
      }
    }
    if (scenario.orthogonalStripContainment) {
      const { minSamples } = scenario.orthogonalStripContainment;
      const space = card._renderCfg?.spaces?.find((item) => item.id === scenario.space);
      const wall = card.renderRoot.querySelector('[data-hp="wall"]');
      const papers = [...card.renderRoot.querySelectorAll('.hp-paper')];
      const close = (a, b, epsilon = 1e-7) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= epsilon;
      const onSegment = (point, a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const length2 = dx * dx + dy * dy;
        if (!(length2 > 0)) return false;
        const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2;
        const projected = [a[0] + dx * t, a[1] + dy * t];
        return t >= -1e-7 && t <= 1 + 1e-7 && close(point, projected, 1e-6);
      };
      const samples = [];
      for (const node of space.nodes || []) {
        const rays = [];
        for (const stored of space.walls || []) {
          if (!onSegment(node, stored.a, stored.b)) continue;
          const half = ((stored.cm / space.cell_cm) * (1000 / 240)) / 2;
          for (const endpoint of [stored.a, stored.b]) {
            const dx = (endpoint[0] - node[0]) * 1000;
            const dy = (endpoint[1] - node[1]) * 1000;
            const length = Math.hypot(dx, dy);
            if (length <= 1e-5) continue;
            rays.push({ u: [dx / length, dy / length], length, half });
          }
        }
        const protectedRays = rays.filter((ray, index) => rays.some((other, otherIndex) =>
          index !== otherIndex
          && Math.abs(ray.u[0] * other.u[0] + ray.u[1] * other.u[1]) <= 1e-9));
        const maxHalf = Math.max(0, ...protectedRays.map((ray) => ray.half));
        const radius = maxHalf * 4;
        for (const ray of protectedRays) {
          const n = [-ray.u[1], ray.u[0]];
          const tLimit = Math.min(ray.length, radius);
          const tStep = Math.max(ray.half / 5, 0.25);
          const sStep = Math.max(ray.half / 5, 0.25);
          for (let t = tStep / 2; t < tLimit - tStep / 4; t += tStep) {
            for (let s = -ray.half + sStep / 2; s < ray.half - sStep / 4; s += sStep) {
              samples.push([
                node[0] * 1000 + ray.u[0] * t + n[0] * s,
                node[1] * 1000 + ray.u[1] * t + n[1] * s,
              ]);
            }
          }
        }
      }
      const misses = samples.filter((point) => {
        const probe = new DOMPoint(point[0], point[1]);
        return !wall?.isPointInFill?.(probe)
          || !papers.some((paper) => paper.isPointInFill?.(probe));
      });
      if (samples.length < minSamples || misses.length) {
        throw new Error(`golden orthogonal-strip containment failed: ${scenario.id}`
          + ` — ${misses.length}/${samples.length} protected samples missing`);
      }
    }
    if (scenario.retainedWedgeProbe) {
      const point = new DOMPoint(
        scenario.retainedWedgeProbe[0] * 1000,
        scenario.retainedWedgeProbe[1] * card._spaceH,
      );
      const wall = card.renderRoot.querySelector('[data-hp="wall"]');
      const papers = [...card.renderRoot.querySelectorAll('.hp-paper')];
      if (!wall?.isPointInFill?.(point)
          || !papers.some((paper) => paper.isPointInFill?.(point))) {
        throw new Error(`golden retained T-junction wedge contract failed: ${scenario.id}`);
      }
      for (const absent of scenario.absentWallProbes || []) {
        const absentPoint = new DOMPoint(absent[0] * 1000, absent[1] * card._spaceH);
        if (wall?.isPointInFill?.(absentPoint)) {
          throw new Error(`golden finite multi-wall ray contract failed: ${scenario.id}`);
        }
      }
    }
    if (scenario.wallKeyRoundtrip) {
      const { node, incidentArm } = scenario.wallKeyRoundtrip;
      const wall = card.renderRoot.querySelector('[data-hp="wall"]');
      const at = (point) => new DOMPoint(point[0] * 1000, point[1] * card._spaceH);
      if (!wall?.isPointInFill?.(at(node)) || !wall.isPointInFill(at(incidentArm))) {
        throw new Error(`golden wall-key round-trip contract failed: ${scenario.id}`);
      }
    }
    if (scenario.roomLabelParity) {
      const labels = [...card.renderRoot.querySelectorAll('.roomlabel')];
      if (labels.length !== 2
          || labels.some((label) => !label.querySelector('.rlgo') || !label.querySelector('.rlmetrics'))
          || labels.some((label) => !label.querySelector('.rlmetrics')?.textContent?.trim())) {
        throw new Error(`golden room-label parity core is incomplete: ${scenario.id}`);
      }
    }
    if (scenario.projection === 'iso' && typeof card._setProjection === 'function') {
      card._setProjection('iso');
      await card.updateComplete;
      await frame();
      await until(() => card._renderProjection === 'iso');
    }
    if (Number.isFinite(scenario.zoom)) {
      const [zx, zy] = Array.isArray(scenario.zoomCenter) ? scenario.zoomCenter : [500, 500];
      card._applyView(scenario.zoom, zx, zy);
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
      if (tool !== 'draw' || !validPoint(pointer)
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
    if (scenario.safeResizePreview) {
      card._tool = 'resize';
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      const handles = [...card.renderRoot.querySelectorAll('.rszhandle')];
      const enabled = handles.filter((handle) => handle.getAttribute('aria-disabled') === 'false');
      const disabled = handles.filter((handle) => handle.getAttribute('aria-disabled') === 'true');
      const handle = enabled.find((entry) =>
        Math.abs(+entry.getAttribute('cx') - 500) < 0.5
        && Math.abs(+entry.getAttribute('cy') - 335) < 0.5);
      if (!handle || !disabled.length || disabled.some((entry) => !entry.querySelector('title'))) {
        throw new Error(`golden safe Resize handle matrix is incomplete: ${scenario.id}`);
      }
      const svgRoot = card.renderRoot.querySelector('.stage svg');
      const point = (x, y) => new DOMPoint(x, y).matrixTransform(svgRoot.getScreenCTM());
      const from = point(+handle.getAttribute('cx'), +handle.getAttribute('cy'));
      const wanted = point(250, +handle.getAttribute('cy'));
      const send = (type, at) => handle.dispatchEvent(new PointerEvent(type, {
        bubbles: true, composed: true, cancelable: true, pointerId: 277,
        pointerType: 'mouse', button: 0, isPrimary: true,
        clientX: at.x, clientY: at.y,
      }));
      send('pointerdown', from);
      send('pointermove', wanted);
      await card.updateComplete;
      await frame();
      const delta = Math.abs(card._resize?.delta || 0);
      if (!card._resize?.preview || !card._resize?.liveLabels?.length || !(delta > 0 && delta < 250)) {
        throw new Error(`golden safe Resize opening clamp did not render: ${scenario.id}`);
      }
      const resizeLengths = card._resize.liveLabels.filter((label) => label.kind === 'length');
      const resizeAreas = card._resize.liveLabels.filter((label) => label.kind === 'area');
      const measuredEdges = card.renderRoot.querySelectorAll('[data-hp="resize-measured-edge"]');
      const areaLabels = card.renderRoot.querySelectorAll('[data-hp="resize-area-label"]');
      const leaders = card.renderRoot.querySelectorAll('[data-hp="resize-area-leader"]');
      if (resizeLengths.length !== 2 || measuredEdges.length !== 2
          || resizeAreas.length !== card._resize.plan.roomIds.length
          || areaLabels.length !== resizeAreas.length || leaders.length !== resizeAreas.length) {
        throw new Error(`golden Resize measurement contract is incomplete: ${scenario.id}`);
      }
    }
    if (scenario.openingPreview) {
      const { type, pointer } = scenario.openingPreview;
      if (!['window', 'door', 'passage', 'gate'].includes(type)
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
      const expectedGeometry = type === 'passage'
        ? !!preview?.querySelector('.passage-preview-cut')
          && preview.querySelectorAll('.passage-preview-boundary').length === 2
        : !!preview?.querySelector('.op-leaf');
      if (!preview || !expectedGeometry) {
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
    if (scenario.decorSelection) {
      card._decorTool = 'select';
      card._decorSel = scenario.decorSelection;
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      const selected = card._decorList.find((shape) => shape.id === scenario.decorSelection);
      const transformFrame = card.renderRoot.querySelector('.dtframe.dtfurnitureframe');
      if (selected?.kind !== 'furniture' || !transformFrame
          || transformFrame.querySelectorAll('.dthandle.dtedge').length !== 4
          || transformFrame.querySelectorAll('.dthandle').length !== 9) {
        throw new Error(`golden furniture transform frame is incomplete: ${scenario.id}`);
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
    if (scenario.furniturePalette) {
      if (scenario.editorTray !== 'furniture-palette') {
        card._decorSel = null;
        card._furnPalette = null;
        card._furnCategory = null;
        card._editorSecondary.openPalette();
        card._decorTool = 'furniture';
      }
      if (scenario.furniturePalette === 'variants') {
        card._furnCategory = scenario.furnitureCategory || 'sofa';
      }
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      const palette = card.renderRoot.querySelector('.furnpalette');
      if (!palette) throw new Error(`golden furniture palette did not open: ${scenario.id}`);
      const selector = scenario.furniturePalette === 'variants'
        ? '.furnitem[data-symbol]'
        : '.furnitem[data-category]';
      if (!palette.querySelector(selector))
        throw new Error(`golden furniture palette level is empty: ${scenario.id}`);
    }
    if (scenario.furniturePlacementPreview) {
      const { symbol, widthCm, depthCm, pointer, free = false } = scenario.furniturePlacementPreview;
      if (typeof symbol !== 'string' || !(widthCm > 0) || !(depthCm > 0)
          || !Array.isArray(pointer) || pointer.length !== 2 || !pointer.every(Number.isFinite)) {
        throw new Error(`invalid golden furniturePlacementPreview: ${scenario.id}`);
      }
      card._decorSel = null;
      card._decorTool = 'furniture';
      card._furnCategory = null;
      card._furnPalette = { symbol, w: widthCm, h: depthCm };
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      const svgRoot = card.renderRoot.querySelector('.stage svg');
      const stageEl = card.renderRoot.querySelector('.stage');
      const screen = new DOMPoint(pointer[0] * 1000, pointer[1] * card._spaceH)
        .matrixTransform(svgRoot.getScreenCTM());
      stageEl.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, composed: true, pointerId: 993, pointerType: 'mouse',
        clientX: screen.x, clientY: screen.y, shiftKey: free,
      }));
      await card.updateComplete;
      await frame();
      const preview = card.renderRoot.querySelector('.furniture-placement-preview');
      const wall = card.renderRoot.querySelector('[data-hp="wall"]');
      const previewBeforeWall = !!wall
        && !!(preview?.compareDocumentPosition(wall) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (!preview || preview.getAttribute('data-symbol') !== symbol
          || preview.getAttribute('aria-hidden') !== 'true'
          || getComputedStyle(preview).pointerEvents !== 'none'
          || Math.abs(Number(getComputedStyle(preview).opacity) - 0.55) > 1e-6
          || !preview.closest('.decorlayer') || !previewBeforeWall) {
        throw new Error(`golden furniture placement preview contract is incomplete: ${scenario.id}`);
      }
    }
    if (scenario.hoverRoom) {
      const room = card._spaceModel().rooms.find((item) => item.id === scenario.hoverRoom);
      if (!room) throw new Error(`golden hover room missing: ${scenario.hoverRoom}`);
      card._hoverRoom = { space: card._space, room };
      card.requestUpdate();
      await card.updateComplete;
    }
    if (scenario.dialog === 'optimize-orphan-references') {
      card._openAlignDialog();
      await card.updateComplete;
      // This golden owns orphan-reference copy/layout only. The shared visual
      // fixture is intentionally v7, but wall-model migration has its own
      // semantic browser assertions; suppress that independent report row so
      // adding a model version does not invalidate this unrelated baseline.
      if (card._alignDialog?.report) {
        card._alignDialog.report.wallSegmentsMigrated = 0;
        card.requestUpdate();
        await card.updateComplete;
      }
      const dialog = card.renderRoot.querySelector('hp-dialog');
      const report = card._alignDialog?.report;
      const body = dialog?.querySelector('.body');
      if (!body || report?.markersDetached !== 1
          || report?.orphanRoomLabelsRemoved !== 0
          || report?.orphanDevicePositionsRemoved !== 1
          || report?.liveMissingPositions.length !== 2
          || !body.textContent.includes(card._t('gs.optimize_references', {
            spaces: '0', rooms: '0', positions: '0', detached: '1',
          }))
          || !body.textContent.includes(card._t('gs.optimize_orphans_removed', {
            total: '1', rooms: '0', devices: '1', groups: '0',
          }))
          || !body.textContent.includes('unresolved-floor')) {
        throw new Error('golden orphan-reference Optimize dialog is incomplete: '
          + JSON.stringify({
            markersDetached: report?.markersDetached,
            orphanRoomLabelsRemoved: report?.orphanRoomLabelsRemoved,
            orphanDevicePositionsRemoved: report?.orphanDevicePositionsRemoved,
            liveMissingPositions: report?.liveMissingPositions,
            body: body?.textContent,
          }));
      }
    } else if (scenario.dialog === 'optimize-preflight') {
      const names = [
        'Ground floor', 'Garage', card._t('gs.align_preflight_space', { n: '3' }), 'Attic',
      ];
      const failures = names.map((displayName, index) => ({
        spaceId: `golden-failure-${index + 1}`,
        displayName,
        status: 'failed',
        reason: 'wall-null',
      }));
      card._openAlignDialog();
      card._alignDialog = {
        ...card._alignDialog,
        preflight: {
          fingerprint: 'golden-optimize-preflight',
          spaces: failures,
          failures,
          ok: false,
        },
        cm: 0, where: '', changed: true, busy: false,
      };
      card.requestUpdate();
      await card.updateComplete;
      const dialog = card.renderRoot.querySelector('hp-dialog');
      const body = dialog?.querySelector('.body');
      if (!body?.textContent?.includes(names[0])
          || !body.textContent.includes(card._t('gs.align_preflight_hint'))
          || dialog.querySelector('.btn.on')) {
        throw new Error('golden Optimize preflight failure dialog is incomplete');
      }
    } else if (scenario.dialog === 'device-inbox') {
      card._setMode('devices');
      await card.updateComplete;
      await settleMode(card);
      card._openDeviceInbox();
      if (scenario.deviceInboxTab) {
        card._deviceInbox = { ...card._deviceInbox, tab: scenario.deviceInboxTab };
      }
      await card.updateComplete;
      await frame();
      const dialog = card.renderRoot.querySelector('hp-dialog.device-inbox-dialog');
      const tabs = dialog?.querySelectorAll('.device-inbox-tabs [role="tab"]');
      const rows = dialog?.querySelectorAll('.device-inbox-row');
      if (!dialog || tabs?.length !== 4 || !rows?.length) {
        throw new Error(`golden device lifecycle catalog is incomplete: ${scenario.id}`);
      }
      const body = dialog.querySelector('.device-inbox');
      if (body && body.scrollWidth > body.clientWidth + 1) {
        throw new Error(`golden device lifecycle catalog overflows horizontally: ${scenario.id}`);
      }
    } else if (scenario.dialog === 'device') {
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
          repaired_target_refs: full ? 0 : 3,
          preserved_unresolved_refs: full ? 0 : 1,
          reference_report: full ? {} : {
            remapped: {
              incoming: { 'layout.space': 4, 'room.open_to': 1 },
              target: { 'marker.space': 3 },
            },
            collisions: {},
            preservedUnresolved: { 'marker.room_id': 1 },
            droppedIncomingLinks: {},
            boundedLineages: 0,
            examples: [{
              bucket: 'preservedUnresolved', category: 'marker.room_id',
              owner: 'legacy-thermostat', reference: 'room_old-generation_deadbeef',
            }],
          },
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
    } else if (scenario.dialog === 'general-color') {
      card._openSettingsDialog();
      await card.updateComplete;
      const dialog = card.renderRoot.querySelector('hp-dialog');
      const picker = [...(dialog?.querySelectorAll('hp-color-opacity') || [])]
        .find((item) => item.label === card._t('gs.light_on'));
      await picker?.updateComplete;
      const trigger = picker?.renderRoot?.querySelector('.trigger');
      if (!trigger) throw new Error('golden general-settings color trigger missing');
      trigger.scrollIntoView({ block: 'center' });
      await frame();
      trigger.click();
      await picker.updateComplete;
    } else if (scenario.dialog === 'general-help') {
      card._openSettingsDialog();
      await card.updateComplete;
      const dialog = card.renderRoot.querySelector('hp-dialog');
      const help = dialog?.querySelector(`hp-help[data-help-key="${scenario.openHelp}"]`);
      await help?.updateComplete;
      const trigger = help?.renderRoot?.querySelector('.trigger');
      if (!dialog || !trigger)
        throw new Error(`golden general-settings help trigger missing: ${scenario.openHelp}`);
      trigger.scrollIntoView({ block: 'center', inline: 'nearest' });
      await frame();
      trigger.click();
      await help.updateComplete;
      await frame();
      const surface = help.renderRoot?.querySelector('.tooltip:popover-open')
        || dialog.renderRoot?.querySelector('[data-hp-overlay="help"]')
          ?.shadowRoot?.querySelector('.tooltip');
      const viewport = { width: innerWidth, height: innerHeight };
      const triggerRect = trigger.getBoundingClientRect();
      const surfaceRect = surface?.getBoundingClientRect();
      const inside = (rect) => !!rect && rect.left >= -1 && rect.top >= -1
        && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1;
      if (trigger.getAttribute('aria-expanded') !== 'true' || !inside(triggerRect)
          || !inside(surfaceRect) || dialog.scrollWidth > dialog.clientWidth + 1)
        throw new Error(`golden general-settings help is clipped: ${scenario.openHelp}`);
    } else if (scenario.dialog === 'support') {
      card._haIntegrationVersion = cardVersion;
      card._openSupportDialog();
      await card.updateComplete;
      const opened = card._supportDialog;
      const text = '{"format":"houseplan-support-package","version":1}\n';
      const preview = {
        token: 'a'.repeat(48),
        expiresAt: Date.now() + 300_000,
        size: new TextEncoder().encode(text).byteLength,
        sha256: 'b'.repeat(64),
        spaces: 2,
        format: 'houseplan-support-package',
        version: 1,
        text,
        preparedAt: Date.now() - 60_000,
      };
      const patch = scenario.supportState === 'empty' ? {}
        : scenario.supportState === 'preview' ? {
          contact: 'user@example.test', message: 'The room light is not rendered.',
          attach: true, status: 'ready', preview,
        } : scenario.supportState === 'validation' ? {
          status: 'error', errorCode: 'validation.message_required',
        } : scenario.supportState === 'success' ? {
          contact: 'user@example.test', message: 'The room light is not rendered.',
          status: 'success', reportId: 'HP-43-GOLDEN',
        } : scenario.supportState === 'relay-error' ? {
          contact: '@houseplan-user', message: 'The report relay timed out.',
          attach: true, status: 'error', preview, errorCode: 'support_rate_limited',
        } : null;
      if (!opened || !patch) {
        throw new Error(`invalid golden support state: ${scenario.id}`);
      }
      card._supportDialog = { ...opened, ...patch };
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      const dialog = card.renderRoot.querySelector('#support-dialog');
      const body = dialog?.querySelector('.supportbody');
      const expected = scenario.supportState === 'preview' ? '.supportpreview'
        : scenario.supportState === 'validation' || scenario.supportState === 'relay-error'
          ? '#support-error'
          : scenario.supportState === 'success' ? '#support-receipt' : '.supportform';
      const focus = dialog?.querySelector(expected);
      focus?.scrollIntoView({ block: 'center', inline: 'nearest' });
      await frame();
      if (!dialog || !body || !focus || body.scrollWidth > body.clientWidth + 1
          || dialog.scrollWidth > dialog.clientWidth + 1
          || !dialog.querySelector('.aboutver')
          || dialog.querySelectorAll('a.aboutlink').length < 3) {
        throw new Error(`golden support dialog is incomplete or clipped: ${scenario.id}`);
      }
    } else if (scenario.dialog === 'device-ripple-color') {
      card._setMode('devices');
      await card.updateComplete;
      await settleMode(card);
      const device = card._devices.find((item) => item.id === scenario.deviceId);
      if (!device) throw new Error(`golden ripple device missing: ${scenario.deviceId}`);
      card._openMarkerDialog(device);
      card._markerDialog = { ...card._markerDialog, display: 'icon_ripple' };
      card.requestUpdate();
      await card.updateComplete;
      const dialog = card.renderRoot.querySelector('hp-dialog');
      const picker = [...(dialog?.querySelectorAll('hp-color-opacity') || [])]
        .find((item) => item.label === card._t('marker.activity_color'));
      await picker?.updateComplete;
      const trigger = picker?.renderRoot?.querySelector('.trigger');
      if (!trigger) throw new Error('golden ripple color trigger missing');
      trigger.scrollIntoView({ block: 'center' });
      await frame();
      trigger.click();
      await picker.updateComplete;
    } else if (scenario.dialog === 'space-room-color') {
      card._openSpaceDialog('edit', scenario.space);
      await card.updateComplete;
      const dialog = card.renderRoot.querySelector('hp-dialog');
      const picker = [...(dialog?.querySelectorAll('hp-color-opacity') || [])]
        .find((item) => item.label === card._t('space.room_color'));
      await picker?.updateComplete;
      const trigger = picker?.renderRoot?.querySelector('.trigger');
      if (!trigger) throw new Error('golden space room-color trigger missing');
      trigger.scrollIntoView({ block: 'center' });
      await frame();
      trigger.click();
      await picker.updateComplete;
    }
    if (scenario.cardEditorInvalidDefaultFloor) {
      if (!customElements.get('ha-form')) {
        customElements.define('ha-form', class GoldenHaForm extends HTMLElement {
          set data(value) { this._data = value; this._render(); }
          set schema(value) { this._schema = value; this._render(); }
          set computeLabel(value) { this._computeLabel = value; this._render(); }
          connectedCallback() { this._render(); }
          _render() {
            if (!this.isConnected || !this._schema || !this._data) return;
            this.replaceChildren(...this._schema.map((field) => {
              const row = document.createElement('label');
              row.style.cssText = 'display:grid;gap:6px;margin:0 0 14px;color:var(--primary-text-color);font-size:14px';
              const title = document.createElement('span');
              title.textContent = this._computeLabel?.(field) || field.name;
              const input = document.createElement('div');
              input.dataset.field = field.name;
              input.textContent = String(this._data[field.name] ?? '');
              input.style.cssText = 'min-height:22px;padding:10px 12px;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);font-size:16px';
              row.append(title, input);
              return row;
            }));
          }
        });
      }
      const raw = scenario.cardEditorInvalidDefaultFloor;
      const cardClass = customElements.get('houseplan-card');
      const editor = await cardClass.getConfigElement();
      editor.setConfig({
        type: 'custom:houseplan-card', title: 'Golden invalid floor',
        language: scenario.language || 'en', default_floor: raw,
      });
      editor.hass = hassFor();
      editor.style.cssText = 'display:block;box-sizing:border-box;width:720px;margin:24px auto;padding:24px;background:var(--ha-card-background);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.35)';
      host.replaceChildren(editor);
      window.__goldenEditor = editor;
      await until(() => editor._spacesAuthoritative === true);
      await editor.updateComplete;
      await frame();
      const alert = editor.renderRoot.querySelector('[role="alert"]');
      const field = [...editor.renderRoot.querySelectorAll('ha-form')]
        .map((form) => form.querySelector('[data-field="default_floor"]'))
        .find(Boolean);
      if (!alert?.textContent?.includes(raw) || field?.textContent !== raw) {
        throw new Error('golden invalid default_floor editor warning is incomplete');
      }
    }
    if (scenario.deviceClassOverrides) {
      for (const [id, classes] of Object.entries(scenario.deviceClassOverrides)) {
        const marker = card.renderRoot.querySelector(`[data-hp="device"][data-id="${CSS.escape(id)}"]`);
        if (!marker || !Array.isArray(classes) || !classes.length) {
          throw new Error(`invalid golden device class override: ${scenario.id}/${id}`);
        }
        marker.classList.add(...classes);
      }
    }
    if (scenario.deviceOnly) {
      const markers = [...card.renderRoot.querySelectorAll('[data-hp="device"]')];
      const selected = markers.find((marker) => marker.dataset.id === scenario.deviceOnly);
      if (!selected) throw new Error(`golden isolated device missing: ${scenario.deviceOnly}`);
      for (const marker of markers) marker.style.visibility = marker === selected ? 'visible' : 'hidden';
    }
    if (scenario.focusDevice) {
      const marker = card.renderRoot.querySelector(
        `[data-hp="device"][data-id="${CSS.escape(scenario.focusDevice)}"]`,
      );
      if (!marker) throw new Error(`golden focus device missing: ${scenario.focusDevice}`);
      marker.focus({ focusVisible: true });
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
    if (scenario.vacuumTrail) {
      await until(() => !!card.renderRoot.querySelector('.vactrail > path.case'));
      const currentCase = card.renderRoot.querySelector('.vactrail > path.case');
      const currentCore = card.renderRoot.querySelector('.vactrail > path.core');
      const previousCase = card.renderRoot.querySelector('.vactrail .prev path.case');
      const previousCore = card.renderRoot.querySelector('.vactrail .prev path.core');
      const currentD = currentCase?.getAttribute('d') || '';
      const previousD = previousCase?.getAttribute('d') || '';
      if ((currentD.match(/M /g) || []).length !== 2
          || (currentD.match(/Q /g) || []).length < 4
          || (previousD.match(/Q /g) || []).length < 2
          || currentD !== currentCore?.getAttribute('d')
          || previousD !== previousCore?.getAttribute('d')) {
        throw new Error(`golden vacuum trail contract is incomplete: ${scenario.id}`);
      }
    }
    await document.fonts?.ready;
    // Camera motion is intentionally visible in production, but reviewed
    // goldens own the settled UI. Never capture a timing-dependent RAF frame.
    await settleCamera(card);
    return {
      space: card._space,
      mode: card._mode,
      devices: card._devices.length,
      dialog: !!card.renderRoot.querySelector('hp-dialog'),
      helpOpen: [...card.renderRoot.querySelectorAll('hp-help')]
        .some((help) => help.renderRoot?.querySelector('.trigger')?.getAttribute('aria-expanded') === 'true'),
      editorTray: card.renderRoot.querySelector('.editor-secondary-host.open .editor-secondary')
        ?.className || '',
      defaultFloorWarning: window.__goldenEditor?.renderRoot
        ?.querySelector('[role="alert"]')?.textContent?.trim() || '',
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
  }, { fixture, scenario, cardVersion });
  if (scenario.tabDrag) {
    const drag = await page.evaluate((placement) => {
      const card = window.__goldenCard;
      const tabs = [...card.renderRoot.querySelectorAll('[data-hp="space-tab"]')];
      if (tabs.length < 3) throw new Error('golden tab drag requires at least three spaces');
      const source = placement === 'before' ? tabs.at(-1) : tabs[0];
      const target = placement === 'before' ? tabs[0] : tabs.at(-1);
      const point = (element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };
      window.__goldenTabTrustedMove = false;
      window.__goldenTabCapturedTargetId = null;
      card.renderRoot.querySelector('.tabs').addEventListener('pointermove', (event) => {
        if (!event.buttons || !event.isTrusted) return;
        window.__goldenTabTrustedMove = true;
        window.__goldenTabCapturedTargetId = event.target
          ?.closest?.('[data-hp="space-tab"]')?.dataset?.id || null;
      }, { capture: true });
      return {
        sourceId: source.dataset.id,
        targetId: target.dataset.id,
        source: point(source),
        target: point(target),
      };
    }, scenario.tabDrag);
    await page.mouse.move(drag.source.x, drag.source.y);
    await page.mouse.down();
    await page.mouse.move(drag.target.x, drag.target.y, { steps: 5 });
    const state = await page.evaluate(async ({ expected, sourceId, targetId }) => {
      const card = window.__goldenCard;
      await card.updateComplete;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const source = [...card.renderRoot.querySelectorAll('[data-hp="space-tab"]')]
        .find((tab) => tab.dataset.id === sourceId);
      const target = [...card.renderRoot.querySelectorAll('[data-hp="space-tab"]')]
        .find((tab) => tab.dataset.id === targetId);
      const targetRect = target?.getBoundingClientRect();
      const shadow = getComputedStyle(target).boxShadow;
      const insetX = Number(shadow.match(
        /([+-]?\d+(?:\.\d+)?)px\s+0px\s+0px\s+0px\s+inset/,
      )?.[1] || 0);
      const ok = window.__goldenTabTrustedMove
        && window.__goldenTabCapturedTargetId === sourceId
        && card._tabDrag?.id === sourceId
        && card._tabDrag?.targetId === targetId
        && card._tabDrag?.placement === expected
        && source?.classList.contains('dragging')
        && target?.classList.contains(`drop-${expected}`)
        && !target?.classList.contains(`drop-${expected === 'before' ? 'after' : 'before'}`)
        && targetRect?.width > 0 && targetRect?.height > 0
        && (expected === 'before' ? insetX > 0 : insetX < 0);
      return {
        ok,
        trusted: window.__goldenTabTrustedMove,
        capturedTargetId: window.__goldenTabCapturedTargetId,
        sourceId,
        targetId,
        placement: card._tabDrag?.placement || null,
        targetSize: targetRect ? [targetRect.width, targetRect.height] : null,
        insetX,
      };
    }, { expected: scenario.tabDrag, sourceId: drag.sourceId, targetId: drag.targetId });
    if (!state.ok) {
      throw new Error(`semantic golden tab drag failed: ${JSON.stringify(state)}`);
    }
    result.tabDrag = state;
  }
  if (scenario.hoverDevice) {
    const point = await page.evaluate((id) => {
      const marker = window.__goldenCard?.renderRoot?.querySelector(
        `[data-hp="device"][data-id="${CSS.escape(id)}"]`,
      );
      if (!marker) return null;
      const rect = marker.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, scenario.hoverDevice);
    if (!point) throw new Error(`golden hover device missing: ${scenario.hoverDevice}`);
    await page.mouse.move(point.x, point.y);
    if (scenario.hideHoverTooltip) {
      await page.evaluate(async () => {
        const card = window.__goldenCard;
        card._tip = null;
        card.requestUpdate();
        await card.updateComplete;
      });
    }
  }
  return result;
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
