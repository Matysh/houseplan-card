#!/usr/bin/env node
// #1082: a lossy diagnostic, never a review result or an admission decision.
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, mkdirSync, openSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { literalArgv, toolProblem, REVIEW_CLI_VERSION } from './review-execution-policy.mjs';
import { knownToolName, projectStoredDecision, projectStoredToolMetadata, reviewDecisionMetadata, reviewToolMetadata } from './review-tool-metadata.mjs';
import { isMainModule } from './spawn-portable.mjs';
import { CALL_DIGEST_ALGORITHM, LEGACY_CALL_DIGEST_ALGORITHM, callDigest, legacyCallDigest } from './review-call-digest.mjs';
import { NATIVE_CALL_DIGEST_ALGORITHM, nativeCallDigest } from './review-native-call-digest.mjs';
import { readReviewCapabilities } from './review-capabilities.mjs';

export const FAILURE_LIMITS = Object.freeze({ traceBytes: 64 * 1024 * 1024, policyBytes: 4 * 1024 * 1024,
  journalBytes: 2 * 1024 * 1024, calls: 256, journalRows: 2048, denials: 64, certificateBytes: 256 * 1024 });
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => { try { return hash(JSON.stringify(value) ?? 'undefined'); } catch { return null; } };
const vocabulary = value => new Set(value.split(' '));
const REASONS = vocabulary('malformed-tool missing-journal duplicate-journal input-digest-mismatch call-digest-algorithm-unavailable invalid-json-tool-call decision-mismatch forbidden-request missing-result duplicate-result duplicate-tool-id');
// Even a syntactically plausible tool ID/key/name could contain a credential.
// Correlation therefore uses hashes; only fixed vocabulary reaches the artifact.
const identity = value => typeof value === 'string' ? digest(value) : null;
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) ? value : null;
const number = value => /^\d{1,16}$/.test(String(value ?? '')) ? String(value) : null;
const state = (value, values) => values.includes(value) ? value : 'unknown';

function inputShape(input, policy) {
  const value = reviewToolMetadata(undefined, input, { files: policy?.files, literalArgv });
  return { keys: value.keys, orderedKeyDigests: value.orderedKeyDigests, omittedKeys: value.omittedKeys,
    otherKeyCount: value.otherKeyCount, digest: value.inputDigest, type: value.inputType,
    fields: value.fields, command: value.command, check: value.check ?? null, digestAlgorithm: LEGACY_CALL_DIGEST_ALGORITHM };
}

// Absent markers describe the old wire algorithm only in OLD diagnostics.
// They never acquire current audit authority or new ToolSearch semantics.
function algorithmInfo(record, implicitLegacy = false) {
  const present = record && Object.hasOwn(record, 'callDigestAlgorithm'), value = record?.callDigestAlgorithm;
  if ([NATIVE_CALL_DIGEST_ALGORITHM, CALL_DIGEST_ALGORITHM, LEGACY_CALL_DIGEST_ALGORITHM].includes(value))
    return { algorithm: value, source: 'explicit', unknownMarkerDigest: null };
  if (!present && implicitLegacy)
    return { algorithm: LEGACY_CALL_DIGEST_ALGORITHM, source: 'implicit-legacy', unknownMarkerDigest: null };
  return { algorithm: 'unknown', source: present ? 'unsupported' : 'missing', unknownMarkerDigest: present ? digest(value) : null };
}

