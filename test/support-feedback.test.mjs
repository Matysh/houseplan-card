import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  codePointLength,
  newSupportDialogState,
  supportCanSubmit,
  supportApiCompatible,
  supportDraftError,
  supportErrorCode,
  supportRuntimeFacts,
  supportSubmissionFingerprint,
  supportSubmissionIdentity,
} from '../test-build/support-feedback.js';

test('support capability is exact and independent from release versions', () => {
  assert.equal(supportApiCompatible(1), true);
  for (const value of [undefined, null, 0, 2, '1', 1.0.toString(), true, {}, NaN]) {
    assert.equal(supportApiCompatible(value), false, `unexpected compatibility for ${String(value)}`);
  }
});

test('a fresh dialog never opts into exact plan geometry', () => {
  const state = newSupportDialogState();
  assert.equal(state.attach, false);
  assert.equal(state.preview, null);
  assert.equal(state.contact, '');
  assert.equal(state.message, '');
  assert.match(state.draftId, /^draft-/);
  assert.match(state.idempotencyKey, /^report-/);
});

test('message/contact limits count Unicode code points rather than UTF-16 units', () => {
  assert.equal(codePointLength('🙂'), 1);
  const state = { ...newSupportDialogState(), message: 'ok', contact: '🙂'.repeat(321) };
  assert.equal(supportDraftError(state), 'contact_too_long');
  assert.equal(supportCanSubmit(state), false);
});

test('attachment submit requires the exact non-expired preview', () => {
  const now = 10_000;
  const base = { ...newSupportDialogState(), message: 'repro', attach: true };
  assert.equal(supportDraftError(base, now), 'preview_missing');
  const preview = {
    token: 'a'.repeat(48), expiresAt: now + 1, size: 2, sha256: 'b'.repeat(64),
    spaces: 1, format: 'houseplan-support-package', version: 1, text: '{}\n', preparedAt: now,
  };
  assert.equal(supportCanSubmit({ ...base, preview, status: 'ready' }, now), true);
  assert.equal(supportDraftError({ ...base, preview }, now + 1), 'preview_expired');
});

test('submission identity follows the effective trimmed payload', () => {
  const initial = {
    ...newSupportDialogState(),
    message: '  first message  ',
    contact: '  user@example.test  ',
  };
  const first = supportSubmissionIdentity(initial);
  assert.equal(first.idempotencyKey, initial.idempotencyKey);
  assert.equal(
    first.fingerprint,
    supportSubmissionFingerprint({ ...initial, message: 'first message', contact: 'user@example.test' }),
  );

  const attempted = { ...initial, submissionFingerprint: first.fingerprint };
  assert.equal(
    supportSubmissionIdentity({ ...attempted, message: 'first message   ' }).idempotencyKey,
    initial.idempotencyKey,
  );
  assert.notEqual(
    supportSubmissionIdentity({ ...attempted, message: 'different message' }).idempotencyKey,
    initial.idempotencyKey,
  );
  assert.notEqual(
    supportSubmissionIdentity({ ...attempted, contact: 'other@example.test' }).idempotencyKey,
    initial.idempotencyKey,
  );

  const preview = {
    token: 'a'.repeat(48), expiresAt: Date.now() + 1_000, size: 2, sha256: 'b'.repeat(64),
    spaces: 1, format: 'houseplan-support-package', version: 1, text: '{}\n', preparedAt: Date.now(),
  };
  assert.notEqual(
    supportSubmissionIdentity({ ...attempted, attach: true, preview }).idempotencyKey,
    initial.idempotencyKey,
  );
  assert.equal(
    supportSubmissionFingerprint({ ...attempted, attach: false, preview }),
    first.fingerprint,
  );
});

test('runtime facts are bounded enums without a raw user agent', () => {
  const facts = supportRuntimeFacts({
    userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 private-suffix',
    language: 'ru', coarsePointer: false, hoverCapable: true,
    registryAccess: 'full', registryLastSuccess: 9_500, now: 10_000,
  });
  assert.deepEqual(facts, {
    browser_family: 'chromium', browser_major: 140, language: 'ru',
    coarse_pointer: false, hover_capable: true, registry_access: 'full',
    registry_age_bucket: 'fresh',
  });
  assert.equal(JSON.stringify(facts).includes('private-suffix'), false);
});

test('remote and unknown failures collapse to stable local error codes', () => {
  assert.equal(supportErrorCode({ code: 'support_rate_limited', message: 'private' }), 'support_rate_limited');
  assert.equal(supportErrorCode({ code: 'provider leaked details' }), 'support_unavailable');
  assert.equal(supportErrorCode(new Error('network secret')), 'support_unavailable');
});

test('Help is lazy, ordered after settings, and owns the single About/Guide surface', () => {
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const runtime = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/plan.styles.ts', import.meta.url), 'utf8');
  const dialogStyles = readFileSync(new URL('../src/styles/dialogs.styles.ts', import.meta.url), 'utf8');
  const header = card.slice(card.indexOf('<div class="zoomctl">'), card.indexOf('</div>\n        ${this._canEdit'));
  assert.ok(header.indexOf('_openSettingsDialog') < header.indexOf('_openSupportDialog'));
  assert.ok(header.indexOf('_openSettingsDialog') < header.indexOf('_openPdfDialog'));
  assert.ok(header.indexOf('_openPdfDialog') < header.indexOf('_openSupportDialog'));
  assert.match(card, /if \(!this\._editorRuntime\)[\s\S]*?_ensureEditorRuntime\(\)[\s\S]*?_openSupportDialog/);
  assert.equal((runtime.match(/_t\('gs\.about_version'/g) || []).length, 1);
  assert.match(runtime, /docs\/USER-GUIDE\.ru\.md/);
  assert.match(runtime, /docs\/USER-GUIDE\.md/);
  assert.equal((header.match(/header-action/g) || []).length, 3);
  assert.match(styles, /\.header-action\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
  assert.match(dialogStyles, /\.supportmessage\s*\{[\s\S]*?background:\s*var\(--hp-bg\);/);
});

test('the consent copy names exact geometry, project relay, retention and network address', () => {
  const en = JSON.parse(readFileSync(new URL('../src/i18n/support/en.json', import.meta.url), 'utf8'));
  const ru = JSON.parse(readFileSync(new URL('../src/i18n/support/ru.json', import.meta.url), 'utf8'));
  assert.match(en['support.privacy'], /exact geometry/);
  assert.match(en['support.privacy'], /project relay/);
  assert.match(en['support.privacy'], /30 days/);
  assert.match(en['support.privacy'], /server address/);
  assert.equal(
    ru['support.contact'],
    'Контакт для связи (email/tg/WhatsApp), необязательно.',
  );
});
