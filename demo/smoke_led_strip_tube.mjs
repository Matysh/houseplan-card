/** #788: browser witness for the visible tube, independent of the Glow field.
 * Synthetic room-wall fixtures enter through the config-event facade. Expected
 * corners come from an analytic inset/line equation below, not LED geometry.
 * Both real SVG lengths and raster pixels protect against extra miter hooks,
 * backtracking at short subdivisions and a notch through the open doorway.
 */
import { launch, check, finish } from './serve.mjs';
import { fixtureWallKey } from './fixtures/wall-key.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
// All coordinates here are render units. A 12 cm wall at 5 cm/grid cell has
// total thickness 10 units (1000/240 units/cell), hence a 5-unit inner inset.
// This plan is smaller than the documented 1000-unit icon reference floor:
// D=2.5%*1000=25, outline=.12D=3, centreline offset=1.5, core=1.5.
const left = 200.1, top = 180.2, right = 500.3, bottom = 480.4;
const offset = 1.5, outlineWidth = 3, coreWidth = 1.5;
const scenarios = [
  { name: 'decimal rectangle and door', angle: 0, tilt: 0, intermediate: false },
  { name: 'sloped side and short saved subdivision', angle: 0, tilt: 0.545461, intermediate: true },
  { name: 'rotated decimal rectangle and door', angle: 0.137, tilt: 0, intermediate: false },
];
const results = [];

await page.evaluate(async () => {
  const card = window.__card;
  card.setConfig({ ...card._config, icon_size: 2.5, language: 'en' });
  await window.__hpTest.setMode('view');
});

