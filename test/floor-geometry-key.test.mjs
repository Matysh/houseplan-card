// #744/#769: the content key of a floor's records. `floorRecordKeyMemo` is the
// helper shared by the card's floor-geometry reader (#744) and the summary
// panel's per-floor area (#769).
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  floorGeometryKeyReader, floorPoolEntry, floorRecordKeyMemo, openingWallIndexKey, physicalBodiesKey,
  sunGeometryKey, sunRoomSettingsKey, WALL_UNION_POOL_LIMIT, wallUnionKey, wallUnionPoolEntry, writeWallUnionPool,
} from '../test-build/floor-geometry-key.js';
import { lightGeometryFingerprint } from '../test-build/glow-scene.js';
import { computeSunRays } from '../test-build/sun.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { openingWallIndex } from '../test-build/wall-thickness.js';
import { physicalSpaceRecord, structuralSpaceRecord } from '../test-build/structural-space-record.js';

const record = (id, cm = 15) => ({
  id, cell_cm: 5, rooms: [{ id: `${id}1`, poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]] }],
  walls: [{ key: 'k', cm, a: [0.1, 0.1], b: [0.5, 0.1] }],
});

test('#1093 canonical ACK omission of empty legacy collections preserves physics', () => {
  const before = { id:'A', rooms:[], walls:[], partitions:[] }, after={id:'A',rooms:[]};
  assert.deepEqual(physicalSpaceRecord(before), physicalSpaceRecord(after));
  assert.notDeepEqual(structuralSpaceRecord(before), structuralSpaceRecord(after), 'history remains complete');
  assert.notDeepEqual(physicalSpaceRecord({...after,partitions:[{id:'p'}]}),physicalSpaceRecord(after));
  assert.deepEqual(physicalSpaceRecord({...after,plan_url:null,plan_aspect:null,zero_wall_style:'dashed'}),physicalSpaceRecord(after));
  for(const positive of [{plan_url:'/plan.svg'},{plan_aspect:2},{zero_wall_style:'solid'}])
    assert.notDeepEqual(physicalSpaceRecord({...after,...positive}),physicalSpaceRecord(after));
});

test('#1093 physical keys exclude known display dependencies and retain unknown/structural values', () => {
  const base=record('A'), key=contentFingerprint(physicalSpaceRecord(base));
  for(const field of ['bg_mode','bg_color','room_color','room_opacity','name_color','wall_fill',
    'show_names','show_borders','hide_decor','hide_openings','fill_mode','custom_fill','glow_enabled',
    'temp_min','temp_max','card_name_scale','card_label_scale','label_temp','label_hum','label_co2',
    'label_lqi','label_light','north_deg','sun_rays','sun_transparent','sun_ray_origin','show_lqi',
    'show_lqi_mode','show_device_battery_mode','glow','temp_source','hum_source','co2_source','name_scale','label_scale']) {
    for(const value of [null,false,0,'different',{c:'#123456',a:.7}]) {
      const changed={...base,settings:{[field]:value},rooms:base.rooms.map(r=>({...r,settings:{[field]:value}}))};
      assert.equal(contentFingerprint(physicalSpaceRecord(changed)),key,field);
      assert.notEqual(contentFingerprint(structuralSpaceRecord(changed)),contentFingerprint(structuralSpaceRecord(base)),
        'history remains complete');
    }
  }
  assert.equal(contentFingerprint(physicalSpaceRecord({...base,title:'Name',rooms:base.rooms.map(r=>({...r,name:'Room',area:'ha-area'}))})),key);
  const keys=[undefined,null,false,0].map(value=>contentFingerprint(physicalSpaceRecord({...base,
    settings:value===undefined?{}:{future_physics:value}})));
  assert.equal(new Set(keys).size,4,'unknown fields distinguish absent/null/false/zero');
  for(const field of ['cell_cm','view_box','zero_wall_style','plan_scale','wall_segments','partitions','wall_columns','openings','stairs'])
    assert.notEqual(contentFingerprint(physicalSpaceRecord({...base,[field]:'changed'})),key,field);
  assert.notEqual(contentFingerprint(physicalSpaceRecord({...base,settings:null})),key,'explicit null remains conservative');
  assert.deepEqual(base,record('A'),'projection does not mutate source');
});

