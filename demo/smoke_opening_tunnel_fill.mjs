/**
 * Room-coloured tunnels in thick walls: door/window/gate, outer and shared
 * walls, a hard split on the wall axis, hide/show policies and editor opacity.
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();

const result = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.shadowRoot || c.renderRoot;
  const sp = c._serverCfg.spaces.find((s) => s.id === c._space);
  const update = async () => {
    c._cfgEpoch++;
    c.requestUpdate();
    await c.updateComplete;
  };
  const pitch = 1 / 240;
  const wallKey = (a, b) => {
    const q = (v) => Math.round(v / pitch) * pitch;
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    angle = Math.round(angle * 1800) / 1800;
    return `${q((a[0] + b[0]) / 2).toFixed(6)},${q((a[1] + b[1]) / 2).toFixed(6)}@${angle.toFixed(4)}`;
  };
  const wall = (a, b, cm = 20) => ({ key: wallKey(a, b), a, b, cm });

  sp.rooms = [
    { id: 'tunnel-left', name: 'Left', area: 'tunnel_left_area',
      poly: [[0.1, 0.2], [0.5, 0.2], [0.5, 0.7], [0.1, 0.7]],
      settings: { fill_mode: 'custom', custom_fill: { c: '#112233', a: 0.21 } } },
    { id: 'tunnel-right', name: 'Right', area: 'tunnel_right_area',
      poly: [[0.5, 0.2], [0.9, 0.2], [0.9, 0.7], [0.5, 0.7]],
      settings: {} },
  ];
  sp.walls = [
    wall([0.1, 0.2], [0.5, 0.2]),
    wall([0.5, 0.2], [0.5, 0.7]),
    wall([0.5, 0.7], [0.9, 0.7]),
  ];
  sp.openings = [
    { id: 'tunnel-window', type: 'window', x: 0.3, y: 0.2, angle: 0, length: 0.1 },
    { id: 'tunnel-door', type: 'door', x: 0.5, y: 0.45, angle: 90, length: 0.1 },
    { id: 'tunnel-gate', type: 'gate', x: 0.7, y: 0.7, angle: 0, length: 0.16 },
  ];
  sp.settings = { ...(sp.settings || {}), show_borders: true, hide_openings: false, fill_mode: 'glow' };
  c._serverCfg.settings = {
    ...(c._serverCfg.settings || {}),
    fill_colors: {
      ...(c._serverCfg.settings?.fill_colors || {}),
      light_none: { c: '#112233', a: 0.21 },
      glow_base: { c: '#445566', a: 0.42 },
    },
  };
  c._setMode('view');
  await update();

  const tunnels = (layer) => [...root().querySelectorAll(
    `.opening-tunnels[data-layer="${layer}"] [data-hp="opening-tunnel"]`,
  )];
  const byId = (id, layer) => root().querySelector(
    `.opening-tunnels[data-layer="${layer}"] [data-hp="opening-tunnel"][data-id="${id}"]`,
  );
  const out = {};
  out.allThreeTypes = new Set([...tunnels('data'), ...tunnels('glow-base')]
    .map((node) => node.getAttribute('data-kind'))).size === 3;
  out.windowRepeatsCustomRoom = byId('tunnel-window', 'data')?.getAttribute('fill') === '#112233'
    && (root().querySelector('[data-hp="room"][data-id="tunnel-left"]')?.getAttribute('style') || '')
      .includes('--room-fill:#112233')
    && !byId('tunnel-window', 'glow-base');
  out.gateRepeatsHotRoom = byId('tunnel-gate', 'glow-base')?.getAttribute('fill') === '#445566'
    && !!root().querySelector('.glow-base-layer [data-room-id="tunnel-right"]');

  const shared = byId('tunnel-door', 'data');
  const stops = [...(shared?.querySelectorAll('stop') || [])].map((s) => ({
    offset: s.getAttribute('offset'), color: s.getAttribute('stop-color'),
    opacity: s.getAttribute('stop-opacity'),
  }));
  out.sharedUsesOneHardGradient = !!shared?.querySelector('linearGradient') && stops.length === 4;
  out.sharedStopsOnWallAxis = stops[1]?.offset === '50.000000%'
    && stops[2]?.offset === '50.000000%';
  const sharedGlow = byId('tunnel-door', 'glow-base');
  const glowStops = [...(sharedGlow?.querySelectorAll('stop') || [])].map((s) => ({
    color: s.getAttribute('stop-color'), opacity: s.getAttribute('stop-opacity'),
  }));
  out.sharedCarriesBothRooms = new Set(stops.map((s) => s.color)).has('#112233')
    && stops.some((s) => s.color === '#000000' && s.opacity === '0')
    && glowStops.some((s) => s.color === '#445566' && s.opacity === '0.42')
    && glowStops.some((s) => s.color === '#000000' && s.opacity === '0');

  const svgEl = root().querySelector('.stage svg');
  const tunnelGroup = root().querySelector('.opening-tunnels');
  const wallGroup = root().querySelector('.wallbodies');
  out.layerBeforeWall = !!svgEl && !!tunnelGroup && !!wallGroup
    && !!(tunnelGroup.compareDocumentPosition(wallGroup) & Node.DOCUMENT_POSITION_FOLLOWING);

  sp.settings.hide_openings = true;
  await update();
  out.hideSymbolKeepsTunnel = root().querySelectorAll('[data-hp="opening"]').length === 0
    && tunnels('data').length === 2 && tunnels('glow-base').length === 2;

  sp.settings.show_borders = false;
  await update();
  out.hiddenBordersKeepTunnel = root().querySelectorAll('.wallbodies').length === 0
    && tunnels('data').length === 2 && tunnels('glow-base').length === 2;

  c._setMode('decor');
  await update();
  out.backdropUsesSingleGroupOpacity = tunnels('data').length === 2
    && tunnels('glow-base').length === 2
    && [...root().querySelectorAll('.opening-tunnels')]
      .every((group) => getComputedStyle(group).opacity === '0.35')
    && getComputedStyle(root().querySelector('.glow-base-layer')).opacity === '0.35'
    && getComputedStyle(root().querySelector('.glow-pools-frame')).opacity === '0.35'
    && byId('tunnel-window', 'data')?.getAttribute('fill-opacity') === '0.21'
    && byId('tunnel-gate', 'glow-base')?.getAttribute('fill-opacity') === '0.42';

  c._setMode('plan');
  await update();
  out.planGestureCannotLeaveStalePatch = tunnels('data').length === 0
    && tunnels('glow-base').length === 0;

  // Regression #81: atomic wall pieces, including real thickness steps, are
  // one continuous SVG surface per side. Two faces therefore mean exactly two
  // contours in one path, never a row of touching translucent rectangles.
  c._setMode('view');
  sp.rooms = [{ id: 'atomic-room', name: 'Atomic', area: 'atomic_area',
    poly: [[0.1, 0.2], [0.9, 0.2], [0.9, 0.7], [0.1, 0.7]],
    settings: { fill_mode: 'custom', custom_fill: { c: '#112233', a: 0.21 } } }];
  const atomicSegments = [[0.1, 0.3], [0.3, 0.5], [0.5, 0.7], [0.7, 0.9]];
  sp.walls = atomicSegments.map(([x0, x1]) => wall([x0, 0.2], [x1, 0.2], 15));
  sp.openings = [{ id: 'atomic-door', type: 'door', x: 0.5, y: 0.2, angle: 0, length: 0.6 }];
  sp.settings.hide_openings = true;
  sp.settings.show_borders = true;
  await update();
  const sameDepth = byId('atomic-door', 'data');
  out.equalAtomicPiecesAreOneSurface = sameDepth?.tagName.toLowerCase() === 'path'
    && ((sameDepth.getAttribute('d') || '').match(/\bM /g) || []).length === 2;

  sp.walls = atomicSegments.map(([x0, x1], index) => (
    wall([x0, 0.2], [x1, 0.2], [10, 20, 15, 15][index])
  ));
  await update();
  const stepped = byId('atomic-door', 'data');
  out.steppedAtomicPiecesAreOneSurface = stepped?.tagName.toLowerCase() === 'path'
    && ((stepped.getAttribute('d') || '').match(/\bM /g) || []).length === 2
    && stepped.getAttribute('fill-opacity') === '0.21';
  return out;
});

checkAll(result);
await finish(browser, result);
