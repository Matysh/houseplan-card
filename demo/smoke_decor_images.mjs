/**
 * #51 targeted browser proof for the custom-image projection and editor flow.
 * Backend upload/parser/storage security is covered by tests_backend; this
 * smoke uses deterministic in-memory raster data so it never depends on a
 * writable demo server or leaves user files behind.
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 760 });
const result = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.shadowRoot || c.renderRoot;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const settle = async () => {
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const stage = () => root().querySelector('.stage');
  const point = (x, y) => {
    const rect = stage().getBoundingClientRect();
    const view = c._viewOr(c._baseVb());
    return {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
    };
  };
  const pointer = (type, x, y, extra = {}) => {
    const screen = point(x, y);
    stage().dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true, isPrimary: true,
      pointerId: 510, pointerType: 'mouse', button: 0, ...screen, ...extra,
    }));
  };

  const sp = c._curSpaceCfg;
  const saved = {
    decor: JSON.parse(JSON.stringify(sp.decor || [])),
    settings: JSON.parse(JSON.stringify(sp.settings || {})),
    assets: c._decorAssets,
    catalog: c._decorAssetCatalog,
    capability: c._haDecorAssetsApi,
    hass: c.hass,
  };
  const id = '5'.repeat(64);
  const url = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 1"%3E%3Cpath fill="%23f80" d="M0 0h2v1H0z"/%3E%3C/svg%3E';
  const rawUrl = `/api/houseplan/content/assets/_/${id}.svg`;
  const asset = {
    asset_id: id, name: 'orange.svg', mime: 'image/svg+xml',
    width: 200, height: 100, bytes: 100, url: rawUrl, used_by: [],
  };
  const id2 = '6'.repeat(64);
  const url2 = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 2"%3E%3Cpath fill="%2308f" d="M0 0h1v2H0z"/%3E%3C/svg%3E';
  const rawUrl2 = `/api/houseplan/content/assets/_/${id2}.svg`;
  const asset2 = {
    asset_id: id2, name: 'blue.svg', mime: 'image/svg+xml',
    width: 100, height: 200, bytes: 100, url: rawUrl2, used_by: [],
  };

  const originalCallWS = c.hass.callWS.bind(c.hass);
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/assets/list') return { assets: [asset, asset2] };
    if (message.type === 'houseplan/content/sign') return { urls: Object.fromEntries(
      message.paths.map((path) => [path, path === rawUrl ? url : path === rawUrl2 ? url2 : path]),
    ) };
    return originalCallWS(message);
  } };

  c._haDecorAssetsApi = null;
  c._decorAssets = new Map();
  c._decorAssetCatalog = [asset];
  sp.decor = [];
  sp.settings = { ...(sp.settings || {}), hide_decor: false };
  c._setMode('decor');
  await settle();
  const capabilityFailsClosed = !root().querySelector('[data-editor-palette="image"]');
  c._haDecorAssetsApi = 1;
  await settle();

  const imageTool = root().querySelector('[data-editor-palette="image"]');
  imageTool?.click();
  await settle();
  await sleep(60);
  await settle();
  const palette = root().querySelector('.imagepalette');
  const item = palette?.querySelector('.imageasset .furnitem');
  item?.click();
  await settle();
  pointer('pointermove', 300, 300);
  await settle();
  const preview = root().querySelector('.decor-image-placement-preview');
  const previewExists = !!preview;
  const previewUsesAsset = preview?.getAttribute('href') === url;
  const previewIsInert = !!preview && getComputedStyle(preview).pointerEvents === 'none';
  const beforePlace = sp.decor.length;
  pointer('pointerdown', 300, 300);
  await settle();
  const image = sp.decor.find((shape) => shape.kind === 'image');
  const rendered = image
    ? root().querySelector(`.decorlayer [data-id="${image.id}"][data-kind="image"]`) : null;
  const near = (left, right, tolerance = 1e-6) => Math.abs(left - right) <= tolerance;
  const unitsPerCm = (1000 / 240) / c._cellCm;

  const out = {
    capabilityFailsClosed,
    oneImageTool: root().querySelectorAll('[data-editor-palette="image"]').length === 1,
    paletteIsNamedDialog: palette?.getAttribute('role') === 'dialog'
      && !!palette?.getAttribute('aria-label'),
    reusableFileIsListed: item?.textContent?.includes('orange.svg') === true,
    reusableFileWasResolvedForPainting: c._decorAssets.get(id)?.url === rawUrl,
    hoverPreviewExists: previewExists,
    hoverPreviewUsesAsset: previewUsesAsset,
    hoverPreviewIsInert: previewIsInert,
    hoverPreviewIsExactAndInert: previewExists && previewUsesAsset && previewIsInert,
    oneShotPlacement: sp.decor.length === beforePlace + 1
      && c._decorTool === 'select' && c._decorImagePalette === null,
    initialPhysicalSize: !!image
      && near(image.w * 1000, 100 * unitsPerCm)
      && near(image.h * 1000, 50 * unitsPerCm),
    fullViewProjection: rendered?.tagName?.toLowerCase() === 'image'
      && rendered.getAttribute('href') === url,
  };

  // A point near a wall may use ordinary decor/room snap, but the object stays
  // centred on that point and is never offset/rotated parallel like furniture.
  c._decorTool = 'image';
  c._decorImagePalette = asset;
  const expectedImagePoint = c._editorRuntime._decorSnap([300, 150]);
  c._editorRuntime._decorImagePlace([300, 150]);
  await settle();
  const nearWall = sp.decor.filter((shape) => shape.kind === 'image').at(-1);
  const nearWallCenterY = nearWall ? (nearWall.y + nearWall.h / 2) * 1000 : NaN;
  out.nearWallImageWasPlaced = !!nearWall;
  out.nearWallKeepsAngle = nearWall?.angle === undefined;
  out.nearWallKeepsClickedCentre = near(nearWallCenterY, expectedImagePoint[1], 1e-3);
  out.noFurnitureWallMagnet = out.nearWallImageWasPlaced && out.nearWallKeepsAngle
    && out.nearWallKeepsClickedCentre;

  const countBeforeTouch = sp.decor.length;
  c._decorTool = 'image';
  c._decorImagePalette = asset;
  pointer('pointerdown', 360, 360, { pointerType: 'touch', pointerId: 511 });
  pointer('pointercancel', 360, 360, { pointerType: 'touch', pointerId: 511 });
  await settle();
  out.cancelledTouchDoesNotPlace = sp.decor.length === countBeforeTouch
    && c._furnTouchPending === null;

  let committedPointerType = '';
  const originalImagePlace = c._editorRuntime._decorImagePlace;
  c._editorRuntime._decorImagePlace = (_raw, pointerType) => { committedPointerType = pointerType; };
  c._decorTool = 'image';
  c._decorImagePalette = asset;
  pointer('pointerdown', 360, 360, { pointerType: 'touch', pointerId: 512 });
  pointer('pointerup', 360, 360, { pointerType: 'touch', pointerId: 512 });
  await settle();
  c._editorRuntime._decorImagePlace = originalImagePlace;
  out.touchCommitUsesTouchSnapTolerance = committedPointerType === 'touch';

  c._decorTool = 'select';
  const imageBeforeReplace = { ...sp.decor.find((shape) => shape.id === image.id) };
  c._editorRuntime._openDecorProperties(imageBeforeReplace);
  await settle();
  const replaceInputExists = !!root().querySelector('.imagepropertypreview + .imageupload input[type="file"]');
  const d = c._decorShapeDialog;
  c._decorShapeDialog = {
    ...d, assetId: id2, opacity: 0.4, angle: '45', sizeWField: `-${d.sizeWField}`,
  };
  c._editorRuntime._decorSaveShape();
  await settle();
  const replaced = sp.decor.find((shape) => shape.id === image.id);
  const replacedNode = root().querySelector(`.decorlayer image[data-id="${image.id}"]`);
  out.propertiesOfferNewUpload = replaceInputExists;
  out.replacePreservesGeometryAndChangesOnlySelectedRef = !!replaced
    && replaced.asset_id === id2
    && near(replaced.x + replaced.w / 2, imageBeforeReplace.x + imageBeforeReplace.w / 2)
    && near(replaced.y + replaced.h / 2, imageBeforeReplace.y + imageBeforeReplace.h / 2)
    && near(replaced.w, imageBeforeReplace.w) && near(replaced.h, imageBeforeReplace.h)
    && nearWall?.asset_id === id;
  out.propertiesProjectOpacityRotationAndFlip = replacedNode?.getAttribute('href') === url2
    && Number(replacedNode.getAttribute('opacity')) === 0.4
    && replacedNode.getAttribute('transform')?.includes('rotate(45)')
    && replacedNode.getAttribute('transform')?.includes('scale(-1 1)');

  c._decorTool = 'select';
  c._decorAssets = new Map();
  await settle();
  const missing = root().querySelector(`.decorlayer .dimage-missing[data-id="${image.id}"]`);
  out.missingIsRepairableOnlyInEditor = !!missing
    && /image unavailable|изображение недоступно/i.test(missing.textContent || '');
  c._setMode('view');
  await settle();
  out.missingFailsDarkInView = !root().querySelector(
    `.decorlayer [data-id="${image.id}"]`,
  );

  c._decorAssets = new Map([[id, asset], [id2, asset2]]);
  sp.settings = { ...(sp.settings || {}), hide_decor: true };
  await settle();
  out.hideDecorHidesImages = !root().querySelector('.decorlayer image[data-kind="image"]');
  sp.settings = { ...(sp.settings || {}), hide_decor: false };
  await settle();
  await customElements.whenDefined('houseplan-space-card');
  const config = JSON.parse(JSON.stringify(c._serverCfg));
  let staticResolveCalls = 0;
  const staticHass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') return {
      config, rev: 1, decor_assets_api: 1, virtual_lights: { rev: 0, config_rev: 1, off: [] },
    };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/assets/resolve') {
      staticResolveCalls++;
      return { assets: [asset, asset2], missing: [] };
    }
    if (message.type === 'houseplan/content/sign') return { urls: Object.fromEntries(
      message.paths.map((path) => [path, path === rawUrl ? url : path === rawUrl2 ? url2 : path]),
    ) };
    return { ok: true };
  } };
  const host = document.createElement('div');
  document.body.append(host);
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: c._space, show_button: false });
  staticCard.hass = staticHass;
  host.append(staticCard);
  const deadline = Date.now() + 5000;
  while (!staticCard.renderRoot?.querySelector('.decorlayer image.dimage')
      && Date.now() < deadline) await sleep(50);
  const staticImage = staticCard.renderRoot?.querySelector('.decorlayer image.dimage');
  const staticSvg = staticCard.renderRoot?.querySelector('.hp-static-stage svg');
  const viewBox = staticSvg?.viewBox?.baseVal;
  const x = Number(staticImage?.getAttribute('x'));
  const y = Number(staticImage?.getAttribute('y'));
  const w = Number(staticImage?.getAttribute('width'));
  const h = Number(staticImage?.getAttribute('height'));
  out.staticCardParity = staticImage?.getAttribute('href') === url2
    && Number(staticImage?.getAttribute('opacity')) === 0.4
    && staticImage?.getAttribute('transform')?.includes('rotate(45)')
    && staticImage?.getAttribute('transform')?.includes('scale(-1 1)');
  out.staticFrameContainsImage = !!viewBox
    && viewBox.x <= x && viewBox.y <= y
    && viewBox.x + viewBox.width >= x + w
    && viewBox.y + viewBox.height >= y + h;
  out.staticImageIsInert = !!staticImage
    && getComputedStyle(staticImage).pointerEvents === 'none';
  const resolveCallsAfterFirstLoad = staticResolveCalls;
  await staticCard._load(true);
  out.staticResolveCachesCompleteAssetSet = resolveCallsAfterFirstLoad === 1
    && staticResolveCalls === resolveCallsAfterFirstLoad;
  host.remove();

  sp.decor = saved.decor;
  sp.settings = saved.settings;
  c._decorAssets = saved.assets;
  c._decorAssetCatalog = saved.catalog;
  c._haDecorAssetsApi = saved.capability;
  c.hass = saved.hass;
  c._decorImagePalette = null;
  c._decorTool = 'select';
  c._setMode('view');
  await settle();
  return out;
});

checkAll(result);
await finish(browser, result);
