import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertCardContract,
  GLOW_CARD_CONTRACT,
  LARGE_HOUSE_CARD_CONTRACT,
} from '../demo/performance/card-contract.mjs';

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
]);

test('large-house benchmark declares every private card member it consumes', () => {
  const declared = declaredMembers(LARGE_HOUSE_CARD_CONTRACT);
  assert.deepEqual(
    directCardMembers('demo/benchmark_large_house.mjs').filter((name) => !declared.has(name)),
    [],
  );
});

test('Glow benchmark declares every private card member it consumes', () => {
  const declared = declaredMembers(GLOW_CARD_CONTRACT);
  assert.deepEqual(
    directCardMembers('demo/benchmark_glow.mjs').filter((name) => !declared.has(name)),
    [],
  );
});

test('performance contracts reference real production members', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  for (const contract of [LARGE_HOUSE_CARD_CONTRACT, GLOW_CARD_CONTRACT]) {
    for (const name of declaredMembers(contract)) {
      assert.match(source, new RegExp(`\\b(?:private\\s+(?:get\\s+)?|get\\s+)${name}\\b`),
        `${contract.label} declares missing production member ${name}`);
    }
  }
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
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
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
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
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
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');

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
      < light.indexOf('const zeroWalls = this._zeroWalls();'),
    'a cached light barrier must return before geometry classification',
  );
  assert.match(light, /contentFingerprint\(\[/);
  assert.match(light, /recutWallBodiesGeometry\(sharedWallGeometry, roomPassages, lightPhysical\)/);
  assert.match(light, /lruWrite\(this\._lightBarrierPool, cacheKey, entry, 8\)/);
});
