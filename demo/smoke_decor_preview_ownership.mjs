// #1080: rendered pixels, not DOM multiplicity, witness a stale placement ghost.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1200, height: 1000 });
await page.emulateMedia({ reducedMotion: 'reduce' });
const evidence = process.env.HP_PREVIEW_EVIDENCE || 'artifacts/decor-preview-1080';
mkdirSync(evidence, { recursive: true });
const state = () => page.evaluate(() => {
  const c = window.__card, root = c.renderRoot;
  const previews = [...root.querySelectorAll('.furniture-placement-preview,.ddraft,.decor-image-placement-preview')];
  return { count: previews.filter(e => getComputedStyle(e).visibility !== 'hidden'
    && Number(getComputedStyle(e).opacity) !== 0 && !e.closest('[style*="opacity: 0"]')).length,
  saved: structuredClone(c._decorList), history: c._geometryHistory.size,
  visibleSaved: [...root.querySelectorAll('[data-hp="decor"]')].some(e =>
    e.dataset.id === 'kept' && getComputedStyle(e).visibility !== 'hidden' && Number(getComputedStyle(e).opacity) > 0) };
});
const pointer = async (type, x, y) => {
  const p = await page.evaluate(({ x, y }) => {
  const c = window.__card, stage = c.renderRoot.querySelector('.stage');
    const ink = stage.querySelector('.decorlayer'), p = new DOMPoint(x, y).matrixTransform(ink.getScreenCTM());
    return { x: p.x, y: p.y };
  }, { x, y });
  await page.mouse.move(p.x, p.y);
  if (type === 'pointerdown') await page.mouse.down();
  if (type === 'pointerup') await page.mouse.up();
  await page.evaluate(async () => { const c = window.__card;
    await c._editorRuntime._whenLiveEditorSettled(); await c.updateComplete;
  });
};
const fullRender = () => page.evaluate(async () => {
  const c = window.__card; c.hass = { ...c.hass }; await c.updateComplete;
});
const armFurniture = () => page.evaluate(async () => {
  const c = window.__card, root = c.renderRoot;
  root.querySelector('[data-editor-palette="furniture"]').click(); await c.updateComplete;
  root.querySelector('.furnitem[data-category="sofa"]').click(); await c.updateComplete;
  root.querySelector('.furnitem[data-symbol="sofa"]').click(); await c.updateComplete;
});
const screen = async name => {
  const buffer = await page.locator('houseplan-card').screenshot();
  writeFileSync(`${evidence}/${name}.png`, buffer); return buffer;
};
const pixelDelta = (a, b, clip) => page.evaluate(async ({ a, b, clip }) => {
  const decode = async base64 => { const im = new Image(); im.src = `data:image/png;base64,${base64}`;
    await im.decode(); const canvas = document.createElement('canvas'); canvas.width = im.width; canvas.height = im.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(im, 0, 0); return ctx.getImageData(clip.x, clip.y, clip.width, clip.height).data; };
  const x = await decode(a), y = await decode(b); let changed = 0;
  for (let i = 0; i < x.length; i += 4) if (Math.max(Math.abs(x[i]-y[i]), Math.abs(x[i+1]-y[i+1]), Math.abs(x[i+2]-y[i+2])) > 3) changed++;
  return changed;
}, { a: a.toString('base64'), b: b.toString('base64'), clip });

