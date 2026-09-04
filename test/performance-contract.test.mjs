import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertCardContract,
  GLOW_CARD_CONTRACT,
  LARGE_HOUSE_CARD_CONTRACT,
  SPACE_GLOW_CARD_CONTRACT,
} from '../demo/performance/card-contract.mjs';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

const directCardMembers = (relativePath) => {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  // Runner-local names never start with one underscore. Tokenising every
  // single-underscore member also catches optional chaining, bracket/in access
  // and a future alias such as `const target = card; target._loadOk`.
  return [...new Set(
    [...source.matchAll(/\b(_(?!_)[A-Za-z0-9_]+)\b/g)].map((match) => match[1]),
  )].sort();
};

const declaredMembers = (contract) => new Set([
  ...contract.methods, ...contract.fields, ...(contract.optionalFields || []),
  ...(contract.fieldAlternatives || []).flatMap((choice) => Object.values(choice)),
]);

const currentProductionMembers = (contract) => new Set([
  ...contract.methods, ...contract.fields, ...(contract.optionalFields || []),
  ...(contract.fieldAlternatives || []).map((choice) => choice.current),
]);

test('large-house benchmark declares every private card member it consumes', () => {
  const declared = declaredMembers(LARGE_HOUSE_CARD_CONTRACT);
  assert.deepEqual(
    directCardMembers('demo/benchmark_large_house.mjs').filter((name) => !declared.has(name)),
    [],
  );
});

test('every measured large-house card preloads its own lazy editor runtime (#380)', () => {
  const source = readFileSync(
    new URL('../demo/benchmark_large_house.mjs', import.meta.url), 'utf8',
  );
  const create = source.indexOf("document.createElement('houseplan-card')");
  const preload = source.indexOf('await window.__hpEnsureHarnessEditorRuntime(card)', create);
  const contract = source.indexOf('window.__hpAssertCardContract(card, cardContract)', create);
  assert.ok(create >= 0 && preload > create && contract > preload);
});

test('Glow benchmark declares every private card member it consumes', () => {
  const declared = new Set([
    ...declaredMembers(GLOW_CARD_CONTRACT),
    ...declaredMembers(SPACE_GLOW_CARD_CONTRACT),
  ]);
  assert.deepEqual(
    directCardMembers('demo/benchmark_glow.mjs').filter((name) => !declared.has(name)),
    [],
  );
});

test('static-card cache diagnostics accept a pre-Glow stable baseline (#380)', () => {
  const source = readFileSync(
    new URL('../demo/benchmark_glow.mjs', import.meta.url), 'utf8',
  );
  assert.match(source, /card\._glowRuntimeState\?\.clipCache\?\.size \?\? 0/);
  assert.doesNotMatch(source, /card\._glowRuntimeState\.clipCache/);
});

test('performance contracts reference real production members', () => {
  const source = readHouseplanProductionSource();
  for (const contract of [LARGE_HOUSE_CARD_CONTRACT, GLOW_CARD_CONTRACT]) {
    for (const name of currentProductionMembers(contract)) {
      assert.match(source, new RegExp(`\\b(?:private\\s+(?:(?:declare|readonly|get)\\s+)*|get\\s+)${name}\\b`),
        `${contract.label} declares missing production member ${name}`);
    }
  }
  const staticSource = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
  for (const name of declaredMembers(SPACE_GLOW_CARD_CONTRACT)) {
    assert.match(staticSource, new RegExp(`\\b(?:private\\s+(?:(?:declare|readonly|get)\\s+)*|get\\s+)${name}\\b`),
      `${SPACE_GLOW_CARD_CONTRACT.label} declares missing production member ${name}`);
  }
});

test('large-house contract accepts only an explicit current or stable resize owner', () => {
  const methods = Object.fromEntries(
    LARGE_HOUSE_CARD_CONTRACT.methods.map((name) => [name, () => undefined]),
  );
  const fields = Object.fromEntries(
    LARGE_HOUSE_CARD_CONTRACT.fields.map((name) => [name, null]),
  );
  Object.assign(fields, {
    _booting: false,
    _bootSoft: false,
    _cameraTransition: {},
    _cleanFloorCache: new Map(),
    _continuity: {},
    _decorList: [],
    _decorTool: 'select',
    _devices: [],
    _glowClipCache: new Map(),
    _gridPitch: 1,
    _hassSequence: 0,
    _loadOk: true,
    _model: [],
    _path: [],
    _serverCfg: {},
    _tool: 'view',
  });

  assert.doesNotThrow(() => assertCardContract(
    { ...methods, ...fields, _resize: {} }, LARGE_HOUSE_CARD_CONTRACT,
  ));
  assert.doesNotThrow(() => assertCardContract(
    { ...methods, ...fields, _rszDrag: null }, LARGE_HOUSE_CARD_CONTRACT,
  ));
  assert.throws(
    () => assertCardContract(
      { ...methods, ...fields, _resize: false }, LARGE_HOUSE_CARD_CONTRACT,
    ),
    /invalid private API types: _resize:object/,
  );
  assert.throws(
    () => assertCardContract({ ...methods, ...fields }, LARGE_HOUSE_CARD_CONTRACT),
    /missing private API: _resize\|_rszDrag/,
  );
});