test('#1078 solar flags move the solar key without making physical or artificial geometry cold', () => {
  const floor=record('A'),original=structuredClone(floor);
  const source={_cfgEpoch:1,_renderCfg:{spaces:[floor]},_curSpaceCfg:floor};
  const reader=floorGeometryKeyReader(source),physical=reader('A'),light=lightGeometryFingerprint(floor,5,1000);
  const solar=sunRoomSettingsKey(floor.rooms);
  for(const enabled of [true,false]) {
    floor.rooms[0].settings={sun_transparent:enabled};source._cfgEpoch++;
    assert.equal(reader('A'),physical);
    assert.equal(lightGeometryFingerprint(floor,5,1000),light);
    assert.equal(sunRoomSettingsKey(floor.rooms)===solar,!enabled);
    assert.notEqual(contentFingerprint(floor),contentFingerprint(original),'the durable record/history retains the real flag');
  }
  floor.rooms[0].settings.future_physics={keep:true};source._cfgEpoch++;
  assert.notEqual(reader('A'),physical,'unknown structural settings retain their conservative invalidation');
  assert.notEqual(lightGeometryFingerprint(floor,5,1000),light);
});

const spied = () => {
  const calls = [];
  const keyOf = floorRecordKeyMemo((value) => {
    calls.push(value);
    return contentFingerprint(value);
  });
  return { calls, keyOf };
};

test('#1071 structural floor keys ignore decor, but generic config/area fingerprints do not', () => {
  const floor = record('A');
  const original = structuredClone(floor);
  const source = { _cfgEpoch: 1, _renderCfg: { spaces: [floor] }, _curSpaceCfg: floor };
  const reader = floorGeometryKeyReader(source), generic = floorRecordKeyMemo();
  const key = reader('A'), configHash = contentFingerprint(floor);
  const areaKey = generic(1, 'area', 'A', floor, floor);
  for (const decor of [[], [{id:'a',kind:'furniture',color:'#123456',opacity:.3}],
    [{id:'b',kind:'image',x:.2,y:.3,w:.4,h:.5,asset_id:'different'}],
    [{id:'c',kind:'text',text:'Live {sensor.example}',x:.9,y:.7}]]) {
    floor.decor = decor;source._cfgEpoch++;
    assert.equal(reader('A'),key,'annotations cannot rebuild physical geometry');
    assert.notEqual(contentFingerprint(floor),configHash,'the durable writer still sees every decor edit');
    assert.notEqual(generic(source._cfgEpoch,'area','A',floor,floor),areaKey,'the generic memo remains full-record');
  }
  delete floor.decor;assert.deepEqual(floor,original,'key derivation never mutates caller data');
  Object.defineProperty(floor,'decor',{enumerable:true,get(){throw new Error('must not visit annotation data');}});
  source._cfgEpoch++;
  assert.equal(reader('A'),key,'excluded data is not traversed or copied');
});

test('#1071 structural keys retain all non-decor fields and both model/current records', () => {
  const floor = {...record('A'),future_geometry:{x:1},partitions:[],wall_segments:[],openings:[],
    wall_columns:[],stairs:[],plan_scale:1,view_box:[0,0,1,1],settings:{},led_strips:[]};
  const source = { _cfgEpoch: 1, _renderCfg: { spaces: [floor] }, _curSpaceCfg: floor };
  const reader = floorGeometryKeyReader(source), original = reader('A');
  for(const field of Object.keys(floor)) {
    const changed = {...floor,[field]:['changed']};
    source._curSpaceCfg=changed;source._cfgEpoch++;
    assert.notEqual(reader('A'),original,`current ${field} must invalidate`);
    source._curSpaceCfg=floor;source._renderCfg={spaces:[{...changed,id:'A'}]};source._cfgEpoch++;
    if(field!=='id')assert.notEqual(reader('A'),original,`model ${field} must invalidate`);
    source._renderCfg={spaces:[floor]};
  }
  source._curSpaceCfg=structuredClone(floor);source._cfgEpoch++;
  const pair=reader('A');source._curSpaceCfg.decor=[{id:'new',color:'#abcdef'}];source._cfgEpoch++;
  assert.equal(reader('A'),pair,'a distinct preview/current pair retains the annotation projection');
  source._curSpaceCfg.rooms[0].poly[0][0]+=.01;source._cfgEpoch++;
  assert.notEqual(reader('A'),pair,'in-place geometry with a new epoch is never stale');
});

