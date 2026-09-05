import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { readAllStylesSource } from './styles-source.mjs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const labs = readFileSync(new URL('../src/labs.ts', import.meta.url), 'utf8');
const styles = readAllStylesSource();
const openings = readFileSync(new URL('../src/iso-openings.ts', import.meta.url), 'utf8');
const overlays = readFileSync(new URL('../src/iso-overlays.ts', import.meta.url), 'utf8');
const projection = readFileSync(new URL('../src/iso-projection.ts', import.meta.url), 'utf8');
const sceneRender = readFileSync(new URL('../src/iso-scene-render.ts', import.meta.url), 'utf8');
const editorRuntime = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const spaceCard = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
const spaceRender = readFileSync(new URL('../src/space-render.ts', import.meta.url), 'utf8');
const goldenHarness = readFileSync(new URL('../demo/golden/harness.mjs', import.meta.url), 'utf8');
const contractSmoke = readFileSync(new URL('../demo/smoke_isometric_contract.mjs', import.meta.url), 'utf8');
const touchSmoke = readFileSync(new URL('../demo/smoke_isometric_live_touch.mjs', import.meta.url), 'utf8');
const serveHarness = readFileSync(new URL('../demo/serve.mjs', import.meta.url), 'utf8');
const isoRuntimeCompat = readFileSync(new URL('../demo/iso-runtime-compat.mjs', import.meta.url), 'utf8');

const section = (source, start, end) =>
  source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

