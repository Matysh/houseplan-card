// #649 п.2 (docs/SUN.md «2.5D»): in the 2.5D View the Flat window wedges give
// way to a soft wash along the real sun — the same windows and gates as
// `sun_rays`, length from the elevation, a parallelogram along the sun vector,
// tone and streaks by floor lightness, a sill line. Flat keeps its wedges
// byte for byte; editors and night draw nothing.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 900 });
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
  const wash = () => sr().querySelector('.sunlayer.iso-sunwash');
  const beams = () => [...sr().querySelectorAll('.iso-sunwash .iso-sunbeam')];
  const litIds = () => beams().map((b) => b.dataset.opening).sort();
  const gradientOf = (beam) => {
    if (!beam) return null;
    const fill = beam.querySelector('.iso-sun-fill')?.getAttribute('fill') || '';
    const id = fill.match(/url\(#([^)]+)\)/)?.[1];
    return id ? sr().getElementById?.(id) ?? sr().querySelector(`#${id}`) : null;
  };
  const depthOf = (beam) => {
    const g = gradientOf(beam);
    if (!g) return NaN;
    const n = (name) => Number(g.getAttribute(name));
    return Math.hypot(n('x2') - n('x1'), n('y2') - n('y1'));
  };
  const firstStop = (beam) => {
    const stop = gradientOf(beam)?.querySelector('stop');
    return stop ? [stop.getAttribute('stop-color'), Number(stop.getAttribute('stop-opacity'))] : null;
  };
  const shiftSign = (beam) => {
    if (!beam) return 0;
    // Far edge of the parallelogram relative to its base, along the base line.
    const pts = (beam.querySelector('.iso-sun-fill')?.getAttribute('points') || '')
      .trim().split(/\s+/).map((p) => p.split(',').map(Number));
    const sill = beam.querySelector('.iso-sun-sill');
    if (!sill) return 0;
    const ax = Number(sill.getAttribute('x1')), bx = Number(sill.getAttribute('x2'));
    const cx = pts.reduce((sum, p) => sum + p[0], 0) / (pts.length || 1);
    return Math.sign(cx - (ax + bx) / 2);
  };

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
    space.settings = { ...(space.settings || {}), show_borders: true };
    cfg.settings = { ...(cfg.settings || {}), sun_rays: true, north_deg: 0 };
    return cfg;
  });
  await setFloor('#737777');

  // Flat reference: the wedges and their exact markup.
  await setSun(180, 30);
  const flatLit = (c._sunRaysCache?.rays || []).map((r) => r.openingId).sort();
  const flatMarkup = sr().querySelector('.sunlayer')?.outerHTML ?? '';
  out.flatHasWedges = flatWedges().length > 0 && !wash();

  await t.setVolumetricView(true);
  await setSun(180, 30);
  out.washReplacesWedges = !!wash() && flatWedges().length === 0;
  out.sameWindowsAsSunRays = JSON.stringify(litIds()) === JSON.stringify(flatLit) && flatLit.length > 0;
  out.interiorWindowDark = !litIds().includes('wI');

  // Length from the elevation: L(e) ∝ clamp(1.865·(0.55 + 1.4·(1 − e/90)^1.6), 0.98, 4.16).
  const L = (e) => Math.min(4.16, Math.max(0.98, 1.865 * (0.55 + 1.4 * (1 - e / 90) ** 1.6)));
  await setSun(180, 10);
  const low = depthOf(beams().find((b) => b.dataset.opening === 'wS'));
  await setSun(180, 60);
  const high = depthOf(beams().find((b) => b.dataset.opening === 'wS'));
  out.lengthFollowsElevation = Math.abs(low / high - L(10) / L(60)) < 0.01;

  // Parallelogram along the sun: the far edge slides the other way when the sun crosses south.
  await setSun(150, 30);
  const east = shiftSign(beams().find((b) => b.dataset.opening === 'wS'));
  await setSun(210, 30);
  const west = shiftSign(beams().find((b) => b.dataset.opening === 'wS'));
  out.shearFollowsSun = east !== 0 && west === -east;
  out.clippedToRoom = beams().every((b) => /url\(#hp-iso-sun-clip-/.test(b.getAttribute('clip-path') || ''));

  // The same physical bodies as Flat cut the beam (CODE-REVIEW-649-r1 M1): a
  // Solid partition across the south beam removes the floor behind it.
  const litArea = (id) => {
    const beam = beams().find((b) => b.dataset.opening === id);
    return !beam ? 0 : [...beam.querySelectorAll('.iso-sun-fill')].reduce((sum, poly) => {
      const pts = poly.getAttribute('points').trim().split(/\s+/).map((q) => q.split(',').map(Number));
      return sum + Math.abs(pts.reduce((acc, point, i) => {
        const next = pts[(i + 1) % pts.length];
        return acc + point[0] * next[1] - next[0] * point[1];
      }, 0)) / 2;
    }, 0);
  };
  await setSun(180, 30);
  const openArea = litArea('wS');
  await t.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.partitions = [...(space.partitions || []), { id: 'sun-cut', a: [0.22, 0.76], b: [0.38, 0.76], cm: 15 }];
    return cfg;
  });
  await setSun(180, 31);
  const cutArea = litArea('wS');
  out.bodyCutsTheBeam = openArea > 0 && cutArea > 0 && cutArea < openArea * 0.9;
  await t.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.partitions = (space.partitions || []).filter((item) => item.id !== 'sun-cut');
    return cfg;
  });
  await setSun(180, 30);
  out.beamBackWithoutBody = Math.abs(litArea('wS') - openArea) < 1;

  // Tone by the floor: dark floor warm-white, no streaks; light floor amber with two streaks.
  const dark = beams()[0];
  out.darkFloorStops = !!dark && JSON.stringify(firstStop(dark)) === JSON.stringify(['#ffe9b4', 0.62])
    && dark.dataset.floor === 'dark';
  out.darkFloorNoStreaks = beams().every((b) => b.querySelectorAll('.iso-sun-streak').length === 0);
  out.darkFloorSill = beams().every((b) => b.querySelector('.iso-sun-sill')?.getAttribute('stroke') === '#fff3cf');
  await setFloor('#eee8de');
  await setSun(210, 30);
  const light = beams()[0];
  out.lightFloorStops = !!light && JSON.stringify(firstStop(light)) === JSON.stringify(['#e2b95e', 0.46])
    && light.dataset.floor === 'light';
  out.lightFloorTwoStreaks = beams().length > 0 && beams().every((b) => b.querySelectorAll('.iso-sun-streak').length === 2);
  out.lightFloorSill = beams().every((b) => b.querySelector('.iso-sun-sill')?.getAttribute('stroke') === '#efd493');

  // Gates of sun_rays: below 3° nothing, night nothing, feature off nothing.
  await setSun(180, 2);
  out.lowSunHidden = !wash() || wash().classList.contains('out') || beams().length === 0;
  await setSun(180, -8);
  out.nightEmpty = beams().length === 0 && flatWedges().length === 0;
  await t.setServerConfig((cfg) => { cfg.settings = { ...cfg.settings, sun_rays: false }; return cfg; });
  await setSun(180, 30);
  out.featureOffEmpty = beams().length === 0;
  await t.setServerConfig((cfg) => { cfg.settings = { ...cfg.settings, sun_rays: true }; return cfg; });
  await setSun(180, 30);

  // Editors draw no light.
  await t.setMode('plan');
  out.editorNoLight = beams().length === 0 && flatWedges().length === 0;
  await t.setMode('view');

  // Back to Flat: the same wedges, byte for byte.
  await setFloor('#737777');
  await t.setVolumetricView(false);
  await setSun(180, 30);
  out.flatWedgesUnchanged = !wash() && (sr().querySelector('.sunlayer')?.outerHTML ?? '') === flatMarkup;
  return out;
});
checkAll(res);
await finish(browser, res);