test('#769 record key: one record is fingerprinted alone, two different objects together', () => {
  const { keyOf } = spied();
  const a = record('A');
  assert.equal(keyOf(1, 's', 'A', a, a), `A|${contentFingerprint(a)}`);
  const preview = record('A', 30);
  assert.equal(keyOf(1, 't', 'A', preview, a), `A|${contentFingerprint([preview, a])}`,
    'a preview record and the stored one: both enter the key');
  const twin = structuredClone(a);
  assert.equal(keyOf(1, 'u', 'A', twin, a), `A|${contentFingerprint([twin, a])}`,
    'two objects are two records even with equal content');
  assert.notEqual(keyOf(1, 'v', 'A', record('A', 20), a), keyOf(1, 't', 'A', preview, a),
    'the content of the second record moves the key');
});

test('#769 record key: remembered per epoch and per record object', () => {
  const { calls, keyOf } = spied();
  const a = record('A');
  const first = keyOf(1, '0', 'A', a, a);
  for (let index = 0; index < 50; index++) assert.equal(keyOf(1, '0', 'A', a, a), first);
  assert.equal(calls.length, 1, 'the same epoch and objects: one fingerprint');
  const copy = structuredClone(a);
  assert.equal(keyOf(1, '0', 'A', copy, copy), first, 'a new object with the same content: the same key');
  assert.equal(calls.length, 2, '… after one more fingerprint');
  assert.equal(keyOf(2, '0', 'A', copy, copy), first);
  assert.equal(calls.length, 3, 'a new epoch fingerprints again');
  keyOf(2, '1', 'B', record('B'), record('B'));
  assert.equal(keyOf(2, '0', 'A', copy, copy), first, 'slots are separate');
  assert.equal(calls.length, 4);
});

test('#769 record key does not depend on the shown floor; the #744 reader keys a foreign floor with it', () => {
  const a = record('A');
  const b = record('B');
  const source = { _cfgEpoch: 1, _renderCfg: { spaces: [a, b] }, _curSpaceCfg: a };
  const reader = floorGeometryKeyReader(source);
  const { keyOf } = spied();
  const own = keyOf(1, '1', 'B', b, b);
  assert.equal(reader('A'), keyOf(1, '0', 'A', a, a), 'the shown floor: its own record');
  assert.equal(reader('B'), `B|${contentFingerprint([b, a])}`,
    '#744: a foreign floor is read next to the shown floor\'s record');
  source._curSpaceCfg = b;
  assert.equal(reader('B'), own, 'shown, B gets the record key');
  source._curSpaceCfg = a;
  assert.equal(keyOf(1, '1', 'B', b, b), own, 'the record key of B is the same whichever floor is shown');
});

test('#769 AC8: one format of the union and bodies keys, the pool bound and its entry', () => {
  assert.equal(wallUnionKey('A|f', 3), 'A|f|3', 'the union key: the floor key and its room count');
  assert.equal(physicalBodiesKey('A|f', 5, 1000), 'A|f|5|1000', 'the bodies key: the floor key at a grid scale');
  assert.notEqual(physicalBodiesKey('A|f', 5, 1000), physicalBodiesKey('A|f', 10, 1000));

  const stored = record('A');
  const value = { d: 'M0 0Z' };
  const entry = wallUnionPoolEntry('A|f|1', value, stored, 5, 1000);
  assert.equal(entry.key, 'A|f|1');
  assert.equal(entry.value, value, 'the union itself is the value');
  assert.equal(value.sourceFingerprint, lightGeometryFingerprint(stored, 5, 1000),
    'the union carries the light fingerprint of the record it was built from');
  assert.deepEqual(Object.keys(value), ['d'], 'the fingerprint is not enumerable');
  assert.equal(wallUnionPoolEntry('A|f|0', null, stored, 5, 1000).value, null, 'no union: nothing to tag');

  const pool = new Map();
  for (let index = 0; index < WALL_UNION_POOL_LIMIT + 2; index++)
    assert.equal(writeWallUnionPool(pool, { key: `k${index}`, value: index }).key, `k${index}`);
  assert.equal(WALL_UNION_POOL_LIMIT, 8);
  assert.deepEqual([...pool.keys()], ['k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'],
    'the oldest floors leave the full pool first');
  writeWallUnionPool(pool, { key: 'k2', value: 'again' });
  assert.deepEqual([...pool.keys()].at(-1), 'k2', 'a rewrite is the most recent');
  assert.equal(pool.size, WALL_UNION_POOL_LIMIT);
});