function callSummary(call, entries, results, policy, final, duplicate) {
  const id = call?.id, matches = typeof id === 'string' ? entries.filter(row => row?.id === id) : [];
  const policyAlgorithm = algorithmInfo(policy, policy?.schema === 1);
  const journalAlgorithm = algorithmInfo(matches.length === 1 ? matches[0] : null,
    matches.length === 1 && policyAlgorithm.algorithm === LEGACY_CALL_DIGEST_ALGORITHM);
  let expectedReason = 'policy-unavailable';
  try { if (policy?.schema === 2 && policyAlgorithm.algorithm === NATIVE_CALL_DIGEST_ALGORITHM) {
    readReviewCapabilities(policy);
    expectedReason = toolProblem({ tool_name: call?.name, tool_input: call?.input }, policy);
  } }
  catch { expectedReason = 'policy-evaluation-unavailable'; }
  const decisionKnown = !['policy-unavailable', 'policy-evaluation-unavailable'].includes(expectedReason);
  const schemaChannel = call?.name === 'StructuredOutput' && isDeepStrictEqual(call.input, final?.structured_output);
  let inputDigest = null;
  try {
    if (policyAlgorithm.algorithm === NATIVE_CALL_DIGEST_ALGORITHM) inputDigest = nativeCallDigest(call?.name, call?.input);
    else if (policyAlgorithm.algorithm === CALL_DIGEST_ALGORITHM) inputDigest = callDigest(call?.name, call?.input);
    else if (policyAlgorithm.algorithm === LEGACY_CALL_DIGEST_ALGORITHM) inputDigest = legacyCallDigest(call?.name, call?.input);
  } catch { /* Invalid or unsupported JSON has no digest-comparison authority. */ }
  const comparable = inputDigest !== null && journalAlgorithm.algorithm !== 'unknown'
    && journalAlgorithm.algorithm === policyAlgorithm.algorithm;
  const inputMatches = matches.length === 1 && comparable ? matches[0].input === inputDigest : null;
  const resultCount = results.filter(row => row?.tool_use_id === id).length;
  const actualMetadata = matches.length === 1 ? projectStoredToolMetadata(matches[0].diagnostic) : null;
  const actualDecision = matches.length === 1 ? projectStoredDecision(matches[0].diagnosticDecision) : null;
  const traceMetadata = reviewToolMetadata(call?.name, call?.input, { files: policy?.files, literalArgv });
  const reasons = [];
  if (typeof id !== 'string') reasons.push('malformed-tool');
  if (duplicate) reasons.push('duplicate-tool-id');
  if (!matches.length && !schemaChannel) reasons.push('missing-journal');
  if (matches.length > 1) reasons.push('duplicate-journal');
  if (matches.length === 1 && !comparable) reasons.push(inputDigest === null
    && [NATIVE_CALL_DIGEST_ALGORITHM, CALL_DIGEST_ALGORITHM].includes(policyAlgorithm.algorithm) ? 'invalid-json-tool-call' : 'call-digest-algorithm-unavailable');
  if (inputMatches === false) reasons.push('input-digest-mismatch');
  if (decisionKnown && matches.length === 1 && matches[0].denied !== Boolean(expectedReason)) reasons.push('decision-mismatch');
  if (decisionKnown && expectedReason || !decisionKnown && inputMatches === true && matches[0].denied === true)
    reasons.push('forbidden-request');
  if (resultCount !== 1) reasons.push(resultCount ? 'duplicate-result' : 'missing-result');
  return { toolUseIdDigest: identity(id), tool: knownToolName(call?.name), toolNameDigest: identity(call?.name),
    input: inputShape(call?.input, policy), callDigest: { algorithm: policyAlgorithm, digest: inputDigest },
    expected: { denied: decisionKnown ? Boolean(expectedReason) : null,
      semantics: decisionKnown ? 'current' : policy?.schema === 1 || policyAlgorithm.algorithm === CALL_DIGEST_ALGORITHM ? 'legacy-not-re-evaluated' : 'unavailable',
      ...reviewDecisionMetadata(expectedReason) },
    journal: { count: matches.length, callDigestAlgorithm: journalAlgorithm, inputDigestMatches: inputMatches,
      denied: matches.length === 1 && typeof matches[0].denied === 'boolean' ? matches[0].denied : null,
      reasonAvailable: Boolean(actualDecision), decision: actualDecision, metadata: actualMetadata,
      decisionAgreesWithTrace: decisionKnown && actualDecision ? isDeepStrictEqual(actualDecision, reviewDecisionMetadata(expectedReason)) : null,
      metadataAgreesWithTrace: actualMetadata ? isDeepStrictEqual(actualMetadata, traceMetadata) : null },
    terminalSchemaChannel: schemaChannel, resultCount, problems: reasons.filter(reason => REASONS.has(reason)) };
}

