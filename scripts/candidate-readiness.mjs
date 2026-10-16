// #858: a read-only envelope, not another publisher or proof controller.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCatalogue } from './release-ledger.mjs';
import { issueBodyDigest } from './review-doc-guard.mjs';
import { verifyBundleTree, compareBundleTrees } from './bundle-tree.mjs';
import { assertCommittedBundleFresh } from './bundle-policy.mjs';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { goldenAcceptanceRefusal } from './golden-acceptance.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { versionFromTag } from './release-contract.mjs';
import { readStableFieldDecision, stableFieldDecisionRefusal } from './stable-field-decision.mjs';

export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value)
  ? value : JSON.stringify(value)).digest('hex');
const unique = a => [...new Set(a)].sort();
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
export const NATIVE_PROFILES = Object.freeze({
  editor: [
    { id: 'editor-wall-selection', script: 'demo/smoke_wallthick_standalone.mjs', oracle: 'public room/partition dialog opening, one visible physical band during held dialog/camera input, exact no-write snapshots, Apply/Undo and lifecycle retirement' },
    { id: 'editor-dialog-input', script: 'demo/smoke_canvas_surface_gestures.mjs', oracle: 'native text selection, bounded captured dialog movement and fixed intermediate camera frames; LED ownership, touch/pen safety and unchanged config/history' },
    { id: 'editor-physical', script: 'demo/smoke_physical_body_characterization.mjs', oracle: 'native body/rotation thresholds, 1/0/1 renders, queue cancellation, one transaction and late overlap/duplicate/tap controls' },
    { id: 'editor-backdrop', script: 'demo/smoke_backdrop.mjs', oracle: 'native body/frame transforms, frozen viewBox through release, rotation modifiers and six-field reset' },
    { id: 'editor-hosted-preview', script: 'demo/smoke_partition_openings_preview.mjs', oracle: 'actual held door/window ink at two targets, one visible copy, other host unchanged, Esc/Undo/trusted cancel and exact release' },
  ],
  geometry: [
    { id: 'geometry-ordinary', script: 'demo/smoke_wall_node_move.mjs', oracle: 'preview equals committed geometry; Esc makes no write; Undo restores openings' },
    { id: 'geometry-neighbour', script: 'demo/smoke_wall_node_topology.mjs', oracle: 'T/X slides, Esc/Undo across 100 cycles, unsupported/rejected moves never write' },
  ],
  view: [
    { id: 'view-ordinary', script: 'demo/smoke_live_pan_coverage.mjs', oracle: 'native mouse pan: held edge pixels stay covered and marker/room movement agrees' },
    { id: 'view-neighbour', script: 'demo/smoke_live_pan_coverage.mjs', oracle: 'native touch pinch, 2.5D and kiosk: held coverage and terminal cleanup' },
  ],
});
/** #929: field QA is optional on every channel; scene intent keeps #889's boundary. */
export function candidatePolicy(version) {
  const beta = typeof version === 'string'
    && versionFromTag(`v${version}`).prerelease
    && /^\d+\.\d+\.\d+-beta\.[1-9]\d*$/.test(version);
  return { channel: beta ? 'beta' : 'strict', scenePlanRequired: !beta, manualAcceptanceRequired: false };
}
export function requiredProfiles(entry, files) {
  if (entry.category === 'infra') return [];
  const majorFrontend = entry.category === 'major' && files.some(f => f.startsWith('src/'));
  return unique([
    ...(files.some(f => /^src\/(?:physical-body-gesture|backdrop-frame-gesture|live-editor|canvas-surface-gestures|wall-thickness-dialog-gesture|wall-thickness-selection)\.ts$/.test(f)) ? ['editor'] : []),
    ...(files.some(f => /(?:wall[-_]|geometry|resize|opening)/.test(f)) ? ['geometry'] : []),
    ...(majorFrontend || files.some(f => /(?:live-interaction|live-view|viewport|gesture|visual-continuity)/.test(f)) ? ['view'] : []),
  ]);
}
export function ownerRecord(comments, marker, owner) {
  // The login comes from GitHub metadata, never from the JSON's claimed author.
  const prefix = `<!-- hp:${marker}\n`;
  for (const comment of [...comments].reverse()) {
    if (comment.user?.login?.toLowerCase() !== owner.toLowerCase()) continue;
    const start = String(comment.body || '').indexOf(prefix);
    if (start < 0) continue;
    const end = comment.body.indexOf('\n-->', start);
    if (end < 0) return { invalid: 'unterminated owner record' };
    try { return { ...JSON.parse(comment.body.slice(start + prefix.length, end)), comment: comment.id, url: comment.html_url }; }
    catch { return { invalid: 'invalid owner JSON' }; }
  }
  return null;
}
// An incomplete optional observation cannot erase a separate explicit veto.
// Only a newer authenticated decision about this exact material supersedes it.
function fieldVeto(comments, material, owner) {
  for (const comment of [...comments].reverse()) {
    const record = ownerRecord([comment], 'candidate-acceptance', owner);
    if (record?.schema !== 1 || record.material !== material) continue;
    if (record.verdict === 'accepted') return null;
    if (['rejected', 'revoked'].includes(record.verdict)) return record;
  }
  return null;
}
export function sceneDelta({ issue, filesKey, owner, sceneIds, required = false }) {
  const plan = ownerRecord(issue.comments || [], 'candidate-plan', owner);
  if (!plan) return { change: [], new: [], blocker: required ? `#${issue.number}: ci:golden needs an owner-reviewed scene plan (including an explicit empty plan)` : null };
  const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
  if (plan.schema !== 1 || plan.issue !== issue.number || plan.body !== issueBodyDigest(issue.body)
    || plan.issueMaterial !== filesKey || !plan.reason?.trim()
    || !Array.isArray(plan.change) || !Array.isArray(plan.new)
    || !(issue.state === 'closed' || labels.includes('S8-merged')))
    return { change: [], new: [], blocker: `#${issue.number}: scene plan is stale/unreviewed; bind fresh body and delivered material` };
  if ([...plan.change, ...plan.new].some(id => !sceneIds.includes(id))
    || plan.change.some(id => plan.new.includes(id))) return { change: [], new: [], blocker: `#${issue.number}: unknown or overlapping scene IDs` };
  return { change: unique(plan.change), new: unique(plan.new), review: { comment: plan.comment, url: plan.url } };
}
export function acceptanceRefusal(record, context) {
  // Optional, user-authored JSON is not a publication dependency. Any bad
  // shape remains an unverified observation, never a thrown readiness gate.
  try { return optionalObservationRefusal(record, context); }
  catch { return 'optional field observation is malformed'; }
}
function optionalObservationRefusal(record, { material, cases, scripts, gpu, input }) {
  if (!record || record.schema !== 1 || record.material !== material || record.verdict !== 'accepted'
    || record.surface !== 'dev' || !record.environment?.browser || !record.environment?.os
    || !Array.isArray(record.cases)) return 'optional field observation is incomplete or stale';
  if (!record.native || record.native.pass !== true || record.native.sha !== input.sha || record.native.tree !== input.tree
    || record.native.bundle !== input.manifest || digest(record.native.pins) !== digest(input.pins)
    || !record.native.environment?.browser || !record.native.environment?.node || !Array.isArray(record.native.cases))
    return 'optional native report does not bind candidate bundle/pins/actual environment';
  for (const item of cases) {
    const proof = record.cases.find(c => c.id === item.id);
    const native = record.native.cases.find(c => c.id === item.id);
    if (!proof || proof.pass !== true || !proof.observed?.trim() || !proof.evidence?.match(/^https:\/\//)
      || proof.script !== item.script || proof.scriptHash !== scripts[item.script]
      || !HASH.test(proof.nativeOutput || '') || native?.pass !== true || native.script !== item.script
      || native.scriptHash !== proof.scriptHash || native.nativeOutput !== proof.nativeOutput)
      return `optional observation lacks native ordinary/neighbour observable: ${item.id}`;
  }
  if (gpu && (record.environment.realGpu !== true || !record.environment.gpu?.trim()
    || record.environment.headless !== false || !record.gpuEvidence?.match(/^https:\/\//)))
    return 'optional observation does not establish real-GPU/browser evidence; headless is not a substitute';
  return null;
}
export function buildCandidate({ input, issues, proof, owner, sceneIds = GOLDEN_SCENARIOS.map(s => s.id) }) {
  if (!SHA.test(input.sha || '') || !SHA.test(input.tree || '')) throw Error('exact candidate SHA/tree required');
  const policy = candidatePolicy(input.version);
  const blockers = [], warnings = [], plans = [], profiles = new Set();
  let fieldDecision = null;
  if (input.fieldDecision) {
    const issue = issues.find(i => i.number === input.fieldDecision.issue);
    const record = ownerRecord(issue?.comments || [], 'stable-field-decision', owner);
    const refusal = stableFieldDecisionRefusal(input.fieldDecision, record, { version: input.version, owner });
    fieldDecision = { input: input.fieldDecision, record, refusal };
    if (refusal) blockers.push(refusal);
    else {
      policy.scenePlanRequired = false;
      policy.fieldAcceptance = 'owner-confirmed-prerelease-promotion';
      warnings.push(`Owner accepted ${record.testedTag} on the stand by chat; linked per-issue records waived for ${record.tag} only. No native/GPU observation is fabricated.`);
    }
  }
  for (const entry of input.catalogue.entries) {
    const issue = issues.find(i => i.number === entry.issue);
    if (!issue) throw Error(`missing fresh issue #${entry.issue}`);
    const files = input.issueFiles[entry.issue] || [];
    requiredProfiles(entry, files).forEach(p => profiles.add(p));
    const filesKey = input.issueMaterials[entry.issue];
    const golden = issue.labels?.some(l => (l.name || l) === 'ci:golden');
    const delta = sceneDelta({ issue, filesKey, owner, sceneIds,
      required: golden && policy.scenePlanRequired });
    if (delta.blocker) blockers.push(delta.blocker);
    if (golden && !policy.scenePlanRequired && !delta.review && !delta.blocker)
      warnings.push(`#${issue.number}: ${policy.channel === 'beta' ? 'beta' : 'owner-confirmed promotion'} has no additional owner scene plan; no intentional pixel changes declared`);
    plans.push({ issue: entry.issue, body: issueBodyDigest(issue.body), issueMaterial: filesKey, ...delta });
  }
  const cases = [...profiles].sort().flatMap(p => NATIVE_PROFILES[p]);
  const gpu = cases.length > 0 && Object.values(input.issueFiles).flat().some(f =>
    /(?:render|styles|live-|iso-|wall-node|houseplan-card)/.test(f));
  const scenes = { change: unique(plans.flatMap(p => p.change)), new: unique(plans.flatMap(p => p.new)) };
  if (scenes.change.some(id => scenes.new.includes(id))) blockers.push('conflicting change/new declarations across issues');
  // No clock or Actions timestamps in material. Proof/receipt changes get their
  // own complete identity; acceptance never authorizes a different body/pin/tree.
  const material = digest({ schema: 1, ...input, plans, cases, gpu, policy });
  const receipts = [];
  for (const entry of input.catalogue.entries) {
    const localCases = requiredProfiles(entry, input.issueFiles[entry.issue] || []).flatMap(p => NATIVE_PROFILES[p]);
    if (!localCases.length) continue;
    const comments = issues.find(i => i.number === entry.issue).comments || [];
    const record = ownerRecord(comments, 'candidate-acceptance', owner);
    // No receipt is required, and missing optional QA is not another warning
    // asking the owner to perform it. Supplied observations retain their limits.
    const refusal = record ? acceptanceRefusal(record, { material, cases: localCases, scripts: input.scripts, gpu, input }) : null;
    // Only an explicit authenticated rejection of THIS material blocks; a bad
    // optional receipt must not resurrect the retired mandatory field gate.
    const veto = fieldVeto(comments, material, owner);
    if (veto) blockers.push(`#${entry.issue}: explicit owner ${veto.verdict} for this candidate`);
    else if (refusal) warnings.push(`#${entry.issue}: optional field observation: ${refusal}`);
    receipts.push({ issue: entry.issue, record, refusal });
  }
  if (proof.status !== 'green') blockers.push(`full exact-SHA Validate is ${proof.status}: ${proof.note || 'proof unavailable'} ${proof.url || ''}`);
  const record = { schema: 1, material, input, policy, ...(fieldDecision ? { fieldDecision } : {}), plans, scenes, cases, gpu, receipts, proof, blockers, warnings };
  return { ...record, identity: digest(record), ready: blockers.length === 0, publish: false,
    planTemplates: plans.filter(p => p.blocker).map(p => ({ schema: 1, issue: p.issue, body: p.body,
      issueMaterial: p.issueMaterial, change: [], new: [], reason: 'Explain reviewed intent; empty arrays are an explicit no-scene-change declaration.' })),
    next: blockers.length ? 'Repair named blockers; re-run read-only prepare. Scene catalogue: --list-scenes. Optional native scenes: npm run release:native. Never accept unrelated golden regions.'
      : 'Prepared only. Use the existing owner release command; full gates and publication confirmation remain mandatory.' };
}
export function intentionalDrift(results, scenes, sceneIds = GOLDEN_SCENARIOS.map(s => s.id)) {
  if (!Array.isArray(results) || !results.length || results.some(r => !['passed', 'different', 'missing-baseline'].includes(r.status))) return false;
  if (results.length !== sceneIds.length || unique(results.map(r => r.id)).join('\0') !== unique(sceneIds).join('\0')) return false;
  return results.some(r => r.status !== 'passed') && !goldenAcceptanceRefusal(results, scenes.change, scenes.new);
}
export function candidateInputs({ candidate = 'HEAD', root = process.cwd(), gitRunner, publicationCheck = false } = {}) {
  const git = gitRunner || (args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim());
  const sha = git(['rev-parse', `${candidate}^{commit}`]);
  const dirt = git(['status', '--porcelain']).split('\n').filter(Boolean);
  // Only the existing publishers' generated, untracked asset containers may
  // coexist with a last-moment check. No tracked/source/config edit is ignored.
  const unsafe = dirt.filter(l => !(publicationCheck && l.startsWith('?? ')
    && /^(?:houseplan\.zip|release-assets\/|passport\/|existing-public\/)$/.test(l.slice(3))));
  if (git(['rev-parse', 'HEAD']) !== sha || unsafe.length) throw Error('prepare requires a clean exact-candidate checkout');
  const catalogue = readCatalogue({ candidate: sha, gitRunner: git });
  const issueFiles = {}, issueMaterials = {};
  for (const entry of catalogue.entries) {
    const files = unique(entry.commits.flatMap(c => git(['diff-tree', '--first-parent', '-m', '--root', '--no-commit-id', '-r', '--name-only', c]).split('\n').filter(Boolean)));
    issueFiles[entry.issue] = files;
    issueMaterials[entry.issue] = digest(files.map(f => [f, git(['ls-tree', sha, '--', f])]));
  }
  const manifest = verifyBundleTree(resolve(root, 'dist'));
  compareBundleTrees(resolve(root, 'dist'), resolve(root, 'custom_components/houseplan/frontend'));
  assertCommittedBundleFresh(manifest, sourceFingerprint(root));
  const pins = Object.fromEntries(['.nvmrc', '.python-version', 'package-lock.json', 'tests_backend/requirements.txt',
    '.github/workflows/validate.yml', 'demo/golden/matrix.mjs'].map(f => [f, digest(git(['show', `${sha}:${f}`]))]));
  const scripts = Object.fromEntries(unique(Object.values(NATIVE_PROFILES).flat().map(c => c.script))
    .map(f => [f, digest(readFileSync(resolve(root, f)))]));
  // Read the channel from the exact committed material, never a CLI/env waiver.
  const version = JSON.parse(git(['show', `${sha}:package.json`])).version;
  candidatePolicy(version);
  const fieldDecision = readStableFieldDecision({ candidate: sha, version, root, git });
  return { sha, tree: git(['rev-parse', `${sha}^{tree}`]), version, manifest: digest(manifest), pins, catalogue, issueFiles, issueMaterials, scripts,
    ...(fieldDecision ? { fieldDecision } : {}) };
}
