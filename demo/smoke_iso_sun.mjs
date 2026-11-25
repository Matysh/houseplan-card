// 3D sunlight uses the same exterior windows, room clipping and hard gates as Flat.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 900 }, 1, [], { reducedMotion: 'no-preference' });
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const t = window.__hpTest;
  const sr = () => c.renderRoot;
  const setSun = async (azimuth, elevation) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: elevation > 0 ? 'above_horizon' : 'below_horizon',
      attributes: { azimuth, elevation, rising: azimuth <= 180 },
    } } };
    await t.settled();
  };
  const setFloor = (color) => t.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.settings = { ...(space.settings || {}), fill_mode: 'custom', custom_fill: { c: color, a: 1 } };
    return cfg;
  });
  const flatWedges = () => [...sr().querySelectorAll('.sunlayer:not(.iso-sunwash) polygon')];
  const solar = () => c._plan3dHost ? c._plan3dPresentation.world.lights.filter(light => light.sun) : [];
  const litIds = () => [...new Set(solar().map(light => light.id.split(':')[1]))].sort();
  const beams = () => c._isoSunCache?.beams ?? [];
  const south = () => beams().find(beam => beam.openingId === 'wS');

  await t.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.openings = [
      { id: 'wN', type: 'window', x: 0.30, y: 0.14, angle: 0, length: 0.08 },
      { id: 'wE', type: 'window', x: 0.96, y: 0.60, angle: 90, length: 0.08 },
      { id: 'wS', type: 'window', x: 0.30, y: 0.86, angle: 0, length: 0.08 },
      { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 },
      { id: 'wI', type: 'window', x: 0.55, y: 0.30, angle: 90, length: 0.08 },
      { id: 'dS', type: 'door', x: 0.20, y: 0.86, angle: 0, length: 0.1 },
    ];
    space.settings = { ...(space.settings || {}), show_borders: true, glow_enabled: true };
    cfg.settings = { ...(cfg.settings || {}), sun_rays: true, north_deg: 0 };
    return cfg;
  });
  await setFloor('#737777');

  // Flat reference: the wedges and their exact markup.
  await setSun(180, 30);
  const flatLit = (c._sunRaysCache?.rays || []).map((r) => r.openingId).sort();
  const flatMarkup = sr().querySelector('.sunlayer')?.outerHTML ?? '';
  out.flatHasWedges = flatWedges().length > 0 && solar().length === 0;

  await t.setVolumetricView(true);
  await setSun(180, 30);
  out.washReplacesWedges = solar().some(light => light.intensity > 0) && flatWedges().length === 0;
  out.sameWindowsAsSunRays = JSON.stringify(litIds()) === JSON.stringify(flatLit) && flatLit.length > 0;
  out.interiorWindowDark = !litIds().includes('wI');

  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const until = async (predicate) => {
    const deadline = performance.now() + 6500;
    while (!predicate()) {
      if (performance.now() > deadline) throw Error('3D solar transition did not settle');
      await frame();
    }
  };
  const painted = () => c._plan3dHost.light.frame(performance.now()).sources.filter(light => light.sun);
  const toggleLamp = async () => {
    const state = c.hass.states['light.ceiling'];
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'light.ceiling': { ...state, state: state.state === 'on' ? 'off' : 'on' } } };
    await t.settled();
  };
  await until(() => painted().some(light => light.intensity === .62));
  const stable = JSON.stringify(painted());
  await toggleLamp();
  out.settledSunPreservedOnLampOff = JSON.stringify(painted()) === stable;
  await toggleLamp();
  out.settledSunPreservedOnLampOn = JSON.stringify(painted()) === stable;

  await setSun(180, 2);
  const falling = painted().find(light => light.id.startsWith('sun:wS:'));
  await toggleLamp();
  const stillFalling = painted().find(light => light.id === falling?.id);
  out.solarFadeNotRestartedOnLamp = falling?.intensity > 0 && stillFalling?.intensity > 0
    && stillFalling.intensity <= falling.intensity && stillFalling.radius === falling.radius;
  await until(() => painted().every(light => light.intensity === 0));
  await setSun(180, 30);
  await until(() => painted().some(light => light.intensity === .62));

  // Length from the elevation: L(e) ∝ clamp(1.865·(0.55 + 1.4·(1 − e/90)^1.6), 0.98, 4.16).
  const L = (e) => Math.min(4.16, Math.max(0.98, 1.865 * (0.55 + 1.4 * (1 - e / 90) ** 1.6)));
  await setSun(180, 10);
  const low = south()?.depth;
  await setSun(180, 60);
  const high = south()?.depth;
  out.lengthFollowsElevation = Math.abs(low / high - L(10) / L(60)) < 0.01;

  // Parallelogram along the sun: the far edge slides the other way when the sun crosses south.
  await setSun(150, 30);
  const east = Math.sign(south()?.shift[0]);
  await setSun(210, 30);
  const west = Math.sign(south()?.shift[0]);
  out.shearFollowsSun = east !== 0 && west === -east;
  out.clippedToRoom = solar().every(light => light.visible.length > 0);

  // The same physical bodies as Flat cut the beam (CODE-REVIEW-649-r1 M1): a
  // Solid partition across the south beam removes the floor behind it.
  const litArea = () => (south()?.polys ?? []).reduce((sum, points) => sum + Math.abs(points.reduce((acc, point, i) => {
    const next = points[(i + 1) % points.length];
    return acc + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2, 0);
  await setSun(180, 30);
  const openArea = litArea();
  await t.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.partitions = [...(space.partitions || []), { id: 'sun-cut', a: [0.22, 0.76], b: [0.38, 0.76], cm: 15 }];
    return cfg;
  });
  await setSun(180, 31);
  const cutArea = litArea();
  out.bodyCutsTheBeam = openArea > 0 && cutArea > 0 && cutArea < openArea * 0.9;
  await t.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.partitions = (space.partitions || []).filter((item) => item.id !== 'sun-cut');
    return cfg;
  });
  await setSun(180, 30);
  out.beamBackWithoutBody = Math.abs(litArea() - openArea) < 1;

  const dark = solar()[0];
  out.darkFloorWarmWhite = dark?.color === '#ffe9b4' && dark.intensity === .62;
  await setFloor('#eee8de');
  await setSun(210, 30);
  const light = solar()[0];
  out.lightFloorAmber = light?.color === '#e2b95e' && light.intensity === .46;

  // Gates of sun_rays: below 3° nothing, night nothing, feature off nothing.
  await setSun(180, 2);
  out.lowSunHidden = solar().every(light => light.intensity === 0);
  await setSun(180, -8);
  out.nightEmpty = solar().length === 0 && flatWedges().length === 0;
  await t.setServerConfig((cfg) => { cfg.settings = { ...cfg.settings, sun_rays: false }; return cfg; });
  await setSun(180, 30);
  out.featureOffEmpty = solar().length === 0 && painted().length === 0;
  await t.setServerConfig((cfg) => { cfg.settings = { ...cfg.settings, sun_rays: true }; return cfg; });
  await setSun(180, 30);

  // Editors draw no light.
  await t.setMode('plan');
  while(c._modeTransitionBusy || c._modeTransitionPreparing) await new Promise(resolve=>requestAnimationFrame(resolve));
  out.editorNoLight = solar().length === 0 && flatWedges().length === 0;
  await t.setMode('view');

  // Back to Flat: the same wedges, byte for byte.
  await setFloor('#737777');
  await t.setVolumetricView(false);
  await setSun(180, 30);
  out.flatWedgesUnchanged = solar().length === 0 && (sr().querySelector('.sunlayer')?.outerHTML ?? '') === flatMarkup;
  return out;
});
checkAll(res);
await finish(browser, res);