for (const scenario of scenarios) {
  const cos = Math.cos(scenario.angle), sin = Math.sin(scenario.angle);
  const rotate = ([x, y]) => [400 + (x - 400) * cos - (y - 330) * sin,
    330 + (x - 400) * sin + (y - 330) * cos];
  const normalise = (point) => rotate(point).map(value => value / 1000);
  const rooms = [
    { id: 'tube-room', name: 'Tube room', poly: [[left - 5, top - 5], [right + 5, top - 5],
      [right + 5, bottom + 5], [left - 5, bottom + 5]].map(normalise) },
    { id: 'receiving-room', name: 'Receiving room', poly: [[right + 5, top - 5], [755.5, top - 5],
      [755.5, bottom + 5], [right + 5, bottom + 5]].map(normalise) },
  ];
  const walls = [];
  for (const room of rooms) room.poly.forEach((a, i) => {
    const b = room.poly[(i + 1) % room.poly.length], key = fixtureWallKey(a, b);
    if (!walls.some(wall => wall.key === key)) walls.push({ key, a, b, cm: 12 });
  });
  // The doorway begins just .1 unit from the inner corner: its first face
  // piece is shorter than the tube's centreline offset. Both rooms exist, so
  // this is a real optically open door, not an opaque exterior opening.
  const door = normalise([right + 5, top + 40.1]);
  const corners = [[left + scenario.tilt, top], [left, bottom], [right, bottom], [right, top]];
  const source = [...corners, ...(scenario.intermediate ? [[right - 0.1, top]] : [])].map(normalise);
  // The free left side keeps its genuine slope; intersect it analytically
  // with y=top+offset and y=bottom-offset instead of silently straightening it.
  const expected = [[left + scenario.tilt * (1 - offset / (bottom - top)), top + offset],
    [left + scenario.tilt * offset / (bottom - top), bottom - offset],
    [right - offset, bottom - offset], [right - offset, top + offset]];
  if (!scenario.tilt) { expected[0][0] += offset; expected[1][0] += offset; }
  const expectedCorners = expected.map(rotate);
  const expectedLength = expectedCorners.reduce((length, a, i) => {
    const b = expectedCorners[(i + 1) % expectedCorners.length];
    return length + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }, 0);

  // Move the stored closure seam to every node, including the short saved
  // subdivision. The visible result must remain one four-corner tube.
  for (let start = 0; start < source.length; start++) for (const reversed of [false, true]) {
    const ordered = [...source.slice(start), ...source.slice(0, start)];
    if (reversed) ordered.reverse();
    const points = [...ordered, ordered[0]];
    await page.evaluate(async ({ rooms, walls, door, angle, points }) => {
      await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
        settings: { ...(cfg.settings || {}), volumetric_view: false },
        spaces: [{ id: 'tube-oracle', title: 'Tube oracle', cell_cm: 5, view_box: [0, 0, 1, 0.7],
          rooms, walls, wall_segments: [], partitions: [], wall_columns: [], decor: [],
          openings: [{ id: 'tube-door', type: 'door', x: door[0], y: door[1],
            angle: 90 + angle * 180 / Math.PI, length: 0.08 }],
          settings: { glow_enabled: true, fill_mode: 'none', show_names: false, sun_rays: false },
          led_strips: [{ id: 'tube', marker: 'd_light1', points }] }],
        markers: [{ id: 'd_light1', binding: 'device:d_light1', space: 'tube-oracle',
          room_id: 'tube-room', is_light: true, glow_radius_cm: 30 }],
      }));
    }, { rooms, walls, door, angle: scenario.angle, points });

    let viewShape = null;
    for (const mode of ['view', 'devices']) {
      await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
      let onShape = null;
      for (const state of ['on', 'off']) {
        // Public HA state input, not a write to the card's private resolver.
        await page.evaluate(async state => {
          const card = window.__card, previous = card.hass.states['light.ceiling'];
          // This geometry-only oracle deliberately uses a white source in
          // both states; source-colour behaviour is held by the Glow smoke.
          card.hass = { ...card.hass, states: { ...card.hass.states,
            'light.ceiling': { ...previous, state,
              attributes: { ...previous.attributes, rgb_color: [255, 255, 255] } } } };
          await window.__hpTest.settled();
        }, state);
        await page.waitForFunction(state => window.__card.shadowRoot
          .querySelector('[data-led-strip="tube"]')?.dataset.state === state, state);

        const actual = await page.evaluate(async ({ expectedCorners, outlineWidth, coreWidth }) => {
          const group = window.__card.shadowRoot.querySelector('[data-led-strip="tube"]');
          const outline = group.querySelector('.led-outline'), core = group.querySelector('.led-core');
          const d = outline.getAttribute('d');
          const corners = [...d.matchAll(/[ML]\s*([-+\d.e]+)[,\s]+([-+\d.e]+)/gi)]
            .map(match => [Number(match[1]), Number(match[2])]);
          const expectedD = expectedCorners.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + ' Z';
          const minX = Math.floor(Math.min(...expectedCorners.map(p => p[0])) - 8);
          const minY = Math.floor(Math.min(...expectedCorners.map(p => p[1])) - 8);
          const width = Math.ceil(Math.max(...expectedCorners.map(p => p[0])) - minX + 8);
          const height = Math.ceil(Math.max(...expectedCorners.map(p => p[1])) - minY + 8);
          const raster = async body => {
            const image = new Image();
            const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height * 2}" viewBox="${minX} ${minY} ${width} ${height}">${body}</svg>`;
            image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
            await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            return context.getImageData(0, 0, canvas.width, canvas.height).data;
          };
          const expectedMarkup = `<path d="${expectedD}" fill="none" stroke="#383838" stroke-width="${outlineWidth}" stroke-linecap="round" stroke-linejoin="round"/><path d="${expectedD}" fill="none" stroke="#FFFFFF" stroke-width="${coreWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
          const [painted, reference] = await Promise.all([
            raster(new XMLSerializer().serializeToString(outline) + new XMLSerializer().serializeToString(core)),
            raster(expectedMarkup),
          ]);
          let badPixels = 0;
          for (let i = 0; i < painted.length; i += 4) {
            if ([0, 1, 2, 3].some(channel => Math.abs(painted[i + channel] - reference[i + channel]) > 16)) badPixels++;
          }
          return { d, corners, closed: /Z\s*$/i.test(d), length: outline.getTotalLength(),
            widths: [Number(outline.getAttribute('stroke-width')), Number(core.getAttribute('stroke-width'))],
            coreD: core.getAttribute('d'), badPixels,
            openingPresent: !!window.__card.shadowRoot.querySelector('[data-hp="opening"][data-id="tube-door"][data-kind="door"]'),
            saved: window.__card._serverCfg.spaces[0].led_strips[0].points };
        }, { expectedCorners, outlineWidth, coreWidth });

        const label = `${scenario.name}, start=${start}, reverse=${reversed}, ${mode}, ${state}`;
        check(`${label}: four closed visible corners`, actual.closed && actual.corners.length === 4);
        check(`${label}: fixture includes the real mounted door`, actual.openingPresent);
        check(`${label}: analytical corner positions`, expectedCorners.every(p =>
          actual.corners.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-4)));
        check(`${label}: no extra travel from a hook, backtrack or door notch`, Math.abs(actual.length - expectedLength) < 0.003);
        check(`${label}: expected tube pixels`, actual.badPixels, 0);
        check(`${label}: outline/core share geometry`, actual.coreD, actual.d);
        check(`${label}: physical outline/core widths`, actual.widths, [outlineWidth, coreWidth]);
        check(`${label}: saved geometry is untouched`, actual.saved, points);
        const shape = { d: actual.d, widths: actual.widths };
        if (state === 'on') onShape = shape;
        else check(`${label}: off keeps the on shape and thickness`, shape, onShape);
        if (mode === 'view' && state === 'on') viewShape = shape;
        if (mode === 'devices') check(`${label}: Devices keeps View tube geometry`, shape, viewShape);
        results.push({ scenario: scenario.name, start, reversed, mode, state,
          corners: actual.corners.length, badPixels: actual.badPixels, lengthError: actual.length - expectedLength });
      }
    }
  }
}
await finish(browser, results);