// #814: the per-floor pools of physical bodies and opening tunnels.
test('#814 AC2: a bounded pool per floor — a hit refreshes recency, an evicting miss builds', () => {
  const builds = [];
  const entry = (key) => () => { builds.push(key); return { key, value: `built ${key}` }; };
  const pool = new Map();
  let active = null;
  const show = (key) => (active = floorPoolEntry(pool, active, key, entry(key)));
  for (const key of ['f1', 'f2', 'f3']) show(key);
  assert.deepEqual(builds, ['f1', 'f2', 'f3'], 'a cold floor is built once');
  for (let index = 0; index < 12; index++) show(`f${(index % 3) + 1}`);
  assert.deepEqual(builds, ['f1', 'f2', 'f3'], 'twelve warm switches build nothing');
  for (let index = 4; index <= 9; index++) show(`f${index}`);
  assert.equal(pool.size, WALL_UNION_POOL_LIMIT);
  assert.deepEqual([...pool.keys()], ['f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'],
    'the least recent floor leaves the full pool first');
  show('f2');
  assert.deepEqual([...pool.keys()].at(-1), 'f2', 'a hit is the most recent');
  const sized = pool.size;
  show('f1');
  assert.deepEqual(builds.slice(-1), ['f1'], 'a miss in the full pool builds, and the counter sees it');
  assert.equal(pool.size, sized, '… while the size stays the same');
  assert.equal(pool.has('f3'), false, 'f3, now the least recent, was evicted');
});

test('#814 AC2: the active entry answers first; re-keying it never renames a pooled record', () => {
  const pool = new Map();
  let builds = 0;
  const build = (key) => () => { builds++; return { key, all: [[[0, 0]]] }; };
  const stored = floorPoolEntry(pool, null, 'stored', build('stored'));
  assert.notEqual(stored, pool.get('stored'), 'the caller holds a copy');
  assert.equal(stored.all, pool.get('stored').all, '… of the same immutable value');
  // Resize re-keys the current entry for its preview record (_rszAcceptPreview).
  stored.key = 'preview';
  assert.equal(floorPoolEntry(pool, stored, 'preview', build('preview')), stored, 'the preview is a hit');
  assert.equal(builds, 1);
  assert.deepEqual([...pool.keys()], ['stored'], 'a preview never enters the pool');
  assert.equal(pool.get('stored').key, 'stored', 'the pooled record keeps its key');
  const back = floorPoolEntry(pool, stored, 'stored', build('stored'));
  assert.equal(builds, 1, 'the stored floor is still warm');
  assert.equal(back.key, 'stored');
  assert.equal(back.all, stored.all);
});

/** A one-slot memo by `key`, counting its builds: what the card does with a key. */
const memoOf = (key, build) => {
  let last = null;
  const memo = (...input) => {
    const k = key(...input);
    if (last?.k !== k) { memo.builds++; last = { k, value: build(...input) }; }
    return last.value;
  };
  memo.builds = 0;
  return memo;
};

test('#814 AC1: the opening wall index key — every input moves it, the cached index is the uncached one', () => {
  const scale = (input) => [1 / 240, input.cellCm, input.gridPitch];
  const keyOf = (input) => openingWallIndexKey(input.spaceId, input.rooms, input.walls, input.cuts, scale(input));
  const fresh = (input) => openingWallIndex(input.rooms, input.walls, input.cuts, 1 / 240, input.cellCm,
    input.gridPitch, 1000);
  const index = memoOf(keyOf, fresh);
  const input = {
    spaceId: 'f1', cellCm: 5, gridPitch: 1000 / 240,
    rooms: [
      { id: 'r1', name: 'Living', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] },
      { id: 'r2', x: 500, y: 100, w: 300, h: 400 },
    ],
    walls: [{ key: 'w', cm: 15, a: [0.5, 0.1], b: [0.5, 0.5] }],
    cuts: [],
  };
  const steps = [
    ['a room point moved in place', () => { input.rooms[0].poly[1][0] = 520; }],
    ['a rect room moved in place', () => { input.rooms[1].w = 320; }],
    ['the room order', () => { input.rooms.reverse(); }],
    ['a room id', () => { input.rooms[0].id = 'r9'; }],
    ['a wall thickness in place', () => { input.walls[0].cm = 30; }],
    ['a wall endpoint in place', () => { input.walls[0].b[1] = 0.45; }],
    ['a wall key', () => { input.walls[0].key = 'w2'; }],
    ['an open cut', () => { input.cuts.push([500, 200, 500, 300]); }],
    ['the cell size', () => { input.cellCm = 10; }],
    ['the grid pitch', () => { input.gridPitch = 1000 / 120; }],
    ['the floor', () => { input.spaceId = 'f2'; }],
  ];
  let previous = keyOf(input);
  assert.deepEqual(index(input), fresh(input));
  for (const [name, change] of steps) {
    const builds = index.builds;
    change();
    assert.notEqual(keyOf(input), previous, `${name} moves the key`);
    previous = keyOf(input);
    assert.deepEqual(index(input), fresh(input), `${name}: the cached index is the uncached one`);
    assert.equal(index.builds, builds + 1, `${name}: one build`);
  }
  // What the index never reads leaves the key: a rename, a setting, another
  // floor, a new epoch with equal records (a server push), a Home Assistant tick.
  const builds = index.builds;
  input.rooms[0].name = 'Renamed';
  input.rooms[0].settings = { fill_mode: 'light' };
  assert.deepEqual(index(structuredClone(input)), fresh(input));
  assert.equal(index.builds, builds, 'no build');
});

