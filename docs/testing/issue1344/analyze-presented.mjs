// Trace linkage follows Chromium AnimationFrameTimingMonitor trace_id, not the
// begin-frame sequence (which can differ from the presented compositor frame).
// https://chromium.googlesource.com/chromium/src/third_party/+/refs/heads/main/blink/renderer/core/frame/animation_frame_timing_monitor.cc#603
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const out = process.argv[2], label = process.argv[3], outputLabel = process.argv[4] || label;
const report = JSON.parse(fs.readFileSync(out + '/' + label + '.json'));
const rows = [], traceInputs = [];
for (const fixture of ['demo', 'medium', 'large']) {
    const path = out + '/' + label + '-' + fixture + '-trace.json';
    if (!fs.existsSync(path))
        continue;
    traceInputs.push({ fixture, file: label + '-' + fixture + '-trace.json', sha256: sha256(fs.readFileSync(path)) });
    const events = JSON.parse(fs.readFileSync(path)).traceEvents.sort((a, b) => a.ts - b.ts);
    const presentations = new Map();
    for (const e of events.filter(e => e.name === 'AnimationFrame::Presentation')) {
        const f = e.args?.begin_frame_id;
        if (f?.sequence_number)
            presentations.set(e.pid + ':' + e.args.id, e.ts);
    }
    const frames = [], open = new Map();
    for (const e of events.filter(e => e.name === 'AnimationFrame' && ['b', 'e'].includes(e.ph))) {
        const key = e.pid + ':' + e.tid + ':' + JSON.stringify(e.id2);
        if (e.ph === 'b') {
            open.set(key, e);
        }
        else {
            const begin = open.get(key);
            if (begin) {
                const f = begin.args?.animation_frame_timing_info?.begin_frame_id;
                frames.push({ pid: begin.pid, tid: begin.tid, begin: begin.ts, end: e.ts, sequence: f?.sequence_number, source: f?.source_id, traceId: begin.args?.id, presentation: presentations.get(begin.pid + ':' + begin.args?.id) });
                open.delete(key);
            }
        }
    }
    for (const row of report.rows.filter(r => r.fixture === fixture)) {
        const prefix = 'hp-mode:' + fixture + ':' + row.sample + ':' + row.from + '-' + row.to;
        const mark = n => events.find(e => e.name === prefix + ':' + n)?.ts;
        const start = mark('start'), interactive = mark('interactive');
        const matched = row.frames.map(f => { const at = start + f.controllerTime * 1000; const af = frames.find(a => a.begin <= at && a.end >= at); return { ...f, traceFrame: af ?? null }; });
        const shown = [...new Set(matched.map(f => f.traceFrame?.presentation).filter(Number.isFinite))].sort((a, b) => a - b);
        const terminal = matched.find(f => f.phase === 'settling')?.traceFrame;
        const costs = matched.filter(f => f.traceFrame).map(f => { const af = f.traceFrame; const pieces = events.filter(e => e.ph === 'X' && e.pid === af.pid && e.tid === af.tid && ['Layout', 'UpdateLayoutTree'].includes(e.name) && e.ts >= af.begin && e.ts < af.end); return { sequence: af.sequence, styleLayoutMs: pieces.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000 }; });
        rows.push({ fixture, sample: row.sample, from: row.from, to: row.to, rafSamples: row.rafSamples, presentedChangedFrames: shown.length, firstPresentedMs: shown.length ? (shown[0] - start) / 1000 : null, maxPresentedGapMs: shown.length > 1 ? Math.max(...shown.slice(1).map((t, i) => (t - shown[i]) / 1000)) : null, unmatched: matched.filter(f => !f.traceFrame).length, notPresented: matched.filter(f => f.traceFrame && !Number.isFinite(f.traceFrame.presentation)).length, terminalFrame: terminal ?? null, interactiveMinusToPresentationMs: Number.isFinite(terminal?.presentation) && Number.isFinite(interactive) ? (interactive - terminal.presentation) / 1000 : null, maxStyleLayoutMs: costs.length ? Math.max(...costs.map(c => c.styleLayoutMs)) : null, costs });
    }
}
fs.writeFileSync(out + '/' + outputLabel + '-presented-analysis.json', JSON.stringify({ provenance: { sourceSha: report.sourceSha, buildFingerprint: report.buildFingerprint, collectorSha256: report.collectorSha256, reportSha256: sha256(fs.readFileSync(out + '/' + label + '.json')), analyzerSha256: sha256(fs.readFileSync(new URL(import.meta.url))), traceInputs }, method: 'Match changed controller sample to enclosing AnimationFrame begin/end, then pid:args.id (Chromium trace_id) to AnimationFrame::Presentation; begin and presented frame sequence can differ. No RAF sample is assumed presented; missing links remain explicit.', rows }, null, 2));
for (const f of ['demo', 'medium', 'large']) {
    const r = rows.filter(r => r.fixture === f);
    if (r.length)
        console.log(JSON.stringify({ fixture: f, minPresented: Math.min(...r.map(r => r.presentedChangedFrames)), maxGap: Math.max(...r.map(r => r.maxPresentedGapMs ?? 0)), maxStyleLayout: Math.max(...r.map(r => r.maxStyleLayoutMs ?? 0)), unmatched: r.reduce((s, r) => s + r.unmatched, 0), unpresented: r.reduce((s, r) => s + r.notPresented, 0), minTerminalWait: Math.min(...r.map(r => r.interactiveMinusToPresentationMs ?? Infinity)) }));
}