export function buildFailureCertificate({ messages, entries, policy, provenance = {}, inputs = {} }) {
  const trace = Array.isArray(messages) ? messages : [], journal = Array.isArray(entries) ? entries : [];
  const blocks = trace.filter(row => row?.type === 'assistant').flatMap(row => Array.isArray(row.message?.content) ? row.message.content : []);
  const calls = blocks.filter(block => block?.type === 'tool_use');
  const results = trace.filter(row => row?.type === 'user').flatMap(row => Array.isArray(row.message?.content)
    ? row.message.content.filter(block => block?.type === 'tool_result') : []);
  const final = trace.findLast(row => row?.type === 'result');
  const ids = new Set(), duplicates = new Set();
  for (const call of calls) { if (ids.has(call.id)) duplicates.add(call.id); ids.add(call.id); }
  const denials = Array.isArray(final?.permission_denials) ? final.permission_denials : [];
  const certificate = { schema: 'houseplan-review-failure/v1', diagnosticOnly: true, verdictAuthority: false,
    provenance: { run: number(provenance.run), attempt: number(provenance.attempt), issue: number(provenance.issue),
      kind: state(provenance.kind, ['task', 'ship', 'release']), stage: state(provenance.stage, ['spec', 'code', 'ship', 'release']),
      materialSha: sha(provenance.materialSha), policyMaterialSha: sha(policy?.sha), toolsSha: sha(provenance.toolsSha),
      policySchema: [1, 2].includes(policy?.schema) ? policy.schema : null,
      capabilityDigest: policy?.schema === 2 && /^[a-f0-9]{64}$/.test(policy.capabilities?.digest || '') ? policy.capabilities.digest : null,
      callDigestAlgorithm: algorithmInfo(policy, policy?.schema === 1),
      cliVersion: policy?.cliVersion === REVIEW_CLI_VERSION ? REVIEW_CLI_VERSION : null,
      materialMatchesPolicy: sha(provenance.materialSha) && sha(policy?.sha) ? provenance.materialSha === policy.sha : null },
    inputs, limits: FAILURE_LIMITS,
    summary: { traceMessages: trace.length, toolCalls: calls.length, journalRows: journal.length,
      malformedJournalRows: journal.filter(row => !row || typeof row.id !== 'string'
        || typeof row.input !== 'string' || !/^[a-f0-9]{64}$/.test(row.input) || typeof row.denied !== 'boolean').length,
      orphanJournalRows: journal.filter(row => !ids.has(row?.id)).length,
      orphanResults: results.filter(row => !ids.has(row?.tool_use_id)).length,
      terminalResult: Boolean(final), terminalSubtype: state(final?.subtype, ['success', 'error_max_turns', 'error_during_execution', 'error_max_budget_usd', 'error_max_structured_output_retries']),
      terminalError: typeof final?.is_error === 'boolean' ? final.is_error : null, permissionDenials: denials.length,
      terminalStructuredOutputDigest: digest(final?.structured_output),
      metadataBlocks: blocks.filter(block => ['server_tool_use', 'tool_reference'].includes(block?.type)).length },
    // Metadata shapes are observed, not granted a missing-journal exemption.
    metadataChannels: blocks.filter(block => ['server_tool_use', 'tool_reference'].includes(block?.type))
      .slice(0, FAILURE_LIMITS.denials).map(block => ({ type: block.type,
        tool: knownToolName(block.name ?? block.tool_name), toolNameDigest: identity(block.name ?? block.tool_name),
        toolUseIdDigest: identity(block.id), input: inputShape(block.input, policy) })),
    calls: calls.slice(0, FAILURE_LIMITS.calls).map(call => callSummary(call, journal, results, policy, final, duplicates.has(call.id))),
    denials: denials.slice(0, FAILURE_LIMITS.denials).map(row => ({ toolUseIdDigest: identity(row?.tool_use_id),
      tool: knownToolName(row?.tool_name), toolNameDigest: identity(row?.tool_name), input: inputShape(row?.tool_input, policy) })),
    omitted: { calls: Math.max(0, calls.length - FAILURE_LIMITS.calls), denials: Math.max(0, denials.length - FAILURE_LIMITS.denials),
      metadataChannels: Math.max(0, blocks.filter(block => ['server_tool_use', 'tool_reference'].includes(block?.type)).length - FAILURE_LIMITS.denials) },
    limitations: ['No raw argv, filenames, prompts, Write content, tool results, MCP configuration or environment values.',
      'Tool identifiers are pseudonymized; fixed vocabulary and hashes are not an execution trace.',
      'This certificate neither admits a tool call nor repairs/approves a missing review result.',
      'Absent, truncated or unreadable evidence cannot establish what executed.'] };
  while (Buffer.byteLength(JSON.stringify(certificate)) + 1 > FAILURE_LIMITS.certificateBytes) {
    const name = certificate.calls.length ? 'calls' : certificate.metadataChannels.length ? 'metadataChannels' : 'denials';
    if (!certificate[name].length) throw new Error('diagnostic header exceeds bound');
    certificate[name].pop(); certificate.omitted[name]++;
  }
  return certificate;
}

