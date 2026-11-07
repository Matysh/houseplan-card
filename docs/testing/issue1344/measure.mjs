// Addressed #1344 diagnostic; never a CI cadence gate or baseline acceptor.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
const root = process.argv[2], out = process.argv[3], label = process.argv[4] || 'candidate';
const trace = process.argv.includes('--trace');
if (!root || !out)
    throw Error('Usage: node measure.mjs CHECKOUT OUTPUT LABEL [--trace]');
fs.mkdirSync(out, { recursive: true });
const { launch } = await import(pathToFileURL(root + '/demo/serve.mjs'));
const { collectModeTransitionSamples } = await import('../../../demo/performance/mode-transition.mjs');
const { makeLargeHouseFixture } = await import(pathToFileURL(root + '/demo/fixtures/large-house.mjs'));
const { makeLargeHouseFixture: builder } = await import('../../../demo/fixtures/large-house.mjs');
const medium = () => builder({ floors: 1, roomsPerFloor: 12, devices: 60, openings: 24, partitions: 60, columns: 40, decor: 60, stairs: 0 });
const { page, browser } = await launch({ width: 1280, height: 800 }, 2, [], {}, root + '/demo/srv', root);
await page.emulateMedia({ reducedMotion: 'no-preference' });
const cdp = await page.context().newCDPSession(page);
const rows = [];
try {
    for (const [name, fixture] of [['demo', null], ['medium', medium()], ['large', makeLargeHouseFixture()]]) {
        if (fixture)
            await page.evaluate(async (f) => {
                const old = window.__card, host = old.parentElement;
                const c = document.createElement('houseplan-card');
                c.setConfig({ type: 'custom:houseplan-card', title: 'Mode transition diagnostic', icon_size: 3.4 });
                const connection = { subscribeEvents: async () => () => { }, subscribeMessage: async () => () => { } };
                c.hass = { language: 'en', locale: { language: 'en' }, user: { id: 'perf', name: 'Synthetic', is_admin: true }, devices: f.devices, entities: f.entities, areas: f.areas, states: f.states,
                    connection, config: { unit_system: { length: 'km' } }, localize: () => null, formatEntityState: s => s.state, callService: async () => { },
                    callWS: async (m) => {
                        if (m.type === 'houseplan/config/get')
                            return { config: structuredClone(f.config), rev: 1, can_write: true };
                        if (m.type === 'houseplan/layout/get')
                            return { layout: structuredClone(f.layout), rev: 1 };
                        if (m.type === 'config/device_registry/list')
                            return Object.values(f.devices);
                        if (m.type === 'config/entity_registry/list')
                            return Object.values(f.entities);
                        if (m.type === 'config_entries/get')
                            return [{ entry_id: 'perf_entry', domain: 'houseplan_perf', title: 'Synthetic' }];
                        if (m.type === 'manifest/list')
                            return [{ domain: 'houseplan_perf', name: 'Synthetic' }];
                        return { ok: true };
                    } };
                host.replaceChildren(c);
                window.__card = c;
                await c._ensureEditorRuntime();
                const start = performance.now();
                while (!c._loadOk || c._booting || c._bootSoft) {
                    if (performance.now() - start > 15000)
                        throw Error('Fixture did not settle');
                    await new Promise(r => setTimeout(r, 20));
                }
                await c.updateComplete;
            }, fixture);
        await page.evaluate(async () => { const c = window.__card; c._setMode('view', false); await c.updateComplete; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
        if (trace)
            await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame', transferMode: 'ReturnAsStream' });
        const diagnostic = await page.evaluate(collectModeTransitionSamples, { fixture: name, samples: 4 });
        const measured = diagnostic.rows;
        rows.push(...measured);
        console.log(JSON.stringify({ fixture: name, rows: measured.length, first: measured[0]?.firstMotionMs, maxStart: Math.max(...measured.map(r => r.firstMotionMs || 0)) }));
        if (trace) {
            const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
            await cdp.send('Tracing.end');
            const { stream } = await done;
            const chunks = [];
            for (;;) {
                const q = await cdp.send('IO.read', { handle: stream });
                chunks.push(Buffer.from(q.data, q.base64Encoded ? 'base64' : 'utf8'));
                if (q.eof)
                    break;
            }
            await cdp.send('IO.close', { handle: stream });
            fs.writeFileSync(out + '/' + label + '-' + name + '-trace.json', Buffer.concat(chunks));
        }
    }
    fs.writeFileSync(out + '/' + label + '.json', JSON.stringify({ label, root, sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), workingDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD'], { cwd: root })).digest('hex'), host: { node: process.version, platform: process.platform, kernel: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length }, trace, viewport: { width: 1280, height: 800, dpr: 2 }, chromium: await browser.version(), buildFingerprint: JSON.parse(fs.readFileSync(root + '/dist/houseplan-assets.json', 'utf8')).fingerprint, collectorSha256: createHash('sha256').update(collectModeTransitionSamples.toString()).digest('hex'), note: 'RAF samples are proxies; presented frames require the trace. Interactive is inert MutationObserver; afterToReady includes two extra RAFs.', rows }, null, 2));
}
finally {
    await browser.close();
}
