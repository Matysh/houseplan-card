/** #1097 native large-house drag/cancel, canonical input and saved readback. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';
import { openingDragFixture } from './performance/opening-drag-fixture.mjs';
import { bundledProducers, callsFor } from './performance/opening-drag-coverage.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
const fixture = openingDragFixture();
const baseline = JSON.parse(readFileSync(new URL('../test/data/1097-opening-drag-baseline.json', import.meta.url)));
const { page, browser } = await launch({ width: 1280, height: 1000 }, Number(process.env.HP_OPENING_DPR || 1));
const out = {}, trace = [];
const settle = () => page.evaluate(() => window.__hpTest.settled());
const writesSettled = () => page.evaluate(() => window.__hpTest.waitForWrites());
const at = (x, y) => page.evaluate(([x, y]) => {
    const svg = window.__card.renderRoot.querySelector('.stage svg');
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
}, [x, y]);
const sample = () => page.evaluate(() => {
    const c = window.__card, root = c.renderRoot, proof = window.__openingDragProof;
    const opening = c._openingsR.find(o => o.id === 'perf-opening-0-0');
    const local = [...root.querySelectorAll('.hp-opening-drag-local .wallbody-fill')].find(element => getComputedStyle(element).visibility === 'visible');
    const rad = (opening?.angle ?? 0) * Math.PI / 180;
    const point = along => new DOMPoint(opening.rx + Math.cos(rad) * along, opening.ry + Math.sin(rad) * along);
    const symbol = [...root.querySelectorAll('[data-hp="opening"]')].find(e => e.dataset.id === opening?.id && !!e.closest('[data-hp-live-editor]') === !!local?.closest('[data-hp-live-editor]'));
    const openingPaint = [...root.querySelectorAll('[data-hp="opening"]')].filter(e => e.dataset.id === 'perf-opening-0-0').map(e => {
        const b=e.getBoundingClientRect(),style=getComputedStyle(e),hit=e.querySelector('.op-hit');
        return {transform:e.getAttribute('transform'),live:!!e.closest('[data-hp-live-editor]'),box:[b.x,b.y,b.width,b.height],
          opacity:style.opacity,visibility:style.visibility,parentStyle:e.parentElement?.getAttribute('style'),hit:hit?.outerHTML};
    });
    return { dialog:!!c._openingDialog,tool:c._tool,space:c._space,openingPaint,builds: { ...c._floorCacheBuilds }, pool: [...c._wallUnionPool.keys()], epoch: c._cfgEpoch,
        config: structuredClone(c._serverCfg), openings: structuredClone(c._curSpaceCfg.openings), preview: structuredClone(c._opDrag?.preview ?? null),
        drag: c._opDrag && { id: c._opDrag.id, moved: c._opDrag.moved }, frames: c._liveEditorPaintCount,
        toast:c._toast,expectedRefusalToast:proof.expectedRefusalToast,rejected:proof.rejected??0,full: proof.full, writes: proof.writes, accepted: proof.accepted, history: c._geometryHistory.size,
        fallbacks: c._editorRuntime._openingDragFallbackBuilds, downs: [...proof.downs], cancels: [...proof.cancels],
        cut: local && opening ? { centerEmpty: !local.isPointInFill(point(0)), shoulderSolid: local.isPointInFill(point(opening.rlen / 2 + 2)),
            localInLive: !!local.closest('[data-hp-live-editor]'), symbol: !!symbol,
            symbolOrigin: symbol?.getAttribute('transform'), d: local.getAttribute('d') } : null };
});
const families = ['wallUnion', 'physicalBodies', 'innerContour', 'cleanFloor', 'lightBarrier'];
const unchanged = (state, before) => {
    assert.deepEqual(state.config, before.config, 'held/cancelled source config stays byte-equivalent');
    assert.equal(state.writes, before.writes);
    assert.equal(state.accepted, before.accepted);
    assert.equal(state.history, before.history);
    assert.equal(state.epoch, before.epoch);
    assert.deepEqual(state.pool, before.pool);
    for (const family of families)
        assert.equal(state.builds[family], before.builds[family], family);
    assert.equal(state.fallbacks, before.fallbacks, 'valid host uses local route');
};
const paint = (state) => {
    assert.equal(state.drag?.id, 'perf-opening-0-0');
    assert.equal(state.drag.moved, true);
    assert.ok(state.cut, 'visible local geometry owns this frame');
    assert.equal(state.cut.centerEmpty, true, 'live host actually contains the new aperture');
    assert.equal(state.cut.shoulderSolid, true, 'local cut retains its solid shoulder');
    assert.equal(state.cut.symbol, true);
};
try {
    await page.evaluate(async (fixture) => {
        await window.__hpTest.setServerConfig(cfg => { cfg.spaces = structuredClone(fixture.config.spaces); cfg.model_version = fixture.config.model_version; cfg.markers = []; });
        for (const sp of fixture.config.spaces)
            await window.__hpTest.switchSpace(sp.id);
        await window.__hpTest.switchSpace(fixture.config.spaces[0].id);
        await window.__hpTest.setMode('plan');
        await window.__hpTest.setTool('select');
    }, fixture);
    await page.waitForFunction(() => !window.__card.renderRoot.querySelector('.stage.mode-transition'));
    await writesSettled();
    await settle();
    await page.evaluate(() => {
        const c = window.__card;
        window.__openingDragProof = { full: 0, writes: 0, accepted: 0, downs: [], cancels: [] };
        const stage = c.renderRoot.querySelector('.stage');
        for (const type of ['pointerdown', 'pointercancel'])
            stage.addEventListener(type, e => {
                window.__openingDragProof[type === 'pointerdown' ? 'downs' : 'cancels'].push({ pid: e.pointerId, trusted: e.isTrusted, type: e.pointerType, opening: e.target.closest('[data-hp="opening"]')?.dataset.id ?? null });
            }, { capture: true });
        const render = c._renderBody.bind(c);
        c._renderBody = function (...args) { // private-ok: diagnostic wrapper counts the real renderer and returns its unmodified result.
            window.__openingDragProof.full++;
            return render(...args);
        };
        const call = c.hass.callWS.bind(c.hass);
        c.hass = { ...c.hass, callWS: async (message) => {
                const write = message.type === 'houseplan/config/set';
                if (write)
                    window.__openingDragProof.writes++;
                // Explicit negative response at the fixture transport boundary;
                // product validators and positive real ACKs stay unchanged.
                if (write && window.__openingDragProof.rejectNext) {
                    window.__openingDragProof.rejectNext=false;
                    window.__openingDragProof.rejected=(window.__openingDragProof.rejected??0)+1;
                    const error=Object.assign(new Error('invalid opening cut (fixture1097)'),{code:'invalid'});
                    window.__openingDragProof.expectedRefusalToast=c._t('toast.cfg_save_failed',{err:c._errText(error)});
                    throw error;
                }
                const result = await call(message);
                if (write)
                    window.__openingDragProof.accepted++;
                return result;
            } };
    });
    await settle();
    const start = await at(132, 40), target = await at(90, 40);
    const begin = async () => {
        const before = await sample(), point = await at(132, 40);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await settle();
        const down = await sample();
        assert.equal(down.downs.length, before.downs.length + 1, 'a fresh trusted down reached the opening');
        assert.equal(down.drag?.id, 'perf-opening-0-0');
        down.screen = point;
        const event = down.downs.at(-1);
        assert.deepEqual({ trusted: event.trusted, type: event.type, opening: event.opening }, { trusted: true, type: 'mouse', opening: 'perf-opening-0-0' });
        return down;
    };
    const escape = await begin();
    await page.mouse.move(target.x, target.y);
    await settle();
    const escapeHeld = await sample();
    unchanged(escapeHeld, escape);
    paint(escapeHeld);
    await page.keyboard.press('Escape');
    await settle();
    unchanged(await sample(), escape);
    await page.mouse.up();
    await writesSettled();
    await settle();
    unchanged(await sample(), escape);
    assert.equal((await sample()).drag, null);
    assert.equal((await sample()).dialog, false, 'a cancelled drag tail must not open the opening dialog');
    out.nativeEscapeCancelsAndLateUpCannotWrite = true;
    const tap = await begin();
    await page.mouse.move(tap.screen.x + 2, tap.screen.y + 1);
    await page.mouse.up();
    await writesSettled();
    await settle();
    unchanged(await sample(), tap);
    out.threePixelTapDoesNotMutateOrBuild = true;
    if ((await sample()).dialog) {
        const cancel = page.getByRole('button', {name:'Cancel', exact:true});
        await cancel.click(); await cancel.waitFor({state:'hidden'}); await settle();
    }
    const down = await begin();
    for (let i = 0; i < 30; i++) {
        const p = await at((.065 + i * .004) * 1000, 40);
        await page.mouse.move(p.x, p.y);
        await settle();
        const state = await sample();
        unchanged(state, down);
        paint(state);
        const old = baseline.preview[i];
        for (const field of ['x', 'y', 'angle'])
            assert.ok(Math.abs(state.preview[field] - old[field]) < 1e-10, `${field}: exact old coordinate sequence`);
        trace.push({ step: i, preview: state.preview, cut: state.cut && { ...state.cut, d: undefined }, builds: state.builds });
    }
    const held = await sample();
    assert.ok(held.frames > down.frames);
    assert.equal(held.full, down.full);
    await page.mouse.up();
    await writesSettled();
    await settle();
    const released = await sample();
    assert.equal(released.writes, down.writes + 1);
    assert.equal(released.accepted, down.accepted + 1);
    assert.equal(released.history, down.history + 1);
    assert.deepEqual(released.openings, baseline.openings, 'same byte-for-byte saved openings[] as the original implementation');
    assert.ok(released.builds.wallUnion - down.builds.wallUnion <= 1, 'at most one saved new floor union');
    out.thirtyNativeFramesHaveLocalCutsStablePoolsAndNoWrites = true;
    out.savedOpeningArrayMatchesOriginalAndOneTransaction = true;
    const switched = [];
    for (const floor of fixture.config.spaces.slice(1)) {
        const before = await sample();
        await page.evaluate(id => window.__hpTest.switchSpace(id), floor.id);
        await settle();
        const after = await sample();
        assert.equal(after.builds.wallUnion, before.builds.wallUnion, 'warm neighbour never rebuilds');
        switched.push(floor.id);
    }
    out.warmNeighbourFloorsRetainTheirUnions = true;
    await page.evaluate(id => window.__hpTest.switchSpace(id), fixture.config.spaces[0].id);
    await settle();
    // Trusted Chromium cancel on the delivered opening pointer; no device touch-parity claim.
    const current = released.openings.find(o => o.id === 'perf-opening-0-0'), touchStart = await at(current.x * 1000, current.y * 1000), touchTarget = await at(100, 40);
    const session = await page.context().newCDPSession(page);
    try {
        const before = await sample();
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchStart.x, y: touchStart.y, id: 1097 }] });
        await settle();
        const touchDown = await sample();
        assert.equal(touchDown.downs.at(-1).trusted, true);
        assert.equal(touchDown.drag.id, 'perf-opening-0-0');
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchTarget.x, y: touchTarget.y, id: 1097 }] });
        await settle();
        const touchHeld = await sample();
        unchanged(touchHeld, touchDown);
        paint(touchHeld);
        await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await writesSettled();
        await settle();
        const cancelled = await sample();
        unchanged(cancelled, touchDown);
        assert.equal(cancelled.drag, null);
        const cancel = cancelled.cancels.at(-1);
        assert.equal(cancel.trusted, true);
        assert.equal(cancel.pid, touchDown.downs.at(-1).pid);
        assert.equal(cancelled.writes, before.writes);
    }
    finally {
        await session.detach();
    }
    out.trustedSamePointerCancelRetiresPreviewWithoutWrite = true;
    // Outside-wall input is refused by the original snap before any commit.
    const outsideBefore=await sample(), outsideStart=await at(current.x*1000,current.y*1000);
    await page.mouse.move(outsideStart.x,outsideStart.y);await page.mouse.down();await settle();
    const outsideDown=await sample();assert.equal(outsideDown.drag?.id,'perf-opening-0-0');
    const outside=await at(132,150);await page.mouse.move(outside.x,outside.y);await settle();
    const outsideHeld=await sample();unchanged(outsideHeld,outsideDown);assert.equal(outsideHeld.drag.moved,false);
    await page.mouse.up();await writesSettled();await settle();unchanged(await sample(),outsideBefore);
    if((await sample()).dialog){const cancel=page.getByRole('button',{name:'Cancel',exact:true});await cancel.click();await cancel.waitFor({state:'hidden'});await settle();}
    out.outsideWallPointerDoesNotInventACommit=true;
    // Ordinary backend refusal uses the unchanged physical rollback owner.
    const refusalBefore=await sample(), refusalStart=await at(current.x*1000,current.y*1000);
    await page.evaluate(()=>{window.__openingDragProof.rejectNext=true;});
    await page.mouse.move(refusalStart.x,refusalStart.y);await page.mouse.down();await settle();
    const refusalDown=await sample(), refusedTarget=await at(140,40);
    await page.mouse.move(refusedTarget.x,refusedTarget.y);await settle();unchanged(await sample(),refusalDown);
    await page.mouse.up();
    await writesSettled().catch(error=>assert.match(error.message,/invalid opening cut \(fixture1097\)/));
    await settle();
    await page.waitForFunction(()=>window.__card._writesPending===0&&!window.__card._saveConfigDebounced.pending());
    const refused=await sample();
    assert.equal(refused.rejected,refusalBefore.rejected+1);assert.equal(refused.writes,refusalBefore.writes+1);
    assert.equal(refused.accepted,refusalBefore.accepted);assert.equal(refused.history,refusalBefore.history);
    assert.deepEqual(refused.config,refusalBefore.config);assert.equal(refused.toast,refused.expectedRefusalToast);
    const wire=await page.evaluate(()=>window.__card.hass.callWS({type:'houseplan/config/get'}));
    assert.deepEqual(wire.config,refusalBefore.config,'backend retains the last accepted pair');
    out.refusedCutResponseRetainsOldToastRollbackAndAcceptedServerConfig=true;
    // A small native camera witness for presentation-only clip ownership.
    const cameraSettled = async () => {
        await page.waitForFunction(()=>!window.__card._cameraTransition.active && !window.__card._modeTransitionBusy && !window.__card._refitRaf && !window.__card._pendingRefitSize);
        await settle();
    };
    await page.evaluate(()=>window.__hpTest.setTool('select'));
    const cameraPoint = () => page.evaluate(() => {
        const c=window.__card, opening=c._openingsR.find(o=>o.id==='perf-opening-0-0');
        const frame=c.renderRoot.querySelector('svg.plan-svg > g'),m=frame.getScreenCTM();
        const p=new DOMPoint(opening.rx,opening.ry).matrixTransform(m);
        return {x:p.x,y:p.y,rx:opening.rx,ry:opening.ry,matrix:[m.a,m.b,m.c,m.d,m.e,m.f]};
    });
    for (let turn=0;turn<4;turn++) {
        if (turn) await page.locator('[data-hp="rotate-right"]').click();
        await page.locator('[data-hp="zoom-fit"]').click(); await cameraSettled();
        const beforePan=await cameraPoint(), stage=await page.locator('.stage').boundingBox();
        await page.mouse.move(stage.x+stage.width-8,stage.y+stage.height-8);await page.mouse.down();
        await page.mouse.move(stage.x+stage.width-21,stage.y+stage.height-17,{steps:4});await page.mouse.up();await cameraSettled();
        const afterPan=await cameraPoint();
        assert.ok(Math.hypot(afterPan.x-beforePan.x,afterPan.y-beforePan.y)>5,'native pan changed the camera');
        await page.mouse.move(afterPan.x,afterPan.y);await page.mouse.wheel(0,-120);await cameraSettled();
        const start=await cameraPoint(), before=await sample();
        assert.notDeepEqual(start.matrix.slice(0,4),afterPan.matrix.slice(0,4),'native zoom changed the scale');
        await page.mouse.move(start.x,start.y);await page.mouse.down();await settle();
        const target=await page.evaluate(([x,y])=>{const m=window.__card.renderRoot.querySelector('svg.plan-svg > g').getScreenCTM();const p=new DOMPoint(x+8,y).matrixTransform(m);return{x:p.x,y:p.y};},[start.rx,start.ry]);
        await page.mouse.move(target.x,target.y);await settle();
        const held=await sample();paint(held);unchanged(held,before);
        assert.equal(await page.evaluate(()=>{
            const local=[...window.__card.renderRoot.querySelectorAll('.hp-opening-drag-local')].find(e=>getComputedStyle(e).visibility==='visible');
            const path=local.closest('.hp-opening-drag-walls').querySelector('clipPath path'),m=local.getScreenCTM();
            const numbers=path.getAttribute('d').match(/[-+]?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi).map(Number),points=[];
            for(let i=0;i<numbers.length;i+=2)points.push([numbers[i],numbers[i+1]]);
            return points.every(([x,y])=>{
                const p=new DOMPoint(x,y).matrixTransform(m);return [p.x*devicePixelRatio,p.y*devicePixelRatio].every(v=>Math.abs(v-Math.round(v))<1e-6);
            });
        }),true,'actual camera/DPR puts complementary clip edges on physical pixels');
        await page.keyboard.press('Escape');await page.mouse.up();await settle();unchanged(await sample(),before);
    }
    out.nativePanZoomAndFourTurnsKeepOpeningAndPhysicalPixelClips=true;
    // #1100/#1097 interop: history must retain the rich warm pool envelope.
    // This T-join is a separate real current-model input, never a patched producer.
    // A fresh card also separates the earlier deliberate rejected transport
    // promise from this independent scenario; no private write-chain reset.
    await page.reload();
    await page.waitForFunction(()=>window.__card?._loadOk&&window.__card._booting===false);
    await installHpTestOnPage(page);
    await assertFreshDemoBundle(page);
    const interop = commitWallSegmentModel({ spaces: [{ id: 'history-opening-interop', cell_cm: 5,
        rooms: [{ id: 'history-room', poly: [[.1,.1],[.9,.1],[.9,.9],[.1,.9]] }],
        partitions: [
            { id: 'history-main', a: [.2,.4], b: [.8,.4], cm: 20 },
            { id: 'history-branch', a: [.5,.4], b: [.5,.75], cm: 20 },
        ],
        openings: [{ id: 'history-opening', type: 'door', x: .42, y: .4, angle: 0, length: .08,
            host: { kind: 'partition', id: 'history-main', t: (.42-.2)/.6 } }],
    }], markers: [], settings: {} }).config;
    const targets = bundledProducers(fileURLToPath(new URL('../dist', import.meta.url)));
    assert.ok(targets.constructor, 'the exact bundled local-preview constructor is identifiable');
    const coverage = await page.context().newCDPSession(page), interopTrace = [];
    const interopAt = (x,y) => page.evaluate(([x,y]) => {
        const m=window.__card.renderRoot.querySelector('svg.plan-svg > g').getScreenCTM();
        const p=new DOMPoint(x,y).matrixTransform(m);return {x:p.x,y:p.y};
    }, [x,y]);
    const interopSnapshot = () => page.evaluate(() => {
        const c=window.__card, opening=c._openingsR.find(o=>o.id==='history-opening');
        const local=[...c.renderRoot.querySelectorAll('.hp-opening-drag-local .wallbody-fill')]
            .find(node=>getComputedStyle(node).visibility==='visible');
        const saved=c._curSpaceCfg.openings.find(o=>o.id==='history-opening');
        const point=along=>new DOMPoint(opening.rx+Math.cos(opening.angle*Math.PI/180)*along,
            opening.ry+Math.sin(opening.angle*Math.PI/180)*along);
        return {config:structuredClone(c._serverCfg),saved:structuredClone(saved),preview:structuredClone(c._opDrag?.preview??null),
            builds:{...c._floorCacheBuilds},fallbacks:c._editorRuntime._openingDragFallbackBuilds,
            cut:local?{centerEmpty:!local.isPointInFill(point(0)),shoulderSolid:local.isPointInFill(point(opening.rlen/2+2)),
                oldApertureSolid:local.isPointInFill(new DOMPoint(saved.x*1000,saved.y*c._spaceH))}:null};
    });
    try {
        await coverage.send('Profiler.enable');
        await coverage.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true});
        await writesSettled();
        await page.evaluate(async cfg=>{
            const hp=window.__hpTest;await hp.setServerConfig(cfg);await hp.switchSpace('history-opening-interop');
            await hp.setMode('plan');await hp.setTool('select');await hp.waitForWrites();await hp.settled();
        },interop);
        await cameraSettled();
        const cold=callsFor((await coverage.send('Profiler.takePreciseCoverage')).result,targets.physical);
        assert.ok(cold>0,'the exact physical producer has a real cold positive');
        const initial=await interopAt(420,400), committed=await interopAt(480,400);
        await page.mouse.move(initial.x,initial.y);await page.mouse.down();
        await page.mouse.move(committed.x,committed.y,{steps:5});await page.mouse.up();
        await writesSettled();await settle();
        const edited=await interopSnapshot();
        assert.ok(Math.abs(edited.saved.x-.42)>.01,'native edit records a physical opening command');
        for(const direction of ['undo','redo']){
            await page.keyboard.press(direction==='undo'?'Control+z':'Control+Shift+z');
            await writesSettled();await cameraSettled();
            const warm=await interopSnapshot();
            assert.equal(warm.saved.x,direction === 'undo' ? .42 : edited.saved.x,'history restores the accepted physical state');
            // Discard the legitimate history safety/render work. The next held
            // native drag must not call an uncounted full physical producer.
            await coverage.send('Profiler.takePreciseCoverage');
            const start=await interopAt(warm.saved.x*1000,400);
            const target=await interopAt(direction==='undo'?480:560,400);
            await page.mouse.move(start.x,start.y);await page.mouse.down();
            await page.mouse.move(target.x,target.y,{steps:5});await settle();
            const held=await interopSnapshot();
            const observed=(await coverage.send('Profiler.takePreciseCoverage')).result;
            const physical=callsFor(observed,targets.physical), constructors=callsFor(observed,targets.constructor);
            assert.deepEqual(held.config,warm.config,'opening preview after history never edits the saved document');
            for(const family of families)assert.equal(held.builds[family],warm.builds[family],family);
            assert.equal(held.fallbacks,warm.fallbacks,'history retains the local route');
            assert.equal(physical,0,'retained joins prevent a hidden physicalBodyParts call');
            assert.equal(constructors,1,'one local preparation owns the entire drag');
            assert.deepEqual(held.cut,{centerEmpty:true,shoulderSolid:true,oldApertureSolid:true},
                'the next aperture is empty, its shoulder is solid, and the old aperture is filled');
            interopTrace.push({direction,coldPhysical:cold,physical,constructors,cut:held.cut,builds:held.builds,fallbacks:held.fallbacks});
            await page.keyboard.press('Escape');await page.mouse.up();await writesSettled();await settle();
            assert.deepEqual((await interopSnapshot()).config,warm.config,'cancel leaves the history-restored document intact');
        }
        out.historyUndoRedoRetainLocalOpeningJoinPreview=true;
        console.log('history-opening interop evidence',JSON.stringify(interopTrace));
    } finally {
        await coverage.send('Profiler.stopPreciseCoverage').catch(()=>{});
        await coverage.detach();
    }
    checkAll(out);
    console.log('opening-drag evidence', JSON.stringify({ sourceBaseline: baseline.sourceSha, trace, switched, released: { builds: released.builds, pool: released.pool, openings: released.openings } }, null, 2));
    await finish(browser);
}
catch (error) {
    const state=await sample().catch(()=>null);
    if(state){delete state.config;state.openings=state.openings.slice(0,2);}
    console.log('opening-drag diagnostic', JSON.stringify({out,trace,sample:state}));
    mkdirSync('artifacts',{recursive:true});
    await page.screenshot({path:'artifacts/opening-drag-failure.png'});
    await browser.close();
    throw error;
}