test('contract accepts recent optional fields only when their runtime type is valid', () => {
  const base = {
    _cleanFloorCache: new Map(), _glowClipCache: new Map(),
    _wallUnionCache: null, _openingTunnelCache: null, _openingWallIndexCache: null,
    _devices: [], _loadOk: false,
  };
  assert.doesNotThrow(() => assertCardContract(base, GLOW_CARD_CONTRACT));
  assert.doesNotThrow(() => assertCardContract({ ...base, _glowScreenBlend: false }, GLOW_CARD_CONTRACT));
  assert.throws(
    () => assertCardContract({ ...base, _glowScreenBlend: undefined }, GLOW_CARD_CONTRACT),
    /invalid private API types: _glowScreenBlend:boolean/,
  );
  assert.throws(
    () => assertCardContract({ ...base, _cleanFloorCache: {} }, GLOW_CARD_CONTRACT),
    /invalid private API types: _cleanFloorCache:map/,
  );
});

test('view render resolves structural wall cuts once per frame, not once per room', () => {
  const source = readHouseplanProductionSource();
  const start = source.indexOf('const allZeroCuts = this._openCuts();');
  const end = source.indexOf('${this._renderOpeningTunnelFills(space, roomFills)}', start);
  assert.ok(start >= 0 && end > start, 'view room-render block is present');
  const roomRender = source.slice(start, end);
  assert.match(roomRender, /const allThickCuts = this\._thickWallCuts\(\);/);
  assert.match(roomRender, /const roomWallGeometry = this\._wallUnionGeometry\(\)\?\.roomGeom;/);
  assert.equal(
    [...roomRender.matchAll(/this\._thickWallCuts\(\)/g)].length,
    1,
    'the structural resolver must stay outside the room map',
  );
  assert.match(roomRender, /const thickCuts = !isPicked \? allThickCuts : \[\];/);
  assert.equal(
    [...roomRender.matchAll(/this\._wallUnionGeometry\(\)/g)].length,
    1,
    'the wall union lookup must stay outside the room map',
  );
});

test('room inner faces are structurally cached and shared by both fill layers', () => {
  const source = readHouseplanProductionSource();
  const helperStart = source.indexOf('private _innerRoomContour(');
  const helperEnd = source.indexOf('\n  /**', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'inner-contour cache helper is present');
  const helper = source.slice(helperStart, helperEnd);
  assert.match(helper, /lruRead\(this\._innerContourCache, key\)/);
  assert.match(helper, /lruWrite\(this\._innerContourCache, key, value, 600\)/);
  assert.match(helper, /multiWallNodes/);
  assert.match(source, /lruRead\(this\._wallUnionPool, unionKey\)/);
  assert.match(source, /lruWrite\(this\._wallUnionPool, unionKey, entry, 8\)/);
  assert.match(source, /wallBodiesGeometryPath\(wallGeometry\)/);

  const glowStart = source.indexOf('private _renderGlowBaseRooms(');
  const glowEnd = source.indexOf('\n  private _renderWallBodies(', glowStart);
  const glowBase = source.slice(glowStart, glowEnd);
  assert.equal([...glowBase.matchAll(/innerContourForRoom\(/g)].length, 0);
  assert.match(glowBase, /this\._innerRoomContour\(space, room\.id, openCuts, roomWalls\)/);

  const viewStart = source.indexOf('const allZeroCuts = this._openCuts();');
  const viewEnd = source.indexOf('${this._renderOpeningTunnelFills(space, roomFills)}', viewStart);
  const viewRooms = source.slice(viewStart, viewEnd);
  assert.equal([...viewRooms.matchAll(/innerContourForRoom\(/g)].length, 0);
  assert.match(viewRooms, /this\._innerRoomContour\(space, r\.id, allZeroCuts, roomWallGeometry\)/);
});

test('wall and light geometry reuse bounded caches before structural work', () => {
  const source = readHouseplanProductionSource();

  const unionStart = source.indexOf('private _wallUnionGeometry()');
  const unionEnd = source.indexOf('\n  /** Thick-wall spans', unionStart);
  assert.ok(unionStart >= 0 && unionEnd > unionStart, 'wall-union helper is present');
  const union = source.slice(unionStart, unionEnd);
  assert.ok(
    union.indexOf('lruRead(this._wallUnionPool, unionKey)')
      < union.indexOf('const openCuts = this._openCuts();'),
    'a cached wall union must avoid resolving openings',
  );
  assert.match(union, /lruWrite\(this\._wallUnionPool, unionKey, entry, 8\)/);

  const lightStart = source.indexOf('private _lightBarriers(');
  const lightEnd = source.indexOf('\n  /** Light pools', lightStart);
  assert.ok(lightStart >= 0 && lightEnd > lightStart, 'light-barrier helper is present');
  const light = source.slice(lightStart, lightEnd);
  assert.ok(
    light.indexOf('lruRead(this._lightBarrierPool, cacheKey)')
      < light.indexOf('buildLightBarrierScene({'),
    'a cached light barrier must return before geometry classification',
  );
  assert.match(light, /resolveLightBarrierRevision\(\{/);
  const shared = readFileSync(new URL('../src/glow-scene.ts', import.meta.url), 'utf8');
  assert.match(shared, /contentFingerprint\(\[/);
  assert.match(shared,
    /recutWallBodiesGeometry\(input\.sharedWallGeometry, roomPassages, opaqueBodies\)/);
  assert.match(light, /lruWrite\(this\._lightBarrierPool, cacheKey, entry, 8\)/);
});
