import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const card = fs.readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const resize = fs.readFileSync(new URL('../src/resize.ts', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles.ts', import.meta.url), 'utf8');
const en = JSON.parse(fs.readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8'));
const ru = JSON.parse(fs.readFileSync(new URL('../src/i18n/ru.json', import.meta.url), 'utf8'));

test('#277 production controller reaches only fixed-topology Resize', () => {
  for (const removed of [
    'planEdgeDrag', 'applyEdgeDrag', 'clampEdgeDrag',
    'applyRoomScale', 'clampRoomScale', '_rszCornerDown', '_rszScaleLabels',
    'simplifyPoly(',
  ]) assert.equal(card.includes(removed), false, `${removed} remains reachable in the card`);
  for (const required of ['resolveSafeResize', 'applySafeResize', 'clampSafeResize', 'validateSafeResize']) {
    assert.equal(card.includes(required), true, `${required} is missing from the controller`);
  }
});

test('#277 corner scale visuals are removed and disabled handles stay accessible', () => {
  for (const removed of ['.rszcorner', '.rszknob', '.rszframe']) {
    assert.equal(styles.includes(removed), false, `${removed} remains in product styles`);
  }
  assert.match(card, /aria-disabled=/);
  assert.match(card, /tabindex="0"/);
  assert.match(card, /_rszDisabledKey/);
  assert.match(styles, /cursor: not-allowed/);
});

test('#277 every stable disabled reason and commit failure is localized RU/EN', () => {
  for (const reason of [
    'diagonal', 'side-angle', 'duplicate-physical-wall', 'partial-shared',
    'unequal-shared', 'multiple-rooms', 'thickness-conflict',
    'opening-conflict', 'invalid-geometry',
  ]) {
    const key = `resize.disabled.${reason}`;
    assert.equal(typeof en[key], 'string', `missing EN ${key}`);
    assert.equal(typeof ru[key], 'string', `missing RU ${key}`);
    assert.ok(en[key].trim() && ru[key].trim());
  }
  assert.ok(en['resize.commit_failed']);
  assert.ok(ru['resize.commit_failed']);
});

test('#292 audit and production render share one resolver and reason contract', () => {
  const audit = resize.match(/export function auditSafeResizeEligibility[\s\S]*?\n}\n\n\/\*\* Apply/);
  assert.ok(audit, 'eligibility audit source is missing');
  assert.match(audit[0], /resolveSafeResize\(/);
  assert.match(card, /const result = resolveSafeResize\(/);
  assert.match(resize, /export type SafeResizeReason = typeof SAFE_RESIZE_REASONS\[number\]/);
  assert.doesNotMatch(audit[0], /sideEdgesArePerpendicular|validateSafeResize|obstacleOverlaysMovingEdge/,
    'the audit must not grow a second eligibility implementation');
});

test('#292 disabled explanations are human-readable and only unconditional repair is actionable', () => {
  for (const dictionary of [en, ru]) {
    for (const reason of [
      'diagonal', 'side-angle', 'duplicate-physical-wall', 'partial-shared',
      'unequal-shared', 'multiple-rooms', 'thickness-conflict',
      'opening-conflict', 'invalid-geometry',
    ]) assert.equal(dictionary[`resize.disabled.${reason}`].includes(reason), false);
  }
  assert.match(en['resize.disabled.duplicate-physical-wall'], /remove or move/i);
  assert.match(ru['resize.disabled.duplicate-physical-wall'], /удалите или переместите/i);
  assert.doesNotMatch(en['resize.disabled.diagonal'] + en['resize.disabled.side-angle'], /Optimize/i);
  assert.doesNotMatch(ru['resize.disabled.diagonal'] + ru['resize.disabled.side-angle'], /Оптимиз/i);
});

test('#277 a lossy persistence rekey stops at the last complete preview', () => {
  assert.match(card, /JSON\.stringify\(beforeWallCms\) !== JSON\.stringify\(afterWallCms\)/);
  assert.match(card, /const previewResult = this\._rszApplyPreview\(res\.polys, res\.openings\)/);
  assert.match(card, /if \(!previewResult\.ok\)/);
  assert.match(card, /this\._rszPreview = previousPreview/);
  assert.match(card, /g\.d = previousD/);
});

test('#298 production carrier proof uses room edges, never independent partitions', () => {
  const carrierBlock = card.match(
    /const wallCarriers: \[number\[\], number\[\]\]\[\] = \[\];[\s\S]*?const wallSignature/,
  );
  assert.ok(carrierBlock, 'production wall-carrier preflight is missing');
  assert.match(carrierBlock[0], /for \(const room of sp\.rooms \|\| \[\]\)/);
  assert.doesNotMatch(carrierBlock[0], /sp\.partitions/,
    'independent partition geometry cannot carry space.walls metadata');
});

test('#277 Resize render fingerprints geometry once for the whole handle layer', () => {
  assert.match(card, /const renderSnapshot = this\._rszDrag\?\.snap \|\| this\._rszSnapshot\(\)/);
  assert.match(card, /this\._rszResolution\(r\.id, i, renderSnapshot\)/);
  assert.doesNotMatch(card, /const resolution = this\._rszResolution\(r\.id, i\);/);
});