try {
  await page.evaluate(async () => {
    const c = window.__card;
    await window.__hpTest.setServerConfig(cfg => {
      cfg.spaces = [{ id: 'preview', title: 'Preview', cell_cm: 5, view_box: [0,0,1,1], rooms: [], decor: [
        { id: 'kept', kind: 'rect', x: .02, y: .02, w: .96, h: .96, color: '#00aa00', fill: false },
      ] }]; cfg.markers = [];
    });
    await window.__hpTest.switchSpace('preview');
    await window.__hpTest.setMode('decor');
    while (c._modeTransitionBusy || c._refitRaf || c._pendingRefitSize) await new Promise(requestAnimationFrame);
    c._decorStyle = { ...c._decorStyle, color: '#ff0000', opacity: 1, widthCm: 3 }; // private-ok: fixed high-contrast creation defaults isolate the stale-pixel oracle, not the unrelated colour editor.
    c.requestUpdate(); await c.updateComplete;
  });
  await armFurniture();
  await page.waitForFunction(() => { const c = window.__card;
    return !c._cameraTransition.active && !c._modeTransitionBusy && !c._refitRaf && !c._pendingRefitSize;
  });
  const initial = await state();
  await pointer('pointermove', 250, 950);
  await fullRender();
  const clip = await page.locator('houseplan-card').evaluate(card => {
    const e = [...card.renderRoot.querySelectorAll('.furniture-placement-preview')].find(e => !e.closest('[data-hp-live-editor]'));
    const b = e.getBoundingClientRect(), c = card.getBoundingClientRect();
    return { x: Math.floor(b.x-c.x)-3, y: Math.floor(b.y-c.y)-3, width: Math.ceil(b.width)+6, height: Math.ceil(b.height)+6 };
  });
  const first = await screen('01-full-render-at-a');
  check('preview.full-render.one-visible', (await state()).count, 1);
  await page.evaluate(() => {
    window.__previewFrames = [];
    const sample = () => {
      window.__previewFrames.push([...window.__card.renderRoot.querySelectorAll('.furniture-placement-preview')]
        .filter(e => getComputedStyle(e).visibility !== 'hidden' && Number(getComputedStyle(e).opacity) > 0).length);
      window.__previewSample = requestAnimationFrame(sample);
    }; sample();
  });
  await pointer('pointermove', 750, 950);
  const moved = await screen('02-live-at-b');
  await fullRender();
  await pointer('pointermove', 650, 950);
  await screen('04-second-handoff');
  const frames = await page.evaluate(() => { cancelAnimationFrame(window.__previewSample); return window.__previewFrames; });
  check('preview.presented-frames.one-owner-without-blank', frames.length > 2 && frames.every(n => n === 1));
  const movedState = await state();
  check('preview.live.one-visible', movedState.count, 1);
  check('preview.hover.saved-unchanged', movedState.saved, initial.saved);
  check('preview.hover.history-unchanged', movedState.history, initial.history);
  check('preview.saved-object-remains-visible', movedState.visibleSaved);
  // A genuine cancellation removes both preview owners through the product.
  await page.keyboard.press('Escape'); await page.evaluate(() => window.__card.updateComplete);
  const cleared = await screen('03-cancelled');
  const stalePixels = await pixelDelta(moved, cleared, clip), firstPixels = await pixelDelta(first, cleared, clip);
  check('preview.old-position.has-visible-witness', firstPixels > 20);
  check('preview.old-position.no-painted-footprint', stalePixels, 0);
  check('preview.cancel.saved-unchanged', (await state()).saved, initial.saved);
  check('preview.cancel.history-unchanged', (await state()).history, initial.history);
  check('preview.cancel.no-ghost', (await state()).count, 0);
  writeFileSync(`${evidence}/pixels.json`, JSON.stringify({ firstPixels, stalePixels, clip }, null, 2));
  // Common shape drafts use the same ownership handoff; no extra objects/history.
  for (const kind of ['rect', 'ellipse', 'line']) {
    await page.evaluate(kind => window.__hpTest.setTool(kind), kind);
    await pointer('pointerdown', 300, 350);
    if (kind === 'line') await pointer('pointerup', 300, 350);
    await pointer('pointermove', 400, 450);
    await fullRender(); await pointer('pointermove', 600, 550);
    check(`preview.${kind}.one-visible-after-full-live`, (await state()).count, 1);
    await page.keyboard.press('Escape'); await page.evaluate(() => window.__card.updateComplete);
    check(`preview.${kind}.cancel.no-ghost`, (await state()).count, 0);
  }
  await page.evaluate(async () => {
    const c = window.__card, id = 'a'.repeat(64), path = `/api/houseplan/content/assets/_/${id}.svg`;
    const asset = { asset_id: id, url: path, width: 200, height: 100, mime: 'image/svg+xml', name: 'Preview.svg', bytes: 100, used_by: [] };
    const call = c.hass.callWS.bind(c.hass);
    c.hass = { ...c.hass, callWS: async message => message.type === 'houseplan/content/sign'
      ? { urls: Object.fromEntries(message.paths.map(p => [p, p === path
        ? 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="orange"/></svg>') : p])) }
      : call(message) };
    c._haDecorAssetsApi = 1; c._decorAssets = new Map([[id, asset]]); // private-ok: seed an already-authorized synthetic asset; upload/ACL transport is covered by smoke_decor_images.
    c._decorTool = 'image'; c._decorImagePalette = asset; c._decorAssetCatalog = [asset]; // private-ok: seed a ready image placement in this renderer-only neighbour; furniture and shapes begin through native controls.
    c.requestUpdate(); await c.updateComplete;
  });
  await pointer('pointermove', 250, 950);
  await page.waitForFunction(() => !!window.__card.renderRoot.querySelector('.decor-image-placement-preview[href^="data:"]'));
  await fullRender(); await pointer('pointermove', 750, 950);
  check('preview.image.one-visible-after-full-live', (await state()).count, 1);
  await page.keyboard.press('Escape'); await page.evaluate(() => window.__card.updateComplete);
  check('preview.image.cancel.no-ghost', (await state()).count, 0);
  await armFurniture();
  await pointer('pointermove', 600, 500);
  await pointer('pointerdown', 600, 500);
  await pointer('pointerup', 600, 500);
  await page.evaluate(() => window.__hpTest.waitForWrites());
  const placed = await state();
  check('preview.commit.one-object', placed.saved.length, initial.saved.length + 1);
  check('preview.commit.one-history', placed.history, initial.history + 1);
  check('preview.commit.no-ghost', placed.count, 0);
  check('preview.commit.saved-object-remains-visible', placed.visibleSaved);
} finally { await finish(browser); }
