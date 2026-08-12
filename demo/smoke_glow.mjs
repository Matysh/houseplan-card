import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const spId = c._space;
  // включить glow-режим
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'glow' } })) };
  c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250));
  // 1) legacy glow переносится в отдельный base-overlay, не в data-fill комнат
  const modelRooms = c._spaceModel().rooms.length;
  out.dataFillSeparated = sr().querySelectorAll('.room.filled').length === 0;
  out.glowBaseRooms = sr().querySelectorAll('.glow-base-layer .glow-base').length === modelRooms;
  // 2) пятна от включённых ламп
  const litLight = c._devices.find((d) => d.space === spId && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on'));
  out.hasLitLight = !!litLight;
  out.spots = sr().querySelectorAll('.glowlayer circle').length;
  out.spotsMatchLights = out.spots === c._devices.filter((d) => d.space === spId && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on')).length;
  // 3) выключение лампы плавно гасит пятно и удаляет его после 500 мс
  const eid = litLight.entities.find((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on');
  const st0 = c.hass.states[eid];
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: { ...st0, state: 'off' } } };
  await c.updateComplete;
  const leavingSpot = sr().querySelector('.glow-spot.is-leaving');
  out.spotFadesOut = !!leavingSpot
    && getComputedStyle(leavingSpot).transitionDuration.split(',').some((v) => v.trim() === '0.5s');
  await new Promise((r) => setTimeout(r, 550));
  out.spotGone = sr().querySelectorAll('.glowlayer circle').length === out.spots - 1;
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: st0 } }; await c.updateComplete;
  const returningSpot = [...sr().querySelectorAll('.glow-spot')]
    .find((node) => node.dataset.glowSource === eid);
  out.spotFadesIn = !!returningSpot
    && !returningSpot.classList.contains('is-leaving')
    && getComputedStyle(returningSpot).transitionDuration.split(',').some((v) => v.trim() === '0.5s');
  // 4) rgb-лампа красит градиент своим цветом (форсируем rgb у лампы)
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: { ...st0, state: 'on', attributes: { ...st0.attributes, rgb_color: [255, 0, 0] } } } };
  await c.updateComplete;
  out.gradientColored = [...sr().querySelectorAll('defs radialGradient stop')].some((s2) => s2.getAttribute('stop-color') === '#ff0000');
  c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: st0 } }; await c.updateComplete;
  // 5) пятно обрезано комнатой (есть clipPath)
  out.clipped = sr().querySelectorAll('defs clipPath[id^="hp-glowclip"]').length > 0;
  // 6) дверь в соседнюю комнату → в clip добавлен сектор (2 сабпути M)
  // добавим дверь между r1 и r2 на общей стене x=0.55… найдём общую стену программно:
  const spm = c._spaceModel();
  const r1 = spm.rooms.find((r) => r.id === 'r1');
  const r2 = spm.rooms.find((r) => r.id === 'r2');
  // возьмём точку на границе r1, ближайшую к центру r2
  const c2 = c._roomCenter(r2);
  const poly1 = r1.poly || [[r1.x, r1.y], [r1.x + r1.w, r1.y], [r1.x + r1.w, r1.y + r1.h], [r1.x, r1.y + r1.h]];
  // общая стена вертикальная — дверь ставим на неё
  const H = 1000;   // square canvas
  const doorPt = (() => {
    let best = null, bd = 1e9;
    for (const [x, y] of [[550, 150], [550, 200], [550, 250]]) {
      const d2 = Math.hypot(x - c2[0], y - c2[1]);
      if (d2 < bd) { bd = d2; best = [x, y]; }
    }
    return best;
  })();
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, openings: [{ id: 'gd', type: 'door', x: doorPt[0] / 1000, y: doorPt[1] / H, angle: 90, length: 0.09 }] })) };
  c._cfgEpoch++; c._glowClipCache.clear();
  c.requestUpdate(); await c.updateComplete;
  // источник детерминированно ставим в центр r1 (двигаем реальную включённую лампу)
  const c1 = c._roomCenter(r1);
  c._layout = { ...c._layout, [litLight.id]: { s: spId, x: c1[0] / 1000, y: c1[1] / 1000 } };
  // Give the shadow assertion a real physical body. The original fixture has
  // no walls/partitions/columns, so no shadow mask can legitimately exist.
  const shadowCenter = [
    c1[0] + (doorPt[0] - c1[0]) * 0.35,
    c1[1] + (doorPt[1] - c1[1]) * 0.35,
  ];
  // радиус 6 м, чтобы дверь заведомо была в зоне досягаемости
  c._serverCfg = {
    ...c._serverCfg,
    settings: { ...(c._serverCfg.settings || {}), glow_radius_cm: 600 },
    spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
      ...s,
      wall_columns: [
        ...(s.wall_columns || []).filter((column) => column.id !== 'glow-shadow-column'),
        {
          id: 'glow-shadow-column', shape: 'circle', cm: 30,
          center: [shadowCenter[0] / 1000, shadowCenter[1] / H],
        },
      ],
    })),
  };
  c._cfgEpoch++; c._glowClipCache.clear();
  c.requestUpdate(); await c.updateComplete;
  // One source, one shape: the floor this lamp can see. A doorway, the room
  // behind it and the shadow of a column are the same region, so they can never
  // disagree — which is what every earlier bug in this area was made of.
  const litClips = [...sr().querySelectorAll('defs clipPath[id^="hp-glowclip"]')];
  const pool = sr().querySelector('.glow-pool');
  out.poolLimitedToVisibleFloor = !!pool
    && litClips.length > 0
    && litClips.every((cp) => cp.querySelectorAll('path.glow-lit').length === 1)
    && !!pool.getAttribute('clip-path');
  // A spot paints one primitive through one region. A second layer (a spill
  // path, an ambient wash, a shadow mask of its own) is exactly how "the
  // attribute is there but nothing renders" became possible.
  out.singleLayerPerSource = [...sr().querySelectorAll('.glow-spot')].every((spot) => (
    spot.children.length === 1 && spot.firstElementChild?.classList.contains('glow-pool')
  ));
  // Exactly one blur in the light layer, and only as the penumbra of that one
  // region: a hair on screen, never a soft sector pasted over the plan.
  const glowFilters = [...sr().querySelectorAll('defs filter[id^="hp-glow"]')];
  const pools = sr().querySelector('.glow-pools');
  const frameFilter = sr().querySelector('.glow-pools-frame')?.getAttribute('filter');
  const featherTemporarilySuspended = frameFilter === null
    && Date.now() < Number(c._glowFeatherSuspendUntil || 0);
  out.edgeFeatherIsAHair = glowFilters.length === 1
    && glowFilters[0].querySelectorAll('feGaussianBlur').length === 1
    && (frameFilter === 'url(#hp-glowfeather)' || featherTemporarilySuspended)
    && Number(pools?.dataset.featherPx) > 0 && Number(pools?.dataset.featherPx) <= 3
    && [...sr().querySelectorAll('.glowlayer [mask], .glow-pools [filter]')].length === 0;
  // Дверь наружу: свет через неё не выходит — есть проём, но за ним нет пола.
  const minX = Math.min(...poly1.map((p) => p[0]));
  const yMid = (Math.min(...poly1.map((p) => p[1])) + Math.max(...poly1.map((p) => p[1]))) / 2;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, openings: [{ id: 'gd2', type: 'door', x: minX / 1000, y: yMid / 1000, angle: 90, length: 0.09 }] })) };
  c._cfgEpoch++; c._glowClipCache.clear();
  c.requestUpdate(); await c.updateComplete;
  const roomsBox = (() => {
    const xs = [], ys = [];
    for (const room of c._spaceModel().rooms) {
      for (const point of (c._roomPolyOf?.(room) || room.poly
        || [[room.x, room.y], [room.x + room.w, room.y + room.h]])) {
        xs.push(point[0]); ys.push(point[1]);
      }
    }
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  })();
  const clipNumbers = [...sr().querySelectorAll('defs clipPath[id^="hp-glowclip"] path.glow-lit')]
    .flatMap((p) => (p.getAttribute('d').match(/-?\d+(?:\.\d+)?/g) || []).map(Number));
  const slack = c._cmToUnits(20);
  out.entranceKeepsLightIndoors = clipNumbers.length > 0
    && clipNumbers.every((value, index) => (index % 2 === 0
      ? value >= roomsBox.minX - slack && value <= roomsBox.maxX + slack
      : value >= roomsBox.minY - slack && value <= roomsBox.maxY + slack));
  // Nothing behind it to light, so for light a front door is masonry like a
  // window: it must not change the lit region at all. Half a lit tunnel — up
  // to the centreline, where the room polygon ends — is the failure mode.
  const litPath = () => [...sr().querySelectorAll('defs clipPath[id^="hp-glowclip"] path.glow-lit')]
    .map((p) => p.getAttribute('d')).join('|');
  const withEntrance = litPath();
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== spId ? s : ({
    ...s, openings: [] })) };
  c._cfgEpoch++; c._glowClipCache.clear();
  c.requestUpdate(); await c.updateComplete;
  out.entranceChangesNothing = withEntrance.length > 0 && litPath() === withEntrance;
  // 6б) профиль градиента: монотонное затухание по всему радиусу. Плато до
  // 70% превращало любую обрезанную форму в плашку сплошного цвета с каймой —
  // именно так сектор в соседней комнате и читался как «залито непонятно чем».
  const gradient = [...sr().querySelectorAll('defs radialGradient')][0];
  const offs = gradient
    ? [...gradient.querySelectorAll('stop')].map((st2) => [
      Number(String(st2.getAttribute('offset')).replace('%', '')),
      Number(st2.getAttribute('stop-opacity')),
    ])
    : [];
  const at = (percent) => {
    for (let i = 1; i < offs.length; i++) {
      if (offs[i][0] >= percent) {
        const span = offs[i][0] - offs[i - 1][0] || 1;
        const k = (percent - offs[i - 1][0]) / span;
        return offs[i - 1][1] + (offs[i][1] - offs[i - 1][1]) * k;
      }
    }
    return offs.length ? offs[offs.length - 1][1] : 0;
  };
  out.falloffMonotonic = offs.length >= 4
    && offs[0][0] === 0 && offs[0][1] > 0
    && offs[offs.length - 1][0] === 100 && offs[offs.length - 1][1] === 0
    && offs.every((stop, i) => i === 0 || (stop[0] > offs[i - 1][0] && stop[1] < offs[i - 1][1]))
    && at(70) <= offs[0][1] * 0.75;
  // Tri-state role is live: Auto -> Never -> Auto removes and restores only
  // this marker's own spatial pool.
  const litMarkerId = litLight.id;
  const litBinding = litLight.bindingKind === 'virtual'
    ? 'virtual'
    : litLight.bindingKind + ':' + litLight.bindingRef;
  const autoSpotCount = sr().querySelectorAll('.glowlayer circle').length;
  c._serverCfg = { ...c._serverCfg, markers: [
    ...(c._serverCfg.markers || []).filter((m) => m.id !== litMarkerId),
    { id: litMarkerId, binding: litBinding, is_light: false },
  ] };
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.roleNeverHidesOwnPool = sr().querySelectorAll('.glowlayer circle').length === autoSpotCount - 1;
  c._serverCfg = { ...c._serverCfg, markers: (c._serverCfg.markers || []).filter((m) => m.id !== litMarkerId) };
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  out.roleAutoRestoresOwnPool = sr().querySelectorAll('.glowlayer circle').length === autoSpotCount;
  // 7а) персональный радиус источника перекрывает глобальный
  c._serverCfg = { ...c._serverCfg, markers: [
    ...(c._serverCfg.markers || []).filter((m) => m.id !== litMarkerId),
    {
      id: litMarkerId,
      binding: litBinding,
      glow_radius_cm: 150,
      glow_color: { c: '#123456', bri: 0.25 },
    },
  ] };
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const rOwn = Number(sr().querySelector('.glowlayer circle')?.getAttribute('r'));
  out.perSourceRadius = Math.abs(rOwn - c._cmToUnits(150)) < 0.5;
  const ownStop = sr().querySelector('defs radialGradient stop');
  out.perSourceAppearance = ownStop?.getAttribute('stop-color') === '#123456'
    && Math.abs(Number(ownStop.getAttribute('stop-opacity')) - 0.428) < 0.002
    && !sr().querySelector('.glow-pools-frame')?.hasAttribute('opacity');
  c._serverCfg = { ...c._serverCfg, markers: (c._serverCfg.markers || []).filter((m) => m.id !== litMarkerId) };
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  // 6в) флаг «источник света»: умный выключатель с обычными светильниками
  const swDev = c._devices.find((d) => d.space === spId && d.entities.some((e) => e.startsWith('switch.')));
  if (swDev) {
    const swEid = swDev.entities.find((e) => e.startsWith('switch.'));
    c.hass = { ...c.hass, states: { ...c.hass.states, [swEid]: { ...c.hass.states[swEid], state: 'on' } } };
    const spotsBefore = sr().querySelectorAll('.glowlayer circle').length;
    c._serverCfg = { ...c._serverCfg, markers: [
      ...(c._serverCfg.markers || []).filter((m) => m.id !== swDev.id),
      { id: swDev.id, binding: swDev.bindingKind + ':' + swDev.bindingRef, is_light: true },
    ] };
    c._regSignature = ''; c._maybeRebuildDevices(); c._saveConfig(); c.requestUpdate(); await c.updateComplete;
    out.switchGlows = sr().querySelectorAll('.glowlayer circle').length === spotsBefore + 1;
    c._serverCfg = { ...c._serverCfg, markers: (c._serverCfg.markers || []).filter((m) => m.id !== swDev.id) };
    c._regSignature = ''; c._maybeRebuildDevices(); c._saveConfig(); c.requestUpdate(); await c.updateComplete;
    out.switchGlowsOffByDefault = sr().querySelectorAll('.glowlayer circle').length === spotsBefore;
  } else { out.switchGlows = 'no-switch'; out.switchGlowsOffByDefault = 'no-switch'; }
  // 7) радиус из настроек: 600 см против 300 см — вдвое больше
  const r600 = Number(sr().querySelector('.glowlayer circle')?.getAttribute('r'));
  c._serverCfg = { ...c._serverCfg, settings: { ...(c._serverCfg.settings || {}), glow_radius_cm: 300 } };
  c.requestUpdate(); await c.updateComplete;
  const r300 = Number(sr().querySelector('.glowlayer circle')?.getAttribute('r'));
  out.radiusReacts = Math.abs(r600 / r300 - 2) < 0.01;
  // Hover must not promote a filtered SVG sibling and flash the screen-blended
  // Glow layer. The pool/gradient nodes stay alive and hover uses plain SVG.
  const poolBeforeHover = sr().querySelector('.glow-pool');
  const gradientBeforeHover = sr().querySelector('radialGradient[id^="hp-glow-"]');
  const roomEl = sr().querySelector('.room');
  roomEl?.dispatchEvent(new MouseEvent('mouseenter'));
  await c.updateComplete;
  const hoverFill = sr().querySelector('.room-hover-fill');
  const hoverFillLayer = sr().querySelector('.room-hover-fill-layer');
  const hoverHalo = sr().querySelector('.room-hover-halo');
  const hoverOutline = sr().querySelector('.room-hover-outline');
  const hoverOutlineLayer = sr().querySelector('.room-hover-outline-layer');
  const glowLayer = sr().querySelector('.glow-pools-frame');
  const wallLayer = sr().querySelector('.wallbodies');
  out.hoverKeepsGlowDom = poolBeforeHover === sr().querySelector('.glow-pool')
    && gradientBeforeHover === sr().querySelector('radialGradient[id^="hp-glow-"]');
  out.hoverUsesPlainSvg = !!roomEl && !!hoverFill && !!hoverHalo && !!hoverOutline
    && getComputedStyle(roomEl).filter === 'none'
    && getComputedStyle(hoverHalo).filter === 'none'
    && getComputedStyle(hoverOutline).filter === 'none';
  const fillStyle = hoverFill ? getComputedStyle(hoverFill) : null;
  out.hoverUsesNeutralDarkening = fillStyle?.fill === 'rgb(0, 0, 0)'
    && Math.abs(Number(fillStyle.fillOpacity) - 0.22) < 0.001;
  out.hoverLayerOrder = !!hoverFillLayer && !!glowLayer && !!hoverOutlineLayer
    && !!(hoverFillLayer.compareDocumentPosition(glowLayer) & Node.DOCUMENT_POSITION_FOLLOWING)
    // The default smoke fixture has no thick wall body. When one exists, the
    // late outline must follow it; absence is not a layer-order failure.
    && (!wallLayer
      || !!(wallLayer.compareDocumentPosition(hoverOutlineLayer) & Node.DOCUMENT_POSITION_FOLLOWING));
  roomEl?.dispatchEvent(new MouseEvent('mouseleave'));
  await c.updateComplete;
  return out;
});

