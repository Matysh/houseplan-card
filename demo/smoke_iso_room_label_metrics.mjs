// #665: in 2.5D the metrics row under a room name keeps the same distance
// from the name at every zoom — the same share of the name height as in Flat.
//
// The regression: the raised label's 44 px touch floor was the label box
// itself (min-height + centring), so the name sat centred in 44 px and the
// absolutely placed metrics row hung (44 - name height) / 2 below it. The
// distance therefore shrank as zooming in grew the font. The floor now lives
// in ::before; this smoke measures the painted boxes and the hit target.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.renderRoot;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  // Metrics rows need an explicit opt-in; the demo fixture shows names only.
  for (const config of [card._serverCfg, card._config].filter(Boolean)) {
    for (const space of config.spaces || []) {
      space.settings = { ...(space.settings || {}), show_names: true, label_temp: true, label_light: true };
    }
  }
  card.requestUpdate();
  await card.updateComplete;
  await frame();

  const labels = () => [...root().querySelectorAll('.roomlabel')]
    .filter((label) => label.querySelector('.rlname') && label.querySelector('.rlmetrics'));
  const measure = () => labels().map((label) => {
    const name = label.querySelector('.rlname').getBoundingClientRect();
    const metrics = label.querySelector('.rlmetrics').getBoundingClientRect();
    return { id: label.dataset.id, name: name.height, gap: metrics.top - name.bottom };
  });
  // Two cameras around the same centre: the label font follows the zoom.
  const atZooms = async () => {
    const base = { ...card._view };
    const rows = [];
    for (const factor of [1.6, 0.35]) {
      const w = base.w * factor;
      const h = base.h * factor;
      card._view = { x: base.x + (base.w - w) / 2, y: base.y + (base.h - h) / 2, w, h };
      card.requestUpdate();
      await card.updateComplete;
      await frame();
      await frame();
      rows.push(measure());
    }
    card._view = base;
    card.requestUpdate();
    await card.updateComplete;
    await frame();
    return rows;
  };

  await window.__hpTest.setVolumetricView(false);
  await card.updateComplete;
  await frame();
  const flat = await atZooms();
  await window.__hpTest.setVolumetricView(true);
  if (typeof card._ensureIsoSceneRuntime === 'function') await card._ensureIsoSceneRuntime();
  await card.updateComplete;
  await frame();
  const iso = await atZooms();

  // Touch floor (AC2): a raised label still owns 44 x 44 px around its centre,
  // and the area link inside it stays a separate, clickable target. Raised
  // device tiles are deliberately above names (z-index 2), so a label a device
  // happens to overlap in this fixture cannot answer: judge the labels no
  // device covers.
  const cls = (el) => el ? `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}` : null;
  const underDevice = (el) => !!el?.closest?.('.dev, .oplock');
  const probes = [...root().querySelectorAll('.stage.projection-iso.mode-view .roomlabel')].map((label) => {
    const rect = label.getBoundingClientRect();
    const pseudo = getComputedStyle(label, '::before');
    const centre = [rect.left + rect.width / 2, rect.top + rect.height / 2];
    const hits = [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]]
      .map(([dx, dy]) => root().elementFromPoint(centre[0] + dx, centre[1] + dy));
    const areaLink = label.querySelector('.rlgo');
    const linkRect = areaLink?.getBoundingClientRect();
    const linkHit = linkRect
      ? root().elementFromPoint(linkRect.left + linkRect.width / 2, linkRect.top + linkRect.height / 2)
      : null;
    return {
      id: label.dataset.id,
      boxHeight: rect.height,
      floor: { width: Number.parseFloat(pseudo.width), height: Number.parseFloat(pseudo.height) },
      covered: hits.some(underDevice) || underDevice(linkHit),
      floorHits: hits.map((hit) => !!hit && (hit === label || label.contains(hit))),
      link: areaLink ? (!!linkHit && (linkHit === areaLink || areaLink.contains(linkHit))) : null,
      hitNames: hits.map(cls),
    };
  });
  const free = probes.filter((probe) => !probe.covered);

  const ratio = (row) => row.gap / row.name;
  return {
    flat,
    iso,
    probes,
    freeLabels: free.length,
    floorIs44: free.length > 0 && free.every((probe) => probe.floor.width >= 44 && probe.floor.height >= 44),
    floorOwnsTheTarget: free.length > 0 && free.every((probe) => probe.floorHits.every(Boolean)),
    areaLinkStaysClickable: free.some((probe) => probe.link === true)
      && free.every((probe) => probe.link !== false),
    ratios: {
      flat: flat.map((rows) => rows.map(ratio)),
      iso: iso.map((rows) => rows.map(ratio)),
    },
  };
});

const pairs = out.iso.flatMap((rows, zoom) => rows.map((row, index) => ({
  zoom, id: row.id, iso: row.gap / row.name, flat: out.flat[zoom][index].gap / out.flat[zoom][index].name,
})));
check('labelsMeasured', pairs.length >= 2 && out.iso.every((rows) => rows.length > 0));
// The font really changed between the two cameras, or the test proves nothing.
check('zoomChangesTheFont', out.iso[1][0].name >= out.iso[0][0].name * 2);
// AC1: the 2.5D share equals the Flat share at each zoom, and is the same at both zooms.
check('gapMatchesFlatAtEveryZoom', pairs.every((pair) => Math.abs(pair.iso - pair.flat) <= 0.02));
check('gapIsZoomIndependent', out.iso[0].every((row, index) =>
  Math.abs(row.gap / row.name - out.iso[1][index].gap / out.iso[1][index].name) <= 0.02));
// AC2: 44 px floor kept, as painted-box-independent hit testing.
check('freeLabelsExist', out.freeLabels >= 1);
check('floorIs44', out.floorIs44);
check('floorOwnsTheTarget', out.floorOwnsTheTarget);
check('areaLinkStaysClickable', out.areaLinkStaysClickable);
await finish(browser, { ...out, pairs });