const styleBodiesFor = (...selectorParts) => [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((match) => selectorParts.every((part) => match[1].includes(part)))
  .map((match) => match[2])
  .join('\n');

test('Labs iso is presentation-only and absent from the secondary space card', () => {
  assert.match(card, /subscribeLabs\(this\._onLabsSnapshot\)/);
  assert.match(card, /data-hp="projection-toggle"/);
  assert.match(card, /this\._labsIso && this\._mode === 'view' && !this\._kiosk/);
  assert.match(card, /iso \? `projection-iso \$\{deviceThemeClass\(this\._renderPlanHass\)\}` : ''/);
  assert.doesNotMatch(card, /projection-\$\{projection\}/,
    'Flat/editor DOM must not gain a projection marker');
  assert.doesNotMatch(spaceCard, /hp-labs|iso-walls|projection-toggle|view\.volumetric/);
  assert.doesNotMatch(spaceRender, /hp-labs|iso-walls|projection-toggle|view\.volumetric/);
  assert.match(labs, /houseplan_card_alpha_v1/);
  assert.match(labs, /params\.getAll\('hp_alpha'\)/);
  assert.doesNotMatch(labs, /CARD_VERSION|houseplan_card_labs_v1|params\.getAll\('hp-labs'\)/);
});

test('Stage 3 code is loaded only through the hidden alpha runtime boundary', () => {
  assert.equal([...card.matchAll(/await import\('\.\/iso-scene-render'\)/g)].length, 1);
  for (const module of ['iso-scene-render', 'iso-walls', 'iso-openings', 'iso-overlays']) {
    const valueImport = new RegExp(`import\\s+(?!type\\b)[^;]+from './${module}';`, 's');
    assert.doesNotMatch(card, valueImport, `${module} leaked into the eager card graph`);
    assert.doesNotMatch(editorRuntime, valueImport, `${module} leaked into the lazy editor graph`);
  }
  for (const module of ['iso-walls', 'iso-openings', 'iso-overlays'])
    assert.match(sceneRender, new RegExp(`from './${module}'`));
  assert.match(card, /const ISO_RETRY_ASSET = '__HOUSEPLAN_ISO_RETRY_ASSET__'/);
  assert.match(sceneRender, /ISO_SCENE_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__'/);
  assert.match(card, /if \(this\._labsIso\) void this\._ensureIsoSceneRuntime\(\)/);
});

test('Stage 3 browser harnesses await the lazy runtime and cold alpha-off skips its chunk', () => {
  for (const [label, source] of [
    ['contract smoke', contractSmoke],
    ['touch smoke', touchSmoke],
    ['golden harness', goldenHarness],
  ]) {
    assert.match(source, /await card\._ensureIsoSceneRuntime\(\)/,
      `${label} does not await the Stage 3 runtime`);
  }
  assert.match(contractSmoke,
    /cleanAlphaOffSkipsIsoRuntimeRequest = isoRuntimeRequests\(\) === 0/);
  assert.ok((contractSmoke.match(/startsWith\('projection-'\)/g) || []).length >= 3,
    'alpha-off, editor and removal witnesses must preserve the legacy Flat stage classes');
  assert.match(contractSmoke,
    /\/iso-scene-render-\[\^\/\]\+\\\.js/,
    'the cold-alpha guard must identify the generated lazy chunk, not generic requests');
});

test('every browser smoke that explicitly selects Iso waits for its lazy runtime', () => {
  const demo = new URL('../demo/', import.meta.url);
  const consumers = [];
  for (const name of readdirSync(demo).filter((item) => /^smoke_.*\.mjs$/.test(item))) {
    const source = readFileSync(new URL(name, demo), 'utf8');
    if (!source.includes("_setProjection('iso')")) continue;
    consumers.push(name);
    assert.match(source, /await (?:window\.)?(?:__hpEnsureHarnessIsoRuntime|ensureIsoRuntime)\(/,
      `${name} selects Iso without waiting for the lazy runtime`);
  }
  assert.ok(consumers.length >= 14, 'the guard unexpectedly lost known Iso smoke consumers');
  assert.match(serveHarness,
    /installHarnessIsoRuntimeHelper\(page\)/,
    'the shared browser helper is not installed by the smoke launcher');
  assert.match(isoRuntimeCompat,
    /await ensure\.call\(card\)[\s\S]*?await card\.updateComplete[\s\S]*?requestAnimationFrame/,
    'the shared helper must await load and a painted settled frame');
});

test('Stage 3 composes ordered inert SVG surfaces below screen-facing HTML', () => {
  assert.match(card, /<svg class="iso-underlay-svg"/);
  assert.match(card, /<svg class="iso-shadows-svg"/);
  assert.match(card, /<svg class="iso-walls-svg"/);
  assert.match(card, /<svg class="iso-overlays-svg"/);
  assert.match(sceneRender, /class="iso-wall-top"/);
  assert.match(sceneRender, /class="iso-wall-side"/);
  assert.match(sceneRender, /class="iso-opening-panel iso-\$\{surface\.type\} iso-opening-\$\{surface\.kind\} iso-material-\$\{surface\.material\}"/);
  assert.match(sceneRender, /class="iso-overlay-plate iso-overlay-\$\{entry\.kind\}"/);
  assert.match(sceneRender, /class="iso-overlay-tether"/);
  assert.match(sceneRender, /class="iso-overlay-ground"/);
  assert.match(sceneRender, /const depthQueue = buildIsoWallDepthQueue\(scene\.geometry, openingSurfaces\)/);
  assert.match(sceneRender, /depthQueue\.map\(\(entry\) =>/);
  assert.match(sceneRender, /entry\.layer === 'wall-top'[\s\S]*?fill-rule="evenodd"/,
    'each independently sorted wall component must retain evenodd hole semantics');
  assert.match(sceneRender, /aria-hidden="true" pointer-events="none"/);
  assert.match(styles, /\.iso-underlay-svg\s*\{\s*z-index:\s*0/);
  assert.match(styles, /\.plan-svg\s*\{\s*z-index:\s*1/);
  assert.match(styles, /\.iso-shadows-svg\s*\{\s*z-index:\s*3/);
  assert.match(styles, /\.iso-walls-svg\s*\{[\s\S]*?z-index:\s*4/);
  assert.match(styles, /\.iso-overlays-svg\s*\{\s*z-index:\s*5/);
  assert.match(styles, /\.devlayer\s*\{[\s\S]*?z-index:\s*6/);
  const shadowSurface = section(card, '<svg class="iso-shadows-svg"', '<svg class="iso-walls-svg"');
  const overlaySurface = section(card, '<svg class="iso-overlays-svg"', '</svg>` : nothing}');
  assert.doesNotMatch(shadowSurface, /renderIsoOverlayGrounds/);
  assert.ok(overlaySurface.indexOf('isoFrame?.grounds') < overlaySurface.indexOf('isoFrame?.raised'));
  const frameResolver = section(sceneRender, 'export function resolveIsoFramePresentation', 'const emptySvg');
  assert.ok(frameResolver.indexOf('grounds: renderIsoOverlayGrounds')
    < frameResolver.indexOf('raised: renderIsoRaisedOverlays'));
  const grounds = section(sceneRender, 'export function renderIsoOverlayGrounds',
    'export function renderIsoRaisedOverlays');
  assert.match(grounds, /renderIsoDefs\(layers, 'overlays', cellCm\)/);
  assert.match(grounds, /class="iso-overlay-ground"[\s\S]*?transform=\$\{isoFixedLightTransform\(cellCm\)\}/);
  assert.doesNotMatch(styles, /perspective\s*:|preserve-3d|rotateX\(|rotateZ\(/);
  assert.doesNotMatch(sceneRender, /window-light|iso-window-light|iso-glow|iso-sun/);
});

test('Stage 3 raises only device, room and lock roots while floor/live layers stay floor-bound', () => {
  for (const renderer of [
    '_renderDecorLayer(undefined, view)', '_renderRoomHoverFill(roomHover)', '_renderGlowLayer(space, disp, view)',
    '_renderSunRays(space)', '_renderOpenings(disp)',
    '_renderVacuums(this._renderVacuumDevices, view, space.id)',
  ]) assert.ok(card.includes(renderer), `missing ${renderer}`);
  assert.match(card, /const point = isoPlacement\?\.visualScene \?\? this\._scenePoint\(\[pos\.x, pos\.y\]\)/);
  assert.match(card, /const point = isoPlacement\?\.visualScene \?\? this\._scenePoint\(\[p\.x, p\.y\]\)/);
  assert.match(card, /const point = isoPlacement\?\.visualScene \?\? this\._scenePoint\(floorAnchor\)/);
  const vacuum = section(card, 'private _renderVacuums(', 'private _renderDevice(');
  assert.match(vacuum, /const point = this\._scenePoint\(\[cx, cy\]\)/);
  assert.doesNotMatch(vacuum, /visualScene|raisedScene|resolveIsoOverlayPlacement/);
  for (const kind of ['device', 'room-label', 'opening-lock'])
    assert.match(card, new RegExp(`data-hp-iso-overlay-kind=\\$\\{isoPlacement\\?\\.plane === 'raised' \\? '${kind}'`));
});

test('Stage 3 structural cache fingerprints geometry/camera/heights and excludes live paint', () => {
  assert.match(sceneRender, /flipH: !!opening\.flip_h/);
  assert.match(sceneRender, /flipV: !!opening\.flip_v/);
  assert.match(sceneRender, /const floorEdgeHeight = gridVisualUnits\(ISO_FLOOR_EDGE_HEIGHT, input\.cellCm\)/);
  assert.match(sceneRender, /const raisedHeight = gridVisualUnits\(ISO_RAISED_OVERLAY_HEIGHT, input\.cellCm\)/);
  assert.match(sceneRender, /camera: ISO_CAMERA,[\s\S]*?wallHeight,[\s\S]*?raisedHeight,[\s\S]*?floorEdgeHeight,[\s\S]*?algorithm: 4/);
  const source = section(sceneRender, 'export function createIsoStructuralSource', 'const unknownArray');
  const roomProjection = section(sceneRender,
    'export function isoStructuralRoomGeometry', 'export type IsoStructuralOpeningHost');
  for (const field of ['id', 'x', 'y', 'w', 'h', 'poly', 'wall_ids'])
    assert.match(roomProjection, new RegExp(`${field}: room\\.${field}`));
  assert.doesNotMatch(roomProjection, /room\.(?:name|area|settings|open_to)/,
    'presentation and compatibility-only room fields must not invalidate structure');
  assert.match(source, /rooms: input\.space\.rooms\.map\(isoStructuralRoomGeometry\)/);
  assert.doesNotMatch(source, /rooms: input\.space\.rooms,/);
  assert.match(source, /openingHosts,[\s\S]*?openingGeometryPolicy,/);
  const hostProjection = section(sceneRender,
    'export function isoStructuralOpeningHost', 'export interface IsoStructuralSourceInput');
  for (const field of ['hostId: resolved.host.id', 't: resolved.t', 'depth: resolved.depth',
    'face: partitionOpeningFace']) assert.ok(hostProjection.includes(field), `missing ${field}`);
  assert.match(openings, /ISO_OPENING_GEOMETRY_POLICY[\s\S]*?revision: 1/);
  assert.match(source,
    /buildIsoOpeningBasis\(\{ \.\.\.opening, face \}, wallHeight, openingGeometryPolicy\)/);
  assert.match(openings, /policy\.gateTurnDeg[\s\S]*?policy\.gateTopRatio/);
  assert.match(openings, /policy\.windowBottomRatio[\s\S]*?policy\.windowTopRatio/);
  assert.match(openings, /policy\.doorTopRatio/);
  assert.match(openings, /policy\.leafThicknessRatio[\s\S]*?policy\.frameThicknessRatio/);
  assert.match(contractSmoke,
    /presentationRoomUpdateKeepsStructuralCache[\s\S]*?roomSourceAfterPresentation\.key === roomSourceBeforePresentation\.key[\s\S]*?buildsAfterRoomPresentation === buildsBeforeRoomPresentation/);
  assert.match(contractSmoke,
    /roomGeometryUpdateInvalidatesStructuralCache[\s\S]*?roomSourceAfterGeometry\.key !== roomSourceAfterPresentation\.key[\s\S]*?buildsAfterRoomGeometry === buildsAfterRoomPresentation \+ 1/);
  assert.doesNotMatch(source, /_openingAmt|openingAmount|\.hass|matchMedia|CSS\.supports|theme|hover|focus|selected|sunlight/);
  assert.match(card, /onBuild: \(\) => \{ this\._isoStructuralBuildCount \+= 1; \}/);
  assert.match(source, /projectIsoOpeningStructure\(basis\)/);
  assert.match(sceneRender, /projectIsoOpening\(basis, amountOf\(opening\)\)/);
  assert.match(sceneRender, /lruWrite\(input\.cache, input\.source\.key, value, 8\)/);
  assert.match(card, /data-hp-iso-structural-builds=\$\{iso \? this\._isoStructuralBuildCount : nothing\}/);
  assert.match(sceneRender, /const wallTops = isoWallSilhouettesOf\(structural\.walls, wallHeight\)/);
  assert.match(sceneRender, /wallSilhouettes:\s*Object\.freeze\(\[[\s\S]*?\.\.\.wallTops,[\s\S]*?\.\.\.geometry\.sides\.map\(\(face\) => \(\{ outer: face\.points \}\)\),[\s\S]*?\]\)/);
});

test('show_borders:false keeps the exact +4° floor matrix and removes every volume cue', () => {
  assert.match(card, /isoLayers && !isoLayers\.floorSymbols/);
  assert.match(card, /<svg class=\$\{iso \? 'plan-svg' : nothing\}[\s\S]*?data-hp-live-viewbox=\$\{iso \? 'camera' : 'floor'\}/);
  assert.match(card, /transform=\$\{iso \? isoFloorMatrixCss\(\) : nothing\}/);
  assert.match(card, /\$\{iso && isoLayers\?\.structural \? svg`<svg class="iso-shadows-svg"/);
  assert.match(card, /if \(!runtime \|\| !layers\?\.structural \|\| !structural\) return null/);
  const baseView = section(card, 'private _baseVb(', '/** How many objects');
  assert.match(baseView, /if \(!this\._spaceDisplayForRender\(\)\.showBorders\)[\s\S]*?projectedFrame\(\{[\s\S]*?wallHeight:\s*0/);
  const effective = section(card, 'private _effectiveProjection()', 'private _scenePoint');
  assert.ok(effective.indexOf("if (!this._spaceDisplayForRender().showBorders)")
    < effective.indexOf('const source = this._isoSource()'));
  assert.doesNotMatch(baseView, /ISO_WALL_HEIGHT|raisedHeight|floorDepth/);
  assert.doesNotMatch(baseView, /accepted Stage 1|Stage 2 structure is absent/);
});

test('one frame resolves one structural source and latches late topology/projection failures', () => {
  const effective = section(card, 'private _effectiveProjection()', 'private _scenePoint');
  assert.equal([...effective.matchAll(/this\._isoSource\(\)/g)].length, 1);
  assert.match(effective, /this\._isoScene\(source\)/);
  assert.match(effective, /this\._isoFallback\.has\(key\)[\s\S]*?try \{/,
    'the invalid source/key sentinel must stop a second failing attempt');
  assert.match(card, /return `\$\{this\._space\}\|invalid\|\$\{this\._cfgEpoch\}`/,
    'an invalid source latch must be scoped to the current structural config revision');
  assert.match(card, /this\._clearIsoInvalidFallback\(\)/,
    'an explicit Iso retry must release invalid source sentinels');
  assert.doesNotMatch(card, /`\$\{this\._space\}\|invalid`/,
    'a space-wide invalid latch would block recovery after a new geometry fingerprint');
  const diagnostic = section(card, 'private _latchIsoFallback(', 'private _effectiveProjection');
  assert.match(diagnostic, /key\.includes\('\|invalid\|'\) \? 'invalid'/);
  assert.match(diagnostic, /safeRuntimeDiagnostic\('structural', fingerprint, true\)/);
  assert.doesNotMatch(diagnostic, /this\._space|\$\{key\}|_error/,
    'structural diagnostics must never serialize identifiers or thrown errors');
  assert.match(card, /failed: \(_ignored, info\) => \{[\s\S]*?safeRuntimeDiagnostic\('runtime-load', 'unverified', info\.terminal\)/);
  assert.doesNotMatch(card, /unable to load hidden isometric runtime[\s\S]{0,160}\b(?:error|message|stack|url)\b/i);
  assert.match(effective, /const fallback = \(\) => \{[\s\S]*?_cancelCameraTransition\(false\); this\._view = null;[\s\S]*?this\._viewModeSnap = null;[\s\S]*?catch \(error\)[\s\S]*?return fallback\(\)/,
    'a structural failure may not reuse an Iso camera as a Flat viewBox');
  assert.match(effective, /fallback = \(\) => \{ if \(this\._renderProjection === 'iso'\)/,
    'the persistent latch must not erase later Flat pan/zoom frames');
  const renderBody = section(card, 'private _renderBody()', 'private _renderSpaceDialog');
  assert.equal([...renderBody.matchAll(/resolveIsoFramePresentation\(/g)].length, 1);
  assert.doesNotMatch(renderBody, /this\._isoScene\(/);
  assert.match(renderBody, /catch \(error\)[\s\S]*?_latchIsoFallback[\s\S]*?_cancelCameraTransition\(false\)[\s\S]*?projection = 'flat'; iso = false/);
  assert.match(renderBody, /this\._view = null;[\s\S]*?_baseVb\('flat', null\)/);
  const resolver = section(sceneRender, 'export function resolveIsoFramePresentation', 'const emptySvg');
  for (const step of ['resolveIsoDecorationLayers', 'resolveIsoOpeningPanels', 'renderIsoUnderlay',
    'renderIsoShadows', 'renderIsoWalls', 'renderIsoOverlayGrounds', 'renderIsoRaisedOverlays'])
    assert.ok(resolver.includes(step), `late Stage 3 step escaped the frame boundary: ${step}`);
});

test('raised footprints participate in global and room fit without entering the structural LRU', () => {
  assert.match(sceneRender, /screenHalfSize: PlanPoint/);
  assert.match(sceneRender, /export function isoOverlaySceneBounds/);
  assert.match(sceneRender, /export function resolveIsoOverlayFitEnvelope/);
  assert.match(sceneRender, /const center = final \? placement\.visualScene : placement\.raisedScene/);
  assert.match(sceneRender, /const plate = final \? placement\.plate/);
  assert.match(sceneRender, /const \[halfX, halfY\] = entry\.screenHalfSize/);
  const scene = section(card, 'private _isoScene(', 'private _latchIsoFallback');
  assert.match(scene, /resolveIsoScene\([\s\S]*?buildIsoOverlayRenderScene|resolveIsoScene\([\s\S]*?_isoOverlayScene/);
  assert.match(scene, /resolveIsoOverlayFitEnvelope\([\s\S]*?overlayFitEntries/);
  assert.ok(scene.indexOf('resolveIsoScene') < scene.indexOf('resolveIsoOverlayFitEnvelope'));
  const roomFit = section(card, 'private _fitRoom(', '/** «Вписать всё»');
  assert.match(roomFit, /overlayFitEntries/);
  assert.match(roomFit, /ownerId: room\.id/);
  assert.match(roomFit, /resolveIsoOverlayFitEnvelope/);
  const structural = section(sceneRender, 'export function resolveIsoScene', 'const unionRect');
  assert.doesNotMatch(structural, /overlayFitEntries|resolveIsoOverlayFitEnvelope|buildIsoOverlayRenderScene/);
});

test('raised DOM roots expose one floor/visual identity and preserve existing actions', () => {
  assert.match(card, /data-hp-iso-stage=\$\{iso \? '3' : nothing\}/);
  for (const token of [
    'data-hp-iso-overlay-kind', 'data-hp-iso-raised', 'data-hp-iso-nudged',
    'data-hp-iso-floor', 'data-hp-iso-visual',
  ]) assert.ok(card.includes(token), `missing ${token}`);
  assert.match(card, /data-hp="device"[\s\S]*?@click=\$\{\(e: MouseEvent\) => this\._clickDevice\(e, d\)\}/);
  assert.match(card, /data-hp="room-label"[\s\S]*?@keydown=\$\{this\._mode === 'view'/);
  assert.match(card, /class="oplock[\s\S]*?@click=\$\{\(e: MouseEvent\) =>/);
  const deviceHit = styleBodiesFor('.dev::before');
  assert.match(deviceHit, /width:\s*max\(44px,/);
  assert.match(deviceHit, /height:\s*max\(44px,/);
  for (const selector of ['.roomlabel', '.oplock']) {
    const raisedHit = styleBodiesFor('projection-iso', selector);
    assert.match(raisedHit, /(?:min-)?width:\s*(?:44px|max\(44px,)/, selector);
    assert.match(raisedHit, /(?:min-)?height:\s*(?:44px|max\(44px,)/, selector);
  }
  assert.match(styles, /\.iso-overlays-svg,[\s\S]*?pointer-events:\s*none/);
});

test('Stage 3 materials and shadows are bounded, theme-aware and capability-safe', () => {
  const materialIds = [...sceneRender.matchAll(/id="(hp-iso-[^"]+)" data-hp-iso-material-def/g)]
    .map((match) => match[1]);
  assert.ok(materialIds.length >= 5 && materialIds.length <= 12,
    `expected a bounded shared definition set, got ${materialIds.length}`);
  assert.equal(new Set(materialIds).size, materialIds.length, 'material ids must be unique');
  assert.match(styles, /\.stage\.theme-dark \.iso-wall-side/);
  assert.match(styles, /\.stage\.theme-dark \.iso-overlay-plate/);
  assert.match(styles, /\.stage:not\(\.theme-light\) \.iso-wall-side/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.iso-overlay-plate[\s\S]*?fill:\s*Canvas/);
  assert.match(styles, /@supports not \(filter: blur\(1px\)\)[\s\S]*?\.iso-overlay-ground[\s\S]*?display:\s*none/);
  const rendering = section(sceneRender, 'function renderIsoDefs(', 'export function resolveIsoDecorationLayers');
  assert.match(sceneRender, /return `translate\(\$\{gridVisualUnits\(4, cellCm\)\} \$\{gridVisualUnits\(8, cellCm\)\}\)`/);
  assert.equal([...sceneRender.matchAll(/transform=\$\{isoFixedLightTransform\(cellCm\)\}/g)].length, 4,
    'ambient, contact, opening and overlay grounding shadows share one fixed-light vector');
  assert.doesNotMatch(rendering, /sunState|_renderSun|Date\.now|Math\.random/);
});

test('Stage 3 adds no schema, dependency, storage, network or HA action surface', () => {
  for (const source of [openings, overlays, projection, sceneRender]) {
    assert.doesNotMatch(source, /localStorage\s*\.|fetch\(|XMLHttpRequest|WebSocket|callService\(|Math\.random/);
  }
  assert.doesNotMatch(packageJson, /three|babylon|webgl/i);
  assert.doesNotMatch(card, /iso2|isometric_stage|stage2_enabled|stage3_enabled|hp_alpha_stage/);
});