// A deterministic opaque-floor scene guards the two bugs which survived the
// old DOM-only assertions: separate physical shadows and visible spill at
// every valid doorway. It intentionally uses thick walls and two receiving
// rooms, then compares actual stage pixels with the mask/light toggled.
const rasterFixture = await page.evaluate(async () => {
  const c = window.__card;
  const root = c.shadowRoot || c.renderRoot;
  const spaceId = c._space;
  const source = c._devices.find((device) => device.id === 'd_light1');
  const sourceEid = source?.entities.find((eid) => eid.startsWith('light.'));
  const current = c._serverCfg.spaces.find((space) => space.id === spaceId);
  if (!source || !sourceEid || !current) return { ready: false };

  const edgeKey = (a, b) => `${a.join(',')}/${b.join(',')}`;
  const wallKey = (a, b) => {
    const pitch = 1 / 240;
    const q = (value) => Math.round(value / pitch) * pitch;
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) {
      dx = -dx; dy = -dy;
    }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    const angleBucket = Math.round(angle * 1800) / 1800;
    return `${q((a[0] + b[0]) / 2).toFixed(6)},${q((a[1] + b[1]) / 2).toFixed(6)}@${angleBucket.toFixed(4)}`;
  };
  const edges = new Map();
  for (const room of current.rooms || []) {
    for (let index = 0; index < room.poly.length; index++) {
      const a = room.poly[index];
      const b = room.poly[(index + 1) % room.poly.length];
      const reverse = edgeKey(b, a);
      if (!edges.has(reverse) && !edges.has(edgeKey(a, b))) edges.set(edgeKey(a, b), { a, b });
    }
  }
  const walls = [...edges.values()].map(({ a, b }) => ({
    key: wallKey(a, b), a, b, cm: 15,
  }));
  const openings = [
    { id: 'glow-raster-east', type: 'door', x: 0.55, y: 0.32, angle: 90, length: 0.09 },
    { id: 'glow-raster-south', type: 'door', x: 0.32, y: 0.58, angle: 0, length: 0.09 },
  ];
  const wallSource = [...edges.values()]
    .map(({ a, b }) => ({
      point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      clearance: Math.min(...openings.map((opening) => Math.hypot(
        (a[0] + b[0]) / 2 - opening.x, (a[1] + b[1]) / 2 - opening.y,
      ))),
    }))
    .sort((left, right) => right.clearance - left.clearance)[0]?.point;
  c._serverCfg = {
    ...c._serverCfg,
    settings: { ...(c._serverCfg.settings || {}), glow_radius_cm: 600 },
    markers: (c._serverCfg.markers || []).filter((marker) => marker.id !== source.id),
    spaces: c._serverCfg.spaces.map((space) => space.id !== spaceId ? space : ({
      ...space,
      settings: {
        ...(space.settings || {}), fill_mode: 'custom',
        custom_fill: { c: '#3f4854', a: 1 }, glow_enabled: true, sun_rays: false,
      },
      walls,
      openings,
      open_spans: [],
      wall_columns: [{
        id: 'glow-raster-column', shape: 'circle', cm: 60, center: [0.18, 0.30],
      }],
      partitions: [],
    })),
  };
  c._layout = { ...c._layout, [source.id]: { s: spaceId, x: 0.295, y: 0.36 } };
  const states = { ...c.hass.states };
  for (const [eid, state] of Object.entries(states)) {
    if (eid.startsWith('light.')) states[eid] = { ...state, state: 'off' };
  }
  states[sourceEid] = {
    ...states[sourceEid], state: 'on',
    attributes: { ...(states[sourceEid]?.attributes || {}), brightness: 255, rgb_color: [255, 196, 112] },
  };
  c.hass = { ...c.hass, states };
  c._cfgEpoch++;
  c._glowClipCache.clear();
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.requestUpdate();
  await c.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 600));

  const freeze = document.createElement('style');
  freeze.dataset.glowSmokeFreeze = 'true';
  freeze.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
  root.querySelector('[data-glow-smoke-freeze]')?.remove();
  root.append(freeze);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const pools = [...root.querySelectorAll('.glow-pool[clip-path]')];
  const litParts = pools.length > 0 && pools.every((node) => {
    const clipId = node.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
    const path = clipId ? root.getElementById(clipId)?.querySelector('path.glow-lit') : null;
    // Every lit part is a subpath of the one clipped shape.
    return !!path && (path.getAttribute('d').match(/M/g) || []).length
      >= Number(node.dataset.litParts);
  });
  const stage = root.querySelector('.stage');
  const svg = stage?.querySelector('svg');
  const matrix = svg?.getScreenCTM();
  if (!pools.length || !stage || !svg || !matrix) {
    return { ready: false, litParts, sourceEid };
  }
  const stageRect = stage.getBoundingClientRect();
  const toStage = (point) => {
    const mapped = new DOMPoint(point[0], point[1]).matrixTransform(matrix);
    return [mapped.x - stageRect.left, mapped.y - stageRect.top];
  };
  const sourcePos = c._pos(source);
  const openingById = new Map(c._openingsR.map((opening) => [opening.id, opening]));
  const wallDepth = c._cmToUnits(15);
  const doors = openings.map((stored) => {
    const opening = openingById.get(stored.id);
    if (!opening) return null;
    const radians = opening.angle * Math.PI / 180;
    const tangent = [Math.cos(radians), Math.sin(radians)];
    const normal = [-tangent[1], tangent[0]];
    const sourceSide = ((sourcePos.x - opening.rx) * normal[0]
      + (sourcePos.y - opening.ry) * normal[1]) >= 0 ? 1 : -1;
    const outward = [-normal[0] * sourceSide, -normal[1] * sourceSide];
    const after = wallDepth / 2 + Math.max(6, c._gridPitch * 0.6);
    const sampleCenter = [opening.rx + outward[0] * after, opening.ry + outward[1] * after];
    const scan = [];
    for (let offset = -opening.rlen * 2.5; offset <= opening.rlen * 2.5; offset += 2) {
      scan.push({
        offset,
        point: toStage([
          sampleCenter[0] + tangent[0] * offset,
          sampleCenter[1] + tangent[1] * offset,
        ]),
      });
    }
    // Inside the aperture itself. An unlit bar here is what disconnected the
    // pool from its own beam and made a doorway read as a red plug (#71).
    const tunnel = [-0.3, -0.15, 0, 0.15, 0.3].map((share) => toStage([
      opening.rx + tangent[0] * opening.rlen * share,
      opening.ry + tangent[1] * opening.rlen * share,
    ]));
    return {
      id: opening.id,
      openingLength: opening.rlen,
      sample: toStage(sampleCenter),
      tunnel,
      scan,
    };
  }).filter(Boolean);
  // The column: behind it there must be no light, beside it there must be, and
  // the border between the two must be a line — not a 45 cm gradient.
  const column = (c._curSpaceCfg.wall_columns || [])[0];
  let shadow = null;
  if (column) {
    const centre = [column.center[0] * 1000, column.center[1] * c._spaceH];
    const radius = c._cmToUnits(column.cm) / 2;
    const away = Math.hypot(centre[0] - sourcePos.x, centre[1] - sourcePos.y);
    const base = Math.atan2(centre[1] - sourcePos.y, centre[0] - sourcePos.x);
    const half = Math.asin(Math.max(0.02, Math.min(0.9, radius / away)));
    const at = (angle, distance) => toStage([
      sourcePos.x + Math.cos(angle) * distance,
      sourcePos.y + Math.sin(angle) * distance,
    ]);
    const far = away + radius + Math.max(10, c._gridPitch);
    shadow = {
      inside: [at(base, far), at(base, away + radius * 2.2)],
      beside: [at(base + half * 4, far), at(base - half * 4, far)],
      // Across the shadow edge, one plan unit at a time.
      edge: Array.from({ length: 41 }, (_, index) => {
        const offset = (index - 20) * 1.0;
        const angle = base + half + Math.atan2(offset, far);
        return { offset, point: at(angle, far) };
      }),
    };
  }
  return { ready: true, litParts, sourceEid, sourceId: source.id, wallSource, doors, shadow };
});

