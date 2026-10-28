import assert from 'node:assert/strict';
import test from 'node:test';
import { flushHouseplanPointerMove } from '../test-build/pointer-move-queue.js';
import { wallBodiesUnionPath } from '../test-build/wall-thickness.js';
import { physicalBodyParts } from '../test-build/physical-geometry.js';
globalThis.window ??= { customCards: [] };
globalThis.window.customCards ??= [];
globalThis.window.setTimeout ??= globalThis.setTimeout;
const { HouseplanEditorRuntime } = await import('../test-build/houseplan-editor-runtime.js');
const event = (x = 0, y = 0, type = 'pointermove', pointerId = 1) => ({ clientX: x, clientY: y, pointerId, type, preventDefault() { }, stopPropagation() { } });
const fixture = (partition = false) => {
    const opening = { id: 'o', type: 'window', x: .4, y: .1, angle: 0, length: .05,
        ...(partition ? { x: .42, y: .3, length: .08, host: { kind: 'partition', id: 'p', t: .4 } } : {}) };
    const cfg = { id: 'floor', openings: [opening], wall_segments: [] };
    const space = { id: 'floor', rooms: [{ id: 'r', poly: [[100, 100], [900, 100], [900, 900], [100, 900]] }],
        partitions: [{ id: 'p', a: [100, 300], b: [900, 300], cm: 20 }], wall_columns: [] };
    const host = { _mode: 'plan', _tool: 'select', _space: 'floor', _cfgEpoch: 7, _spaceH: 1000, _gridPitch: 10, _cellCm: 5,
        _serverCfg: { model_version: 8 }, _curSpaceCfg: cfg, _spaceModel: () => space, requestUpdate() { } };
    const runtime = Object.assign(Object.create(HouseplanEditorRuntime.prototype), { host, properties: { select: () => true },
        _openingDragFallbackBuilds: 0, _geometrySnapshot: () => ({ spaceId: 'floor' }), _svgPoint: e => [e.clientX, e.clientY] });
    const commits = [];
    runtime._commitPhysicalGeometry = () => { commits.push(structuredClone(opening)); return true; };
    host._t = x => x;
    return { runtime, host, opening, commits };
};
test('#1097 real queued room/partition moves own only preview and release once', () => {
    const timer = window.setTimeout;
    window.setTimeout = () => 0;
    try {
        for (const partition of [false, true]) {
            const { runtime, host, opening, commits } = fixture(partition), before = structuredClone(opening);
            runtime._opPointerDown(event(400, partition ? 300 : 100, 'pointerdown'), opening);
            for (let i = 0; i < 30; i++) {
                runtime._opPointerMove(event(450 + i * 4, partition ? 300 : 100), opening);
                flushHouseplanPointerMove(host, 'opening');
                assert.deepEqual(opening, before, 'saved record never follows held pointer');
                assert.equal(host._cfgEpoch, 7);
            }
            const preview = structuredClone(host._opDrag.preview);
            assert.notDeepEqual(preview, before);
            runtime._opPointerUp(event(566, partition ? 300 : 100, 'pointerup'), opening);
            assert.equal(commits.length, 1);
            assert.deepEqual(opening, preview);
            assert.equal(host._cfgEpoch, 8);
            runtime._opPointerUp(event(566, partition ? 300 : 100, 'pointerup'), opening);
            assert.equal(commits.length, 1);
        }
    }
    finally {
        window.setTimeout = timer;
    }
});
test('#1097 cancel retires queued moves, stale pointer and late up cannot write', () => {
    for (const terminal of ['escape', 'pointercancel', 'navigation']) {
        const { runtime, host, opening, commits } = fixture(), before = structuredClone(opening);
        runtime._opPointerDown(event(400, 100, 'pointerdown'), opening);
        runtime._opPointerMove(event(600, 100), opening);
        if (terminal === 'pointercancel')
            runtime._opPointerUp(event(600, 100, 'pointercancel'), opening);
        else
            runtime._cancelOpeningDrag();
        flushHouseplanPointerMove(host, 'opening');
        runtime._opPointerUp(event(600, 100, 'pointerup'), opening);
        let dialogs = 0; runtime._editOpening = () => { dialogs++; };
        runtime._opClick(event(600, 100, 'click'), opening);
        assert.equal(dialogs, 0, 'cancelled pointer tail cannot open a dialog');
        assert.equal(host._opDrag, null);
        assert.deepEqual(opening, before);
        assert.equal(host._cfgEpoch, 7);
        assert.equal(commits.length, 0);
    }
    const { runtime, host, opening, commits } = fixture();
    runtime._opPointerDown(event(400, 100, 'pointerdown'), opening);
    runtime._opPointerMove(event(600, 100, 'pointermove', 2), opening);
    flushHouseplanPointerMove(host, 'opening');
    runtime._opPointerUp(event(600, 100, 'pointerup', 2), opening);
    assert.equal(host._opDrag.moved, false);
    assert.equal(commits.length, 0);
    runtime._cancelOpeningDrag();
});
test('#1097 <=3px is a tap; replaced source or epoch cannot receive a held draft', () => {
    const { runtime, host, opening, commits } = fixture(), before = structuredClone(opening);
    runtime._opPointerDown(event(400, 100, 'pointerdown'), opening);
    runtime._opPointerMove(event(402, 101), opening);
    flushHouseplanPointerMove(host, 'opening');
    runtime._opPointerUp(event(402, 101, 'pointerup'), opening);
    assert.deepEqual(opening, before);
    assert.equal(host._cfgEpoch, 7);
    assert.equal(commits.length, 0);
    for (const replacement of ['record', 'epoch']) {
        runtime._opPointerDown(event(400, 100, 'pointerdown'), opening);
        runtime._opPointerMove(event(600, 100), opening);
        flushHouseplanPointerMove(host, 'opening');
        if (replacement === 'record')
            host._curSpaceCfg.openings = [structuredClone(opening)];
        else
            host._cfgEpoch++;
        runtime._opPointerUp(event(600, 100, 'pointerup'), opening);
        assert.deepEqual(opening, before);
        assert.equal(commits.length, 0);
    }
});
test('#1097 an unavailable local host takes the uncached canonical fallback visibly', () => {
    const { runtime, host, opening } = fixture(true);
    opening.host = { kind: 'partition', id: 'missing', t: .5 };
    runtime._opPointerDown(event(420, 300, 'pointerdown'), opening);
    Object.assign(host, { _wallUnionGeometry: () => null, _viewOr: () => ({ x: 0, y: 0, w: 1000, h: 1000 }), _baseVb: () => [0, 0, 1000, 1000],
        _stageEl: null, _spaceWalls: [], _openCuts: () => [], _roomWallOpeningInputs: () => [], _wallKeyPitch: 1 / 240,
        _openingsR: [{ ...opening, rx: 420, ry: 300, rlen: 80, orphanReason: 'host-not-found' }] });
    const before = structuredClone(opening);
    const result = runtime._renderOpeningDragBodies({ color: '#789', wallFill: { c: '#abc', a: .5 } });
    assert.equal(runtime._openingDragFallbackBuilds, 1);
    const space=host._spaceModel();
    const expected=wallBodiesUnionPath(space.rooms,[],[],[],1/240,5,10,1000,
      physicalBodyParts(space,5,10,.002,[]).all);
    assert.ok(expected?.d,'the negative fixture has real unrelated masonry');
    assert.ok(JSON.stringify(result.values).includes(expected.d), 'fallback draws exactly the canonical pass');
    assert.deepEqual(opening, before);
    assert.equal(host._cfgEpoch, 7);
    runtime._cancelOpeningDrag();
});
