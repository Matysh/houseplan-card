import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { digest } from './storage.mjs';
import { listZipEntries, readZipEntries } from './zip.mjs';

export const POLICY = Object.freeze({
  zip_bytes: { label: 'ZIP', fraction: .05, absolute: 32768, unit: 'B' },
  frontend_all_files_gzip_bytes: { label: 'Весь frontend, gzip', fraction: .05, absolute: 16384, unit: 'B' },
  initial_view_gzip_bytes: { label: 'Начальная загрузка View, gzip', fraction: .05, absolute: 8192, unit: 'B' },
  firstStableRenderMs: { label: 'Первый устойчивый кадр', fraction: .10, absolute: 50, unit: 'ms' },
  spaceSwitchMs: { label: 'Смена этажа', fraction: .10, absolute: 75, unit: 'ms' },
  panZoomMs: { label: 'Один шаг масштаба', fraction: .10, absolute: 5, unit: 'ms' },
  stateUpdateMs: { label: 'Обновление состояния', fraction: .10, absolute: 15, unit: 'ms' },
});
export const FROZEN_HASH = 'bf73c10a1618c1936c3c5a199f981f6af0335d1770f0f9763c8f785d2b6f9136';
export function frozenBaseline() {
  const bytes = readFileSync(new URL('../baselines/v1.83.1.json', import.meta.url));
  if (digest(bytes) !== FROZEN_HASH) throw Error('Frozen v1.83.1 diagnostic measurement changed');
  return JSON.parse(bytes);
}
export const median = values => {
  if (!values.length || values.some(x => !Number.isFinite(x))) throw Error('Finite samples required');
  const list = [...values].sort((a, b) => a - b), mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
};
export function measureFrontend(entries, zipBytes) {
  const manifestBytes = entries.get('frontend/houseplan-assets.json');
  if (!manifestBytes || !(zipBytes > 0)) throw Error('Release ZIP/frontend manifest required');
  const manifest = JSON.parse(manifestBytes), files = [];
  for (const [path, bytes] of entries) if (path.startsWith('frontend/') && !path.endsWith('/')) {
    files.push({ path: path.slice(9), raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length, sha256: digest(bytes) });
  }
  const initial = new Set(manifest.initialViewFiles);
  if (!initial.size || initial.size !== manifest.initialViewFiles.length || [...initial].some(path => !files.some(f => f.path === path))) throw Error('Incomplete initial View dependency closure');
  return { buildFingerprint: manifest.fingerprint, size_metrics: { zip_bytes: zipBytes, frontend_all_files_raw_bytes: files.reduce((n, f) => n + f.raw, 0),
    frontend_all_files_gzip_bytes: files.reduce((n, f) => n + f.gzip, 0), initial_view_gzip_bytes: files.filter(f => initial.has(f.path)).reduce((n, f) => n + f.gzip, 0) }, files };
}
export function measureZip(path) {
  const names = listZipEntries(path).filter(name => name.startsWith('frontend/') && !name.endsWith('/'));
  return { ...measureFrontend(readZipEntries(path, names), readFileSync(path).length), artifactDigest: digest(readFileSync(path)), compression: { node: process.version, zlib: process.versions.zlib, level: 9 } };
}
export function collectMeasurement({ zip, performance, host, runnerHash, release, sourceSha }) {
  if (!sourceSha) throw Error('Candidate measurement identity required');
  if (performance && performance.sourceSha !== sourceSha) throw Error('Performance report is from another candidate');
  const sizes = measureZip(zip);
  if (!sizes.buildFingerprint || performance && sizes.buildFingerprint !== performance.buildFingerprint) throw Error('Performance did not measure the packaged frontend');
  const timing_metrics = {}, diagnostics = [];
  for (const [key, policy] of Object.entries(POLICY)) if (policy.unit === 'ms') {
    const samples = performance?.rows?.map(row => row[key]);
    if (!validSamples(samples)) { diagnostics.push(`Нет достоверной серии замеров: ${policy.label}`); continue; }
    timing_metrics[key] = { median: median(samples), samples };
  }
  if (!host?.cpu || !host?.power_scheme || !runnerHash) diagnostics.push('Условия замера записаны не полностью; сравнение времени недоступно');
  return { schema: 1, release, source_sha: sourceSha, recorded_at_utc: new Date().toISOString(), ...sizes, timing_metrics, host,
    measurement_status: diagnostics.length ? 'incomplete' : 'complete', diagnostics,
    timing_protocol: { profile: performance?.profile, fixture: performance?.fixture, warmups: performance?.warmups, samples: performance?.samples, runtime: performance?.runtime, runner_sha256: runnerHash } };
}
const validSamples = samples => Array.isArray(samples) && samples.length >= 5 && samples.every(value => Number.isFinite(value) && value >= 0);
function comparable(left, right) {
  const cpu = value => value.replace(/\((?:R|TM)\)/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const kernel = value => String(value ?? '').match(/\d+\.\d+\.\d+[^\s]*/)?.[0] ?? String(value ?? '');
  const canonical = value => value && typeof value === 'object' ? Array.isArray(value) ? value.map(canonical)
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const signature = record => {
    const p = record?.timing_protocol, h = record?.host;
    if (!p?.runner_sha256 || !p.runtime || typeof h?.cpu !== 'string' || !h.cpu || typeof h.power_scheme !== 'string' || !h.power_scheme || h.power_scheme === 'unrecorded') return null;
    return JSON.stringify(canonical({ profile: p.profile, fixture: p.fixture, warmups: p.warmups, samples: p.samples, runtime: p.runtime,
      runner: p.runner_sha256, cpu: cpu(h.cpu), power: h.power_scheme.toLowerCase(), linux: kernel(h.linux) }));
  };
  const a = signature(left), b = signature(right); return a !== null && a === b;
}
function measurement(record, key, policy) {
  if (policy.unit === 'B') return record?.size_metrics?.[key];
  const series = record?.timing_metrics?.[key]?.samples;
  return validSamples(series) ? median(series) : undefined;
}
function compareOne(candidate, reference, diagnostic) {
  return Object.entries(POLICY).map(([key, policy]) => {
    const before = measurement(reference, key, policy), after = measurement(candidate, key, policy);
    const available = Number.isFinite(before) && before >= 0 && Number.isFinite(after) && after >= 0;
    const matched = policy.unit === 'B' || comparable(candidate, reference);
    const delta = available ? after - before : null, threshold = available ? Math.max(before * policy.fraction, policy.absolute) : null;
    const excessive = available && delta > threshold;
    // Two halves must independently exceed the same policy before random timing noise can stop a beta.
    const samples = candidate.timing_metrics?.[key]?.samples;
    const repeatable = policy.unit === 'B' || available && matched && samples?.length >= 5
      && median(samples.slice(0, Math.floor(samples.length / 2))) - before > threshold
      && median(samples.slice(Math.floor(samples.length / 2))) - before > threshold;
    return { key, ...policy, before: before ?? null, after: after ?? null, delta, percent: available && before ? delta / before * 100 : null,
      threshold, comparable: matched, diagnostic, status: !available ? 'missing' : !matched ? 'incomparable' : excessive && repeatable ? 'regression' : excessive ? 'noisy' : 'within-tolerance',
      blocks: !diagnostic && excessive && repeatable && matched };
  });
}
export function compareMeasurements(candidate, latestStable, anchor = frozenBaseline()) {
  if (!candidate?.source_sha) throw Error('Candidate measurement identity required');
  const primary = compareOne(candidate, latestStable, false), diagnostic = compareOne(candidate, anchor, true);
  const needsMeasurement = primary.some(row => ['missing', 'incomparable', 'noisy'].includes(row.status));
  return { schema: 1, sha: candidate.source_sha, reference: latestStable?.release ?? 'нет замера последнего stable', anchor: anchor.release,
    requiresDecision: primary.some(row => row.blocks), needsMeasurement, primary, diagnostic,
    ready: !primary.some(row => row.blocks) };
}
export function renderMetrics(report) {
  const table = (title, rows) => [title, '', '| Метрика | База | Кандидат | Изменение | Итог |', '|---|---:|---:|---:|---|',
    ...rows.map(r => `| ${r.label} | ${r.before ?? 'нет данных'} | ${r.after ?? 'нет данных'} | ${r.percent === null ? '—' : r.percent.toFixed(1) + '%'} | ${r.status}${r.blocks ? ': решение владельца' : ''} |`)].join('\n');
  const notes = report.evidenceStatus && report.evidenceStatus !== 'complete'
    ? `Состояние замера: ${report.evidenceStatus}. Отсутствующие данные не означают успешную проверку.\n${(report.diagnostics ?? []).map(reason => `- ${reason}`).join('\n')}\n\n` : '';
  return notes + table(`Сравнение с ${report.reference}`, report.primary) + '\n\n' + table(`Диагностика с ${report.anchor} (не блокирует)`, report.diagnostic) + '\n';
}