if (rasterFixture.ready) {
  const stage = page.locator('houseplan-card').locator('.stage').first();
  const lightOn = await stage.screenshot({ animations: 'disabled' });
  await page.evaluate(async (sourceEid) => {
    const c = window.__card;
    const state = c.hass.states[sourceEid];
    c.hass = {
      ...c.hass,
      states: { ...c.hass.states, [sourceEid]: { ...state, state: 'off' } },
    };
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, rasterFixture.sourceEid);
  const lightOff = await stage.screenshot({ animations: 'disabled' });
  const metrics = await page.evaluate(async ({ on64, off64, doors, shadow }) => {
    const decode = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    };
    const images = await Promise.all([decode(on64), decode(off64)]);
    const width = images[0].width;
    const height = images[0].height;
    if (images.some((image) => image.width !== width || image.height !== height)) {
      return { dimensionsMatch: false, shadow: null, doors: [] };
    }
    const data = images.map((image) => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, width, height).data;
    });
    const [lit, off] = data;
    const lumaAt = (pixels, x, y) => {
      const px = Math.max(0, Math.min(width - 1, Math.round(x)));
      const py = Math.max(0, Math.min(height - 1, Math.round(y)));
      const offset = (py * width + px) * 4;
      return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
    };
    const meanLuma = (pixels, point, radius = 2) => {
      let total = 0; let count = 0;
      for (let y = point[1] - radius; y <= point[1] + radius; y++) {
        for (let x = point[0] - radius; x <= point[0] + radius; x++) {
          total += lumaAt(pixels, x, y); count++;
        }
      }
      return total / count;
    };
    const delta = (point, radius = 2) => meanLuma(lit, point, radius) - meanLuma(off, point, radius);
    const doorMetrics = doors.map((door) => {
      const beyond = door.scan.filter(({ point }) => delta(point, 1) >= 3);
      const visibleWidth = beyond.length
        ? beyond[beyond.length - 1].offset - beyond[0].offset : 0;
      // Median, not mean: the door symbol itself draws a dark line across the
      // aperture and would otherwise decide the verdict.
      const tunnelDeltas = door.tunnel
        .map((point) => delta(point, 1))
        .sort((left, right) => left - right);
      return {
        id: door.id, delta: delta(door.sample), visibleWidth,
        openingLength: door.openingLength,
        tunnelDelta: tunnelDeltas[Math.floor(tunnelDeltas.length / 2)],
      };
    });
    let shadowMetrics = null;
    if (shadow) {
      const inside = Math.max(...shadow.inside.map((point) => delta(point, 1)));
      const beside = Math.min(...shadow.beside.map((point) => delta(point, 1)));
      // Width of the lit → unlit transition, in stage pixels. A geometric edge
      // crosses it in one or two antialiased pixels; a Gaussian took tens.
      const profile = shadow.edge.map(({ offset, point }) => ({ offset, value: delta(point, 0) }));
      const high = Math.max(...profile.map((sample) => sample.value));
      const low = Math.min(...profile.map((sample) => sample.value));
      const band = profile.filter((sample) =>
        sample.value > low + (high - low) * 0.2 && sample.value < low + (high - low) * 0.8);
      shadowMetrics = {
        inside, beside, high, low,
        edgeWidth: band.length
          ? Math.abs(band[band.length - 1].offset - band[0].offset) : 0,
      };
    }
    return { dimensionsMatch: true, shadow: shadowMetrics, doors: doorMetrics };
  }, {
    on64: lightOn.toString('base64'),
    off64: lightOff.toString('base64'),
    doors: rasterFixture.doors,
    shadow: rasterFixture.shadow,
  });
  console.log('Glow raster metrics:', JSON.stringify(metrics));
  res.litPartsMatchClip = rasterFixture.litParts;
  res.doorwayCarriesLight = metrics.doors.length === 2
    && metrics.doors.every((door) => door.delta >= 8);
  res.beamWidthBounded = metrics.doors.length === 2
    && metrics.doors.every((door) => door.visibleWidth <= door.openingLength * 2);
  res.apertureItselfLit = metrics.doors.length === 2
    && metrics.doors.every((door) => door.tunnelDelta >= 8);
  // An opaque body leaves no light behind it, keeps the floor beside it lit,
  // and the border between the two is a line rather than a soft ramp.
  res.occluderCastsShadow = !!metrics.shadow
    && metrics.shadow.inside <= 3 && metrics.shadow.beside >= 8;
  res.shadowEdgeIsCrisp = !!metrics.shadow
    && metrics.shadow.high - metrics.shadow.low >= 8
    && metrics.shadow.edgeWidth <= 4;
  const sourceInsideWall = await page.evaluate(async ({ sourceEid, sourceId, wallSource }) => {
    if (!wallSource) return false;
    const c = window.__card;
    const state = c.hass.states[sourceEid];
    c._layout = {
      ...c._layout,
      [sourceId]: { s: c._space, x: wallSource[0], y: wallSource[1] },
    };
    c.hass = {
      ...c.hass,
      states: { ...c.hass.states, [sourceEid]: { ...state, state: 'on' } },
    };
    c._glowClipCache.clear();
    c.requestUpdate();
    await c.updateComplete;
    // The continuity contract may keep the last complete device frame briefly
    // while the moved source and its HA snapshot are staged atomically. Wait
    // for that bounded hand-off instead of mistaking the allowed stale frame
    // for a geometry leak.
    const root = c.shadowRoot || c.renderRoot;
    const selector = `[data-glow-source="${CSS.escape(sourceEid)}"] .glow-pool`;
    const deadline = performance.now() + 1800;
    while (root.querySelector(selector) && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      await c.updateComplete;
    }
    return !root.querySelector(selector);
  }, {
    sourceEid: rasterFixture.sourceEid,
    sourceId: rasterFixture.sourceId,
    wallSource: rasterFixture.wallSource,
  });
  res.sourceInsideWallSuppressed = sourceInsideWall;
} else {
  res.litPartsMatchClip = false;
  res.doorwayCarriesLight = false;
  res.beamWidthBounded = false;
  res.apertureItselfLit = false;
  res.occluderCastsShadow = false;
  res.shadowEdgeIsCrisp = false;
  res.sourceInsideWallSuppressed = false;
}
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "spots": 1,
});
await finish(browser, res);
