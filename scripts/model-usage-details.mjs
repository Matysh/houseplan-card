#!/usr/bin/env node
// #857: reporting dimensions only. Never publish transcript/errors/tool outputs.
import { readFileSync } from 'node:fs';
import { MODEL_USAGE_FIELDS, isCount } from './model-usage.mjs';
import { isMainModule } from './spawn-portable.mjs';

const record = v => v && typeof v === 'object' && !Array.isArray(v);
const modelId = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v)
  && !/^(?:gh[psuro]_|github_pat_|sk-)/.test(v);
const nullableCount = v => isCount(v) ? v : null;
const cost = v => Number.isFinite(v) && v >= 0 ? v : null;
const unknown = reason => ({ schema: 1, reason, models: [], turns: null, durationMs: null,
  finishReason: null, outcome: 'unknown', providerCostUsdEstimate: null,
  billing: 'provider-estimate-not-oauth-charge-or-quota' });

export function modelDetailsFromMessages(messages) {
  if (!Array.isArray(messages)) return unknown('unreadable');
  const r = messages.findLast(m => record(m) && m.type === 'result');
  if (!r) return unknown('no-result');
  const finishReason = /^[a-z][a-z0-9_]{0,79}$/.test(r.subtype || '') ? r.subtype : null;
  const outcome = /max_turns|max_budget/.test(finishReason || '') ? 'exhausted'
    : r.is_error === true || finishReason?.startsWith('error') ? 'error'
      : finishReason === 'success' ? 'success' : 'unknown';
  const unreadable = record(r.modelUsage) && (Object.keys(r.modelUsage).length > 32
    || Object.keys(r.modelUsage).some(id => !modelId(id)));
  const models = record(r.modelUsage) && !unreadable ? Object.entries(r.modelUsage)
    .filter(([id]) => modelId(id)).map(([id, values]) => ({ id,
      ...Object.fromEntries(Object.entries(MODEL_USAGE_FIELDS).map(([key, field]) => [key, nullableCount(values?.[field])])),
      costUsdEstimate: cost(values?.costUSD) })) : [];
  return { ...unknown(unreadable ? 'unreadable' : null), models, turns: nullableCount(r.num_turns), durationMs: nullableCount(r.duration_ms),
    finishReason, outcome, providerCostUsdEstimate: cost(r.total_cost_usd) };
}

export function modelDetailsFromExecutionFile(path, read = p => readFileSync(p, 'utf8')) {
  if (!String(path || '').trim()) return unknown('no-execution-file');
  try { return modelDetailsFromMessages(JSON.parse(read(path))); }
  catch { return unknown('unreadable'); }
}

export function validModelDetails(d) {
  return record(d) && d.schema === 1 && (d.reason === null || ['unreadable', 'no-result', 'no-execution-file', 'invalid'].includes(d.reason))
    && d.billing === 'provider-estimate-not-oauth-charge-or-quota'
    && ['unknown', 'success', 'exhausted', 'error'].includes(d.outcome)
    && (d.finishReason === null || /^[a-z][a-z0-9_]{0,79}$/.test(d.finishReason))
    && [d.turns, d.durationMs].every(v => v === null || isCount(v))
    && (d.providerCostUsdEstimate === null || cost(d.providerCostUsdEstimate) !== null)
    && Array.isArray(d.models) && d.models.length <= 32 && new Set(d.models.map(m => m?.id)).size === d.models.length
    && d.models.every(m => record(m) && modelId(m.id) && Object.keys(m).every(k => ['id', 'costUsdEstimate', ...Object.keys(MODEL_USAGE_FIELDS)].includes(k))
      && Object.keys(MODEL_USAGE_FIELDS).every(k => m[k] === null || isCount(m[k]))
      && (m.costUsdEstimate === null || cost(m.costUsdEstimate) !== null))
    && Object.keys(d).every(k => Object.keys(unknown(null)).includes(k));
}
export function formatModelDetails(d) {
  if (!validModelDetails(d)) d = unknown('invalid');
  return '<!-- hp:model-usage-v1 ' + Buffer.from(JSON.stringify(d)).toString('base64url') + ' -->';
}
export function parseModelDetails(line) {
  const m = /^<!-- hp:model-usage-v1 ([A-Za-z0-9_-]{1,32000}) -->$/.exec(String(line || ''));
  if (!m) return null;
  try { const d = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); return validModelDetails(d) ? d : null; }
  catch { return null; }
}
export function publishedModelDetails(raw) { return formatModelDetails(parseModelDetails(raw) || unknown('invalid')); }
export function modelSummary(raw) {
  const d = parseModelDetails(raw) || unknown('invalid');
  const value = v => v === null ? 'unknown' : String(v);
  return `outcome=${d.outcome}; finish=${d.finishReason || 'unknown'}; turns=${value(d.turns)}; duration_ms=${value(d.durationMs)}; `
    + (d.models.length ? d.models.map(m => `${m.id} [${Object.keys(MODEL_USAGE_FIELDS).map(k => `${k}=${value(m[k])}`).join(', ')}]`).join('; ') : 'models=unknown')
    + `; provider_cost_usd_estimate=${value(d.providerCostUsdEstimate)} (not OAuth charge/quota)`;
}
export function lastModelDetailsIn(text) {
  let found = null;
  for (const line of String(text || '').split('\n')) { const d = parseModelDetails(line.trim()); if (d) found = d; }
  return found;
}
export function completeOutcomeAllowed(line) {
  const d = parseModelDetails(line);
  // Usage is reporting, never positive authority. Known interrupted SDK result
  // is an extra refusal; missing reporting cannot substitute a full sealed verdict.
  return !d || !['exhausted', 'error'].includes(d.outcome);
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  if (process.argv.some(a => a.startsWith('--summary-line='))) console.log(modelSummary(arg('summary-line')));
  else if (process.argv.some(a => a.startsWith('--require-complete-line='))) {
    if (!completeOutcomeAllowed(arg('require-complete-line'))) { console.error('model result interrupted: no complete verdict may be published'); process.exitCode = 1; }
  } else console.log(formatModelDetails(modelDetailsFromExecutionFile(arg('execution-file'))));
}
