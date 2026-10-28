/** #1097: trusted native input; all geometry/caches are observed read-only. */
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { bundledProducers, callsFor } from './opening-drag-coverage.mjs';
import { openingDragFixture } from './opening-drag-fixture.mjs';
import { launch } from '../serve.mjs';
export async function measureOpeningDrag(scale = 1, repeats = 1, {coverage = false} = {}) {
    const fixture = openingDragFixture(), { page, browser } = await launch({ width: 1280, height: 1000 }, scale);
    const settle = () => page.evaluate(() => window.__hpTest.settled());
    const snapshot = () => page.evaluate(() => { const c = window.__card; return { builds: { ...c._floorCacheBuilds }, pool: [...c._wallUnionPool.keys()], epoch: c._cfgEpoch, fallbacks: c._editorRuntime._openingDragFallbackBuilds ?? 0, config: structuredClone(c._curSpaceCfg.openings), drag: c._opDrag && { id: c._opDrag.id, moved: c._opDrag.moved }, frames: c._liveEditorPaintCount }; });
    const at = (x, y) => page.evaluate(([x, y]) => { const svg = window.__card.renderRoot.querySelector('.stage svg'); const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }; }, [x, y]);
    const targets = coverage ? bundledProducers(fileURLToPath(new URL('../../dist',import.meta.url))) : null;
    const session = coverage ? await page.context().newCDPSession(page) : null;
    try {
        if (session) { await session.send('Profiler.enable'); await session.send('Profiler.startPreciseCoverage',{callCount:true,detailed:true}); }
        const samples = [], seed = await page.evaluate(() => structuredClone(window.__card._serverCfg));
        for (let repeat = 0; repeat < repeats; repeat++) {
            await page.evaluate(async ({ fixture, seed }) => {
                await window.__hpTest.setServerConfig(cfg => { for (const key of Object.keys(cfg))
                    delete cfg[key]; Object.assign(cfg, structuredClone(seed)); cfg.spaces = structuredClone(fixture.config.spaces); cfg.model_version = fixture.config.model_version; cfg.markers = []; });
                for (const sp of fixture.config.spaces)
                    await window.__hpTest.switchSpace(sp.id);
                await window.__hpTest.switchSpace(fixture.config.spaces[0].id);
                await window.__hpTest.setMode('plan');
                await window.__hpTest.setTool('select');
            }, { fixture, seed });
            await page.waitForFunction(() => !window.__card.renderRoot.querySelector('.stage.mode-transition'));
            await settle();
            const op = fixture.config.spaces[0].openings[0], start = await at(op.x * 1000, op.y * 1000);
            await page.mouse.move(start.x, start.y);
            let coldPhysical = null;
            if (session) {
                const cold = (await session.send('Profiler.takePreciseCoverage')).result;
                coldPhysical = callsFor(cold,targets.physical);
                assert.ok(coldPhysical > 0, 'cold positive for the exact physical producer');
            }
            await page.mouse.down();
            await settle();
            const before = await snapshot(), frames = [];
            for (let i = 0; i < 30; i++) {
                const p = await at((.065 + i * .004) * 1000, op.y * 1000), begin = coverage ? null : performance.now();
                await page.mouse.move(p.x, p.y);
                await settle();
                if (!coverage) frames.push(performance.now() - begin);
            }
            const held = await snapshot();
            const observed = session ? (await session.send('Profiler.takePreciseCoverage')).result : null;
            const physical = observed ? {coldPositive:coldPhysical, calls:callsFor(observed,targets.physical), cropConstructors:callsFor(observed,targets.constructor), targets} : null;
            await page.mouse.up();
            await page.evaluate(() => window.__hpTest.waitForWrites());
            await settle();
            const after = await snapshot();
            const switches = [];
            for (const sp of fixture.config.spaces.slice(1)) {
                const b = await snapshot();
                await page.evaluate(id => window.__hpTest.switchSpace(id), sp.id);
                await settle();
                const a = await snapshot();
                switches.push({ id: sp.id, wallUnion: a.builds.wallUnion - b.builds.wallUnion });
            }
            const delta = Object.fromEntries(Object.keys(held.builds).map(k => [k, held.builds[k] - before.builds[k]]));
            samples.push({ repeat, before, held, after, frames, switches, delta, physical, checks: { nativeDrag: held.drag?.moved === true, liveFrames: held.frames - before.frames,
                    AC1: (!physical || physical.calls === 0) && held.fallbacks === before.fallbacks && ['wallUnion', 'physicalBodies', 'innerContour', 'cleanFloor'].every(k => delta[k] === 0) && JSON.stringify(before.pool) === JSON.stringify(held.pool), AC3: switches.every(s => s.wallUnion === 0) } });
        }
        return { scale, repeats, coverage, samples };
    }
    finally {
        if (session) { await session.send('Profiler.stopPreciseCoverage').catch(()=>{}); await session.detach(); }
        await browser.close();
    }
}
