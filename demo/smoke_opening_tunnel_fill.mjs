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
      settings: { fill_mode: 'light' } },
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

  const tunnels = () => [...root().querySelectorAll('[data-hp="opening-tunnel"]')];
  const byId = (id) => root().querySelector(`[data-hp="opening-tunnel"][data-id="${id}"]`);
  const out = {};
  out.allThreeTypes = tunnels().length === 3;
  out.windowRepeatsColdRoom = byId('tunnel-window')?.getAttribute('fill') === '#112233'
    && (root().querySelector('[data-hp="room"][data-id="tunnel-left"]')?.getAttribute('style') || '')
      .includes('--room-fill:#112233');
  out.gateRepeatsHotRoom = byId('tunnel-gate')?.getAttribute('fill') === '#445566'
    && (root().querySelector('[data-hp="room"][data-id="tunnel-right"]')?.getAttribute('style') || '')
      .includes('--room-fill:#445566');

  const shared = byId('tunnel-door');
  const stops = [...(shared?.querySelectorAll('stop') || [])].map((s) => ({
    offset: s.getAttribute('offset'), color: s.getAttribute('stop-color'),
    opacity: s.getAttribute('stop-opacity'),
  }));
  out.sharedUsesOneHardGradient = !!shared?.querySelector('linearGradient') && stops.length === 4;
  out.sharedStopsOnWallAxis = stops[1]?.offset === '50.000000%'
    && stops[2]?.offset === '50.000000%';
  out.sharedCarriesBothRooms = new Set(stops.map((s) => s.color)).has('#112233')
    && new Set(stops.map((s) => s.color)).has('#445566');

  const svgEl = root().querySelector('.stage svg');
  const tunnelGroup = root().querySelector('.opening-tunnels');
  const wallGroup = root().querySelector('.wallbodies');
  out.layerBeforeWall = !!svgEl && !!tunnelGroup && !!wallGroup
    && !!(tunnelGroup.compareDocumentPosition(wallGroup) & Node.DOCUMENT_POSITION_FOLLOWING);

  sp.settings.hide_openings = true;
  await update();
  out.hideSymbolKeepsTunnel = root().querySelectorAll('[data-hp="opening"]').length === 0
    && tunnels().length === 3;

  sp.settings.show_borders = false;
  await update();
  out.hiddenBordersKeepTunnel = root().querySelectorAll('.wallbodies').length === 0
    && tunnels().length === 3;

  c._setMode('decor');
  await update();
  out.backdropUsesSingleGroupOpacity = tunnels().length === 3
    && getComputedStyle(root().querySelector('.opening-tunnels')).opacity === '0.35'
    && byId('tunnel-window')?.getAttribute('fill-opacity') === '0.21';

  c._setMode('plan');
  await update();
  out.planGestureCannotLeaveStalePatch = tunnels().length === 0;
  return out;
});

checkAll(result);
await finish(browser, result);