/** Read only regular bounded inputs. Errors never reflect their raw text/path. */
export function readDiagnosticInput(path, maxBytes, { jsonl = false } = {}) {
  if (!path) return { status: 'missing', value: null, sha256: null };
  let fd;
  try {
    if (realpathSync(path) !== resolve(path)) return { status: 'symlink-refused', value: null, sha256: null };
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = fstatSync(fd);
    if (!stat.isFile()) return { status: 'not-regular', value: null, sha256: null };
    if (stat.size > maxBytes) return { status: 'oversize', value: null, sha256: null };
    // A growing input must not turn the stat check into an unbounded read.
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0, count;
    while (length < buffer.length && (count = readSync(fd, buffer, length, buffer.length - length, null)) > 0) length += count;
    if (length > maxBytes) return { status: 'oversize', value: null, sha256: null };
    const bytes = buffer.subarray(0, length);
    const sha256 = hash(bytes);
    try {
      if (jsonl) {
        const lines = bytes.toString('utf8').split('\n').filter(Boolean);
        const value = lines.slice(0, FAILURE_LIMITS.journalRows).map(line => JSON.parse(line));
        return { status: lines.length > value.length ? 'truncated' : 'read', sha256, value, omitted: lines.length - value.length };
      }
      return { status: 'read', sha256, value: JSON.parse(bytes.toString('utf8')) };
    } catch { return { status: 'invalid-json', value: null, sha256 }; }
  } catch { return { status: 'unreadable-or-missing', value: null, sha256: null }; }
  finally { if (fd !== undefined) closeSync(fd); }
}

export function collectFailureCertificate({ policyPath, tracePath, provenance, output }) {
  const policy = readDiagnosticInput(policyPath, FAILURE_LIMITS.policyBytes);
  const trace = readDiagnosticInput(tracePath, FAILURE_LIMITS.traceBytes);
  const journal = readDiagnosticInput(policyPath ? `${policyPath}.jsonl` : '', FAILURE_LIMITS.journalBytes, { jsonl: true });
  const metadata = (row, expected) => ({ status: row.status, sha256: row.sha256, omitted: row.omitted ?? 0,
    shape: row.value === null ? 'unavailable' : expected === 'array' ? (Array.isArray(row.value) ? 'expected' : 'wrong')
      : [1, 2].includes(row.value?.schema) && typeof row.value.root === 'string' && Array.isArray(row.value.files) ? 'expected' : 'wrong' });
  const certificate = buildFailureCertificate({ policy: policy.value, messages: trace.value, entries: journal.value,
    provenance, inputs: { policy: metadata(policy, 'policy'), trace: metadata(trace, 'array'), journal: metadata(journal, 'array') } });
  mkdirSync(dirname(output), { recursive: true });
  // Unique trusted path, not a model-written artifact or a raw runner directory.
  const path = resolve(dirname(output), `certificate-${randomUUID()}.json`);
  writeFileSync(path, JSON.stringify(certificate) + '\n', { flag: 'wx', mode: 0o600 });
  return path;
}

if (isMainModule(import.meta.url)) {
  try {
    const env = process.env;
    const path = collectFailureCertificate({ policyPath: env.REVIEW_DIAGNOSTIC_POLICY,
      tracePath: env.REVIEW_EXECUTION_FILE || env.REVIEW_DIAGNOSTIC_TRACE_FALLBACK,
      output: env.REVIEW_DIAGNOSTIC_OUTPUT,
      provenance: { run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, issue: env.REVIEW_DIAGNOSTIC_ISSUE,
        kind: env.REVIEW_DIAGNOSTIC_KIND, stage: env.REVIEW_DIAGNOSTIC_STAGE,
        materialSha: env.REVIEW_DIAGNOSTIC_SHA, toolsSha: env.REVIEW_DIAGNOSTIC_TOOLS_SHA } });
    // Only the exact newly created file is uploaded; no wildcard runner directory.
    if (env.GITHUB_OUTPUT) writeFileSync(env.GITHUB_OUTPUT, `certificate=${path}\n`, { flag: 'a' });
    console.log('Bounded diagnostic-only failure certificate collected; no review result published.');
  } catch { console.error('Failure certificate could not be collected; no evidence or verdict authority.'); process.exitCode = 1; }
}