test('#814 AC1: the sun key — every input moves it, the cached wedges are the uncached ones', () => {
  const rooms = [
    { id: 'r1', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] },
    { id: 'r2', poly: [[500, 100], [800, 100], [800, 500], [500, 500]] },
  ];
  const input = {
    rooms, walls: [], cuts: [], bodies: 'f1|record|5|1000',
    windows: [{ id: 'wE', x: 800, y: 300, angle: 90, length: 60 }, { id: 'wS', x: 300, y: 500, angle: 0, length: 60 }],
    azimuth: 90, elevation: 20, north: 0, origin: 'inner', zero: { style: 'solid', barriers: [] },
  };
  const keyOf = (i) => sunGeometryKey(openingWallIndexKey('f1', i.rooms, i.walls, i.cuts, [1, 5, 1000]),
    i.bodies, i.windows, [i.azimuth, i.elevation, i.north, i.origin], i.zero);
  const fresh = (i) => computeSunRays(structuredClone(i.rooms), structuredClone(i.windows), i.azimuth, i.elevation,
    i.north, undefined, undefined, i.origin);
  const rays = memoOf(keyOf, fresh);
  assert.ok(rays(input).length > 0, 'the fixture is lit');
  const steps = [
    ['a window moved in place', () => { input.windows[0].y = 340; }],
    ['a window resized in place', () => { input.windows[0].length = 80; }],
    ['a window added', () => { input.windows.push({ id: 'wN', x: 300, y: 100, angle: 0, length: 60 }); }],
    ['a room point moved in place', () => { input.rooms[1].poly[1][0] = 760; input.rooms[1].poly[2][0] = 760; }],
    ['the azimuth', () => { input.azimuth = 200; }],
    ['the elevation', () => { input.elevation = 40; }],
    ['the compass', () => { input.north = 90; }],
    ['the ray origin', () => { input.origin = 'outer'; }],
  ];
  let previous = keyOf(input);
  for (const [name, change] of steps) {
    change();
    assert.notEqual(keyOf(input), previous, `${name} moves the key`);
    previous = keyOf(input);
    assert.deepEqual(rays(input), fresh(input), `${name}: the cached wedges are the uncached ones`);
  }
  for (const [name, change] of [
    ['a wall record', () => { input.walls.push({ key: 'w', cm: 15 }); }],
    ['an open cut', () => { input.cuts.push([500, 200, 500, 300]); }],
    ['the floor record of the bodies', () => { input.bodies = 'f1|moved partition|5|1000'; }],
    ['a solid zero wall', () => { input.zero = { style: 'solid', barriers: [[100, 300, 300, 300]] }; }],
    ['the zero-wall style', () => { input.zero = { ...input.zero, style: 'dashed' }; }],
  ]) {
    change();
    assert.notEqual(keyOf(input), previous, `${name} moves the key`);
    previous = keyOf(input);
  }
  rays(input);
  const builds = rays.builds;
  rays(structuredClone(input));
  assert.equal(rays.builds, builds, 'equal inputs in new objects (a server push, an epoch) build nothing');
});
