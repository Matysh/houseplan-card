#!/usr/bin/env node
// Реестр известных поломок (mutation gate), issue #85.
//
//   node scripts/mutation-gate.mjs --list          мутанты и кого они проверяют
//   node scripts/mutation-gate.mjs --check         патчи применимы к текущему коду
//   node scripts/mutation-gate.mjs                 полный прогон: все мутанты
//   node scripts/mutation-gate.mjs --id=<mutant>   один мутант
//   node scripts/mutation-gate.mjs --build-only    применить и собрать, тест не гонять
//
// Код выхода: 0 — каждый тест поймал свою поломку, 1 — хотя бы один не поймал,
// 2 — не смог проверить (патч не лёг, сборка упала).
//
// Зачем. Зелёный тест в этом проекте несколько раз означал «ничего не
// проверено», и выяснялось это после того, как баг доезжал до владельца:
// смок непрерывности не заметил удаления механизма, который защищает; golden,
// заведённый под #71, был пуст — 1 177 тёплых пикселей против 107 119, и все
// 1 177 были иконками. Общее у всех случаев: тест ни разу не проверяли на
// способность падать. Этот гейт делает такую проверку регулярной.
//
// Каждый мутант — маленький патч продуктового исходника, воспроизводящий
// известную поломку, и имя теста, который ОБЯЗАН на ней покраснеть. Прогон:
// worktree → патч → сборка бандла → бандл в demo/srv/assets → тест. Тест,
// оставшийся зелёным, — это провал гейта, а не успех теста.
//
// Прогон дорогой (пересборка бандла на мутанта), поэтому его место — перед
// стабильным релизом (.github/workflows/mutation-gate.yml), не на каждой бете.
// Дешёвая часть — «патчи применимы, guard-файлы существуют» — живёт в
// test/mutation-gate.test.mjs и идёт с обычными юнитами: реестр, отставший от
// кода, хуже отсутствующего, потому что выглядит защитой.

import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const occurrenceCount = (source, needle) => source.split(needle).length - 1;

/**
 * Map a logical pre-split card anchor onto the lazy editor source.
 *
 * Keeping the mutation definitions in their original logical form makes the
 * registry readable and preserves the history of each regression. At runtime
 * we relocate only anchors that actually moved into the typed editor host.
 * The mapping is deliberately strict: an ambiguous or missing anchor still
 * fails the cheap mutation applicability gate.
 */
function relocateEditorPatch(patch, cardSource, editorSource) {
  if (patch.file !== 'src/houseplan-card.ts'
      || occurrenceCount(cardSource, patch.find) === 1) return patch;
  if (occurrenceCount(editorSource, patch.find) === 1) {
    return { ...patch, file: 'src/houseplan-editor-runtime.ts' };
  }

  const normalized = editorSource.replaceAll('this.host.', 'this.');
  if (occurrenceCount(normalized, patch.find) !== 1) return patch;

  const normalizedStart = normalized.indexOf(patch.find);
  let rawIndex = 0;
  let normalizedIndex = 0;
  while (normalizedIndex < normalizedStart) {
    if (editorSource.startsWith('this.host.', rawIndex)) {
      rawIndex += 'this.host.'.length;
      normalizedIndex += 'this.'.length;
    } else {
      rawIndex += 1;
      normalizedIndex += 1;
    }
  }
  const rawStart = rawIndex;
  const hostFlags = [];
  let findIndex = 0;
  while (findIndex < patch.find.length) {
    if (patch.find.startsWith('this.', findIndex)) {
      hostFlags.push(editorSource.startsWith('this.host.', rawIndex));
    }
    if (editorSource.startsWith('this.host.', rawIndex)) {
      rawIndex += 'this.host.'.length;
      findIndex += 'this.'.length;
    } else {
      rawIndex += 1;
      findIndex += 1;
    }
  }
  const rawFind = editorSource.slice(rawStart, rawIndex);
  let replacementThis = 0;
  const rawReplace = patch.replace.replaceAll('this.', () => {
    const host = hostFlags[replacementThis++] === true;
    return host ? 'this.host.' : 'this.';
  });
  return {
    ...patch,
    file: 'src/houseplan-editor-runtime.ts',
    find: rawFind,
    replace: rawReplace,
  };
}

// --- реестр ---------------------------------------------------------------
// `find` обязан встречаться в файле ровно один раз: патч, который ложится «куда
// попало», проверяет не то, что объявлен проверять. Это контролирует --check.
const MUTANT_DEFINITIONS = [
  {
    id: 'resource-docs-flatten-current-yaml',
    guard: 'node scripts/check-docs.mjs',
    because: 'the supported HA 2026.2+ resource snippet must stay nested under lovelace; '
      + 'a plausible-looking top-level resources block is the user-facing defect from #462 AC1',
    patches: [{
      file: 'README.md',
      find: 'lovelace:\n  resource_mode: yaml\n  resources:',
      replace: 'resource_mode: yaml\nresources:',
    }],
  },
  {
    id: 'frontend-registration-skips-retry',
    guard: 'python3 -m pytest tests_backend/test_ha_frontend_registration.py -q -p no:cacheprovider '
      + '-k "retry_waits_one_second"',
    because: 'a temporarily unavailable Lovelace registry must receive the one lifecycle-bound '
      + 'recovery attempt promised by #462 AC3',
    patches: [{
      file: 'custom_components/houseplan/frontend_registration.py',
      find: '            _schedule_retry(hass, entry, state)',
      replace: '            pass  # mutant: recovery retry removed',
    }],
  },
  {
    id: 'frontend-registration-retries-without-delay',
    guard: 'python3 -m pytest tests_backend/test_ha_frontend_registration.py -q -p no:cacheprovider '
      + '-k "retry_waits_one_second"',
    because: 'even an already-running HA must retain the fixed cancellable delay instead of '
      + 'repeating a transient registry failure in the same tick (#462 AC3)',
    patches: [{
      file: 'custom_components/houseplan/frontend_registration.py',
      find: '        state._cancel_timer = async_call_later(\n'
        + '            hass, FRONTEND_RETRY_DELAY_SECONDS, _after_delay\n'
        + '        )',
      replace: '        _after_delay()  # mutant: retry runs without the fixed lifecycle delay',
    }],
  },
  {
    id: 'frontend-registration-is-not-unload-bound',
    guard: 'python3 -m pytest tests_backend/test_ha_frontend_registration.py -q -p no:cacheprovider '
      + '-k "retry_lifecycle_handles_are_cancelled"',
    because: 'the start listener, delay and running retry belong to the config-entry lifecycle; '
      + 'otherwise unload can resurrect frontend side effects (#462 AC3)',
    patches: [{
      file: 'custom_components/houseplan/frontend_registration.py',
      find: '    entry.async_on_unload(state.cancel)',
      replace: '    pass  # mutant: retry lifecycle detached from config-entry unload',
    }],
  },
  {
    id: 'frontend-reload-notice-forgets-persisted-flag',
    guard: 'python3 -m pytest tests_backend/test_ha_frontend_registration.py -q -p no:cacheprovider '
      + '-k "reload_notice_is_localized_and_persisted_once"',
    because: 'the first-install hard-reload notice must remain one-shot across retry, reload and '
      + 'future versions rather than reappearing forever (#462 AC4)',
    patches: [{
      file: 'custom_components/houseplan/frontend_registration.py',
      find: '                data={**entry.data, FRONTEND_RELOAD_NOTICE_DATA_KEY: True},',
      replace: '                data={**entry.data},  # mutant: one-shot flag is not persisted',
    }],
  },
  {
    id: 'version-recovery-treats-unknown-as-mismatch',
    guard: 'node --test --test-name-pattern="malformed values stay unknown" '
      + 'test/version-recovery.test.mjs',
    because: 'a missing or malformed integration_version must clear stale state and stay unknown, '
      + 'not manufacture a reload request (#462 AC6)',
    patches: [{
      file: 'src/version-recovery.ts',
      find: "  if (!normalizedFrontend || !normalizedBackend) return { kind: 'unknown' };",
      replace: "  if (!normalizedFrontend || !normalizedBackend) return { kind: 'mismatch', frontend: normalizedFrontend || 'unknown', backend: normalizedBackend || 'unknown' };",
    }],
  },
  {
    id: 'version-recovery-delays-config-capability-adoption',
    guard: 'node demo/smoke_version_recovery.mjs',
    because: 'a successful config/get must set or clear its runtime capabilities before a sibling '
      + 'layout request or later asset preparation can reject the structural candidate (#462 AC6)',
    patches: [{
      file: 'src/version-recovery-card.ts',
      find: '    (response) => adoptCardConfigCapabilities(host, response),',
      replace: '    () => undefined,  // mutant: aggregate consumers own capability adoption',
    }],
  },
  {
    id: 'version-recovery-auto-reloads-ordinary-view',
    guard: 'node --test --test-name-pattern="ordinary mode always" '
      + 'test/version-recovery.test.mjs',
    because: 'outside kiosk a version mismatch must never reload without the user pressing the '
      + 'trusted action, even after an arbitrary wait (#462 AC7)',
    patches: [{
      file: 'src/version-recovery.ts',
      find: '    if (!this._input.kiosk) {',
      replace: '    if (false && !this._input.kiosk) {',
    }],
  },
  {
    id: 'version-recovery-ignores-editor-state',
    guard: 'node --test --test-name-pattern="card adapter maps editor state" '
      + 'test/version-recovery-card.test.mjs',
    because: 'a kiosk card in an editor must preserve unsaved work instead of silently reloading '
      + 'when its versions differ (#462 AC8)',
    patches: [{
      file: 'src/version-recovery-card.ts',
      find: "    viewOnly: host._config?.kiosk === true && host._mode === 'view' && !host._editing,",
      replace: '      viewOnly: true,',
    }],
  },
  {
    id: 'version-recovery-ignores-dialog-state',
    guard: 'node --test --test-name-pattern="card adapter maps blocking surfaces" '
      + 'test/version-recovery-card.test.mjs',
    because: 'a first-class dialog or contextual surface must block the kiosk auto-reload '
      + 'rather than disappear underneath it (#462 AC8)',
    patches: [{
      file: 'src/version-recovery-card.ts',
      find: '    surfacesIdle,',
      replace: '    surfacesIdle: true,',
    }],
  },
  {
    id: 'version-recovery-ignores-pending-config-write',
    guard: 'node --test --test-name-pattern="card adapter maps config writes" '
      + 'test/version-recovery-card.test.mjs',
    because: 'a pending configuration write must block kiosk reload so an accepted edit cannot '
      + 'be lost during version recovery (#462 AC8)',
    patches: [{
      file: 'src/version-recovery-card.ts',
      find: '    configWritesIdle: host._writesPending === 0 && !host._saveConfigDebounced.pending(),',
      replace: '    configWritesIdle: true,',
    }],
  },
  {
    id: 'version-recovery-ignores-interaction-pause',
    guard: 'node --test --test-name-pattern="card adapter maps interaction pause" '
      + 'test/version-recovery-card.test.mjs',
    because: 'recent pointer, keyboard, touch and native more-info interaction must defer the '
      + 'silent kiosk reload by the same shared pause contract (#462 AC8)',
    patches: [{
      file: 'src/version-recovery-card.ts',
      find: '    interactionPauseElapsed: Date.now() >= host._cyclePausedUntil,',
      replace: '    interactionPauseElapsed: true,',
    }],
  },
  {
    id: 'version-recovery-marks-target-after-reload',
    guard: 'node --test --test-name-pattern="marks the exact target before one reload" '
      + 'test/version-recovery.test.mjs',
    because: 'the backend target must be durably claimed before navigation, otherwise the next '
      + 'document can enter an infinite kiosk reload loop (#462 AC8)',
    patches: [{
      file: 'src/version-recovery.ts',
      find: '    storage.setItem(VERSION_RELOAD_ATTEMPT_KEY, target);\n    return \'claimed\';',
      replace: "    return 'claimed';  // mutant: navigation happens before any durable claim",
    }],
  },
  {
    id: 'version-recovery-ignores-stored-target',
    guard: 'node --test --test-name-pattern="same target is once per tab" '
      + 'test/version-recovery.test.mjs',
    because: 'all full cards in one tab must honour the attempted backend target so a stale '
      + 'frontend cannot reload repeatedly (#462 AC9)',
    patches: [{
      file: 'src/version-recovery.ts',
      find: "    return storage.getItem(VERSION_RELOAD_ATTEMPT_KEY) === target ? 'attempted' : 'fresh';",
      replace: "    return 'fresh';  // mutant: forget the tab-wide target guard",
    }],
  },
  {
    id: 'space-copy-title-always-reuses-two',
    guard: 'node --test --test-name-pattern="first free numbered" test/space-copy.test.mjs',
    because: 'copy naming must skip occupied suffixes instead of silently proposing a duplicate (#456 AC2)',
    patches: [{
      file: 'src/space-copy.ts',
      find: '  while (names.has(`${base} (${suffix})`)) suffix++;',
      replace: '  while (false && names.has(`${base} (${suffix})`)) suffix++;',
    }],
  },
  {
    id: 'space-copy-always-asks-to-optimize',
    guard: 'node --test --test-name-pattern="no extra confirmation" test/space-copy-runtime.test.mjs',
    because: 'an already clean plan must use the name submission as its only confirmation (#456 AC3)',
    patches: [{
      file: 'src/space-copy-runtime.ts',
      find: '    if (optimized.changed) {',
      replace: '    if (true) {',
    }],
  },
  {
    id: 'space-copy-skips-required-optimize',
    guard: 'node --test --test-name-pattern="durable before the copy" test/space-copy-runtime.test.mjs',
    because: 'the accepted whole-plan Optimize must become durable before the copy is derived or written (#456 AC4)',
    patches: [{
      file: 'src/space-copy-runtime.ts',
      find: '      await commitPlanOptimization(host, optimized.config, optimized.layout);',
      replace: '      await Promise.resolve();',
    }],
  },
  {
    id: 'space-copy-ignores-unsafe-optimize-preflight',
    guard: 'node --test --test-name-pattern="unsafe Optimize" test/space-copy-runtime.test.mjs',
    because: 'a failed whole-plan geometry proof must stop before confirmation or either write (#456 AC5)',
    patches: [{
      file: 'src/space-copy-runtime.ts',
      find: '      if (!preflight.ok) {',
      replace: '      if (false && !preflight.ok) {',
    }],
  },
  {
    id: 'space-copy-drops-existing-partitions',
    guard: 'node --test --test-name-pattern="complete allowed physical surface" test/space-copy.test.mjs',
    because: 'copying room contours alone loses independent walls already drawn in the source (#456 AC6)',
    patches: [{
      file: 'src/space-copy.ts',
      find: '  const sourcePartitions = geometryList(source.partitions);',
      replace: '  const sourcePartitions = [];',
    }],
  },
  {
    id: 'space-copy-keeps-opening-device-binding',
    guard: 'node --test --test-name-pattern="complete allowed physical surface" test/space-copy.test.mjs',
    because: 'copied openings are geometry only and must not control the source contact or lock (#456 AC7)',
    patches: [{
      file: 'src/space-copy.ts',
      find: '    delete copied.contact;',
      replace: '',
    }],
  },
  {
    id: 'space-copy-shares-settings-object',
    guard: 'node --test --test-name-pattern="complete allowed physical surface" test/space-copy.test.mjs',
    because: 'editing one copy must not mutate the source display or backdrop state through an alias (#456 AC8)',
    patches: [{
      file: 'src/space-copy.ts',
      find: "    if (key !== 'view_box' && own(source, key)) copiedSpace[key] = clone(source[key]);",
      replace: "    if (key !== 'view_box' && own(source, key)) copiedSpace[key] = source[key];",
    }],
  },
  {
    id: 'space-copy-leaks-room-drafts',
    guard: 'node --test --test-name-pattern="complete allowed physical surface" test/space-copy.test.mjs',
    because: 'the new floor must start without room identity or unfinished room chains (#456 AC9)',
    patches: [{
      file: 'src/space-copy.ts',
      find: '  if (copiedPartitions.length) copiedSpace.partitions = copiedPartitions;',
      replace: "  if (own(source, 'room_drafts')) copiedSpace.room_drafts = clone(source.room_drafts);\n"
        + '  if (copiedPartitions.length) copiedSpace.partitions = copiedPartitions;',
    }],
  },
  {
    id: 'space-copy-ignores-wall-limit',
    guard: 'node --test --test-name-pattern="collection boundaries" test/space-copy.test.mjs',
    because: 'an oversized copy must fail before it can create an optimistic or server-side partial state (#456 AC10)',
    patches: [{
      file: 'src/space-copy.ts',
      find: "  if (partitionCount > SPACE_COPY_LIMITS.partitions) throw new SpaceCopyError('partitions_limit');",
      replace: "  if (false) throw new SpaceCopyError('partitions_limit');",
    }],
  },
  {
    id: 'space-copy-rejection-keeps-local-copy',
    guard: 'node --test --test-name-pattern="keeps accepted Optimize" test/space-copy-runtime.test.mjs',
    because: 'a rejected second write must restore server truth without rolling back the accepted Optimize (#456 AC11)',
    patches: [{
      file: 'src/space-copy-runtime.ts',
      find: '      if (rollbackOptimistic(host, attempt, contentFingerprint)) invalidateConfig(host);',
      replace: '',
    }, {
      file: 'src/space-copy-runtime.ts',
      find: '        await host._reloadConfigOnly(true);',
      replace: '        await Promise.resolve();',
    }],
  },
  {
    id: 'space-copy-does-not-select-result',
    guard: 'node --test --test-name-pattern="one config write" test/space-copy-runtime.test.mjs',
    because: 'after an accepted write the user must enter the clean copied space, not remain on the source (#456 AC12)',
    patches: [{
      file: 'src/space-copy-runtime.ts',
      find: '    host._commitSpace(result.space.id, true);',
      replace: '',
    }],
  },
  {
    id: 'render-invalidation-renders-irrelevant-ha',
    guard: 'node demo/smoke_render_invalidation.mjs',
    because: 'an irrelevant HA state row must still enter lifecycle intake without scheduling '
      + 'a full Lit render; the production smoke owns this card/runtime wiring (#451)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      if (!render) return;',
      replace: '      if (false && !render) return;',
    }],
  },
  {
    id: 'draft-delete-drops-the-promise',
    guard: 'node demo/smoke_free_walls.mjs',
    because: 'a delayed confirmation must keep the draft deletion pending all the way to the '
      + 'card facade; dropping the runtime promise makes the smoke inspect stale geometry (#405)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    if (sel.kind === 'draft') { await this._deleteDraftWhole(); return; }",
      replace: "    if (sel.kind === 'draft') { void this._deleteDraftWhole(); return; }",
    }],
  },
  {
    id: 'smoke-guard-blind-to-tail',
    guard: 'node demo/guard/verify-guard.mjs',
    because: 'the uncaught-exception guard must read its counter AFTER the page delivered '
      + 'its events; reading it first is the defect of #404 and looks identical to a '
      + 'working guard in everything but the outcome',
    patches: [{
      file: 'demo/serve.mjs',
      find: '  await roundTripLivePages();\n  if (_pageErrors) _failures.push(',
      replace: '  if (_pageErrors) _failures.push(',
    }],
  },
  {
    id: 'smoke-guard-forgets-to-register-pages',
    guard: 'node demo/guard/verify-guard.mjs',
    because: 'the round-trip and the page registry are two halves of one fix (#404): a '
      + 'mutant on either half alone leaves the other unproven',
    patches: [{
      file: 'demo/serve.mjs',
      find: '  _livePages.add(page);',
      replace: '',
    }],
  },
  {
    id: 'support-preview-replacement-keeps-old-token',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'support_preview_replacement_and_discard_are_draft_local '
      + 'tests_backend/test_ha_websocket.py',
    because: 'refreshing one support draft must invalidate its previous token while leaving '
      + 'another draft usable; discard success alone cannot prove either fact (#421 AC1)',
    patches: [{
      file: 'custom_components/houseplan/websocket_api.py',
      find: '    for old_token, record in list(rt.support_previews.items()):\n'
        + '        if record.get("owner") == owner and record.get("draft_id") == msg["draft_id"]:\n'
        + '            rt.support_previews.pop(old_token, None)\n',
      replace: '',
    }],
  },
  {
    id: 'support-preview-discard-keeps-token',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'support_preview_replacement_and_discard_are_draft_local '
      + 'tests_backend/test_ha_websocket.py',
    because: 'an idempotent discard response is not proof of invalidation; a later submit must '
      + 'fail because the owned token was actually removed (#421 AC2)',
    patches: [{
      file: 'custom_components/houseplan/websocket_api.py',
      find: '    rt.support_previews.pop(msg["token"], None)\n'
        + '    connection.send_result(msg["id"], {"ok": True})',
      replace: '    connection.send_result(msg["id"], {"ok": True})',
    }],
  },
  {
    id: 'support-preview-submit-skips-ttl-prune',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'support_preview_token_expires_at_ttl_without_transport '
      + 'tests_backend/test_ha_websocket.py',
    because: 'the exact TTL boundary must reject an expired attachment before relay transport; '
      + 'without submit-time pruning the stale bytes remain usable (#421 AC3)',
    patches: [{
      file: 'custom_components/houseplan/websocket_api.py',
      find: '    _prune_support_previews(rt)\n'
        + '    token = msg.get("preview_token")',
      replace: '    token = msg.get("preview_token")',
    }],
  },
  {
    id: 'report-page-errors-skips-round-trip',
    guard: 'node demo/guard/verify-guard.mjs',
    because: 'reportPageErrors() is a verdict path separate from finish(); removing only its '
      + 'delivery round-trip must leave the dedicated tail-error probe visibly red (#421 AC4/AC5)',
    patches: [{
      file: 'demo/serve.mjs',
      find: 'export async function reportPageErrors() {\n'
        + '  await roundTripLivePages();\n'
        + '  if (!_pageErrors) return false;',
      replace: 'export async function reportPageErrors() {\n'
        + '  if (!_pageErrors) return false;',
    }],
  },
  {
    id: 'docs-fingerprint-refresh-erases-acceptance-trace',
    guard: 'node --test --test-name-pattern="fingerprint-only refresh" '
      + 'test/docs-accept.test.mjs',
    because: 'a source-fingerprint refresh changes no pixels and must preserve the earlier '
      + 'human acceptance trace instead of manufacturing an empty one (#421 AC6/AC7)',
    patches: [{
      file: 'scripts/docs-accept.mjs',
      find: '      : { ...(previousAcceptance || {}), lastWriteWasFingerprintOnly: true },',
      replace: '      : { declared: [], witnesses: 0, floor: 0 },',
    }],
  },
  {
    id: 'i18n-dead-key-returns',
    guard: 'node --test test/i18n-dead-keys.test.mjs',
    because: 'a translation key without any literal, dynamic-family or derived consumer must '
      + 'not silently return to all shipped dictionaries (#406)',
    patches: [{
      file: 'src/i18n/en.json',
      find: '  "confirm.unlock_title": "Unlock?",',
      replace: '  "confirm.unlock": "Unlock {name}?",\n'
        + '  "confirm.unlock_title": "Unlock?",',
    }],
  },
  {
    id: 'dialog-native-surface-stretches-to-viewport',
    guard: 'node demo/smoke_dialog_modal_recovery.mjs',
    because: 'the native top-layer shell must shrink-wrap its surface; restoring width:auto '
      + 'reproduces the left-pinned confirmation from #463 even though :modal remains true',
    patches: [{
      file: 'src/hp-dialog.ts',
      find: '      width: fit-content;\n      height: fit-content;',
      replace: '      width: auto;\n      height: fit-content;',
    }],
  },
  {
    id: 'dialog-native-update-recovery-disabled',
    guard: 'node demo/smoke_dialog_modal_recovery.mjs',
    because: 'an open-but-nonmodal native shell must be reconciled on a later Lit update without '
      + 'a duplicate or hp-close event; firstUpdated alone cannot recover that #463 state',
    patches: [{
      file: 'src/hp-dialog.ts',
      find: '  protected updated(changed: PropertyValues): void {\n'
        + '    super.updated(changed);\n'
        + '    this._ensureNativeModal();\n'
        + '  }',
      replace: '  protected updated(changed: PropertyValues): void {\n'
        + '    super.updated(changed);\n'
        + '    // mutant: update reconciliation removed\n'
        + '  }',
    }],
  },
  {
    id: 'dialog-native-reconnect-recovery-disabled',
    guard: 'node demo/smoke_dialog_modal_recovery.mjs',
    because: 'detaching a modal drops it from the browser top layer while its rendered shell '
      + 'survives; reconnect must schedule one bounded reconciliation for the same node (#463)',
    patches: [{
      file: 'src/hp-dialog.ts',
      find: '    queueMicrotask(() => {\n'
        + '      // Re-entering the top layer lets the UA choose a default focus target.\n'
        + '      // Restore our deterministic initial target only on a real reconnect\n'
        + '      // recovery; ordinary updates must never steal focus from a live field.\n'
        + '      if (this._ensureNativeModal()) this._focusInitial();\n'
        + '    });',
      replace: '    // mutant: reconnect reconciliation removed',
    }],
  },
  {
    id: 'confirm-dialog-loses-alertdialog',
    guard: 'node demo/smoke_danger_confirm_branches.mjs',
    because: 'delete and unlock confirmations must expose the real dialog as an alertdialog '
      + 'with its consequence text in both standalone and HA environments (#406)',
    patches: [{
      file: 'src/hp-dialog.ts',
      find: "      role=${this.alert ? 'alertdialog' : 'dialog'}",
      replace: '      role="dialog"',
    }],
  },
  {
    id: 'vacuum-route-ambiguity-takes-the-first',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'two plausible routes must give ambiguous, never "the first one": a guessed '
      + 'floor turns the plan into a false statement about where the robot is (#162, M-A)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: '  if (matched.length > 1) {\n    return { kind: \'ambiguous\', routeIds: matched.map((route) => route.id).sort() };\n  }',
      replace: '  if (matched.length > 1) {\n    return { kind: \'ready\', route: matched[0] };\n  }',
    }],
  },
  {
    id: 'vacuum-route-missing-space-falls-back-to-dock',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'a route pointing at a deleted space must fail visibly, not quietly render the '
      + 'robot in the dock space it no longer belongs to (#162, M-B)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: "    if (input.spaceIds && !input.spaceIds.has(route.space)) return { kind: 'missing_space', route };",
      replace: '    // mutant: missing space ignored',
    }],
  },
  {
    id: 'vacuum-route-unmapped-draws-anyway',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'an unmapped active map must draw nothing: reusing the last matrix puts the '
      + 'robot on a floor nobody mapped it to (#162, M-C)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: '    if (observed === route.map_id) matched.push(route);',
      replace: '    matched.push(route);',
    }],
  },
  {
    id: 'vacuum-route-identity-duplicates-allowed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'two routes with the same (source, map_id) make the resolver permanently '
      + 'ambiguous and silently share one calibration (#162, M-D)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: "      if (seenIdentity.has(identity)) problems.push(issue(markerId, id, 'duplicate_identity'));",
      replace: '      // mutant: duplicate identity accepted',
    }],
  },
  {
    id: 'vacuum-legacy-run-adopts-the-first-candidate',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'a legacy run carries no source, so two candidates must be ambiguous_run and '
      + 'draw nowhere; picking the first one invents a floor for old data (#162, M-H)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: "  if (candidates.length === 1) return { kind: 'adopted', route: candidates[0] };",
      replace: "  if (candidates.length >= 1) return { kind: 'adopted', route: candidates[0] };",
    }],
  },
  {
    id: 'vacuum-overlay-ignores-the-rendered-space',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'the live puck belongs to the ACTIVE ROUTE space, not to every space that '
      + 'happens to be on screen: dropping the check draws one robot on both floors (#162)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: "  const live = active && active.space === input.renderSpace\n    ? normalizeRouteMatrix(active.calibration) : null;",
      replace: '  const live = active ? normalizeRouteMatrix(active.calibration) : null;',
    }],
  },
  {
    id: 'vacuum-previous-run-follows-the-robot',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'the previous run belongs to the space of its own route, so it keeps showing '
      + 'where the robot has been after it moved to another map (#162, AC10)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: '  const previousAllowed = !!previousRoute\n    && previousRoute.space === input.renderSpace',
      replace: '  const previousAllowed = !!previousRoute\n    && !!active && active.space === input.renderSpace',
    }],
  },
  {
    id: 'vacuum-run-forgets-its-route',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'route_change_starts_a_new_run_even_on_the_same_map_id '
      + 'tests_backend/test_trails.py',
    because: 'a stored run must remember which route wrote it, or two maps that share a map '
      + 'id across different cameras collapse into one run on the wrong floor (#162, M-F)',
    patches: [{
      file: 'custom_components/houseplan/trails.py',
      find: '            if route_id:\n                cur["route_id"] = route_id',
      replace: '            if False:\n                cur["route_id"] = route_id',
    }],
  },
  {
    id: 'vacuum-retargeted-route-keeps-its-old-trails',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'drop_unknown_routes_touches_only_runs_that_name_a_route '
      + 'tests_backend/test_trails.py',
    because: 'a route that was deleted or re-targeted to another space must take its runs '
      + 'with it; keeping them replays an old cleanup on a floor it never happened on '
      + '(#162, M-E server half)',
    patches: [{
      file: 'custom_components/houseplan/trails.py',
      find: '            if isinstance(stored, str) and stored and stored not in route_ids:',
      replace: '            if False:',
    }],
  },
  {
    id: 'vacuum-route-warning-stays-silent',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'a moving robot that is drawn nowhere must say so on the dock: silence reads as '
      + '"not cleaning", and the user cannot discover an unassigned map (#162)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: "    case 'unmapped': case 'needs_calibration': case 'ambiguous': case 'missing_space':\n      return resolution.kind;",
      replace: "    case 'нет такого':\n      return resolution.kind as any;",
    }],
  },
  {
    id: 'vacuum-route-validation-accepts-a-dead-space',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'invalid_routes_are_rejected '
      + 'tests_backend/test_vacuum_route_validation.py',
    because: 'a route saved against a space that does not exist can never resolve, so the '
      + 'write has to be refused at the boundary rather than discovered as a missing robot '
      + '(#162, M-D backend half)',
    patches: [{
      file: 'custom_components/houseplan/vacuum_routes.py',
      find: '        elif space_ids is not None and space not in space_ids:\n            problems.append(issue(route_id, "unknown_space"))',
      replace: '        elif False:\n            problems.append(issue(route_id, "unknown_space"))',
    }],
  },
  {
    id: 'space-delete-keeps-foreign-vacuum-routes',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="уносит только свои маршруты" '
      + 'test/space-deletion.test.mjs',
    because: 'a deleted space must take the robot map assignments that pointed at it; leaving '
      + 'them behind keeps a route nothing can resolve and a robot that never appears (#162, AC16)',
    patches: [{
      file: 'src/space-deletion.ts',
      find: '    const kept = routes.filter((route) => route?.space !== spaceId);',
      replace: '    const kept = routes;',
    }],
  },
  {
    id: 'vacuum-empty-routes-revive-legacy-frontend',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="explicit empty routes remain authoritative" '
      + 'test/vacuum-routes.test.mjs',
    because: 'an explicit empty route array means the user removed every map assignment; '
      + 'treating it as false revives stale legacy calibration in the frontend (#443, AC1)',
    patches: [{
      file: 'src/vacuum-routes.ts',
      find: '  if (Array.isArray(explicit)) {',
      replace: '  if (Array.isArray(explicit) && explicit.length) {',
    }],
  },
  {
    id: 'vacuum-empty-routes-revive-legacy-backend',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'explicit_empty_routes_remain_authoritative tests_backend/test_vacuum_routes.py',
    because: 'backend trail reconciliation must share the frontend empty-array authority; '
      + 'the old truthiness check otherwise assigns a deleted map again (#443, AC2)',
    patches: [{
      file: 'custom_components/houseplan/vacuum_routes.py',
      find: '    if isinstance(explicit, list):',
      replace: '    if isinstance(explicit, list) and explicit:',
    }],
  },
  {
    id: 'vacuum-space-export-drops-empty-authority',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'issue_443_space_export_preserves_explicit_empty_routes '
      + 'tests_backend/test_ha_import_export.py',
    because: 'single-space export must preserve an explicit empty list after filtering; '
      + 'writing null would make retained legacy calibration authoritative on import (#443, AC3)',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '                    vacuum["map_routes"] = kept_routes',
      replace: '                    vacuum["map_routes"] = kept_routes or None',
    }],
  },
  {
    id: 'vacuum-overlay-back-to-the-dock-space-filter',
    guard: 'npm run bundle:sync && node demo/smoke_vacuum_multifloor.mjs',
    because: 'the overlay layer must see every robot of the plan, not only those whose DOCK '
      + 'is in the space on screen: the old filter is exactly why a multi-floor robot could '
      + 'never appear on its second floor (#162, AC2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            ${this._renderVacuums(this._renderVacuumDevices, view, space.id)}',
      replace: '            ${this._renderVacuums(devs, view, space.id)}',
    }],
  },
  {
    id: 'vacuum-calibration-solves-against-the-dock',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/vacuum-routes.test.mjs',
    because: 'a matrix solved against the DOCK space and applied on another floor is wrong '
      + 'wherever the two plans differ — calibration belongs to the route (#162, AC8)',
    patches: [{
      file: 'src/vacuum-route-edit.ts',
      find: '  return { space: route?.space || dockSpace, routeId: route?.id || \'\' };',
      replace: '  return { space: dockSpace, routeId: route?.id || \'\' };',
    }],
  },
  {
    id: 'vacuum-manual-fit-after-proposal-uses-the-dock',
    guard: 'npm run bundle:sync && node demo/smoke_vacuum_multifloor.mjs',
    because: 'the high-residual proposal is refined against the geometry the matrix was solved '
      + 'against — opening it on the dock floor fits the robot to the wrong plan (#162, AC8, '
      + 'the stateful half the pure calibrationTarget mutant cannot reach)',
    patches: [{
      file: 'src/vacuum-calibration-write.ts',
      find: '    const space = proposal.space || device.space;',
      replace: '    const space = device.space;',
    }],
  },
  {
    id: 'area-snapshot-cleanup-ignores-authority',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="limited frames and runtime reset" '
      + 'test/device-area-relocation.test.mjs',
    because: 'temporary registry absence must not erase device Area provenance before the '
      + 'registry is authoritative (#406/#419)',
    patches: [{
      file: 'src/device-area-relocation.ts',
      find: '    if (!options.authoritative || !namespaceNonEmpty) continue;',
      replace: '    if (!namespaceNonEmpty) continue;',
    }],
  },
  {
    id: 'area-snapshot-cleanup-forgets-registry-evidence',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="orphan cleanup uses full registry evidence" '
      + 'test/device-area-relocation.test.mjs',
    because: 'a filtered presentation roster is not proof that a live HA binding disappeared '
      + 'and must not erase its Area provenance (#419 AC1/AC12)',
    patches: [{
      file: 'src/device-area-relocation.ts',
      find: '    const exists = markerBindings.has(binding)\n'
        + '      || ids.some((id) => markerIds.has(id))\n'
        + "      || (kind === 'device' ? deviceIds.has(ref) : entityIds.has(ref) || liveEntityIds.has(ref));",
      replace: '    const exists = false;',
    }],
  },
  {
    id: 'area-snapshot-cleanup-trusts-first-absence',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="requires two distinct" '
      + 'test/device-area-relocation.test.mjs',
    because: 'one shortened authoritative frame is only a reason to re-check, never enough '
      + 'evidence for destructive cleanup (#419 AC5/AC12)',
    patches: [{
      file: 'src/device-area-relocation.ts',
      find: '    if (firstRevision === undefined) {\n'
        + '      candidates.set(binding, options.revision);\n'
        + '      needsConfirmationRefresh = true;\n'
        + '      continue;\n'
        + '    }',
      replace: '    if (firstRevision === undefined) {\n'
        + '      for (const id of ids) removeIds.add(id);\n'
        + '      continue;\n'
        + '    }',
    }],
  },
  {
    id: 'area-snapshot-cleanup-trusts-empty-namespace',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="empty registry namespaces" '
      + 'test/device-area-relocation.test.mjs',
    because: 'even repeated empty registry namespaces are an unsafe basis for deleting every '
      + 'saved Area provenance entry (#419 AC2/AC12)',
    patches: [{
      file: 'src/device-area-relocation.ts',
      find: '    if (!options.authoritative || !namespaceNonEmpty) continue;',
      replace: '    if (!options.authoritative) continue;',
    }],
  },
  {
    id: 'settings-help-party1-placement-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 86 Party 1" test/i18n.test.mjs',
    because: 'the critical-settings help inventory must fail when one agreed trigger disappears (#86)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "this._help('device_inbox.show_hidden.help')",
      replace: 'nothing',
    }],
  },
  {
    id: 'room-climate-ignores-marker-placement',
    guard: 'node demo/smoke_room_climate_placement.mjs',
    because: 'a real sensor manually placed into a House Plan room must leave its registry HA '
      + 'Area and feed the local room label, tooltip and temperature fill exactly once (#317)',
    patches: [{
      file: 'src/devices.ts',
      find: '    const target = entityTargets.get(eid)\n'
        + '      || (reg.device_id ? deviceTargets.get(reg.device_id) : null)\n'
        + '      || reg.area_id || dev?.area_id || null;',
      replace: '    const target = reg.area_id || dev?.area_id || null;',
    }],
  },
  {
    id: 'editor-runtime-fingerprint-handshake',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/editor-runtime-loader.test.mjs',
    because: 'a mixed entry/editor build must fail closed instead of installing incompatible code (#337)',
    patches: [{
      file: 'src/editor-runtime-loader.ts',
      find: '        if (module.fingerprint !== this.options.expectedFingerprint) {',
      replace: '        if (false && module.fingerprint !== this.options.expectedFingerprint) {',
    }],
  },
  {
    id: 'editor-runtime-one-retry',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/editor-runtime-loader.test.mjs',
    because: 'a transient chunk failure gets exactly one bounded retry (#337)',
    patches: [{
      file: 'src/editor-runtime-loader.ts',
      find: '    for (const attempt of [0, 1] as const) {',
      replace: '    for (const attempt of [0] as const) {',
    }],
  },
  {
    id: 'wallthick-hover-floor-back',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="uses the exact physical wall width" '
      + 'test/grid-scale.test.mjs',
    because: 'restoring the raw grid-unit floor inflates a 50 cm hover strip to 75 cm '
      + 'on a 30 cm cell instead of matching the physical wall body from #303',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '    ? wallCmToUnits(thicknessCm, normalizedCellCm, normalizedPitch) / 2\n',
      replace: '    ? Math.max(\n'
        + '      wallCmToUnits(thicknessCm, normalizedCellCm, normalizedPitch) / 2,\n'
        + '      normalizedPitch * 1.25,\n'
        + '    )\n',
    }],
  },
  {
    id: 'wallthick-zero-strip-not-visual',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="zero-thickness hover" '
      + 'test/grid-scale.test.mjs',
    because: 'the visible strip for a zero-thickness wall must have one physical size across '
      + 'cell scales rather than growing with the coordinate grid',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '    : gridVisualUnits(normalizedPitch * 1.5, normalizedCellCm);',
      replace: '    : normalizedPitch * 1.5;',
    }],
  },
  {
    id: 'wallthick-hit-narrowed',
    guard: 'node demo/smoke_wallthick_hover_width.mjs',
    because: 'the visual correction must not make the Thickness tool harder to hit with a '
      + 'pointer or finger; its six-pitch hit radius is a separate UX contract',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const space = this._spaceModel();\n'
        + '    if (!space) return null;\n'
        + '    const pull = this._gridPitch * 6;\n'
        + '    const cuts = this._openCuts();',
      replace: '    const space = this._spaceModel();\n'
        + '    if (!space) return null;\n'
        + '    const pull = this._gridPitch * 2;\n'
        + '    const cuts = this._openCuts();',
    }],
  },
  {
    id: 'opening-search-filter-dead',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="matches friendly name" '
      + 'test/opening-entity-search.test.mjs',
    because: 'the opening picker must actually apply the typed query; returning the unfiltered '
      + 'candidate list recreates the original hundred-row scrolling problem from #301',
    patches: [{
      file: 'src/logic.ts',
      find: '  const normalized = query.trim().toLowerCase();',
      replace: "  const normalized = '';",
    }],
  },
  {
    id: 'opening-search-name-only',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="matches entity id" '
      + 'test/opening-entity-search.test.mjs',
    because: 'large HA installations often identify the wanted opening by entity_id rather '
      + 'than a duplicated friendly name, so a label-only search violates #301 directly',
    patches: [{
      file: 'src/logic.ts',
      find: '      candidate.label.toLowerCase().includes(normalized)\n'
        + '        || candidate.value.toLowerCase().includes(normalized))',
      replace: '      candidate.label.toLowerCase().includes(normalized))',
    }],
  },
  {
    id: 'opening-search-order-resorted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="preserves resolver order" '
      + 'test/opening-entity-search.test.mjs',
    because: 're-sorting a filtered contact list hides door/window device classes behind '
      + 'generic binary sensors and discards the deliberate resolver priority from #301',
    patches: [{
      file: 'src/logic.ts',
      find: '  return filtered.slice(0, Math.max(0, limit));',
      replace: '  return [...filtered].sort((a, b) => a.label.localeCompare(b.label))'
        + '.slice(0, Math.max(0, limit));',
    }],
  },
  {
    id: 'opening-search-hides-none',
    guard: 'node demo/smoke_opening_entity_search.mjs',
    because: 'the clear-binding action must remain first and visible for every query, including '
      + 'a query with no matches; hiding it can trap a stale contact or lock on the opening',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '                <button type="button" class="cand opening-entity-candidate ${cur ? \'\' : \'sel\'}"\n'
        + '                  data-opening-entity="" @click=${() => this._selectOpeningEntity(kind, \'\')}>\n'
        + '                  <span class="cl">${this._t(\'opening.none\')}</span>\n'
        + '                </button>\n',
      replace: '',
    }],
  },
  {
    id: 'opening-search-select-not-wired',
    guard: 'node demo/smoke_opening_entity_search.mjs',
    because: 'a visually filtered result is useless unless its click writes the exact entity_id '
      + 'into opening.contact or opening.lock and closes the picker as required by #301',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '                    @click=${() => this._selectOpeningEntity(kind, candidate.value)}>',
      replace: '                    @click=${() => this._selectOpeningEntity(kind, \'\')}>',
    }],
  },
  {
    id: 'device-tombstone-blocks-child-picker',
    guard: 'node demo/smoke_binding_picker.mjs',
    because: 'a device tombstone must expose an active child in the catalog/Add flow when Show entities is on; '
      + 'restoring only the exact device reproduces the user-visible dead end from #262',
    patches: [{
      file: 'src/device-inbox.ts',
      find: '      if (isRemovedPlanEntity(h, eid, removed) && !removedBindings.has(value) && !childOfRemovedDevice) continue;',
      replace: '      if (isRemovedPlanEntity(h, eid, removed) && !removedBindings.has(value)) continue;',
    }],
  },
  {
    id: 'live-child-still-suppressed-by-parent-tombstone',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 262" test/devices.test.mjs',
    because: 'fixing only the picker lets the person select X but buildDevices and every '
      + 'availability consumer still discard it after Save; a live exact child must win (#262)',
    patches: [{
      file: 'src/devices.ts',
      find: '  if (removed.liveEntities.has(eid)) return false;\n',
      replace: '',
    }],
  },
  {
    id: 'parent-tombstone-restores-all-siblings',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 262" test/devices.test.mjs',
    because: 'one restored child is an exact override, not permission for every sibling and '
      + 'room aggregate of the deleted parent device to return (#262)',
    patches: [{
      file: 'src/devices.ts',
      find: '  if (removed.liveEntities.has(eid)) return false;\n',
      replace: '  if (removed.liveEntities.size) return false;\n',
    }],
  },
  {
    id: 'child-readd-clears-parent-tombstone',
    guard: 'node demo/smoke_binding_picker.mjs',
    because: 'saving one child must preserve the device tombstone; dropping all tombstones '
      + 'resurrects the automatic parent and the siblings the person deliberately removed (#262)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: `      candidate.markers = candidate.markers.filter(
        (m) => m.id !== id && m.id !== oldId
          && (marker.binding === 'virtual' || m.binding !== marker.binding),
      );`,
      replace: `      candidate.markers = candidate.markers.filter(
        (m) => m.id !== id && m.id !== oldId
          && (marker.binding === 'virtual' || m.binding !== marker.binding)
          && (!marker.binding.startsWith('entity:') || m.removed !== true),
      );`,
    }],
  },
  {
    id: 'orphan-space-detach-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="detaches a live marker" '
      + 'test/space-reference-repair.test.mjs',
    because: 'an active marker with no exact copy or usable Area must lose only its dead space '
      + 'field; retaining that one field is the original invisibility bug and must be caught '
      + 'without relying on rendering (#244)',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: '        } else {\n          delete marker.space;\n          targetSpace = null;\n'
        + '          report.markersDetached++;\n        }',
      replace: '        } else {\n          targetSpace = null;\n'
        + '          report.markersDetached++;\n        }',
    }],
  },
  {
    id: 'orphan-space-ambiguous-signature-guessed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="ambiguous, truncated and malformed" '
      + 'test/space-reference-repair.test.mjs',
    because: 'choosing the first of two independent import copies moves a device between plans '
      + 'by array order; exact signature repair is safe only when the candidate is unique (#244)',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: '        const candidates = spaceSignatures.get(root) || [];\n'
        + '        return candidates.length === 1 ? candidates[0] : null;',
      replace: '        const candidates = spaceSignatures.get(root) || [];\n'
        + '        return candidates[0] || null;',
    }],
  },
  {
    id: 'orphan-cleanup-partial-registry-deletes',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="fails closed for limited registry" '
      + 'test/space-reference-repair.test.mjs',
    because: 'limited registry access is not proof that an HA device or group was deleted; '
      + 'treating it as authoritative destroys positions on permission/network failures (#252)',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: '  const rosterAuthoritative = roster?.authoritative === true;',
      replace: '  const rosterAuthoritative = true;',
    }],
  },
  {
    id: 'orphan-cleanup-proven-owners-kept',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="removes only proven room, device and group" '
      + 'test/space-reference-repair.test.mjs',
    because: 'proof without deletion leaves the exact maintenance debt #252 exists to remove; '
      + 'all three supported owner categories must change the candidate once and only once',
    patches: [{
      file: 'src/space-reference-repair.ts',
      find: "    if (status === 'absent') {\n      delete layout[key];\n      countRemoval(owner.kind);",
      replace: "    if (status === 'absent') {\n      countRemoval(owner.kind);",
    }],
  },
  {
    id: 'chain-thickness-falls-back-to-default',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="chainSegmentCms fills a gap" '
      + 'test/wall-face-graph.test.mjs',
    because: 'a segment whose thickness was not recorded must inherit the previous segment of '
      + 'its own chain — the value the person watched on screen — instead of the global default '
      + 'that silently replaced 30 cm with 15 cm in the stored plan (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '    const inherited = previous ?? active ?? fallback;',
      replace: '    const inherited = active ?? fallback;',
    }],
  },
  {
    id: 'chain-thickness-live-tail-inherits-previous',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="live rubber-band" '
      + 'test/wall-face-graph.test.mjs',
    because: 'the last missing thickness belongs to the live rubber-band, so a field change '
      + 'between clicks must preview the value that the click will commit instead of inheriting '
      + 'the preceding segment (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '    const liveTail = active ?? previous ?? fallback;',
      replace: '    const liveTail = previous ?? active ?? fallback;',
    }],
  },
  {
    id: 'chain-thickness-preview-diverges',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="owns no fallback of its own" '
      + 'test/wall-face-graph.test.mjs',
    because: 'the preview and every writer must read one resolver; two formulas for one meaning '
      + 'is what let the editor show 30 cm while the config kept 15 (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '    result.push({ a: [a[0], a[1]], b: [b[0], b[1]], cm: cms[i] });',
      replace: '    result.push({ a: [a[0], a[1]], b: [b[0], b[1]], '
        + 'cm: Number.isFinite(cms[i]) && cms[i] >= 0 ? cms[i] : 15 });',
    }],
  },
  {
    id: 'chain-thickness-length-invariant-dropped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="always returns exactly segmentCount" '
      + 'test/wall-face-graph.test.mjs',
    because: 'the resolver must return one thickness per segment for any input: the array drifting '
      + 'shorter than the path is the mechanism that produced the whole defect (#234)',
    patches: [{
      file: 'src/wall-face-graph.ts',
      find: '  for (let i = 0; i < count; i++) {',
      replace: '  for (let i = 0; i < Math.min(count, (recorded?.length ?? 0)); i++) {',
    }],
  },
  {
    id: 'smoke-launcher-skips-freshness',
    guard: 'node --test --test-name-pattern="launcher enforces the gate" '
      + 'test/bundle-freshness.test.mjs',
    because: 'a smoke run against a stale demo bundle does not fail cleanly — on #234 three '
      + 'assertions went red while a fourth went green, because the old code was wrong in two '
      + 'places that agreed with each other, and the mixed result reads as a logic defect (#236)',
    patches: [{
      file: 'demo/serve.mjs',
      find: '  await assertFreshDemoBundleUnlessAllowed(page, repoRoot);',
      replace: '  // freshness intentionally skipped by the mutant',
    }],
  },
  {
    id: 'safe-resize-axis-eligibility-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="diagonal and non-perpendicular" test/resize.test.mjs',
    because: 'an angled wall must never enter the production resize plan; accepting it restores '
      + 'the topology-changing path that #277 removes',
    patches: [{
      file: 'src/resize.ts',
      find: '  const movingAxis = axisOf(a, b, eps);',
      replace: "  const movingAxis = axisOf(a, b, eps) || 'h';",
    }, {
      file: 'src/resize.ts',
      find: "  if (!movingAxis) return { enabled: false, reason: 'diagonal' };",
      replace: "  if (false && !movingAxis) return { enabled: false, reason: 'diagonal' };",
    }],
  },
  {
    id: 'safe-resize-wall-endpoints-affine-scaled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 298" test/wall-thickness.test.mjs',
    because: 'fixed-topology Resize may translate a moving wall or move its topology endpoint, '
      + 'but proportional scaling invents a wall-record coordinate with no carrier (#298)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "    if (mode === 'fixed-topology') {\n"
        + '      const adx = move.na[0] - move.oa[0], ady = move.na[1] - move.oa[1];',
      replace: "    if (false && mode === 'fixed-topology') {\n"
        + '      const adx = move.na[0] - move.oa[0], ady = move.na[1] - move.oa[1];',
    }],
  },
  {
    id: 'safe-resize-legacy-midpoint-fail-open',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 298 fixed-topology legacy" '
      + 'test/wall-thickness.test.mjs',
    because: 'Safe Resize must reject an affected key-only midpoint unless it names '
      + 'one unambiguous whole changed edge (#298)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "    if (mode === 'fixed-topology') {\n      const direct = wholeEdgeMoves.get(w.key);",
      replace: "    if (false && mode === 'fixed-topology') {\n      const direct = wholeEdgeMoves.get(w.key);",
    }],
  },
  {
    id: 'safe-resize-third-room-cascade-enabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="partial shared and third-owner" test/resize.test.mjs',
    because: 'a long edge split between neighbours may not turn into a three-room cascade or '
      + 'insert vertices; the anonymized #277 regression pins that exact topology',
    patches: [{
      file: 'src/resize.ts',
      find: "  if (partial) return { enabled: false, reason: 'partial-shared' };",
      replace: "  if (false && partial) return { enabled: false, reason: 'partial-shared' };",
    }],
  },
  {
    id: 'safe-resize-topology-signature-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="exactly two existing vertices" test/resize.test.mjs',
    because: 'preview and commit must reject a candidate whose vertex count no longer matches '
      + 'the gesture plan; otherwise simplify/insert can silently return through another path',
    patches: [{
      file: 'src/resize.ts',
      find: '    if (!original || !next || next.length !== plan.topology[roomId]\n'
        + '        || next.length !== original.poly.length || !polyIsSimple(next)) return false;',
      replace: '    if (!original || !next || !polyIsSimple(next)) return false;',
    }],
  },
  {
    id: 'safe-resize-side-ownership-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#289 side ownership" test/resize.test.mjs',
    because: 'extending or shortening a shared side wall must stop before one thickness record '
      + 'describes both shared and outer material; the exact 43-step #289 fixture pins both directions',
    patches: [{
      file: 'src/resize.ts',
      find: '  if (!sideOwnershipPreserved(result, plan, eps)) return false;',
      replace: '  if (false && !sideOwnershipPreserved(result, plan, eps)) return false;',
    }],
  },
  {
    id: 'safe-resize-opening-jamb-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="physical jamb" test/resize.test.mjs',
    because: 'the moving wall body must stop before a perpendicular opening, including half its '
      + 'physical thickness; centreline-only fitting overlaps the jamb',
    patches: [{
      file: 'src/resize.ts',
      find: '    >= opening.length / 2 + movingHalf - eps;',
      replace: '    >= -Infinity;',
    }],
  },
  {
    id: 'safe-resize-commit-preflight-bypassed',
    guard: 'node demo/smoke_room_resize.mjs',
    because: 'a candidate rejected by the exact production wall/floor preflight must create '
      + 'neither preview nor commit; polygon-only success previously persisted disappearing walls',
    patches: [{
      file: 'src/resize-controller.ts',
      find: '      try { valid = input.validatePreview(accepted.preview); } catch { valid = false; }',
      replace: '      try { valid = true; } catch { valid = false; }',
    }, {
      file: 'src/houseplan-card.ts',
      find: '    if (!legacySafe) {',
      replace: '    if (false && !legacySafe) {',
    }, {
      file: 'src/houseplan-card.ts',
      find: '        && this._checkSpacePhysicalGeometry(committedCandidate, before.spaceId).ok;',
      replace: '        && true;',
    }],
  },
  {
    id: 'resize-history-boundary-repair-removed',
    guard: 'node demo/smoke_resize_pointer_real_plan.mjs',
    because: 'write-time wall degradation must not erase the one Resize Undo command; '
      + 'the strict outbound barrier remains authoritative after the local restore (#293)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const physicalChanged = spacePhysicalGeometryFingerprint(before)\n'
        + '      !== spacePhysicalGeometryFingerprint(state);\n'
        + '    if (physicalChanged) {\n'
        + '      let safe = false;\n'
        + '      try {\n'
        + '        const check = restoredCandidate\n'
        + '          ? this._checkSpacePhysicalGeometry(restoredCandidate, state.spaceId)\n'
        + '          : null;\n'
        + "        safe = !!check?.ok || !!(allowHistoryBoundaryRepair\n"
        + "          && check?.reason === 'wall-degraded-extra');\n"
        + '      } catch { safe = false; }\n'
        + '      if (!safe) {',
      replace: '    const physicalChanged = spacePhysicalGeometryFingerprint(before)\n'
        + '      !== spacePhysicalGeometryFingerprint(state);\n'
        + '    if (physicalChanged) {\n'
        + '      let safe = false;\n'
        + '      try {\n'
        + '        const check = restoredCandidate\n'
        + '          ? this._checkSpacePhysicalGeometry(restoredCandidate, state.spaceId)\n'
        + '          : null;\n'
        + '        safe = !!check?.ok;\n'
        + '      } catch { safe = false; }\n'
        + '      if (!safe) {',
    }, {
      file: 'src/houseplan-card.ts',
      find: "        // A history snapshot can predate the write-time wall degradation that\n"
        + "        // canonicalized its command. Restore that one repairable baseline so\n"
        + "        // Undo remains byte-exact immediately; _writeConfig still degrades and\n"
        + "        // strictly validates the outbound candidate before it can leave the\n"
        + "        // card. Every other preflight failure stays fail-closed.\n"
        + "        safe = !!check?.ok || !!(allowHistoryBoundaryRepair\n"
        + "          && check?.reason === 'wall-degraded-extra');",
      replace: "        safe = !!check?.ok;",
    }],
  },
  {
    id: 'resize-audit-resolver-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-availability-audit.test.mjs',
    because: 'the real-plan availability counter must classify every handle through the same '
      + 'resolver as production render; an always-enabled audit would make the baseline meaningless (#292)',
    patches: [{
      file: 'src/resize.ts',
      find: '      const resolution = resolveSafeResize(\n'
        + '        rooms, openings, room.id, edge, optionsFor(room.id, edge, a, b),\n'
        + '      );',
      replace: '      const resolution: SafeResizeResolution = { enabled: true, plan: {} as SafeResizePlan };',
    }],
  },
  {
    id: 'resize-pointer-delta-zeroed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#293 pointer displacement" test/resize.test.mjs',
    because: 'an enabled handle must turn real pointer travel into a signed wall displacement; '
      + 'returning zero recreates the active-but-inert user report from #293',
    patches: [{
      file: 'src/resize.ts',
      find: '  return (current[0] - start[0]) * normal[0]',
      replace: '  return (current[0] - start[0]) * 0',
    }],
  },
  {
    id: 'resize-shared-seam-not-coalesced',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="moving a shared seam" test/wall-thickness.test.mjs',
    because: 'two owners moving one internal seam must keep the continuous side wall as one '
      + 'record; atomising it changes metadata cardinality and silently rejects every preview (#293)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        if (previous && closePoint(previous[1], atom[0])\n'
        + '            && collinearForward(previous, atom)) {',
      replace: '        if (false && previous && closePoint(previous[1], atom[0])\n'
        + '            && collinearForward(previous, atom)) {',
    }],
  },
  {
    id: 'resize-pointer-capture-removed',
    guard: 'node demo/smoke_resize_pointer_real_plan.mjs',
    because: 'the real pointer must keep driving the gesture after it leaves the small SVG handle; '
      + 'without capture the visible preview freezes as soon as the cursor exits (#293)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    capturePointer(ev);\n    const plan = resolution.plan;',
      replace: '    // mutant: pointer capture removed\n    const plan = resolution.plan;',
    }],
  },
  {
    id: 'language-runtime-handwritten-duplicate',
    guard: 'node --test --test-name-pattern="#354" test/i18n-runtime.test.mjs',
    because: 'a handwritten twin of LanguageRuntime looks equivalent today and rots tomorrow — '
      + 'the i18n suite must prove the object production actually runs (#354 К1/К3)',
    patches: [{
      file: 'src/i18n/registry.ts',
      find: 'export const LANGUAGE_RUNTIME: LanguageRuntimeContract = new LanguageRuntime(\n'
        + '  LANGUAGE_REGISTRY,\n'
        + '  BUILD_FINGERPRINT,\n'
        + '  console.warn,\n'
        + '  notifyLanguageLoadFailures,\n'
        + ');',
      replace: 'const twin = new LanguageRuntime(LANGUAGE_REGISTRY, BUILD_FINGERPRINT, '
        + 'console.warn, notifyLanguageLoadFailures);\n'
        + 'export const LANGUAGE_RUNTIME: LanguageRuntimeContract = {\n'
        + '  state: (code) => twin.state(code),\n'
        + '  dictionary: (code) => twin.dictionary(code),\n'
        + '  ensure: (code) => twin.ensure(code),\n'
        + '};',
    }],
  },
  {
    id: 'locale-failure-delivery-cut',
    guard: 'node --test --test-name-pattern="#354" test/i18n-runtime.test.mjs',
    because: 'cutting the listener loop leaves subscribeLanguageLoadFailures a decoy — the unit '
      + 'must prove real code delivery, not only unsubscription (#354 r1-M1)',
    patches: [{
      file: 'src/i18n/registry.ts',
      find: '  for (const listener of languageLoadFailureListeners) listener(code);',
      replace: '  void code;',
    }],
  },
  {
    id: 'locale-failure-toast-dropped',
    guard: 'node demo/smoke_german_locale.mjs',
    because: 'a failed dictionary must be visible on the View card, not only a console line — '
      + 'a German user on a stale tab silently reading English is the N7 hole (#354 К2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    this._languageFailureUnsub = composeUnsub(subscribeLanguageLoadFailures(() => {\n"
        + "      this._showToast(this._t('toast.locale_load_failed'));\n"
        + '    }), ',
      replace: '    this._languageFailureUnsub = composeUnsub(',
    }],
  },
  {
    id: 'french-locale-wrong-dictionary',
    guard: 'node demo/smoke_french_locale.mjs',
    because: 'a French profile silently reading another dictionary is invisible to parity units — '
      + 'only the bundle smoke proves the fr entry loads the fr chunk (#371)',
    patches: [{
      file: 'src/i18n/registry.ts',
      find: "    : await import(/* @vite-ignore */ new URL(`${FRENCH_RETRY_ASSET}?retry`, import.meta.url).href);\n  return { dictionary: module.dictionary, fingerprint: module.fingerprint };",
      replace: "    : await import(/* @vite-ignore */ new URL(`${FRENCH_RETRY_ASSET}?retry`, import.meta.url).href);\n  void module.dictionary;\n  return { dictionary: en, fingerprint: module.fingerprint };",
    }],
  },
  {
    id: 'static-glow-light-cache-spread',
    guard: 'node --test test/space-render-caches.test.mjs',
    because: 'a fresh spread on the devices array silently defeats RESOLVED_LIGHT_CACHE '
      + '(WeakMap by array identity) in BOTH cards — invisible to CI perf profiles (#375 V6a)',
    patches: [{
      file: 'src/glow-scene.ts',
      find: "    input.hass, input.devices, null, input.virtualLights,",
      replace: "    input.hass, [...input.devices], null, input.virtualLights,",
    }],
  },
  {
    id: 'static-glow-scene-lru-single',
    guard: 'node --test test/space-render-caches.test.mjs',
    because: 'a single-entry scene cache makes a door ping-pong rebuild the barrier scene '
      + 'on every flip — the LRU capacity is the contract, parity with the full card (#375 V6c)',
    patches: [{
      file: 'src/space-render.ts',
      find: "const STATIC_LIGHT_BARRIER_LRU = 8;",
      replace: "const STATIC_LIGHT_BARRIER_LRU = 1;",
    }],
  },
  {
    id: 'decor-default-style-seed-cut',
    guard: 'node demo/smoke_decor_default_persist.mjs',
    because: 'without the seed the persisted key is dead weight: every reload silently falls '
      + 'back to the factory style while the write path keeps pretending to save (#377)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (raw) this._decorStyle = decorStyleFromSettings(raw, DEFAULT_DECOR_STYLE);",
      replace: "    void raw;",
    }],
  },
  {
    id: 'decor-default-style-debounce-cut',
    guard: 'node demo/smoke_decor_default_persist.mjs',
    because: 'without the debounce a palette drag streams a config write per input event — '
      + 'store spam and needless expected_rev races between tabs (#377)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "      this._persistDecorStyle();\n    }, 1000);",
      replace: "      this._persistDecorStyle();\n    }, 0);",
    }],
  },
  {
    id: 'core-budget-ignores-growth',
    guard: 'node --test test/core-file-budget.test.mjs',
    because: 'the two cores put on 500-1000 lines per release while everything new '
      + 'goes into new modules — a budget that does not notice growth of its own '
      + 'files is decoration, and the decomposition issue it replaces sat still for '
      + '25 days precisely because nobody was counting (#425, replaces #34)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'export class HouseplanCard',
      replace: `${'\n'.repeat(400)}export class HouseplanCard`,
    }],
  },
  {
    id: 'capture-allows-partial-raster',
    guard: 'node --test test/capture-determinism-args.test.mjs',
    because: 'partial raster reuses whatever the compositor drew before, so the frame '
      + 'depends on the history of the run — one or two of ten frames drifted between '
      + 'runs while three shots inside one process matched byte for byte (#424)',
    patches: [{
      file: 'demo/docs/browser-args.mjs',
      find: "  '--disable-partial-raster',\n",
      replace: '',
    }],
  },
  {
    id: 'capture-draws-before-compositor-settles',
    guard: 'node --test test/capture-determinism-args.test.mjs',
    because: 'without running every compositor stage first the screenshot is taken '
      + 'mid-flight, and the remaining work lands differently on every run (#424)',
    patches: [{
      file: 'demo/docs/browser-args.mjs',
      find: "  '--run-all-compositor-stages-before-draw',\n",
      replace: '',
    }],
  },
  {
    id: 'capture-gate-forgives-a-missing-frame',
    guard: 'node --test test/capture-determinism-gate.test.mjs',
    because: 'comparing only the frames both runs happen to have lets a run that '
      + 'produced nine frames pass against a run that produced ten — «совпало» then '
      + 'means nothing, which is the opposite of what the gate is for (#422)',
    patches: [{
      file: 'scripts/capture-determinism.mjs',
      find: '  const names = [...new Set([...Object.keys(first), ...Object.keys(second)])].sort();',
      replace: '  const names = Object.keys(first).filter((name) => name in second).sort();',
    }],
  },
  {
    id: 'capture-gate-hashes-everything-in-the-folder',
    guard: 'node --test test/capture-determinism-gate.test.mjs',
    because: 'hashing every file in docs/images drags the manifest into the comparison, '
      + 'and the manifest legitimately changes between runs — the gate would then cry '
      + 'wolf on every capture and be switched off within a week (#422)',
    patches: [{
      file: 'scripts/capture-determinism.mjs',
      find: "    if (!name.endsWith('.png')) continue;\n",
      replace: '',
    }],
  },
  {
    id: 'capture-drifts-between-runs',
    guard: 'node --test test/capture-clip.test.mjs',
    because: 'a crop that rounds to the nearest pixel shaves half a pixel off the '
      + 'target, and the frame then depends on sub-pixel layout — the very drift '
      + 'that made #410 undiagnosable; the in-process stability probe stays green '
      + 'on it, so the whole-pixel rule needs a check of its own (#422)',
    patches: [{
      file: 'demo/docs/clip.mjs',
      find: '  const x = Math.floor(rect.x);',
      replace: '  const x = Math.round(rect.x);',
    }],
  },
  {
    id: 'anchor-liveness-ignores-reachability',
    guard: 'node --test test/review-doc-guard.test.mjs',
    because: 'asking whether the object merely exists locally lets an anchor born on '
      + 'the author machine soften the #413 refusal exactly where the mistake was '
      + 'made — liveness has to mean reachable from origin (#422)',
    patches: [{
      file: 'scripts/review-doc-guard.mjs',
      find: "    const probe = run(['log', '--remotes=origin', '--tags', '--format=%T']);",
      replace: "    const probe = { status: 0, stdout: object };",
    }],
  },
  {
    id: 'danger-confirm-back-into-the-branch',
    guard: 'node demo/smoke_danger_confirm_branches.mjs',
    because: 'a confirmation that lives inside one branch of render() does not '
      + 'exist in onboarding — the trash button was dead and the promise hung '
      + 'forever (#402)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    return html`${body}${this._renderVersionBanner()}${this._renderDangerConfirm()}`;',
      replace: '    return html`${body}${this._renderVersionBanner()}`;',
    }],
  },
  {
    id: 'danger-confirm-lost-space-request-guard-removed',
    guard: 'node demo/smoke_danger_confirm_branches.mjs',
    because: 'accepting a new confirmation while the active space resolves to nothing '
      + 'registers a promise whose hp-confirm owner cannot exist (#417 AC1)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (this._dangerConfirmMissingSpace()) return Promise.resolve(false);",
      replace: "    void this._dangerConfirmMissingSpace();",
    }],
  },
  {
    id: 'danger-confirm-lost-space-transition-cancel-removed',
    guard: 'node demo/smoke_danger_confirm_branches.mjs',
    because: 'an open confirmation must resolve false before a lost-space render clears '
      + 'its only decision source (#417 AC1)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (this._dangerConfirm && (\n'
        + '      this._dangerConfirmMissingSpace() || this._syncDangerConfirmLocaleGate() === \'warm\'\n'
        + '    )) {\n'
        + '      this._cancelDangerConfirm();\n'
        + '    }',
      replace: '    if (this._dangerConfirm && this._syncDangerConfirmLocaleGate() === \'warm\') {\n'
        + '      this._cancelDangerConfirm();\n'
        + '    }',
    }],
  },
  {
    id: 'danger-confirm-warm-language-guard-removed',
    guard: 'node demo/smoke_danger_confirm_branches.mjs',
    because: 'a request made while the language gate is already warm must be rejected '
      + 'synchronously without ever entering the confirmation controller (#417 AC2/AC3)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (this._syncDangerConfirmLocaleGate() === 'warm') return Promise.resolve(false);",
      replace: "    void this._syncDangerConfirmLocaleGate();",
    }],
  },
  {
    id: 'danger-confirm-uses-last-rendered-language-gate',
    guard: 'node demo/smoke_danger_confirm_branches.mjs',
    because: 'ready -> warm and warm -> ready both have a window before render; consulting the '
      + 'last painted branch can admit an unrenderable request or reject a renderable one (#434 AC7)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "  /** Synchronize host/runtime language state and return the current branch. */\n"
        + '  private _syncDangerConfirmLocaleGate(): LanguageRenderGate {\n'
        + "    if (!this._config || !this.hass) return 'ready';\n"
        + '    return languageRenderGate(\n'
        + '      this, LANGUAGE_RUNTIME, langOf(this.hass, this._config.language),\n'
        + '    );\n'
        + '  }',
      replace: "  private _dangerConfirmLocaleGate: LanguageRenderGate = 'ready';\n"
        + '  private _syncDangerConfirmLocaleGate(): LanguageRenderGate {\n'
        + '    return this._dangerConfirmLocaleGate;\n'
        + '  }',
    }, {
      file: 'src/houseplan-card.ts',
      find: '    const localeGate = this._syncDangerConfirmLocaleGate();\n'
        + "    if (localeGate === 'cold') return languageLoadingTemplate();",
      replace: '    const localeGate = languageRenderGate(\n'
        + '      this, LANGUAGE_RUNTIME, langOf(this.hass, this._config.language),\n'
        + '    );\n'
        + '    this._dangerConfirmLocaleGate = localeGate;\n'
        + "    if (localeGate === 'cold') return languageLoadingTemplate();",
    }],
  },
  {
    id: 'danger-confirm-warm-transition-cancel-removed',
    guard: 'node demo/smoke_danger_confirm_branches.mjs',
    because: 'a dialog opened while ready must settle false and lose its actionable DOM owner '
      + 'when a new language moves the committed card into the warm noChange branch (#434 AC7)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (this._dangerConfirm && (\n'
        + '      this._dangerConfirmMissingSpace() || this._syncDangerConfirmLocaleGate() === \'warm\'\n'
        + '    )) {\n'
        + '      this._cancelDangerConfirm();\n'
        + '    }',
      replace: '    if (this._dangerConfirm && this._dangerConfirmMissingSpace()) {\n'
        + '      this._cancelDangerConfirm();\n'
        + '    }',
    }],
  },
  {
    id: 'space-card-decor-capability-downgrade-does-not-clear-assets',
    guard: 'node demo/smoke_space_card_decor_capability.mjs',
    because: 'the static card must fail closed after a capability-only backend downgrade; '
      + 'source-shape assertions cannot prove that the stale image map is actually cleared (#440)',
    patches: [{
      file: 'src/space-card.ts',
      find: '      if (snap.decorAssetsApi !== DECOR_ASSETS_API_VERSION) {',
      replace: '      if (false) {',
    }],
  },
  {
    id: 'space-card-decor-capability-change-not-adopted',
    guard: 'node demo/smoke_space_card_decor_capability.mjs',
    because: 'an exact capability-only upgrade must become authoritative even when config, '
      + 'layout and virtual-light content are unchanged (#440)',
    patches: [{
      file: 'src/space-card.ts',
      find: '        this._snap = snap;\n',
      replace: '        this._snap = { ...snap, decorAssetsApi: this._snap?.decorAssetsApi ?? null };\n',
    }],
  },
  {
    id: 'furniture-edge-handles-steal-the-corner',
    guard: 'node demo/smoke_furniture_polish.mjs',
    because: 'both handles share one hit radius, so on furniture narrower than '
      + '4·hr whichever is painted last takes the corner — and the corner is '
      + 'the one that cannot be reached any other way (#400 AC1)',
    patches: [{
      file: 'src/houseplan-card.ts',
      // Порядок — именованное решение, поэтому мутант меняет ЕГО, а не текст
      // рядом с ним: прежний патч правил комментарий и регрессию не
      // воспроизводил (находка CODE-REVIEW-400-r1).
      find: "const HANDLE_PAINT_ORDER = ['edges', 'corners'] as const;",
      replace: "const HANDLE_PAINT_ORDER = ['corners', 'edges'] as const;",
    }],
  },
  {
    id: 'align-guides-exclude-dead-source',
    guard: 'node demo/smoke_align_guides.mjs',
    because: 'device dragging lives in _deviceDrag since #74; excluding by '
      + '_drag excludes nothing, and a guide drawn from a marker to itself '
      + 'looks exactly like an honest one (#400 AC4/AC5)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '      const draggedId = this.host._deviceDrag?.id ?? this.host._drag?.id;',
      replace: '      const draggedId = this.host._drag?.id;',
    }],
  },
  {
    id: 'workflow-scan-hardcodes-the-list',
    guard: 'node --test test/validate-workflow.test.mjs',
    because: 'scanning a fixed pair of names is how a third workflow installs '
      + 'unpinned dependencies unnoticed — the shape #399 removed',
    patches: [{
      file: 'test/validate-workflow.test.mjs',
      // Список из ДВУХ настоящих имён — самая правдоподобная форма регрессии:
      // на сегодняшнем дереве она неотличима от корректного кода, и мутант с
      // одним именем ловился бы по посторонней причине (замечание r1).
      find: "  const files = readdirSync(directory).filter((name) => name.endsWith('.yml'));",
      replace: "  const files = ['validate.yml', 'mutation-gate.yml'];",
    }],
  },
  {
    id: 'lint-scope-drifts',
    guard: 'node --test test/lint-scope.test.mjs',
    because: 'a declared lint scope wider than the checked one is what let '
      + 'F401/F811 into tests_backend unnoticed (#399)',
    patches: [{
      file: 'pyproject.toml',
      find: 'include = ["custom_components/houseplan/**/*.py"]',
      replace: 'include = ["custom_components/houseplan/**/*.py", "tests_backend/**/*.py"]',
    }],
  },
  {
    id: 'frontend-pin-drifts-from-ha',
    guard: 'node --test test/backend-pins.test.mjs',
    because: 'a frontend pin nobody derives from the pinned HA is how the '
      + 'harness ends up testing a combination that does not exist (#399)',
    patches: [{
      file: 'tests_backend/requirements.txt',
      find: 'home-assistant-frontend==20260729.7',
      replace: 'home-assistant-frontend==20260826.1',
    }],
  },
  {
    id: 'sysmodules-guard-blind-to-variable',
    guard: 'node --test test/backend-test-hygiene.test.mjs',
    because: 'a guard that only sees string literals let the third instance of '
      + 'the #389 class walk past it (#398 AC1)',
    patches: [{
      file: 'test/backend-test-hygiene.test.mjs',
      find: '    if (start === null) { if (namesThePackage) hits.push(match[0]); continue; }',
      replace: '    if (start === null) { continue; }',
    }],
  },
  {
    id: 'pure-imports-stops-cleaning',
    guard: 'python3 -m pytest tests_backend/test_backend_quality.py -q -p no:cacheprovider',
    because: 'pure_imports is allowed to write into sys.modules only because it '
      + 'removes the entries again; without that the exemption is a hole (#398 AC8)',
    patches: [{
      file: 'tests_backend/pure_imports.py',
      find: '            del sys.modules[key]',
      replace: '            pass',
    }],
  },
  {
    id: 'device-echo-keeps-local-noncanonical',
    guard: 'node demo/smoke_device_position_history.mjs',
    because: 'a card that keeps the raw position while sending the canonical '
      + 'one mistakes its own echo for a remote edit and wipes the undo stack '
      + '(#397 B3)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            this._layout = { ...this._layout, [deviceId]: pos };',
      replace: '            void pos;',
    }],
  },
  {
    id: 'camera-cancel-loses-zoom',
    guard: 'node demo/smoke_smooth_zoom.mjs',
    because: 'the frame frozen by touching the plan is what the user sees; not '
      + 'persisting it is the v1.69.0 regression #396 B1 closes',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    this._cancelCameraTransition(false, true);',
      replace: '    this._cancelCameraTransition(false);',
    }],
  },
  {
    id: 'room-fit-interactive-owner-leaks-through',
    guard: 'node demo/smoke_room_fit.mjs',
    because: 'an HA link or another independently interactive child must never bubble into '
      + 'the room camera command (#152 AC6)',
    patches: [{
      file: 'src/room-fit.ts',
      find: "    if (pathMatches(node, ROOM_FIT_INTERACTIVE_OWNER)) return { kind: 'interactive' };",
      replace: "    if (pathMatches(node, ROOM_FIT_INTERACTIVE_OWNER)) continue;",
    }],
  },
  {
    id: 'room-fit-pan-release-reaccepted',
    guard: 'node demo/smoke_room_fit.mjs',
    because: 'movement that became a pan must not survive as a room click when the pointer '
      + 'is released over the original room (#152 AC7)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        this._roomPointer = null;\n        this._doubleFit.clear();\n        this._suppressClick = true;',
      replace: '        this._doubleFit.clear();\n        this._suppressClick = true;',
    }, {
      file: 'src/room-fit.ts',
      find: '  if (!candidate || blocked || candidate.pointerId !== pointerId',
      replace: '  if (!candidate || candidate.pointerId !== pointerId',
    }],
  },
  {
    id: 'room-fit-html-overlay-jumps-ahead',
    guard: 'node demo/smoke_room_fit.mjs',
    because: 'HTML room labels and the SVG plan must consume the same presented camera on '
      + 'every intermediate transition frame (#152 AC10)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'space.rooms.map((r) => this._renderRoomLabel(\n'
        + '                  r, space, view, disp, isoOverlays?.rooms.get(r),\n'
        + '                ))',
      replace: 'space.rooms.map((r) => this._renderRoomLabel(\n'
        + '                  r, space, this._cameraTransition.target?.viewBox || view, disp, '
        + 'isoOverlays?.rooms.get(r),\n'
        + '                ))',
    }],
  },
  {
    id: 'room-fit-persists-zoom',
    guard: 'node demo/smoke_room_fit.mjs',
    because: 'room focus is session-only and must not leak its zoom into LS_ZOOM on '
      + 'completion or cancellation (#152 AC15)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (state.reason !== 'room') this._saveZoom();",
      replace: '    this._saveZoom();',
    }, {
      file: 'src/houseplan-card.ts',
      find: "    if (presentedZoom !== undefined && reason !== 'room') this._saveZoom();",
      replace: '    if (presentedZoom !== undefined) this._saveZoom();',
    }],
  },
  {
    id: 'camera-anchor-from-presented',
    guard: 'node demo/smoke_smooth_zoom.mjs',
    because: 'reading the anchor from the lagging frame walks the point under '
      + 'the pointer 17 px away in a fast wheel series (#396 B2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const anchorFrom = (animated && this._cameraTransition.target)',
      replace: '    const anchorFrom = (false && this._cameraTransition.target)',
    }],
  },
  {
    id: 'glow-feather-thaws-during-camera',
    guard: 'node --test test/golden-matrix.test.mjs',
    because: 'the feather freeze must know about the animated transition, not '
      + 'only about pinch and pan (#396 M2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      && !this._cameraTransition.active;',
      replace: '      && true;',
    }],
  },
  {
    id: 'error-code-dropped-from-contract',
    guard: 'python3 -m pytest tests_backend/test_backend_quality.py -q -p no:cacheprovider',
    because: 'a code emitted by the backend but missing from ERROR_CODES is exactly the '
      + 'unregistered-error hole #42 closes (AC5 m1)',
    patches: [{
      file: 'custom_components/houseplan/const.py',
      find: '    "invalid_space_id", "invalid_toggle_entity", "invalid_vacuum_map_route",',
      replace: '    "invalid_toggle_entity", "invalid_vacuum_map_route",',
    }],
  },
  {
    id: 'typing-gate-stops-running',
    guard: 'python3 -m pytest tests_backend/test_backend_quality.py -q -p no:cacheprovider',
    because: 'a strict-typing allowlist that CI never executes is a measurement '
      + 'that measures nothing — the step must be load-bearing (#42 r6 AC4)',
    patches: [{
      file: '.github/workflows/validate.yml',
      find: '          python -m mypy $modules',
      replace: '          echo "skip: $modules"',
    }],
  },
  {
    id: 'error-scanner-loses-a-class-source',
    guard: 'python3 -m pytest tests_backend/test_backend_quality.py -q -p no:cacheprovider',
    because: 'silencing one err.code class source must redden the scanner, or the branch '
      + '(b) proof is decorative (#42 AC5 m1b)',
    patches: [{
      file: 'tests_backend/test_backend_quality.py',
      find: "    fixed |= set(re.findall(r'^\\s+code = \"([a-z0-9_]+)\"', validation, re.M))",
      replace: "    pass  # m1b: the class-attr source silenced",
    }],
  },
  {
    id: 'error-code-via-variable-dropped',
    guard: 'python3 -m pytest tests_backend/test_backend_quality.py -q -p no:cacheprovider',
    because: 'the variable-passed MarkerControlError subfamily must stay proven — dropping '
      + 'invalid_light_entity from ERROR_CODES has to redden AC5 (#42 m1c, spec rev6)',
    patches: [{
      file: 'custom_components/houseplan/const.py',
      find: '    "invalid_light_entity", "invalid_marker_control", "invalid_name",',
      replace: '    "invalid_marker_control", "invalid_name",',
    }],
  },
  {
    id: 'error-details-json-branch-cut',
    guard: 'node --test test/open-passage-contract.test.mjs',
    because: 'structured JSON details replacing the English-sentence regex is the visible '
      + 'half of the #42 error contract (AC6 m2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "      let spaceId = '', fieldList: string[] = [];\n      try {\n        const details = JSON.parse(raw);",
      replace: "      let spaceId = '', fieldList: string[] = [];\n      try {\n        const details = { space: null, fields: null }; void raw;",
    }],
  },
  {
    id: 'discovery-preview-copies-the-filter',
    guard: 'node --test test/devices.test.mjs',
    because: 'the preview must diff the REAL seedHiddenBindings/buildDevices outputs — a '
      + 'hand-rolled platform check would drift from the production filter (#44 AC6)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    const seededOf = (settings: object, excluded: ReadonlySet<string>) => new Set(\n      seedHiddenBindings({ ...ctx, settings, excluded } as never));",
      replace: "    const seededOf = (settings: object, excluded: ReadonlySet<string>) => new Set(\n      [...excluded].filter((platform) => platform && EXCLUDED_DOMAINS.has(platform)));",
    }],
  },
  {
    id: 'discovery-reset-writes-a-copy',
    guard: 'node demo/smoke_discovery_filters.mjs',
    because: 'Restore recommended must store the default as ABSENCE of the key — a written '
      + 'copy of the product list would freeze it against future product updates (#44 AC2)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    if (draft.usesProductList) delete settings.exclude_integrations;\n    else settings.exclude_integrations = draft.excluded;",
      replace: "    settings.exclude_integrations = draft.excluded;",
    }],
  },
  {
    id: 'schema-manifest-enum-drift',
    guard: 'node --test test/config-schema-parity.test.mjs',
    because: 'a backend enum value the frontend does not know (and the allow-list does not '
      + 'bless) is exactly the schema drift #33 exists to catch — the manifest mutation '
      + 'simulates the backend change without the frontend pair',
    patches: [{
      file: 'scripts/config-schema.json',
      find: "    \"config.spaces[].settings.fill_mode\": {\n      \"enum\": [\n        \"custom\",",
      replace: "    \"config.spaces[].settings.fill_mode\": {\n      \"enum\": [\n        \"phantom-33\",\n        \"custom\",",
    }],
  },
  {
    id: 'registry-selector-dead-decision',
    guard: 'node --test test/config-schema-parity.test.mjs',
    because: 'a registry decision whose selector no longer matches the schema is a dead '
      + 'decision — the completeness test must refuse to let them accumulate (#33 AC4)',
    patches: [{
      file: 'scripts/config-field-registry.mjs',
      find: "    selector: { path: ['spaces', '*', 'zero_wall_style'] },",
      replace: "    selector: { path: ['spaces', '*', 'zero_wall_stylo'] },",
    }],
  },
  {
    id: 'same-binding-click-resets-source',
    guard: 'node demo/smoke_value_face_source.mjs',
    because: 'a same-binding click silently wiping the configured value source is exactly '
      + 'the #385(a) bug — only the dialog smoke drives the real handler',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "                                if (c.value === d.binding) {\n                                  this.host._markerDialog = { ...d, bindingOpen: false };\n                                  return;\n                                }",
      replace: "                                if (false) { return; }",
    }],
  },
  {
    id: 'release-proof-computed-for-every-commit',
    guard: 'node --test test/process-gate.test.mjs',
    because: 'gating the expensive diff proof on the SAME release predicate is the #385(v) '
      + 'contract — a narrowed or removed gate either wastes git-show spawns per commit '
      + 'or hands release commits a null proof (false violations)',
    patches: [{
      file: 'scripts/process-gate.mjs',
      find: "        releaseSourceViolations: isReleaseCommit(subject, one)\n          ? releaseSourceViolationsOf(sha, files) : null,",
      replace: "        releaseSourceViolations: releaseSourceViolationsOf(sha, files),",
    }],
  },
  {
    id: 'fit-house-hidden-walls-vote',
    guard: 'node demo/smoke_space_card.mjs',
    because: 'hidden architecture silently widening the tight frame is exactly the #384 bug: '
      + 'only the twin-frames smoke sees the rendered viewBox difference',
    patches: [{
      file: 'src/space-render.ts',
      find: "    if (disp.showBorders) for (const body of extras) {",
      replace: "    for (const body of extras) {",
    }],
  },
  {
    id: 'space-card-null-title-compact-narrowed',
    guard: 'node --test test/space-card-audit-lows.test.mjs',
    because: 'YAML `title:` with no value is null — narrowing the compact condition back to '
      + "'' alone silently reopens the #372 header strip for those configs (#376а)",
    patches: [{
      file: 'src/space-card.ts',
      find: "      compactTopFrame: this._config.title === '' || this._config.title === null,",
      replace: "      compactTopFrame: this._config.title === '',",
    }],
  },
  {
    id: 'furniture-stroke-iso-camera-mismatch',
    guard: 'node --test test/furniture-stroke-contract.test.mjs',
    because: 'the stroke compensation models the flat camera; applying it in the labs iso '
      + 'projection diverges furniture from ordinary decor by a wrong-camera factor (#376г)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    const furnitureScreenScale = this._renderProjection === 'iso' ? 1 : furniturePlanScreenScale(",
      replace: "    const furnitureScreenScale = furniturePlanScreenScale(",
    }],
  },
  {
    id: 'furniture-wall-surface-drops-thickness',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="magnet presses|local atomic|out of reach" '
      + 'test/furniture.test.mjs',
    because: 'falling back to the room centreline recreates #445: BACK enters thick masonry '
      + 'and the physical reach threshold moves by half the wall depth',
    patches: [{
      file: 'src/furniture-wall-surface.ts',
      find: '      const half = Number.isFinite(rawHalf) && rawHalf > 0 ? rawHalf : 0;',
      replace: '      const half = 0;',
    }],
  },
  {
    id: 'furniture-wall-surface-loses-room-side',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="exterior wall exposes|shared thick wall" '
      + 'test/furniture.test.mjs',
    because: 'treating a one-sided room face like an arbitrary body face lets an outside '
      + 'pointer flip furniture through an exterior wall and loses shared-room intent (#445)',
    patches: [{
      file: 'src/furniture-placement.ts',
      find: '    let normal = unit(surface.normal);',
      replace: '    let normal = unit(null);',
    }],
  },
  {
    id: 'furniture-wall-tie-follows-input-order',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="exact-axis placement|corner selection" '
      + 'test/furniture.test.mjs',
    because: 'without the final stable identity comparison an exact shared axis or room corner '
      + 'changes side when room/surface arrays are reordered (#445 AC2/AC10)',
    patches: [{
      file: 'src/furniture-placement.ts',
      find: '              && candidate.stableId.localeCompare(best.stableId) < 0)))) best = candidate;',
      replace: '              && false)))) best = candidate;',
    }],
  },
  {
    id: 'furniture-wall-runtime-drops-raw-intent',
    guard: 'node demo/smoke_furniture.mjs',
    because: 'using the grid-snapped axis point for shared-wall side selection loses the user\'s '
      + 'actual room-side intent in the editor integration (#445 AC2/AC5)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '      intentPoint: [raw[0], raw[1]],',
      replace: '      intentPoint: [snapped[0], snapped[1]],',
    }],
  },
  {
    id: 'furniture-wall-runtime-drops-drag-side',
    guard: 'node demo/smoke_furniture.mjs',
    because: 'without the current local +y normal an exact-axis drag may flip furniture to the '
      + 'other face of a shared wall (#445 AC2/AC5)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '      [rawCx, rawCy], preferredNormal);',
      replace: '      [rawCx, rawCy]);',
    }],
  },
  {
    id: 'furniture-exterior-surface-removed',
    guard: 'node demo/smoke_furniture.mjs',
    because: 'the production preview/commit/drag path must keep exterior furniture outside; '
      + 'unit-only candidate counts do not prove the shipped interaction (#447 AC3)',
    patches: [{
      file: 'src/furniture-wall-surface.ts',
      find: '    const exterior = ownersByAtom.get(atomId)?.size === 1 && half > 1e-9;',
      replace: '    const exterior = false && ownersByAtom.get(atomId)?.size === 1 && half > 1e-9;',
    }],
  },
  {
    id: 'decor-keyboard-nudge-reruns-magnet',
    guard: 'node demo/smoke_decor.mjs',
    because: 'Arrow fine-tuning must apply an exact delta; even a result-preserving call into '
      + 'the decor magnet violates the no-resnap contract and can later move furniture (#447 AC5)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const moved = nudgeDecorShape(\n'
        + '      selected, renderDx, renderDy, NORM_W, this._decorH, CANVAS_LIMIT,\n'
        + '    );',
      replace: "    this._decorSnap([renderDx, renderDy], 'mouse', selected.id);\n"
        + '    const moved = nudgeDecorShape(\n'
        + '      selected, renderDx, renderDy, NORM_W, this._decorH, CANVAS_LIMIT,\n'
        + '    );',
    }],
  },
  {
    id: 'decor-keyboard-nudge-drops-focus-dialog-guards',
    guard: 'node demo/smoke_decor.mjs',
    because: 'the global Arrow listener must not steal navigation from fields or mutate decor '
      + 'behind an open dialog (#447 AC8)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '          && !inField && !inEditorSecondary && !this._editorSecondaryDialogBlocked) {',
      replace: '          && !inEditorSecondary) {',
    }],
  },
  {
    id: 'opening-light-quantum-identity',
    guard: 'node --test --test-name-pattern="#366" test/logic.test.mjs',
    because: 'an identity quantum brings back ~100 barrier recomputes per moving-gate cycle — '
      + 'the sweep unit must bound distinct signatures to the 0.05 grid (#366)',
    patches: [{
      file: 'src/logic.ts',
      find: '  return Math.min(1, Math.max(0,\n'
        + '    Math.round(safe / OPENING_LIGHT_AMOUNT_QUANTUM) * OPENING_LIGHT_AMOUNT_QUANTUM));',
      replace: '  return safe;',
    }],
  },
  {
    id: 'vac-trail-drop-warn-removed',
    guard: 'node --test --test-name-pattern="#369" test/vacuum.test.mjs',
    because: 'a NaN calibration must not hide the trail silently — the drop count belongs in the '
      + 'console (#369b)',
    patches: [{
      file: 'src/vacuum.ts',
      find: '  if (droppedSegments > 0) {\n'
        + '    warn(`[houseplan] vacuum trail: ${droppedSegments} segment(s) dropped — non-finite point (check map calibration)`);\n'
        + '  }',
      replace: '  void droppedSegments; void warn;',
    }],
  },
  {
    id: 'climate-legacy-area-undefined-lost',
    guard: 'node --test --test-name-pattern="369в" test/devices.test.mjs',
    because: 'legacy/import markers carry an absent area key, not an explicit null — strict '
      + 'equality quietly demotes their climate back to the registry fallback (#369v)',
    patches: [{
      file: 'src/devices.ts',
      find: '  if (marker.area == null && marker.space && marker.room_id) {',
      replace: '  if (marker.area === null && marker.space && marker.room_id) {',
    }],
  },
  {
    id: 'opted-out-roster-looks-alive',
    guard: 'node --test --test-name-pattern="369г" test/device-presentation.test.mjs',
    because: 'a roster the user deliberately disabled is evidence of opting out, not of life — '
      + 'dropping the guard makes the marker glow forever (#369g)',
    patches: [{
      file: 'src/device-presentation.ts',
      find: '  const activeEntitylessDevice = ownEntities.length === 0\n'
        + '    && !disabledRoster\n',
      replace: '  void disabledRoster;\n'
        + '  const activeEntitylessDevice = ownEntities.length === 0\n',
    }],
  },
  {
    id: 'furniture-shift-listeners-not-attached',
    guard: 'node demo/smoke_furniture_polish.mjs',
    because: 'without the window listeners the preview ignores Shift until the mouse moves — the '
      + 'exact drift the smoke pins (#369d)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '    this.host._furnPalette = { symbol, w: d.w, h: d.h };\n'
        + '    this._furnShiftAttach();',
      replace: '    this.host._furnPalette = { symbol, w: d.w, h: d.h };',
    }],
  },
  {
    id: 'placement-accepts-any-mouse-button',
    guard: 'node demo/smoke_furniture_polish.mjs',
    because: 'a right click with an armed tool must not stamp furniture (#369e)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    if (ev.pointerType === 'mouse' && ev.button !== 0\n"
        + "        && t !== 'select' && t !== 'erase') return false;",
      replace: '    // mutant: any button places',
    }],
  },
  {
    id: 'backdrop-probe-always-safe',
    guard: 'node demo/smoke_backdrop_guard.mjs',
    because: 'a probe that waves every raster through reopens the original hole — a 100 MP scan '
      + 'decodes unwarned and kills the tablet tab (#39 AC1)',
    patches: [{
      file: 'src/backdrop-pick.ts',
      find: "  if (probe.kind === 'safe' && file.size <= guardAboveBytes) return { kind: 'pass', ext };",
      replace: "  return { kind: 'pass', ext };",
    }],
  },
  {
    id: 'backdrop-downscale-drops-alpha',
    guard: 'node demo/smoke_backdrop_guard.mjs',
    because: 'a transparent PNG reduced into JPEG silently paints the plan background black — '
      + 'alpha must survive the reduced copy (#39 AC2)',
    patches: [{
      file: 'src/backdrop-pick.ts',
      find: "    const alpha = state.probe.alpha;",
      replace: '    const alpha = false;',
    }],
  },
  {
    id: 'backdrop-hard-demoted-to-warn',
    guard: 'node demo/smoke_backdrop_guard.mjs',
    because: 'beyond the 16384 px canvas cap the reduced copy CANNOT be built — offering it is a '
      + 'lie that ends in a decode failure (#39 AC4 phase 1)',
    patches: [{
      file: 'src/backdrop-probe.ts',
      find: "  const kind: BackdropVerdict = Math.max(width, height) > HARD_DIMENSION\n"
        + "    ? 'hard'\n"
        + "    : decodedBytes > WARN_DECODED_BYTES ? 'warn' : 'safe';",
      replace: "  const kind: BackdropVerdict = "
        + "decodedBytes > WARN_DECODED_BYTES ? 'warn' : 'safe';",
    }],
  },
  {
    id: 'backdrop-phase2-falls-back-to-original',
    guard: 'node demo/smoke_backdrop_guard.mjs',
    because: 'silently uploading the original the user just declined is the exact dishonesty the '
      + 'phase-2 contract forbids — staging must stay clean after a failed reduce (#39 AC4b)',
    patches: [{
      file: 'src/backdrop-pick.ts',
      find: '    } catch {\n'
        + '      // Honest phase 2 (spec §UX): no silent fallback to the original the\n'
        + '      // user just declined — staging stays clean, the toast says what happened.\n'
        + '      if (!stillCurrent()) return;\n'
        + '      close();\n'
        + "      host._showToast(host._t('backdrop.downscale_failed'));\n"
        + '    }',
      replace: '    } catch {\n'
        + '      const payload = await encodePlanFile(guard.file, guard.ext, guard.file.name);\n'
        + '      apply(payload);\n'
        + '      close();\n'
        + '    }',
    }],
  },
  {
    id: 'backdrop-busy-dismiss-races-decision',
    guard: 'node demo/smoke_backdrop_guard.mjs',
    because: 'Escape/scrim during the running reduce must not race the decision — the dialog '
      + 'stays up while busy, and a force-cleared guard never applies a stale result (#39 r1-M1)',
    patches: [{
      file: 'src/backdrop-pick.ts',
      find: '  const dismiss = (): void => {\n'
        + '    if (host._backdropGuard?.busy) return;\n'
        + '    close();\n'
        + '  };',
      replace: '  const dismiss = (): void => {\n'
        + '    close();\n'
        + '  };',
    }],
  },
  {
    id: 'cold-view-vacuum-mapid-delegated',
    guard: 'node demo/smoke_cold_view_vacuum.mjs',
    because: 'map-id resolution runs inside willUpdate for every vacuum with telemetry — the '
      + '#337 stub threw there on a cold tab and froze the whole Lit update cycle (#358); the '
      + 'demo mower has no position attributes, so only this telemetry-bearing cold smoke sees it',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const ve = this._vacEntity(d);\n'
        + '    const sel = ve ? planHass?.states?.[ve]?.attributes?.selected_map : null;\n'
        + '    return vacMapIdWithFallback(tele.mapId, sel);',
      replace: "    return this._editorRuntimeOrThrow()._vacMapId(d, tele, planHass);",
    }],
  },
  {
    id: 'cold-view-toggle-delegated-to-runtime',
    guard: 'node demo/smoke_cold_view_toggle.mjs',
    because: 'the View card must resolve a tap without the lazy editor runtime — the #337 stub '
      + 'threw inside the click handler on every cold tab and a wall switch controlling three '
      + 'virtual lamps did nothing until an editor surface was opened (#357)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '  public _toggleIntent(\n'
        + '    device: DevItem,\n'
        + '    devices: readonly DevItem[] = this._devices,\n'
        + '  ): ResolvedToggleIntent | null {\n'
        + '    return resolveToggleIntent({\n'
        + '      hass: this._planHass,\n'
        + '      registryHass: this._fullRegistryHass,\n'
        + '      devices,\n'
        + '      device,\n'
        + '      virtualLights: this._virtualLights,\n'
        + '    });\n'
        + '  }',
      replace: '  public _toggleIntent(\n'
        + '    device: DevItem,\n'
        + '    devices: readonly DevItem[] = this._devices,\n'
        + '  ): ResolvedToggleIntent | null {\n'
        + "    return this._editorRuntimeOrThrow()._toggleIntent(device, devices);\n"
        + '  }',
    }],
  },
  {
    id: 'lazy-loader-network-failure-terminal',
    guard: 'node --test --test-name-pattern="#353 AC1" test/editor-runtime-loader.test.mjs',
    because: 'a transient network failure must re-arm the loader for the next explicit press — '
      + 'a terminal state blocks the editor until a page refresh (#353 К1)',
    patches: [{
      file: 'src/editor-runtime-loader.ts',
      find: "    this._setState(sawMismatch ? 'failed' : 'idle');",
      replace: "    this._setState('failed');",
    }],
  },
  {
    id: 'lazy-loader-terminality-hardcoded',
    guard: 'node --test --test-name-pattern="#353" test/editor-runtime-loader.test.mjs',
    because: 'a hardcoded terminal flag shows the wrong advice — the network toast must invite '
      + 'another press, the mismatch toast must demand a refresh (#353 К2/AC5)',
    patches: [{
      file: 'src/editor-runtime-loader.ts',
      find: '    this.options.failed?.(lastError, { terminal: sawMismatch });',
      replace: '    this.options.failed?.(lastError, { terminal: true });',
    }],
  },
  {
    id: 'lazy-chunk-cache-control-reverted',
    guard: 'node scripts/backend-test-guard.mjs hashed_chunks_are_immutably_cacheable '
      + 'tests_backend/test_frontend_assets.py',
    because: 'content-hashed chunk bodies never change under their URL — reverting to no-cache '
      + 'reopens the stale-proxy window and refetches on every editor entry (#353 К4)',
    patches: [{
      file: 'custom_components/houseplan/frontend_asset_manifest.py',
      find: 'ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"',
      replace: 'ASSET_CACHE_CONTROL = "no-cache"',
    }],
  },
  {
    id: 'bundle-tree-orphans-ignored',
    guard: 'node --test --test-name-pattern="#353 AC4" test/bundle-assets.test.mjs',
    because: 'an unlisted chunk on disk rides into the release zip and masks sync bugs — '
      + 'the tree check must fail loudly on orphans (#353 К5)',
    patches: [{
      file: 'scripts/bundle-tree.mjs',
      find: "      if (name.endsWith('.js') && !listed.has(`houseplan-assets/${name}`)) {\n"
        + '        throw new Error(`orphan bundle asset: houseplan-assets/${name}`);\n'
        + '      }',
      replace: "      void name; void listed;",
    }],
  },
  {
    id: 'entry-fallback-rewrite-skipped',
    guard: 'node demo/smoke_entry_stale.mjs',
    because: 'without the rewrite the entry keeps a STATIC re-export: after an update a cached '
      + 'entry aborts before any code runs and the card dies silently (#353 К3)',
    patches: [{
      file: 'scripts/bundle-manifest.mjs',
      find: '      entry.code = entry.code.replace(pattern, fallback);',
      replace: '      void fallback;',
    }],
  },
  {
    id: 'junction-limit-key-precision-lost',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#331 AC1" test/junction-limits.test.mjs',
    because: 'toFixed(6) keys split one node into two on floating debris and forked on the '
      + 'sign of zero — two false П4 refusals on a legitimate resize (#331 §2.1)',
    patches: [{
      file: 'src/junction-limits.ts',
      find: 'const key = (point: number[]): string =>\n'
        + '  `${quantizeKeyCoord(point[0])},${quantizeKeyCoord(point[1])}`;',
      replace: 'const key = (point: number[]): string => '
        + '`${point[0].toFixed(6)},${point[1].toFixed(6)}`;',
    }],
  },
  {
    id: 'junction-limit-branch-dropped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#331 AC3" test/junction-limits.test.mjs',
    because: 'taking only the first collinear continuation silently drops every fork and '
      + 'understates the wall run — a legitimate thickness-step filler gets refused (#331 §2.3)',
    patches: [{
      file: 'src/junction-limits.ts',
      find: '    for (const candidate of byNode.get(key(node)) || []) {',
      replace: '    for (const candidate of (byNode.get(key(node)) || []).slice(0, 1)) {',
    }],
  },
  {
    id: 'junction-limit-candidate-fail-open',
    guard: 'node demo/smoke_junction_limits.mjs',
    because: 'an exception while judging the candidate must refuse the write — a silent pass '
      + 'reopens the fail-open hole the #278 guard closed for geometry (#331 §2.5)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "      return [{ rule: 'check_failed', subject: spaceId, actual: 0, limit: 0 }];",
      replace: '      return [];',
    }],
  },
  {
    id: 'junction-limit-p3-quadratic-again',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node demo/benchmark_junction_limits.mjs',
    because: 'П3 rebuilding its node index per segment is the exact O(n²) #330 removed '
      + '(289 ms per call on 576 atoms, twice per pointermove) — the benchmark budget '
      + 'must turn red the day it returns',
    patches: [{
      file: 'src/junction-limits.ts',
      find: '    const units = collinearRunLengthUnits(segment, usable, byNode);',
      replace: '    const units = collinearRunLengthUnits(segment, usable);',
    }],
  },
  {
    id: 'junction-limit-p4-bruteforce-again',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node demo/benchmark_junction_limits.mjs',
    because: 'П4 is architecturally quadratic without the bucket grid (#330 §4.5); feeding '
      + 'every node the whole segment list instead of its cell brings the 104-372 ms cost '
      + 'back and the benchmark must catch it',
    patches: [{
      file: 'src/junction-limits.ts',
      find: '    for (const segment of segmentGrid.get(`${cx},${cy}`) || []) {',
      replace: '    for (const segment of usable) {',
    }],
  },
  {
    id: 'junction-limit-baseline-cache-stale',
    // r2-M1: the behavioural guard — the smoke counts BASELINE computations
    // (exactly one per gesture with a working cache, one per pointermove
    // without) — plus the source-contract unit stays as the cheap first line.
    guard: 'node demo/smoke_junction_limits.mjs '
      + '&& npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#330 AC4" test/junction-limits.test.mjs',
    because: 'a baseline cache that survives a config epoch change serves verdicts of a '
      + 'plan that no longer exists — the epoch check IS the invalidation contract (#330 §4.4)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (cached && fingerprint && cached.fingerprint === fingerprint\n"
        + '        && cached.spaceId === spaceId) {',
      replace: '    if (cached && cached.spaceId === spaceId) {',
    }],
  },
  {
    id: 'junction-limit-optimize-unguarded',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'test_333_optimize_refuses_a_crafted_violation '
      + 'tests_backend/test_ha_websocket.py',
    because: 'plan/optimize writes arbitrary client geometry; without the junction gate a '
      + 'crafted payload persists violations that inheritance then legalises for every later '
      + 'config/set (#333 AC1)',
    patches: [{
      file: 'custom_components/houseplan/websocket_api.py',
      find: '            return validate_junction_limits(\n'
        + '                msg["config"], config_data.get("config"),\n'
        + '            ), None',
      replace: '            return {}, None',
    }],
  },
  {
    id: 'junction-limit-backend-raw-baseline',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'test_legacy_baseline_is_judged_after_the_same_migration '
      + 'tests_backend/test_junction_limits.py',
    because: 'a legacy baseline carries no wall catalogue, so judging it raw reports "no '
      + 'violations" whatever its geometry and turns every inherited one into a refusal of '
      + 'an unrelated edit (#329 §3, code review r1 H1)',
    patches: [{
      file: 'custom_components/houseplan/junction_limits.py',
      find: '        migrated, _ = commit_wall_segment_model(config)',
      replace: '        migrated = config  # mutant: judge the raw document',
    }],
  },
  {
    id: 'junction-limit-angle-not-enforced',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="П1" test/junction-limits.test.mjs',
    because: 'the owner-approved 15° minimum between neighbouring walls is a hard limit; '
      + 'lowering it silently lets the trident apex of #329 be drawn again',
    patches: [{
      file: 'src/junction-limits.ts',
      find: 'export const MIN_JUNCTION_ANGLE_DEG = 15;',
      replace: 'export const MIN_JUNCTION_ANGLE_DEG = 0;',
    }],
  },
  {
    id: 'junction-limit-write-gate-removed',
    guard: 'node demo/smoke_junction_limits.mjs',
    because: 'the limits must refuse the WRITE, not merely report it — without the barrier '
      + 'an impossible junction reaches the saved document (#329 §2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (introduced.length) {\n      this._clearGeometryGesture();',
      replace: '    if (false && introduced.length) {\n      this._clearGeometryGesture();',
    }],
  },
  {
    id: 'wall-draw-full-preflight-again',
    guard: 'node demo/benchmark_wall_draw_click.mjs',
    because: 'every intermediate Walls click must use the bounded #461 barrier; routing it back '
      + 'through the generic full-space transaction recreates the measured one-second pause',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    commitDraftSegmentGeometry(this, this.host._t('history.draft_segment'), before);",
      replace: "    this._commitPhysicalGeometry(this.host._t('history.draft_segment'), before);",
    }],
  },
  {
    id: 'wall-draw-local-neighbour-dropped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="local draft projection" '
      + 'test/draft-live-preflight.test.mjs',
    because: 'a bounded proof that drops a room whose masonry envelope meets the new segment '
      + 'can accept geometry the generic barrier rejects (#461 AC4)',
    patches: [{
      file: 'src/draft-live-preflight.ts',
      find: '    return id && near ? [id] : [];',
      replace: '    return [];',
    }],
  },
  {
    id: 'wall-draw-terminal-full-check-skipped',
    guard: 'node demo/benchmark_wall_draw_click.mjs',
    because: 'the local click verdict is deliberately non-terminal; finishing a wall chain must '
      + 'still cross an independent full-space barrier (#461 AC7)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    this._commitPhysicalGeometry(this.host._t('history.wall_chain_finish'), before);",
      replace: "    this._recordGeometry(this.host._t('history.wall_chain_finish'), before);",
    }],
  },
  {
    id: 'wall-draw-rejection-rollback-skipped',
    guard: 'node demo/smoke_wall_draw_click.mjs',
    because: 'a junction-rejected terminal click must restore its config snapshot before the '
      + 'gesture is cleared, otherwise the invalid point survives without history or a write (#461 AC6)',
    patches: [{
      file: 'src/draft-live-commit.ts',
      find: '  if (introduced.length) {\n    runtime._clearGeometryGesture();\n'
        + '    runtime._restoreGeometryStateLocal(before);',
      replace: '  if (introduced.length) {\n    runtime._clearGeometryGesture();',
    }],
  },
  {
    id: 'wall-draw-wall-artifact-discarded',
    guard: 'node demo/benchmark_wall_draw_click.mjs',
    because: 'the exact candidate wall union already computed by physical preflight must feed '
      + 'the junction pass; discarding it repays the expensive union on every click (#461 AC5)',
    patches: [{
      file: 'src/draft-live-commit.ts',
      find: '    geometry, candidateProjection.roomIds,',
      replace: '    null, candidateProjection.roomIds,',
    }],
  },
  {
    id: 'degenerate-apex-bevelled-again',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="§4" test/junction-limits.test.mjs',
    because: 'a sharp apex must end in ONE point on both faces; the two-point bevel is the '
      + 'flat cut the owner rejected and the bow-tie fold that carved the jags (#329 §4)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      if (isDegenerateApexCorner(poly, offsets, i)) {\n'
        + '        out.push([poly[i][0], poly[i][1]]);\n'
        + '        continue;\n      }',
      replace: '      // mutant: degenerate apex falls back to the bevel',
    }],
  },
  {
    id: 'resize-preview-reject-silent',
    guard: 'node demo/smoke_room_resize.mjs',
    because: 'an unexpected runtime preflight rejection must explain why an enabled handle '
      + 'stopped instead of restoring the original silent no-op (#293)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: [
        '        this._showToast(this._rszLimitViolation',
        '          ? `${this._t(\'resize.limit_stopped\')} — `',
        '            + this._junctionLimitLabel(this._rszLimitViolation)',
        "          : this._t('resize.preview_failed'));",
      ].join('\n'),
      replace: '        // mutant: reject remains silent',
    }],
  },
  {
    id: 'resize-labels-show-centreline',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="innerEdgeSpan measures between wall faces" '
      + 'test/wall-thickness.test.mjs',
    because: 'resize labels must report the distance a person measures with a tape between wall '
      + 'faces; centreline numbers cannot be checked against anything and sat next to an area '
      + 'that was already computed from the floor (#233)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const span = end - start;',
      replace: '  const span = centre;',
    }],
  },
  {
    id: 'resize-labels-drops-measured-edge',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-labels.test.mjs',
    because: 'each of the two remaining length badges must retain a matching side-wall '
      + 'highlight; duplicating one edge silently drops the other measurement (#300)',
    patches: [{
      file: 'src/resize-labels.ts',
      find: '  return [(movingEdge - 1 + n) % n, (movingEdge + 1) % n];',
      replace: '  return [(movingEdge - 1 + n) % n, (movingEdge - 1 + n) % n];',
    }],
  },
  {
    id: 'resize-labels-same-side-areas',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-labels.test.mjs',
    because: 'the inward side must follow polygon winding; a shared wall needs its two room '
      + 'areas on opposite sides instead of stacked together (#300)',
    patches: [{
      file: 'src/resize-labels.ts',
      find: '  return signedArea(poly) >= 0\n',
      replace: '  return true\n',
    }],
  },
  {
    id: 'resize-labels-ignore-gear-collision',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/resize-labels.test.mjs',
    because: 'a visible room-settings button must move the area badge tangentially at current '
      + 'zoom; keeping the nominal position recreates the overlap (#300)',
    patches: [{
      file: 'src/resize-labels.ts',
      find: '  if (collides(0)) {',
      replace: '  if (false && collides(0)) {',
    }],
  },
  {
    id: 'resize-labels-hide-narrow-area',
    guard: 'node demo/smoke_resize_labels.mjs',
    because: 'the owner chose always-visible area labels; keeping only one owner in a narrow '
      + 'shared fixture loses the second room instead of using its leader (#300)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    for (const id of ids) {\n      const poly = res.polys[id]',
      replace: '    for (const id of ids.slice(0, 1)) {\n      const poly = res.polys[id]',
    }],
  },
  {
    id: 'resize-wall-partial-overlap-not-split',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 253 splits a longer exact wall" '
      + 'test/wall-thickness.test.mjs',
    because: 'a room edge may cover only part of a longer thickness record; omitting the overlap '
      + 'boundaries recreates #253 by leaving the entire record behind instead of moving one atom',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      const bounds = [0, 1, ...overlaps.flatMap(({ lo, hi }) => [lo, hi])]',
      replace: '      const bounds = [0, 1]',
    }],
  },
  {
    id: 'resize-wall-key-collision-drops-record',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="key collisions never erase" '
      + 'test/wall-thickness.test.mjs',
    because: 'compatibility keys identify a quantised midpoint, not an exact interval; treating '
      + 'them as unique silently deletes different thickness records, the second half of #253',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    const duplicate = exactOut.some((candidate) => candidate.entry.cm === value\n'
        + '      && closePoint(candidate.span[0], ca) && closePoint(candidate.span[1], cb));',
      replace: '    const duplicate = exactOut.some((candidate) =>\n'
        + '      candidate.entry.key === keyOf(ca, cb, pitch, scale));',
    }],
  },
  {
    id: 'wall-key-storage-normalization-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 258 wallKey" '
      + 'test/wall-thickness.test.mjs',
    because: 'one grid endpoint has exact and nine-decimal storage forms; keying their midpoint '
      + 'without first stabilising the endpoints recreates the one-grid-step key fork from #258',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  return Math.abs(snapped - v) <= keyEpsilon(pitch) ? snapped : v;',
      replace: '  return v;',
    }],
  },
  {
    id: 'multi-wall-orthogonal-strip-protection-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #271 keeps finite" '
      + 'test/wall-thickness.test.mjs',
    because: 'a short-support trim (#271) must still exclude and restore every finite strip '
      + 'protected by an orthogonal partner (#275); disabling both protections cuts visible '
      + 'notches from the reachable combined fixture',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  return cuts && protectedStrips ? difference(cuts, protectedStrips) : cuts;',
      replace: '  return cuts;',
    }, {
      file: 'src/wall-thickness.ts',
      find: '      if (protectedStrips) local = union(local, protectedStrips);',
      replace: '      // protected-strip fail-safe intentionally disabled by the mutant',
    }, {
      file: 'src/wall-thickness.ts',
      find: '  if (protectedStrips) {\n'
        + '    try {\n'
        + '      let protectedInside = protectedStrips;',
      replace: '  if (protectedStrips && false) {\n'
        + '    try {\n'
        + '      let protectedInside = protectedStrips;',
    }],
  },
  {
    id: 'multi-wall-finite-ray-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #271 keeps finite" '
      + 'test/wall-thickness.test.mjs',
    because: 'a degree-3 repair must stop at every real interval endpoint; restoring the '
      + 'node-wide 8H rectangle recreates the phantom wall and light barrier from #271',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      const supportExtent = Math.min(extent, support.length);',
      replace: '      const supportExtent = extent;',
    }],
  },
  {
    id: 'multi-wall-shared-continuation-protection-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #288 keeps" '
      + 'test/wall-thickness.test.mjs',
    because: 'a node-wide replacement mask must retain the finite shared wall attached to the '
      + 'far endpoint of a short ray; dropping that ownership recreates the four 45-step gaps '
      + 'from the real second-floor fixture (#288)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "          if (candidate.kind !== 'shared'\n",
      replace: "          if (candidate.kind === 'shared'\n",
    }],
  },
  {
    id: 'multi-wall-exterior-corridor-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue #272 keeps a short non-orthogonal trim" '
      + 'test/wall-thickness.test.mjs',
    because: 'a reachable short-support bevel cut must cross the exterior with finite width; '
      + 'ending it at one mathematical point recreates the enclosed white triangle from #272',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    multiWallBevelCutsAt(nodeMap, retainToLimit, connectToExterior),',
      replace: '    multiWallBevelCutsAt(nodeMap, retainToLimit, false),',
    }],
  },
  {
    id: 'wall-exact-span-fallback-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 258 exact-span" '
      + 'test/wall-thickness.test.mjs',
    because: 'already affected plans must resolve the same physical a/b span immediately even '
      + 'when their persisted midpoint key is on the other side of the rounding tie (#258)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const exactEps = keyEpsilon(pitch) * scale;',
      replace: '  const exactEps = -1;',
    }],
  },
  {
    id: 'invariant-wall-key-storage-normalization-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="копия wallKey" '
      + 'test/model-invariants.test.mjs',
    because: 'the raw-model invariant keeps a deliberate copy of production wallKey; if its '
      + 'storage-noise normalisation drifts, the diagnostic and runtime disagree again (#258)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  return Math.abs(snapped - value) <= keyEpsilon(pitch) ? snapped : value;',
      replace: '  return value;',
    }],
  },
  {
    id: 'unit-formatting-escapes-the-formatter',
    guard: 'node --test --test-name-pattern="детектор действительно ловит" '
      + 'test/single-source-numbers.test.mjs',
    because: 'одно число, видимое дважды, обязано иметь один источник: расхождение превью и '
      + 'записи стоило продукту #234, а расхождение подписи и площади — #233. Детектор без '
      + 'способности сработать — это разрешение собирать подписи где угодно',
    patches: [{
      file: 'test/single-source-numbers.test.mjs',
      find: "  + '\\\\s*(m²|ft²|м²|m\\\\b|cm\\\\b|см(?![а-яё])|м(?![а-яё])|′|″)',",
      replace: "  + '\\\\s*(ЗАГЛУШКА)',",
    }],
  },
  {
    id: 'invariant-loses-wall-record',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="исчезнувшая запись толщины" '
      + 'test/model-invariants.test.mjs',
    because: 'потеря записи толщины — это дефект #253, найденный человеком глазами; если '
      + 'инвариант перестанет её замечать, класс вернётся в продукт незамеченным (#254)',
    patches: [{
      file: 'src/wall-record-preservation.ts',
      find: '    if (now === 0) {',
      replace: '    if (false) {',
    }],
  },
  {
    id: 'budget-warning-never-fires',
    guard: 'node --test --test-name-pattern="срабатывает до стены" test/bundle-assets.test.mjs',
    because: 'прежняя редакция полагалась на то, что человек заметит тренд в выводе: за сутки '
      + 'запас ушёл с 26 КБ до 8.3 КБ, и не заметил никто — каждая отдельная строка выглядела '
      + 'нормально (#367)',
    patches: [{
      file: 'scripts/bundle-budget.mjs',
      find: '  if (!Number.isFinite(headroom) || headroom >= threshold) return null;',
      replace: '  if (true) return null;',
    }],
  },
  {
    id: 'mutation-report-drops-missing-shard',
    guard: 'node --test --test-name-pattern="отсутствующий лог шарда" test/mutation-gate-report.test.mjs',
    because: 'a shard whose artifact never arrived is an unknown, not a clean shard — '
      + 'treating it as ok would let a whole quarter of the registry escape silently (#472)',
    patches: [{
      file: 'scripts/mutation-gate-report.mjs',
      find: "    if (text == null) { shards.push({ shard, status: 'missing' }); continue; }",
      replace: "    if (text == null) { shards.push({ shard, status: 'ok' }); continue; }",
    }],
  },
  {
    id: 'mutation-report-duplicates-escaped',
    guard: 'node --test --test-name-pattern="без дублей и по порядку" test/mutation-gate-report.test.mjs',
    because: 'the same mutant reported by two shards must be one line with one command, '
      + 'otherwise the report double-counts and the owner chases a phantom (#472)',
    patches: [{
      file: 'scripts/mutation-gate-report.mjs',
      find: "    escaped: [...escaped].sort(),",
      replace: "    escaped: logs.flatMap(() => [...escaped]).sort(),",
    }],
  },
  {
    id: 'mutation-report-red-guard-as-mutant',
    guard: 'node --test --test-name-pattern="красный гард без мутанта" test/mutation-gate-report.test.mjs',
    because: 'runCleanGuards prints `FAIL чистый прогон: …` into the same log; a parser that '
      + 'takes the word after FAIL invents a mutant named «чистый» whose --id command does '
      + 'not exist (#472, spec review r1)',
    patches: [{
      file: 'scripts/mutation-gate-report.mjs',
      find: "      if (asEscaped && known.has(asEscaped[1])) { escaped.add(asEscaped[1]); continue; }",
      replace: "      if (asEscaped) { escaped.add(asEscaped[1]); continue; }\n      if (/^FAIL (\\S+)/.test(line)) { escaped.add(line.split(' ')[1].replace(/:$/, '')); continue; }",
    }],
  },
  {
    id: 'review-comment-source-ignores-issue-number',
    guard: 'node --test --test-name-pattern="по документу ЭТОЙ задачи|чужой номер задачи" '
      + 'test/review-doc-guard.test.mjs',
    because: 'matching a bare stage marker counts any comment that merely mentions another '
      + "issue's review document as a verdict of this one — #454 gave its own first code "
      + 'review round number r3 that way, and a contaminated yellow would burn the §4 budget '
      + 'without a single real cycle (#89)',
    patches: [{
      file: 'scripts/review-doc-guard.mjs',
      find: '  const own = new RegExp(`${marker}-${num}(?![0-9])`);',
      replace: '  const own = new RegExp(marker);',
    }],
  },
  {
    id: 'review-round-counts-files-not-max',
    guard: 'node --test --test-name-pattern="от максимума номеров" test/review-doc-guard.test.mjs',
    because: 'counting how many round documents exist instead of taking the highest number '
      + 'hands out an occupied file name whenever the numbering has a hole — and a hole is '
      + 'exactly what the collision this fixes leaves behind (#454)',
    patches: [{
      file: 'scripts/review-doc-guard.mjs',
      find: '  return known.length ? Math.max(...known) + 1 : 1;',
      replace: '  return known.length + 1;',
    }],
  },
  {
    id: 'review-round-drops-file-source',
    guard: 'node --test --test-name-pattern="прожитая уже с исправлением|момент коллизии" '
      + 'test/review-doc-guard.test.mjs',
    because: 'without the published documents the counter is back to reading prose, and a '
      + 'verdict that never named its file silently reuses the round number (#454, #449)',
    patches: [{
      file: 'scripts/review-doc-guard.mjs',
      find: '  const attemptFiles = attemptFromRounds(rounds);',
      replace: '  const attemptFiles = 1;',
    }],
  },
  {
    id: 'review-round-drops-comment-insurance',
    guard: 'node --test --test-name-pattern="отказ публикации" test/review-doc-guard.test.mjs',
    because: 'the publish step can fail after the verdict is already posted; trusting only '
      + 'the documents then loses a spent cycle and hands out a used round number (#454)',
    patches: [{
      file: 'scripts/review-doc-guard.mjs',
      find: '    attempt: Math.max(attemptFiles, attemptComments),',
      replace: '    attempt: attemptFiles,',
    }],
  },
  {
    id: 'review-doc-guard-matches-by-substring',
    guard: 'node --test --test-name-pattern="соседний каталог" test/review-doc-guard.test.mjs',
    because: 'сравнение подстрокой пускает docs/reviews-old и docs/reviewsx: allowlist, который '
      + 'ошибается в свою пользу, не защищает ни от чего (#365)',
    patches: [{
      file: 'scripts/review-doc-guard.mjs',
      find: "  const prefixes = allowlist.map((item) => (item.endsWith('/') ? item : `${item}/`));",
      replace: "  const prefixes = allowlist.map((item) => item.replace(/\\/$/, ''));",
    }],
  },
  {
    id: 'review-doc-guard-allows-empty-diff',
    guard: 'node --test --test-name-pattern="пустой дифф" test/review-doc-guard.test.mjs',
    because: 'пустой дифф означает, что документа нет: прежняя редакция шага выходила тут с '
      + 'нулём, и вердикт ревью оставался без артефакта (#171, #365)',
    patches: [{
      file: 'scripts/review-doc-guard.mjs',
      find: '  if (!cleaned.length) {',
      replace: '  if (false) {',
    }],
  },
  {
    id: 'no-new-any-judges-every-line',
    guard: 'node --test --test-name-pattern="нетронутой строке гейт не блокирует" '
      + 'test/no-new-any.test.mjs',
    because: 'гейт, судящий все строки вместо добавленных, краснеет на 1034 существующих '
      + 'вхождениях и будет отключён в первый же день — а долг типизации снимается при '
      + 'извлечении подсистем, не разовой заменой (#342)',
    patches: [{
      file: 'scripts/no-new-any.mjs',
      find: '      if (!file.addedLines.has(line)) continue;',
      replace: '      if (false) continue;',
    }],
  },
  {
    id: 'no-new-any-accepts-bare-marker',
    guard: 'node --test --test-name-pattern="только с конкретной причиной" '
      + 'test/no-new-any.test.mjs',
    because: 'голый `// any-ok` — это не обоснование, а способ обойти гейт одной строкой; '
      + 'без проверки причины исключение перестаёт что-либо значить (#342)',
    patches: [{
      file: 'scripts/no-new-any.mjs',
      find: '      if (exemption?.ok) continue;',
      replace: '      if (exemption) continue;',
    }],
  },
  {
    id: 'invariant-hidden-counts-corner-touch',
    guard: 'node --test --test-name-pattern="касание углом" test/model-invariants.test.mjs',
    because: 'перегородка, продолжающая стену за угол, законна: общего с ребром у неё ровно '
      + 'точка. Порог в шаг решётки — единственное, что отделяет находку от ложного '
      + 'срабатывания на каждом углу плана (#296)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '        if (overlap > GRID_STEP_N && (!best || overlap > best.overlap)) {',
      replace: '        if (overlap >= 0 && (!best || overlap > best.overlap)) {',
    }],
  },
  {
    id: 'invariant-hidden-tolerates-two-point-draft',
    guard: 'node --test --test-name-pattern="черновик из двух точек" '
      + 'test/model-invariants.test.mjs',
    because: 'ровно это условие пропускает вырожденный черновик в align-grid: `points.length '
      + '>= 2` считает контур из двух точек годным, а комнатой он не станет никогда — '
      + 'и остаётся невидимым препятствием для ресайза (#296)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '      if (points.length < 3) {',
      replace: '      if (points.length < 2) {',
    }],
  },
  {
    id: 'invariant-hidden-ignores-collinearity',
    guard: 'node --test --test-name-pattern="перегородка поперёк комнаты" '
      + 'test/model-invariants.test.mjs',
    because: 'перегородка поперёк комнаты — единственный смысл существования перегородки; '
      + 'без проверки поперечного отклонения проверка ловит её и будет отключена в первую '
      + 'неделю (#296)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  if (across(c) > EDGE_TOLERANCE || across(d) > EDGE_TOLERANCE) return 0;',
      replace: '  if (false) return 0;',
    }],
  },
  {
    id: 'invariant-roles-sample-endpoints',
    guard: 'node --test --test-name-pattern="реальные планы проекта эту проверку" '
      + 'test/model-invariants.test.mjs',
    because: 'конец записи — узел, а не участок: там стена законно касается двух комнат, '
      + 'и включение концов в выборку даёт ложное срабатывание на каждой наружной стене, '
      + 'упирающейся в общую (#287)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  for (let i = 1; i < samples; i++) {',
      replace: '  for (let i = 0; i <= samples; i++) {',
    }],
  },
  {
    id: 'invariant-keys-cry-wolf',
    guard: 'node --test --test-name-pattern="старый и неразбираемый compatibility key" '
      + 'test/model-invariants.test.mjs',
    because: 'valid exact endpoints prove the same physical span before every legacy key '
      + 'fallback; calling a stale or unparsable index a violation would cry wolf (#258)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: "      notes.push({ invariant: 'wall_keys', kind: 'stale_wall_key', owner,",
      replace: "      violations.push({ invariant: 'wall_keys', kind: 'stale_wall_key', owner,",
    }],
  },
  {
    id: 'invariant-keys-hide-stale-observation',
    guard: 'node --test --test-name-pattern="старый и неразбираемый compatibility key" '
      + 'test/model-invariants.test.mjs',
    because: 'a mismatched compatibility key is repairable data debt; hiding the observation '
      + 'would make Optimize repair invisible and let the two representations accumulate (#258)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '      if (wall.key === expected) continue;',
      replace: '      continue;',
    }],
  },
  {
    id: 'invariant-accepts-dead-space-reference',
    guard: 'node --test --test-name-pattern="маркер на удалённое пространство" '
      + 'test/model-invariants.test.mjs',
    because: 'маркер, привязанный к удалённому пространству, исчезает с плана молча (#244): '
      + 'проверка ссылок обязана считать это дефектом операции, а не особенностью данных (#254)',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '    if (space && !spaceIds.has(space)) {\n      add(\'marker_space\'',
      replace: '    if (false) {\n      add(\'marker_space\'',
    }],
  },
  {
    id: 'wall-face-apply-skips-overlap-guard',
    guard: 'node demo/smoke_wall_face_overlap.mjs',
    because: 'вторая проверка при создании — не дубль первой, а defense-in-depth из #173 §10.3: '
      + 'решение принимается в диалоге, а геометрия к моменту применения может стать другой '
      + '(#177)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const clash = existingRooms.find((room) => room.id !== ownSplit',
      replace: '      const clash = [].find((room) => room.id !== ownSplit',
    }],
  },
  {
    id: 'docs-fixture-splits-posix-only',
    guard: 'node --test --test-name-pattern="не зависит от разделителя платформы" '
      + 'test/docs-accept.test.mjs',
    because: 'фикстура приёмки разбирала путь только по «/» и на Windows отдавала весь путь '
      + 'вместо имени файла: три проверки краснели на верной реализации, а Linux этого не '
      + 'видел вовсе — регресс обязан краснеть на любой платформе (#247)',
    patches: [{
      file: 'test/docs-accept.test.mjs',
      find: "export const basename = (path) => String(path).split(/[\\\\/]/).filter(Boolean).pop() ?? '';",
      replace: "export const basename = (path) => String(path).split('/').pop() ?? '';",
    }],
  },
  {
    id: 'docs-accept-takes-any-chromium',
    guard: 'node --test --test-name-pattern="без названного Chromium" test/docs-accept.test.mjs',
    because: 'набор, снятый другим браузером, переписывает все десять картинок без единого '
      + 'содержательного изменения, поэтому окружение съёмки — часть доказательства, а не '
      + 'украшение манифеста (#246)',
    patches: [{
      file: 'scripts/docs-accept.mjs',
      find: "  if (typeof manifest.chromium !== 'string' || !manifest.chromium.trim())",
      replace: '  if (false)',
    }],
  },
  {
    id: 'docs-accept-copies-before-checking',
    guard: 'node --test --test-name-pattern="отсутствующий в артефакте файл" '
      + 'test/docs-accept.test.mjs',
    because: 'половина принятого набора хуже непринятого: на плане окажется картинка от одного '
      + 'дерева рядом с манифестом от другого, и check-docs покажет одну ошибку вместо десяти '
      + '(#246)',
    patches: [{
      file: 'scripts/docs-accept.mjs',
      find: "      throw new Error(`${scenario.id}: в артефакте нет файла ${entry.file || '(без имени)'}`);",
      replace: '      continue;',
    }],
  },
  {
    id: 'docs-fingerprint-sees-product-version',
    guard: 'node --test --test-name-pattern="не трогает отпечаток скриншотов" '
      + 'test/source-fingerprint.test.mjs',
    because: 'номер версии продукта на скриншотах не нарисован, и если отпечаток документации '
      + 'снова начнёт его видеть, каждый релизный коммит будет оставлять job docs красным — '
      + 'красный гейт, который «всегда такой», перестают читать (#245)',
    patches: [{
      file: 'scripts/source-fingerprint.mjs',
      find: '    ? (text) => text.split(version).join(\'0.0.0-product-version\')',
      replace: '    ? (text) => text',
    }],
  },
  {
    id: 'smoke-select-drops-registered-link',
    guard: 'node --test --test-name-pattern="держится на зарегистрированной связи" '
      + 'test/smoke-select.test.mjs',
    because: 'связь «изменённый контракт → смок, который его не называет» доказать поиском '
      + 'нельзя, и держится она только на реестре: без записи выборка по диффу #234 снова '
      + 'промолчит о smoke_wall_thickness_transition — том самом классе смоков, на котором '
      + '#234 потерял регресс (#241)',
    patches: [{
      file: 'scripts/smoke-links.mjs',
      find: "    symbols: ['chainSegmentCms', 'wallChainSegments', '_draftSegmentCms', '_closingWallCm'],",
      replace: '    symbols: [],',
    }],
  },
  {
    id: 'inner-span-ignores-neighbour-thickness',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="innerEdgeSpan measures between wall faces" '
      + 'test/wall-thickness.test.mjs',
    because: 'an edge is cut by the inner faces of its NEIGHBOURS, not by its own thickness: a '
      + 'thin side between two thick walls loses 2x15, not 2x7.5, and reading own thickness at '
      + 'both ends gives a number no tape measure confirms (#233 AC2)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    const o = Math.max(0, Number(offsets[edge]) || 0);',
      replace: '    const o = own;',
    }],
  },
  {
    id: 'inner-span-shortens-a-passage',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="keeps the centreline where there is no wall" '
      + 'test/wall-thickness.test.mjs',
    because: 'a passage has no face to measure from, and insetContour leaves that joint as a flat '
      + 'cap, so shortening an open side would split length from area again at a new boundary '
      + '(#233, spec review r1/H1)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  if (!(own > 0)) return centre;',
      replace: '  if (false) return centre;',
    }],
  },
  {
    id: 'inner-span-reads-whole-edge-thickness',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="ownEdgeOffsets reads the atomic profile" '
      + 'test/wall-thickness.test.mjs',
    because: 'thicknessCmAt returns 0 for a whole-edge query against a partially set thickness, so '
      + 'reading it instead of the atomic profile would silently stop shortening split-thickness '
      + 'edges (#233, spec review r1/H2)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      if (distToSeg(mid[0], mid[1], p0[0], p0[1], p1[0], p1[1]) <= eps) {',
      replace: '      if (false) {',
    }],
  },
  {
    id: 'snapn-returns-input-near-node',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="snapN returns the exact nearest node" '
      + 'test/align-grid.test.mjs',
    because: 'explicit Optimize must replace a stored ULP tail with the exact nearest grid node '
      + 'instead of preserving the noisy input merely because its displacement is visually tiny',
    patches: [{
      file: 'src/align-grid.ts',
      find: '  return Math.round(v / GRID_STEP_N) * GRID_STEP_N;',
      replace: '  const s = Math.round(v / GRID_STEP_N) * GRID_STEP_N;\n'
        + '  return Math.abs(s - v) <= EPS ? v : s;',
    }],
  },
  {
    id: 'optimize-storage-boundary-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="Optimize canonicalizes the six-room ULP source" '
      + 'test/plan-optimizer.test.mjs',
    because: 'Optimize must remove near-node tails before visible Align so storage-only cleanup '
      + 'is not misreported as a user-visible move and the exact candidate survives reload (#291)',
    patches: [{
      file: 'src/plan-optimizer.ts',
      find: '  canonicalizeConfigGeometryInPlace(config);\n'
        + '  canonicalizeLayoutGeometryInPlace(references.layout);',
      replace: '  // mutant: skip the pre-Align lattice boundary',
    }],
  },
  {
    id: 'optimize-config-storage-half-raw',
    guard: 'node scripts/backend-test-guard.mjs storage_helpers_are_the_final_canonical_barrier '
      + 'tests_backend/test_coordinate_canonicalization.py',
    because: 'the durable config half must remain the exact canonical target recorded by '
      + 'Optimize intent even for internal writers which bypass WebSocket schema (#248)',
    patches: [{
      file: 'custom_components/houseplan/store.py',
      find: '    canonical_config = canonicalize_config_geometry(config)',
      replace: '    canonical_config = config',
    }],
  },
  {
    id: 'optimize-layout-storage-half-raw',
    guard: 'node scripts/backend-test-guard.mjs storage_helpers_are_the_final_canonical_barrier '
      + 'tests_backend/test_coordinate_canonicalization.py',
    because: 'the durable layout half must remain the exact canonical target recorded by '
      + 'Optimize intent even for internal writers which bypass WebSocket schema (#248)',
    patches: [{
      file: 'custom_components/houseplan/store.py',
      find: '    out["layout"] = canonicalize_layout_geometry(layout)',
      replace: '    out["layout"] = layout',
    }],
  },
  {
    id: 'union-quantization-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="boolean input normalization|six-room ULP" '
      + 'test/physical-geometry.test.mjs',
    because: 'ordinary split/merge double tails must collapse at the shared boolean boundary '
      + 'instead of making one room erase every Glow clip in its space',
    patches: [{
      file: 'src/physical-geometry.ts',
      find: '    const qx = Math.round(x / step) * step;\n'
        + '    const qy = Math.round(y / step) * step;',
      replace: '    const qx = x;\n    const qy = y;',
    }],
  },
  {
    id: 'schema-quantization-removed',
    guard: 'node scripts/backend-test-guard.mjs backend_schemas_apply '
      + 'tests_backend/test_coordinate_canonicalization.py',
    because: 'backend schemas are the public write door for cards, imports and manual clients; '
      + 'removing their canonicalisation would let the same ULP noise enter every future writer',
    patches: [{
      file: 'custom_components/houseplan/validation.py',
      find: '        extra=vol.ALLOW_EXTRA,  # unknown (legacy) keys do not break loading\n'
        + '    ),\n    canonicalize_config_geometry,\n    _config_wall_segment_invariants,\n)',
      replace: '        extra=vol.ALLOW_EXTRA,  # unknown (legacy) keys do not break loading\n'
        + '    ),\n    lambda value: value,\n    _config_wall_segment_invariants,\n)',
    }],
  },
  {
    id: 'frontend-writes-raw-coords',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="frontend write paths" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'a server-only fix leaves the open card rendering its noisy mutable config until '
      + 'reload, so the current session can still reproduce the geometry failure after Save',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const candidate = canonicalizeConfigGeometry(this._serverCfg);',
      replace: '      const candidate = this._serverCfg;',
    }],
  },
  {
    id: 'image-box-frontend-canonicalization-omitted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="decor box catalog" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'the decor type can know about an image while a handwritten traversal silently '
      + 'leaves its x/y/w/h outside the canonical write barrier (#431 AC4)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: '    && (DECOR_BOX_KINDS as readonly string[]).includes(value);',
      replace: "    && value !== 'image'\n"
        + '    && (DECOR_BOX_KINDS as readonly string[]).includes(value);',
    }],
  },
  {
    id: 'image-box-python-canonicalization-omitted',
    guard: 'node scripts/backend-test-guard.mjs decor_box_catalog_matches_shared_contract '
      + 'tests_backend/test_coordinate_canonicalization_pure.py',
    because: 'the Python schema and storage boundary must mirror the complete frontend box '
      + 'catalog instead of accepting image floating-point tails from older clients (#431 AC4)',
    patches: [{
      file: 'custom_components/houseplan/coordinate_canonicalization.py',
      find: 'DECOR_BOX_KINDS = ("rect", "ellipse", "furniture", "image")',
      replace: 'DECOR_BOX_KINDS = ("rect", "ellipse", "furniture")',
    }],
  },
  {
    id: 'quantization-hits-allowlist',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="scalar\\+lattice fixture contract" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'presentation and calibration values are deliberately outside geometry; widening '
      + 'the allow-list silently changes user data that has no ULP topology problem',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: "  for (const marker of records(root.markers)) scalarFields(marker, ['angle']);",
      replace: "  for (const marker of records(root.markers)) scalarFields(marker, ['angle', 'size']);",
    }],
  },
  {
    id: 'lattice-round-truncates',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="all 4801 lattice nodes" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'truncating toward zero maps every negative and fractional node to the wrong exact '
      + 'double, recreating topology drift even though the output still looks grid-like (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: '  const scaled = value * LATTICE_GRID_N;\n'
        + '  const nearest = Math.round(scaled);\n'
        + '  const deviation = Math.abs(scaled - nearest);',
      replace: '  const scaled = value * LATTICE_GRID_N;\n'
        + '  const nearest = Math.trunc(scaled);\n'
        + '  const deviation = Math.abs(scaled - nearest);',
    }],
  },
  {
    id: 'python-lattice-round-truncates',
    guard: 'node scripts/backend-test-guard.mjs all_4801_lattice_nodes '
      + 'tests_backend/test_coordinate_canonicalization_pure.py',
    because: 'the backend must use the JavaScript Math.round tie direction and nearest-node '
      + 'semantics; truncation would make old-client writes diverge from the card (#291)',
    patches: [{
      file: 'custom_components/houseplan/coordinate_canonicalization.py',
      find: '    nearest = math.floor(scaled + 0.5)',
      replace: '    nearest = math.trunc(scaled)',
    }],
  },
  {
    id: 'lattice-noise-threshold-too-small',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="all 4801 lattice nodes" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'a threshold below the measured nine-decimal tail leaves the real 1/240 noise '
      + 'population intact while nominal exact nodes continue to pass (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: 'export const LATTICE_NOISE_STEPS = 1e-4;',
      replace: 'export const LATTICE_NOISE_STEPS = 1e-9;',
    }],
  },
  {
    id: 'lattice-noise-threshold-too-large',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="all 4801 lattice nodes" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'a broad threshold silently attracts authored off-grid geometry instead of only '
      + 'removing the measured storage tail (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: 'export const LATTICE_NOISE_STEPS = 1e-4;',
      replace: 'export const LATTICE_NOISE_STEPS = 0.5;',
    }],
  },
  {
    id: 'lattice-layout-allowlist-omitted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="scalar\\+lattice fixture contract" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'config-only canonicalization lets marker and room-label writes recreate the same '
      + 'noise through the independent layout Store (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: '  for (const value of Object.values(root)) {\n'
        + '    const item = record(value);\n'
        + "    if (item) latticeFields(item, ['x', 'y']);\n"
        + '  }\n  return result;',
      replace: '  // mutant: omit all layout x/y values\n  return result;',
    }],
  },
  {
    id: 'lattice-unknown-fields-recursive',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="scalar\\+lattice fixture contract" '
      + 'test/coordinate-canonicalization.test.mjs',
    because: 'recursively rounding future, physical and calibration numbers corrupts data which '
      + 'is deliberately outside the persisted coordinate allow-list (#291)',
    patches: [{
      file: 'src/coordinate-canonicalization.ts',
      find: '  }\n  return value;\n}\n\n/** Existing scalar contract',
      replace: '  }\n  return canonicalizeNumber(value);\n}\n\n/** Existing scalar contract',
    }],
  },
  {
    id: 'import-path-bypasses-schema',
    guard: 'node scripts/backend-test-guard.mjs import_document_canonicalizes_external_coordinates',
    because: 'an externally assembled backup is an independent source of noisy geometry and '
      + 'must enter preview and storage through the same canonical schema as the live card',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        config = CONFIG_SCHEMA(config_candidate)',
      replace: '        config = config_candidate',
    }],
  },
  {
    id: 'wall-component-failure-kills-primary',
    guard: 'node demo/smoke_wall_union_isolation.mjs',
    because: 'a local shell/extra merge failure must remain a render-safe component set instead '
      + 'of restoring the all-or-nothing blank wall layer from #278',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: "      status: degradedExtraCount || degradedCoreCount ? 'degraded-extra' : 'ok',",
      replace: "      status: degradedExtraCount || degradedCoreCount ? 'failed-core' : 'ok',",
    }],
  },
  {
    id: 'wall-isolated-extra-discarded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="isolates one failed independent-body" '
      + 'test/wall-thickness.test.mjs',
    because: 'keeping only the primary makes the floor look mostly repaired while silently '
      + 'dropping the exact independent body whose union failed (#278)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          isolated.push({ id: `extra-${index}`, geom: standalone });',
      replace: '          // mutant: discard the valid isolated body',
    }],
  },
  {
    id: 'strict-wall-barrier-accepts-degraded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="strict one-space barrier" '
      + 'test/plan-geometry-preflight.test.mjs',
    because: 'render-safe degradation is read compatibility, never permission to persist another '
      + 'geometry mutation over the unsafe candidate (#278)',
    patches: [{
      file: 'src/plan-geometry-preflight.ts',
      find: "      if (united.status === 'degraded-extra') {",
      replace: "      if (false && united.status === 'degraded-extra') {",
    }],
  },
  {
    id: 'wall-thickness-writer-bypasses-common-barrier',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="production source routes physical writers" '
      + 'test/wall-union-isolation.test.mjs',
    because: 'one direct physical writer is enough to recreate the corrupt persisted geometry '
      + 'even when Resize and the other editors use the shared transaction boundary (#278)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (this._commitPhysicalGeometry(this._t('history.wall_thickness'), before))",
      replace: "    if ((this._recordGeometry(this._t('history.wall_thickness'), before), true))",
    }, {
      // #313: the independent-masonry writer is a second thickness commit
      // point — bypassing the barrier there recreates the same #278 hole.
      file: 'src/houseplan-card.ts',
      find: "      const committed = this._commitPhysicalGeometry(\n        this._t('history.wall_thickness'), before,\n      );",
      replace: "      const committed = (this._recordGeometry(this._t('history.wall_thickness'), before), true);",
    }],
  },
  {
    id: 'model-invariants-bypasses-production-geometry',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="Optimize and model-invariants" '
      + 'test/wall-union-isolation.test.mjs',
    because: 'the CLI must fail on the same degraded result as Optimize instead of returning the '
      + 'pre-#278 false green for a visually broken export',
    patches: [{
      file: 'scripts/model-invariants.mjs',
      find: '  return result.failures.map((failure, index) => ({',
      replace: '  return [].map((failure, index) => ({',
    }],
  },
  {
    id: 'optimize-preflight-bypassed',
    guard: 'node demo/smoke_optimize_geometry_preflight.mjs',
    because: 'a red preview must remain a hard write barrier even if a caller invokes the '
      + 'private Apply method directly instead of clicking the deliberately absent button (#199)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (!d || d.busy || !this._serverCfg || !d.changed || !d.preflight?.ok) return;',
      replace: '    if (!d || d.busy || !this._serverCfg || !d.changed) return;',
    }],
  },
  {
    id: 'optimize-preflight-active-space-only',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="one failed space blocks" '
      + 'test/plan-geometry-preflight.test.mjs',
    because: 'Optimize is one whole-plan transaction, so a broken non-active floor must block '
      + 'the operation just as decisively as the first floor in config order (#199)',
    patches: [{
      file: 'src/plan-geometry-preflight.ts',
      find: '  const rawSpaces = Array.isArray(config?.spaces) ? config.spaces : [];',
      replace: '  const rawSpaces = Array.isArray(config?.spaces) ? config.spaces.slice(0, 1) : [];',
    }],
  },
  {
    id: 'optimize-preflight-accepts-null',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="null, exceptions and floor failure" '
      + 'test/plan-geometry-preflight.test.mjs',
    because: 'wallBodiesGeometry null is a structural boolean failure, not an empty successful '
      + 'wall set that may be hidden behind a later floor fallback (#199)',
    patches: [{
      file: 'src/plan-geometry-preflight.ts',
      find: '      if (united == null) {',
      replace: '      if (false && united == null) {',
    }],
  },
  {
    id: 'optimize-preflight-renders-apply-on-failure',
    guard: 'node demo/smoke_optimize_geometry_preflight.mjs',
    because: 'the failure state is not a dismissible warning: rendering Apply invites a person '
      + 'to treat an unsafe whole-plan candidate as an accepted risk (#199)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '          ${!d.changed || !d.preflight?.ok ? nothing : html`',
      replace: '          ${!d.changed ? nothing : html`',
    }],
  },
  {
    id: 'union-failure-kills-space',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="malformed room|fallback unions overlapping" '
      + 'test/physical-geometry.test.mjs',
    because: 'one room rejected by polyclip must be skipped locally while every healthy floor '
      + 'fragment remains clipped and visible rather than failing the whole space dark',
    patches: [{
      file: 'src/physical-geometry.ts',
      find: '  return intersectionPathsByBound(base, bounds, options);',
      replace: '  return [];',
    }],
  },
  {
    id: 'union-failure-silent',
    guard: 'node demo/smoke_glow_geometry_resilience.mjs',
    because: 'a residual per-room geometry fallback must leave one redacted, deduplicated '
      + 'space/room diagnostic instead of silently looking like a broken Glow setting',
    patches: [{
      file: 'src/glow-scene.ts',
      find: '  console.warn(\n'
        + '    `HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${spaceId}, room ${roomId}, phase ${phase}`,\n'
        + '  );',
      replace: '  if (false) console.warn(\n'
        + '    `HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space ${spaceId}, room ${roomId}, phase ${phase}`,\n'
        + '  );',
    }],
  },
  {
    id: 'glow-fail-dark-weakened',
    guard: 'node demo/smoke_glow_fail_dark.mjs',
    because: 'resilient floor clipping must not revive a source embedded in opaque masonry; '
      + 'the existing source guard remains a release-blocking fail-dark boundary',
    patches: [{
      file: 'src/glow-scene.ts',
      find: '  return pointInOpaquePlanBody(\n'
        + '    [source.x, source.y], scene.masonryGeometry, scene.opaqueBodies,\n'
        + '  );',
      replace: '  return false && pointInOpaquePlanBody(\n'
        + '    [source.x, source.y], scene.masonryGeometry, scene.opaqueBodies,\n'
        + '  );',
    }],
  },
  {
    id: 'near-axis-threshold-weakened',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 near-axis boundary" test/near-axis.test.mjs',
    because: 'the measured 316x1 wall must stay inside the one shared 0.25 degree drafting '
      + 'tolerance while 316x2 and a true diagonal remain outside (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: 'export const NEAR_AXIS_MAX_DEGREES = 0.25;',
      replace: 'export const NEAR_AXIS_MAX_DEGREES = 0.1;',
    }],
  },
  {
    id: 'near-axis-inclusive-boundary-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 near-axis boundary" test/near-axis.test.mjs',
    because: 'the product contract includes an edge exactly on the 0.25 degree boundary (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: '  if (minor / major > NEAR_AXIS_MAX_SLOPE) return null;',
      replace: '  if (minor / major >= NEAR_AXIS_MAX_SLOPE) return null;',
    }],
  },
  {
    id: 'near-axis-authoring-snap-bypassed',
    guard: 'npm run bundle:sync && node demo/smoke_plan_drawing_repairs.mjs',
    because: 'the production Walls hover and click must persist the exact same straight endpoint '
      + 'instead of merely repairing old data through Optimize (#290)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const point = anchor ? snapNearAxisEndpoint(anchor, snapped) : snapped;',
      replace: '    const point = snapped;',
    }],
  },
  {
    id: 'near-axis-shared-owner-repair-partial',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 repairs a duplicated" test/near-axis.test.mjs',
    because: 'a shared physical wall must move every coincident room-owner copy atomically (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: 'const replaceRoomPoints = (rooms: any[], move: EndpointMove): any[] => rooms.map((room) => {',
      replace: 'const replaceRoomPoints = (rooms: any[], move: EndpointMove): any[] => rooms.map((room, index) => {\n'
        + '  if (index > 0) return room;',
    }],
  },
  {
    id: 'near-axis-shared-owner-double-counted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#290 repairs a duplicated" test/near-axis.test.mjs',
    because: 'coincident room-owner copies are one physical wall in the Optimize report (#290)',
    patches: [{
      file: 'src/near-axis.ts',
      find: '      const key = segmentKey(a, b);',
      replace: '      const key = `${segmentKey(a, b)}:${candidates.size}`;',
    }],
  },
  {
    id: 'near-axis-optimize-confirmation-bypassed',
    guard: 'npm run bundle:sync && node demo/smoke_near_axis_optimize.mjs',
    because: 'opening the Optimize preview or cancelling it must never persist a lossy repair (#290)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: 'public _openAlignDialog = (): void => this._previewAlignDialog(false);',
      replace: 'public _openAlignDialog = (): void => {\n'
        + '    this._previewAlignDialog(false);\n'
        + '    void this._runAlignToGrid();\n'
        + '  };',
    }],
  },
  {
    id: 'optimizer-micro-interval-cleanup-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="isolated thickness micro-interval" '
      + 'test/plan-optimizer.test.mjs',
    because: 'explicit Optimize must remove only the proven sub-half-step 22→15→22 '
      + 'artefact instead of continuing to call the lossy plan canonical',
    patches: [{
      file: 'src/plan-optimizer.ts',
      find: '  if (!walls?.length) return [];\n  const scale = coordScale > 0 ? coordScale : 1;\n'
        + '  const eps = Math.max(pitch * scale * 0.02, 1e-9);',
      replace: '  if (!walls?.length) return [];\n  return walls.slice();\n'
        + '  const scale = coordScale > 0 ? coordScale : 1;\n'
        + '  const eps = Math.max(pitch * scale * 0.02, 1e-9);',
    }],
  },
  {
    id: 'wall-compaction-owner-role-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#299" test/wall-thickness.test.mjs',
    because: 'equal centimetres must not merge shared(A,B) with outer(A) or shared(A,C); '
      + 'dropping the owner signature recreates the mixed-role wall record from #299',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          if (pr.kinds[next] === null || pr.cms[next] !== cm\n'
        + '              || ownerSignatureFor(nextKey) !== ownerSignature) break;',
      replace: '          if (pr.kinds[next] === null || pr.cms[next] !== cm) break;',
    }],
  },
  {
    id: 'optimizer-single-topology-island-blocked',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 273 Optimize" '
      + 'test/plan-optimizer.test.mjs',
    because: 'a proven 22→15→22 island beside exactly one room T-node must not survive '
      + 'merely because the old #198 guard classified both endpoints identically',
    patches: [{
      file: 'src/plan-optimizer.ts',
      find: '        if (isNode(a, roomNodes) && isNode(b, roomNodes)) continue;',
      replace: '        if (isNode(a, roomNodes) || isNode(b, roomNodes)) continue;',
    }],
  },
  {
    id: 'optimizer-coincident-opening-rehost-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 276 reconciles" '
      + 'test/coincident-partitions.test.mjs',
    because: 'removing the redundant independent wall without materialising its hosted opening '
      + 'would leave a dangling host and make the door disappear after explicit Optimize (#276)',
    patches: [{
      file: 'src/coincident-partitions.ts',
      find: '    const nextOpenings = openings.map((opening) => openingReplacement.get(opening.id) || opening);',
      replace: '    const nextOpenings = openings.map((opening) => opening);',
    }],
  },
  {
    id: 'optimizer-coincident-residual-dropped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="covered middle" '
      + 'test/optimize-hidden-obstacles.test.mjs',
    because: 'piecewise Optimize may absorb only the exactly covered middle of an independent '
      + 'wall and must preserve both free residual spans with stable identifiers (#296)',
    patches: [{
      file: 'src/coincident-partitions.ts',
      find: '    const residualRuns = runs.filter((run) => !run.safe);',
      replace: '    const residualRuns: PieceRun[] = [];',
    }],
  },
  {
    id: 'optimizer-coincident-max-thickness-lost',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="max thickness independently" '
      + 'test/optimize-hidden-obstacles.test.mjs',
    because: 'each absorbed piece must retain the thicker of room masonry and the hidden '
      + 'partition instead of silently thinning an authored wall (#296)',
    patches: [{
      file: 'src/coincident-partitions.ts',
      find: '      const finalCm = proofOk ? Math.max(roomCm, source.cm) : source.cm;',
      replace: '      const finalCm = proofOk ? roomCm : source.cm;',
    }],
  },
  {
    id: 'optimizer-backend-trusts-frontend-delta',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'backend_proves_full_partition_delta_without_openings tests_backend/test_validation.py',
    because: 'the backend must reconstruct every removed partition atom independently; '
      + 'trusting the frontend candidate lets a no-opening partition disappear without masonry (#296)',
    patches: [{
      file: 'custom_components/houseplan/validation.py',
      find: 'def _safe_optimize_partition_delta(space: dict, old_partition: dict) -> bool:\n'
        + '    """Independently prove every removed atom of one old partition axis."""\n'
        + '    if not _known_optimize_partition(old_partition):',
      replace: 'def _safe_optimize_partition_delta(space: dict, old_partition: dict) -> bool:\n'
        + '    """Independently prove every removed atom of one old partition axis."""\n'
        + '    return True\n'
        + '    if not _known_optimize_partition(old_partition):',
    }],
  },
  {
    id: 'atomic-child-thickness-parent-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="exact parent|atomic solid children" '
      + 'test/wall-thickness.test.mjs test/open-spans.test.mjs',
    because: 'closing a fully virtual stretch beside an atomised exact parent run must inherit '
      + 'the real neighbouring thickness instead of silently writing the 15 cm default',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const exact = exactCoveringWall(walls, a, b, pitch, coordScale);',
      replace: '  const exact = false ? exactCoveringWall(walls, a, b, pitch, coordScale) : null;',
    }],
  },
  {
    id: 'device-position-cancel-routed-to-commit',
    guard: 'node demo/smoke_device_position_history.mjs',
    because: 'pointer cancellation and lost capture must restore the uncommitted device preview '
      + 'without creating a position command or writing layout (#74)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '@pointercancel=${(e: PointerEvent) => this._pointerCancel(e, d)}',
      replace: '@pointercancel=${(e: PointerEvent) => this._pointerUp(e, d)}',
    }],
  },
  {
    id: 'stale-space-position-guard-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="stable space ids" test/optional-space-model-contract.test.mjs',
    because: 'position persistence with a stable space id must fail closed before layout, dirty-set '
      + 'and websocket side effects when that space has been deleted or renamed',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (!this._spaceModelById(d.space)) return;\n    this._layout = applyDevicePlacement(',
      replace: '    this._layout = applyDevicePlacement(',
    }],
  },
  {
    id: 'fixed-floor-transition-guard-bypassed',
    guard: 'node demo/smoke_fixed_floor.mjs',
    because: 'a fixed card must reject tabs and every internal active-space mutation instead of '
      + 'showing another floor after the initial resolver selected the configured one',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (authority || !this._hasFixedFloor) return true;',
      replace: '    if (authority || this._hasFixedFloor) return true;',
    }],
  },
  {
    id: 'empty-space-cleanup-disabled',
    guard: 'node demo/smoke_optional_space_model.mjs',
    because: 'удаление последнего пространства обязано завершать жесты, редакторы и отложенную запись; '
      + 'смок дважды переводит живую карточку в пустой план и проверяет реальный lifecycle cleanup',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: 'if (this._emptySpaceStateActive) return;',
      replace: 'if (empty) return;',
    }],
  },
  {
    id: 'continuity-long-resume-noop',
    guard: 'node demo/smoke_visual_continuity.mjs',
    because: 'смок обязан доказывать, что long-resume СРАБОТАЛ (токен ушёл вперёд), '
      + 'а не что ничего не спрятали: в beta.7 он не заметил удаления всего механизма',
    patches: [{
      file: 'src/visual-continuity.ts',
      find: "if (!signal.long && (signal.kind === 'visible' || signal.kind === 'pageshow')) {",
      replace: "if ((signal.kind === 'visible' || signal.kind === 'pageshow')) {",
    }],
  },
  {
    id: 'opening-cut-degenerate',
    guard: 'node demo/smoke_glow.mjs',
    because: 'проём, выродившийся в точку, остаётся кладкой — свет перестаёт '
      + 'проходить через дверь; смок обязан это увидеть по освещённому полу за проёмом',
    patches: [{
      file: 'src/glow-scene.ts',
      find: '    outlineCuts.push([\n'
        + '      opening.x - dx, opening.y - dy,\n'
        + '      opening.x + dx, opening.y + dy,\n'
        + '    ]);',
      replace: '    outlineCuts.push([\n'
        + '      opening.x, opening.y,\n'
        + '      opening.x, opening.y,\n'
        + '    ]);',
    }],
  },
  {
    id: 'registryless-opening-requires-registry-row',
    guard: 'node demo/smoke_registryless_opening.mjs',
    because: 'возврат требования Entity Registry row снова делает выбранную YAML-сущность '
      + 'невидимой в painted frame; smoke обязан доказать contact, lock и frozen-snapshot parity',
    patches: [{
      file: 'src/ha-binding-status.ts',
      find: '  return !!entityId\n    && !!projectedHass?.states?.[entityId];',
      replace: '  return !!entityId\n    && !!projectedHass?.entities?.[entityId]\n'
        + '    && !!projectedHass?.states?.[entityId];',
    }],
  },
  {
    id: 'column-shadow-removed',
    guard: 'node demo/smoke_glow.mjs',
    because: 'физические тела выпали из окклюдеров — колонна перестаёт отбрасывать '
      + 'тень; исторически смок теней был зелёным, пока тени физически не рисовались',
    patches: [{
      file: 'src/glow-scene.ts',
      // Physical bodies now enter the one canonical scene shared by both
      // cards. Removing them here must drop column shadows in the smoke.
      find: '  const opaqueBodies = input.physicalBodies(partitionCuts, cacheKey);',
      replace: '  const opaqueBodies: number[][][] = [];',
    }],
  },
  {
    id: 'decor-restored-below-room-fills',
    guard: 'node demo/smoke_decor_layer_order.mjs',
    because: 'moving decor back before room fills reproduces #231: opaque custom floors, room '
      + 'hover and Glow base erase stored decor even though the decor group still exists in the DOM; '
      + 'the raster probes must catch the visual regression, including the filled opening tunnel',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "            ${''/* Decor is one composition layer above every floor treatment\n"
        + '                   (room fill/hover, opening tunnels and Glow base) and below\n'
        + '                   live lighting, physical plan geometry and devices. Keep\n'
        + '                   hide_decor visual-only: the decor editor must always paint\n'
        + '                   stored shapes so they remain editable. */}\n'
        + "            ${disp.hideDecor && this._mode !== 'decor' ? nothing : this._renderDecorLayer(undefined, view)}\n",
      replace: '',
    }, {
      file: 'src/houseplan-card.ts',
      find: '            ${(() => {\n'
        + '              // audit L1: hoisted out of the per-room map — these depend on the',
      replace: "            ${disp.hideDecor && this._mode !== 'decor' ? nothing : this._renderDecorLayer(undefined, view)}\n"
        + '            ${(() => {\n'
        + '              // audit L1: hoisted out of the per-room map — these depend on the',
    }],
  },
  {
    id: 'feather-20px',
    guard: 'node demo/smoke_glow.mjs',
    because: 'растушёвка 20 px вместо 2 размывает границу света на полкомнаты; '
      + 'смок читает data-feather-px и обязан отвергнуть значение больше 3',
    patches: [{
      file: 'src/glow-scene.ts',
      find: 'export const GLOW_EDGE_FEATHER_PX = 2;',
      replace: 'export const GLOW_EDGE_FEATHER_PX = 20;',
    }],
  },
  {
    id: 'barrier-cache-never-invalidated',
    guard: 'node demo/smoke_zero_walls.mjs',
    because: 'кэш барьеров, который не инвалидируется по содержимому, — это свет '
      + 'сквозь стену, которая уже существует; смок переключает пунктирную нулевую '
      + 'стену в сплошную и обязан увидеть смену освещённости соседней комнаты',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const cacheKey = `${space.id}|${revision.fingerprint}`;',
      replace: '    const cacheKey = space.id; // mutant: ignore changed geometry',
    }],
  },
  {
    id: 'golden-lamp-out-of-reach',
    guard: 'node demo/golden/run.mjs --mode=capture --scenario=lighting-opaque-glow-two-doorways-dark',
    because: 'сцена заведена как защита дверного света (#71) и однажды уже была '
      + 'пустой: лампа стояла так, что пятно не доходило до стены. Уведённая лампа '
      + 'обязана ронять семантический ассерт warmPixelRegion, а не только пиксельный дифф. '
      + 'Режим capture, а не verify: политика запрещает verify по одной сцене '
      + '(demo/golden/policy.mjs) — частичный verify это лазейка «чтобы CI позеленел». '
      + 'На capture семантический провал даёт status error, и goldenRunFailed '
      + 'краснеет в любом режиме — то есть проверка сохраняется полностью',
    // Мутируется фикстура сцены, не продуктовый код: пустота сцены — свойство
    // фикстуры. Пересборка бандла всё равно нужна, путь тот же.
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.40, y: 0.48 } },",
      replace: "layoutOverrides: { 'golden-light-one': { s: 'golden-lighting', x: 0.06, y: 0.90 } },",
    }],
  },
  {
    id: 'golden-filled-tunnel-removed',
    guard: 'node demo/golden/run.mjs --mode=capture --scenario=openings-filled-tunnel-dark',
    because: 'сцена защищает непрерывную room-coloured заливку толстого тоннеля (#81): '
      + 'если fixture перестаёт рисовать заливку, semantic tunnelContinuity обязан упасть, '
      + 'а не принять пустой проём как корректный golden',
    // Ломаем только заявленное условие fixture. Capture сохраняет полный
    // semantic gate даже для одной сцены и не зависит от pixel baseline.
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: "{ id: 'openings-filled-tunnel-dark', fixture: 'visual', space: 'golden-lighting', mode: 'view',\n    fillMode: 'custom', customFill: { c: '#66717c', a: 0.55 }, glowEnabled: false,",
      replace: "{ id: 'openings-filled-tunnel-dark', fixture: 'visual', space: 'golden-lighting', mode: 'view',\n    fillMode: 'none', customFill: { c: '#66717c', a: 0.55 }, glowEnabled: false,",
    }],
  },
  {
    id: 'sun-north-subtraction-restored',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="planSunAngle" test/sun.test.mjs',
    because: 'возврат старого azimuth - northDeg снова зеркалит направление при '
      + 'ненулевом севере; табличный AC-01 обязан покраснеть на 90+90 и wrap-кейсах',
    patches: [{
      file: 'src/sun.ts',
      find: 'return norm360(azimuth + northDeg);',
      replace: 'return norm360(azimuth - northDeg);',
    }],
  },
  {
    id: 'sun-to-sun-vector-inverted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="north right plus east sun" test/sun.test.mjs',
    because: 'формула угла остаётся правильной, но инверсия toSun выбирает окно с '
      + 'противоположной стороны; направленный AC-03 обязан отличить окно от направления луча',
    patches: [{
      file: 'src/sun.ts',
      find: '  const toSun = sunDirOnPlan(azimuth, northDeg);\n  const away: [number, number] = [-toSun[0], -toSun[1]];',
      replace: '  const direction = sunDirOnPlan(azimuth, northDeg);\n  const toSun: [number, number] = [-direction[0], -direction[1]];\n  const away: [number, number] = [-toSun[0], -toSun[1]];',
    }],
  },
  {
    id: 'sun-golden-north-neutralized',
    guard: 'node --test --test-name-pattern="sun-ray golden" test/golden-matrix.test.mjs',
    because: 'нулевой north_deg снова делает golden нечувствительным к знаку композиции; '
      + 'структурный тест обязан требовать ненулевой север и асимметричный азимут',
    patches: [{
      file: 'demo/golden/matrix.mjs',
      find: '    glowEnabled: false, allLightsOff: true, northDeg: 90,',
      replace: '    glowEnabled: false, allLightsOff: true, northDeg: 0,',
    }],
  },
  {
    id: 'plan-only-room-area-restored',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'возврат room.area нарушает основное обещание чистого шаблона; '
      + 'projection/roundtrip тест обязан увидеть HA Area даже при нулевых markers',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '_ROOM_PLAN_FIELDS = ("id", "name", "open_to", "x", "y", "w", "h", "poly", "wall_ids")',
      replace: '_ROOM_PLAN_FIELDS = ("id", "name", "area", "open_to", "x", "y", "w", "h", "poly", "wall_ids")',
    }],
  },
  {
    id: 'plan-only-projector-bypassed',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'игнорирование request-флага возвращает markers и device layout; '
      + 'полный representative export обязан доказать, что true включает lossy projector',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        if plan_only:\n            projected_space = _project_plan_only_space(space)',
      replace: '        if False and plan_only:\n            projected_space = _project_plan_only_space(space)',
    }],
  },
  {
    id: 'ordinary-export-plan-only-false-emitted',
    guard: 'node scripts/backend-test-guard.mjs ordinary_space_export_is_unchanged',
    because: 'аддитивное поле не должно менять обычный space export даже значением false; '
      + 'fixed regression обязан сохранить прежнюю структуру документа',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '**({"plan_only": True} if plan_only else {}),',
      replace: '**({"plan_only": plan_only}),',
    }],
  },
  {
    id: 'plan-only-revalidate-flag-dropped',
    guard: 'node scripts/backend-test-guard.mjs plan_only_export_projects',
    because: 'revalidate не имеет права превращать plan-only preview в обычный space preview; '
      + 'roundtrip test проверяет сохранение флага после обновления revisions',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '            "plan_only": _transfer_plan_only(document),\n            "counts":',
      replace: '            "plan_only": False,\n            "counts":',
    }],
  },
  {
    id: 'plan-only-forged-file-trusted',
    guard: 'node scripts/backend-test-guard.mjs forged_plan_only_privacy_claim',
    because: 'флаг файла не является доказательством приватности; negative parser matrix '
      + 'обязана покраснеть, если schema-aware проверка больше не вызывается',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '    if plan_only:\n        _validate_plan_only_document(document, config, layout, placement)',
      replace: '    if False and plan_only:\n        _validate_plan_only_document(document, config, layout, placement)',
    }],
  },
  {
    id: 'plan-only-preview-label-hidden',
    guard: 'node demo/smoke_backup_transfer.mjs',
    because: 'валидный plan-only файл без явной строки в preview выглядит обычной копией; '
      + 'browser smoke обязан проверять пользовательский статус, а не только backend-флаг',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "${p.plan_only ? html`<span class=\"backupplanonlystatus\">${this._t('backup.plan_only_preview')}</span>` : nothing}",
      replace: "${false ? html`<span class=\"backupplanonlystatus\">${this._t('backup.plan_only_preview')}</span>` : nothing}",
    }],
  },
  {
    id: 'passage-visible-geometry-door-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/opening-symbol.test.mjs',
    because: 'если явную пустую ветку passage убрать, общий fallback рисует дверную створку; '
      + 'renderer test обязан требовать буквально пустую видимую геометрию',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: "  if (spec.type === 'passage') return svg``;",
      replace: "  if (false && spec.type === 'passage') return svg``;",
    }],
  },
  {
    id: 'passage-light-classifier-removed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/light-visibility.test.mjs',
    because: 'потеря passage из явного allowlist снова делает внутренний открытый проём '
      + 'непрозрачным; тест одновременно сохраняет fail-dark для неизвестных типов',
    patches: [{
      file: 'src/logic.ts',
      find: "  return type === 'door' || type === 'gate' || type === 'passage';",
      replace: "  return type === 'door' || type === 'gate';",
    }],
  },
  {
    id: 'passage-import-validator-bypassed',
    guard: 'node scripts/backend-test-guard.mjs invalid_passage_import',
    because: 'импорт является недоверенным новым content и не имеет broken-read исключения; '
      + 'forged contact/lock обязан быть отклонён до создания preview',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        validate_opening_passages(incoming_config, validate_all=True)',
      replace: '        if False:\n            validate_opening_passages(incoming_config, validate_all=True)',
    }],
  },
  {
    id: 'passage-static-door-cut-leak',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/space-geometry.test.mjs',
    because: 'Static обязан менять masonry только для нового passage; добавление обычной двери '
      + 'в cuts сломает сохранённую совместимость старых планов',
    patches: [{
      file: 'src/space-geometry.ts',
      find: "    if (opening?.type !== 'passage') continue;",
      replace: "    if (opening?.type !== 'passage' && opening?.type !== 'door') continue;",
    }],
  },
  {
    id: 'passage-iso-door-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/iso-openings.test.mjs',
    because: 'без zero-leaf branch скрытая изометрия превращает passage в дверь; '
      + 'basis test обязан ловить любое появление панели независимо от live state',
    patches: [{
      file: 'src/iso-openings.ts',
      find: "  if (input.type === 'passage') {",
      replace: "  if (false && input.type === 'passage') {",
    }],
  },
  {
    id: 'entity-marker-kept-in-parent-device',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="entity marker owns its entity|partial auto parent" '
      + 'test/devices.test.mjs',
    because: 'an explicitly placed entity must be removed from the residual automatic parent '
      + 'so state, action and light projection cannot render the same HA channel twice',
    patches: [{
      file: 'src/devices.ts',
      find: '      !owned.has(entityId) && !hass?.entities?.[entityId]?.hidden),',
      replace: '      !hass?.entities?.[entityId]?.hidden),',
    }],
  },
  {
    id: 'entity-marker-parent-seeded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="seedHiddenBindings: entity ownership" '
      + 'test/devices.test.mjs',
    because: 'the first-run seeder must share residual ownership with buildDevices or it can '
      + 'materialise the removed automatic duplicate as a permanent hidden device marker',
    patches: [{
      file: 'src/devices.ts',
      find: '  const entsBy = entitiesByDevice(h);\n'
        + '  const ownership = entityMarkerOwnership(markers, fullHass);\n'
        + '  const marked = new Set(markers.map((m) => m.binding));',
      replace: '  const entsBy = entitiesByDevice(h);\n'
        + '  const ownership = entityMarkerOwnership([], fullHass);\n'
        + '  const marked = new Set(markers.map((m) => m.binding));',
    }],
  },
  {
    id: 'manual-room-device-area-fallback',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="manual room without area.*device" test/devices.test.mjs',
    because: 'возврат старого device fallback снова даёт registry Area приоритет над явно '
      + 'сохранённой комнатой без HA Area; AC1 обязан увидеть неверные area и space',
    patches: [{
      file: 'src/devices.ts',
      find: '      const { area, space } = resolveExplicitMarkerPlacement(\n'
        + '        m, dev?.area_id, areaToSpace, firstSpaceId,\n'
        + '      );',
      replace: "      const area = m.area || dev?.area_id || '';\n"
        + '      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;',
    }],
  },
  {
    id: 'manual-room-entity-branch-skipped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="manual room without area.*entity" test/devices.test.mjs',
    because: 'исправление только device-ветки оставляет entity Area и Area родительского '
      + 'устройства способными увести маркер из ручной комнаты; AC2 покрывает оба пути',
    patches: [{
      file: 'src/devices.ts',
      find: '      const { area, space } = resolveExplicitMarkerPlacement(\n'
        + '        m, registryArea, areaToSpace, firstSpaceId,\n'
        + '      );',
      replace: "      const area = m.area || registryArea || '';\n"
        + '      const space = (area && areaToSpace[area]) || m.space || firstSpaceId;',
    }],
  },
  {
    id: 'area-null-without-room-id-hijacked',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="area null without room_id" test/devices.test.mjs',
    because: 'одно area:null не доказывает ручную комнату: расширенный предикат угоняет '
      + 'legacy marker без room_id из registry Area; негативный AC3 обязан это поймать',
    patches: [{
      file: 'src/devices.ts',
      find: "  const manualRoomWithoutArea = typeof marker.room_id === 'string'\n"
        + '    && marker.room_id.length > 0\n'
        + '    && marker.area === null;',
      replace: '  const manualRoomWithoutArea = marker.area === null;',
    }],
  },
  {
    id: 'reopened-room-from-registry-space',
    guard: 'node demo/smoke_subarea.mjs',
    because: 'room_id без правильного effective space создаёт отсутствующую option при '
      + 'повторном открытии; browser smoke обязан восстановить точный garden#@room id',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "          ? d.space + '#@' + d.marker.room_id",
      replace: "          ? this._space + '#@' + d.marker.room_id",
    }],
  },
  {
    id: 'same-space-room-change-recenters',
    guard: 'node demo/smoke_subarea.mjs',
    because: 'редактирование комнаты внутри одного пространства не должно двигать уже '
      + 'расставленный маркер; smoke сравнивает закреплённые координаты до и после Save',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      if (!replacingRemoved && prevPos && prevPos.s === targetSpaceId) {',
      replace: '      if (!replacingRemoved && prevPos && prevPos.s === targetSpaceId && !roomChanged) {',
    }],
  },
  {
    id: 'hidden-room-names-full-svg-fallback',
    guard: 'node demo/smoke_hide_room_names.mjs',
    because: 'show_names:false must remove every permanent label from the full flat renderer; '
      + 'the smoke must reject the legacy centred SVG substitute independently of compact and iso',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            ${glowLayerVisible ? this._renderGlowLayer(space, disp, view) : nothing}',
      replace: '            ${!space.bg && !disp.showNames && !this._markup ? svg`<g class="room-svg-labels" pointer-events="none">${space.rooms.map((room) => {\n'
        + '              const center = this._roomCenter(room);\n'
        + '              return svg`<text class="rlabel" data-hp="room-label" data-id=${room.id || nothing}\n'
        + '                data-area=${room.area || nothing} x=${center[0]} y=${center[1]}>${room.name}</text>`;\n'
        + '            })}</g>` : nothing}\n'
        + '            ${glowLayerVisible ? this._renderGlowLayer(space, disp, view) : nothing}',
    }],
  },
  {
    id: 'hidden-room-names-compact-svg-fallback',
    guard: 'node demo/smoke_hide_room_names.mjs',
    because: 'the compact card is an independent renderer and must not replace a disabled HTML '
      + 'room card with the old SVG name even when the full card is correct',
    patches: [{
      file: 'src/space-render.ts',
      find: '  spaceModels, defaultPositions, markerPos, labelPos, spaceFrame, iconCqw, NORM_W,',
      replace: '  spaceModels, roomCenter, defaultPositions, markerPos, labelPos, spaceFrame, iconCqw, NORM_W,',
    }, {
      file: 'src/space-render.ts',
      find: '        ${passageGlowTunnels}\n'
        + '        <g class="decorlayer" pointer-events="none">${decorImages}</g>\n'
        + '        ${glowPools}\n        ${wallUnion',
      replace: '        ${passageGlowTunnels}\n'
        + '        ${!space.bg && !disp.showNames ? svg`<g class="room-svg-labels" pointer-events="none">${space.rooms.map((room) => {\n'
        + '          const center = roomCenter(room);\n'
        + '          return svg`<text class="rlabel" data-hp="room-label" data-id=${room.id || nothing}\n'
        + '            data-area=${room.area || nothing} x=${center[0]} y=${center[1]}>${room.name}</text>`;\n'
        + '        })}</g>` : nothing}\n'
        + '        <g class="decorlayer" pointer-events="none">${decorImages}</g>\n'
        + '        ${glowPools}\n'
        + '        ${wallUnion',
    }],
  },
  {
    id: 'hidden-room-names-iso-override',
    guard: 'node demo/smoke_hide_room_names.mjs',
    because: 'hidden isometric View must obey the same show_names:false contract instead of '
      + 'forcing an HTML room card solely because the space has no backdrop',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            ${disp.showNames || this._markup\n',
      replace: '            ${disp.showNames || (iso && !space.bg) || this._markup\n',
    }],
  },
  {
    id: 'plan-room-area-icon-hidden',
    guard: 'node demo/smoke_room_link.mjs',
    because: 'Plan обязан сохранять тот же состав name-row, что и View; возврат прежнего '
      + 'условия снова убирает Area icon и сдвигает подпись относительно anchor',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const showAreaLink = !!r.area;',
      replace: '    const showAreaLink = !this._markup && !!r.area;',
    }],
  },
  {
    id: 'plan-room-area-icon-navigates',
    guard: 'node demo/smoke_room_link.mjs',
    because: 'Area icon в Plan является частью drag-зоны, а не ссылкой; включение View-handlers '
      + 'обязано одновременно проявиться навигацией и невозможностью начать drag с иконки',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const areaLinkInteractive = !this._markup;',
      replace: '    const areaLinkInteractive = true;',
    }],
  },
  {
    id: 'space-create-hidden-display-override',
    guard: 'node demo/smoke_space_create_display_defaults.mjs',
    because: 'Save must persist the two booleans visibly chosen for a new hand-drawn space; '
      + 'the production smoke saves and reopens a mixed pair so the old hidden true/true override cannot return',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        show_borders: d.showBorders,\n        show_names: d.showNames,',
      replace: "        show_borders: d.source === 'draw' && d.mode === 'create' ? true : d.showBorders,\n"
        + "        show_names: d.source === 'draw' && d.mode === 'create' ? true : d.showNames,",
    }],
  },
  {
    id: 'vacuum-trail-resume-disabled',
    guard: 'node scripts/trail-resume-test-guard.mjs',
    because: 'an ended same-map run inside the accepted 30-minute window must reopen instead '
      + 'of rotating into previous; focused pure and recorder sequences must reject the old unconditional split',
    patches: [{
      file: 'custom_components/houseplan/trails.py',
      find: '        resumed = bool(cur and can_resume_trail_run(cur, map_id, now, route_id))',
      replace: '        resumed = False',
    }],
  },
  {
    id: 'vacuum-trail-smoothing-disabled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="smoothVacPath rounds corners" test/vacuum.test.mjs',
    because: 'the bounded curve is the user-visible point of #209; restoring a straight vertex '
      + 'must be rejected by the focused geometry test rather than blessed by a matching empty golden',
    patches: [{
      file: 'src/vacuum.ts',
      find: "      commands.push({ kind: 'quadratic', control: b, point: after });",
      replace: "      commands.push({ kind: 'line', point: b });",
    }],
  },
  {
    id: 'device-unavailable-hover-restored',
    guard: 'node demo/smoke_device_icon_design.mjs',
    because: 'unavailable keeps click/keyboard access but must never regain the blue visual hover '
      + 'which makes an offline device look live',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: '.dev:not(.unavail):hover {',
      replace: '.dev.unavail:hover {',
    }],
  },
  {
    id: 'controller-availability-follows-target',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 251 separates controller availability" '
      + 'test/device-presentation.test.mjs',
    because: 'a live controller must not inherit unavailable from its controlled lamp; '
      + 'the focused matrix keeps own availability and target working as separate facts (#251)',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  let visual = input.controllerFace\n"
        + "    ? { ...input.sourceVisual, availability: input.controllerAvailability }",
      replace: "  let visual = input.controllerFace\n    ? input.sourceVisual",
    }],
  },
  {
    id: 'controller-diagnostics-do-not-prove-online',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 251 separates controller availability" '
      + 'test/device-presentation.test.mjs',
    because: 'battery, LQI and update are the available evidence for event-only wireless '
      + 'controllers; excluding those siblings restores the field defect (#251)',
    patches: [{
      file: 'src/device-presentation.ts',
      find: '  const live = ownEntities.some((eid) => {',
      replace: "  const live = ownEntities.filter((eid) => !eid.startsWith('sensor.') "
        + "&& !eid.startsWith('update.')).some((eid) => {",
    }],
  },
  {
    id: 'entityless-active-controller-stays-available',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 318 keeps an active entityless physical controller available" '
      + 'test/device-presentation.test.mjs',
    because: 'an active physical controller whose HA device exposes no own entities has no offline '
      + 'evidence; its face must remain available while controls decide working versus neutral (#318)',
    patches: [{
      file: 'src/device-presentation.ts',
      find: "  if (activeEntitylessDevice) return 'available';",
      replace: "  if (activeEntitylessDevice) return 'unavailable';",
    }],
  },
  {
    id: 'wireless-controller-loses-filtered-target-role',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 274 keeps a wireless controller" '
      + 'test/device-presentation.test.mjs',
    because: 'a saved target tombstone may empty the runtime light graph without turning the '
      + 'physical controller into its event-only primary; live diagnostics still prove online (#274)',
    patches: [{
      file: 'src/device-presentation.ts',
      find: "  const controllerFace = sources.sourceKind === 'controls'\n"
        + "    || (configuredController && sources.sourceKind !== 'light' && sources.sourceKind !== 'cover');",
      replace: "  const controllerFace = sources.sourceKind === 'controls';",
    }],
  },
  {
    id: 'wireless-controller-preview-drops-sibling-markers',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 274 keeps a wireless controller" '
      + 'test/device-presentation.test.mjs',
    because: 'the draft must inherit the same tombstones and ownership roster as the saved plan; '
      + 'isolating it restores the plan/preview contradiction (#274)',
    patches: [{
      file: 'src/devices.ts',
      find: '  const markers = [\n'
        + '    ...siblingMarkers.filter((item) => item.id !== marker.id),\n'
        + '    marker,\n'
        + '  ];',
      replace: '  const markers = [marker];',
    }],
  },
  {
    id: 'unavailable-toggle-stays-silent',
    guard: 'node demo/smoke_controls.mjs',
    because: 'a configured group with no available target must explain the safe no-op instead '
      + 'of returning silently before service, confirmation and press feedback (#251)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        this._showUnavailableToggleTargets(initial);',
      replace: '        // Mutant: restore the historical quiet no-op.',
    }],
  },
  {
    id: 'partial-group-shows-noop-toast',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 251 classifies only unavailable" '
      + 'test/device-toggle.test.mjs',
    because: 'a partial group did execute its available subset and must never claim that no '
      + 'action happened merely because another target was skipped (#251)',
    patches: [{
      file: 'src/device-toggle.ts',
      find: "  if (!intent || intent.kind !== 'group' || toggleOperation(intent)\n"
        + "      || intent.noneReason !== 'configured-targets-missing') return [];",
      replace: "  if (!intent || intent.kind !== 'group') return [];",
    }],
  },
  {
    id: 'device-marker-lqi-low-boundary-shifted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="marker LQI keeps semantic bands" '
      + 'test/device-presentation.test.mjs',
    because: 'marker LQI must keep the owner-approved inclusive <=40 red boundary without '
      + 'changing the separate room-fill gradient',
    patches: [{
      file: 'src/device-presentation.ts',
      find: '  if (lqi <= 40) return \'low\';',
      replace: '  if (lqi < 40) return \'low\';',
    }],
  },
  {
    id: 'presentation-row-contract',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'a removed marker must stay outside the presentation roster; the matrix checks '
      + 'the documented pre-resolver lifecycle owner instead of pretending the face can hide it later',
    patches: [{
      file: 'src/devices.ts',
      find: '    if (m.removed) continue;',
      replace: '    if (false && m.removed) continue;',
    }],
  },
  {
    id: 'device-presentation-policy-lifecycle',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'HA-disabled markers must not leak live faces back into View or the device editor; '
      + 'the pure policy test exercises the shared lifecycle gate on both surfaces',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  if (input.bindingLifecycle === 'ha_disabled') {\n    effectiveHidden = true;",
      replace: "  if (input.bindingLifecycle === 'ha_disabled') {\n    effectiveHidden = false;",
    }],
  },
  {
    id: 'device-presentation-policy-user-hidden',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'a user-hidden marker must stay out of View while the separate design-preview '
      + 'exception remains explicit and independently protected',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: '  } else if (input.userHidden && !input.designPreview) {\n'
        + '    effectiveHidden = true;',
      replace: '  } else if (input.userHidden && !input.designPreview) {\n'
        + '    effectiveHidden = false;',
    }],
  },
  {
    id: 'device-presentation-policy-user-hidden-preview',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'design preview must keep the saved face of a user-hidden marker instead of '
      + 'collapsing it into the ordinary active lifecycle',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  } else if (input.userHidden) {\n    decisions.push('lifecycle.user_hidden_preview');",
      replace: "  } else if (false && input.userHidden) {\n    decisions.push('lifecycle.user_hidden_preview');",
    }],
  },
  {
    id: 'device-presentation-policy-orphaned',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'an orphaned saved binding must retain its diagnostic lifecycle decision and '
      + 'must not be treated as an ordinary active marker',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  } else if (input.bindingLifecycle === 'orphaned') {\n"
        + "    decisions.push('lifecycle.orphaned_diagnostic');",
      replace: "  } else if (false && input.bindingLifecycle === 'orphaned') {\n"
        + "    decisions.push('lifecycle.orphaned_diagnostic');",
    }],
  },
  {
    id: 'presentation-static-source-fast-path',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'the static plan fast path deliberately skips source discovery and must expose '
      + 'that bounded decision instead of silently looking like an evaluated empty graph',
    patches: [{
      file: 'src/device-presentation.ts',
      find: "  sourceKind: 'none', decisionIds: ['source.skipped_static_fast_path'],",
      replace: "  sourceKind: 'none', decisionIds: ['source.none'],",
    }],
  },
  {
    id: 'device-presentation-policy-static',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'static_icon is the strongest visible face gate and must suppress state, value, '
      + 'metrics, pulse and vacuum live together rather than relying on renderer-specific checks',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: '  } else if (staticIcon) {\n    visual = NEUTRAL_VISUAL;',
      replace: '  } else if (false && staticIcon) {\n    visual = NEUTRAL_VISUAL;',
    }],
  },
  {
    id: 'device-presentation-policy-alarm',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'critical alarm must survive live_states:false for every dynamic face; removing '
      + 'the alarm exception turns the safety state into an ordinary neutral marker',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  } else if (input.sourceVisual.status !== 'alarm' && !input.liveStates) {",
      replace: '  } else if (!input.liveStates) {',
    }],
  },
  {
    id: 'device-presentation-policy-unavailable',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'unavailable is a distinct renderer state after lifecycle and alarm; losing its '
      + 'decision lets offline markers masquerade as neutral available devices',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  else if (visual.availability === 'unavailable') decisions.push('status.unavailable');",
      replace: "  else if (false && visual.availability === 'unavailable') decisions.push('status.unavailable');",
    }],
  },
  {
    id: 'device-presentation-policy-status',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'working, open and neutral are ordered stable states; the focused table must catch '
      + 'a reordered or removed working branch before it changes the marker plate',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  else if (visual.status === 'working') decisions.push('status.working');",
      replace: "  else if (false && visual.status === 'working') decisions.push('status.working');",
    }],
  },
  {
    id: 'device-presentation-policy-live-gate',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'live_states:false must neutralise every ordinary dynamic state without suppressing '
      + 'alarm; the matrix proves the gate with observable visual output',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  } else if (input.sourceVisual.status !== 'alarm' && !input.liveStates) {",
      replace: "  } else if (input.sourceVisual.status !== 'alarm' && false) {",
    }],
  },
  {
    id: 'device-presentation-policy-value',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'value mode may render text only with one available scalar source; bypassing that '
      + 'single gate either hides valid values or revives ambiguous arbitrary registry rows',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "  const face: PresentationFace = input.display === 'value'\n"
        + "    && !effectiveHidden && input.valueAvailable ? 'value' : 'icon';",
      replace: "  const face: PresentationFace = false\n"
        + "    && !effectiveHidden && input.valueAvailable ? 'value' : 'icon';",
    }],
  },
  {
    id: 'device-presentation-policy-diagnostics',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'metrics and vacuum overlays share the static/hidden gate; forcing metrics on lets '
      + 'satellites escape a static face even though the core itself remains neutral',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: '  const metrics = !staticIcon && !effectiveHidden;',
      replace: '  const metrics = true;',
    }],
  },
  {
    id: 'device-presentation-policy-pulse-gate',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'ordinary activity belongs only to icon_ripple while alarm is independent; '
      + 'dropping the display gate recreates ambiguous activity on the default badge mode',
    patches: [{
      file: 'src/device-presentation-policy.ts',
      find: "    && visual.availability === 'available'\n"
        + "    && (visual.status === 'alarm' || (input.liveStates && input.display === 'icon_ripple'));",
      replace: "    && visual.availability === 'available'\n"
        + "    && (visual.status === 'alarm' || input.liveStates);",
    }],
  },
  {
    id: 'presentation-source-decision-trace',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="every documented decision row" '
      + 'test/device-presentation-policy.test.mjs',
    because: 'source precedence must remain named and executable; erasing the cover winner must '
      + 'break the matrix even if the renderer happens to retain the same pixels for one fixture',
    patches: [{
      file: 'src/device-presentation.ts',
      find: "    decisionIds.push('source.cover');",
      replace: "    decisionIds.push('source.cover_mutant');",
    }],
  },
  {
    id: 'device-long-value-ellipsis-restored',
    guard: 'node demo/smoke_device_icon_design.mjs',
    because: 'Text and Double must expose the complete dynamic value; the new shared shell '
      + 'must not regress to the old clipped satellite',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: '    .dev .valtext {\n      overflow: visible;',
      replace: '    .dev .valtext {\n      overflow: hidden;\n      text-overflow: ellipsis;',
    }],
  },
  {
    id: 'device-keyboard-bypasses-click-path',
    guard: 'node demo/smoke_device_icon_design.mjs',
    because: 'Enter and Space must reuse the current surface click path so Device editor opens '
      + 'settings and secure View actions keep their existing confirmation policy',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    this._clickDevice(ev, d);',
      replace: '    if (d.primary) this._openMoreInfo(d.primary);',
    }],
  },
  {
    id: 'device-visual-factor-removed',
    guard: 'node --test --test-name-pattern="issue 213 resolves the effective base" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'the current effective size must be resolved once at the surface boundary; '
      + 'restoring a late face-level 0.9 factor would shrink every marker a second time',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: '      --dev-size: calc(var(--device-base-size, 2.25cqw) * var(--dev-scale, 1));',
      replace: '      --dev-size: calc(var(--device-base-size, 2.25cqw) * var(--dev-scale, 1) * 0.9);',
    }],
  },
  {
    id: 'device-text-capsule-radius-restored',
    guard: 'node --test --test-name-pattern="issue 212 Text value" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'a wide Text core must keep a radius based on its height instead of reverting '
      + 'to the elliptical 50% rule',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: '      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) / 2);',
      replace: '      border-radius: 50%;',
    }],
  },
  {
    id: 'device-press-duration-drifted',
    guard: 'node --test --test-name-pattern="issue 212 feedback" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'accepted device actions must retain the owner-specified bounded 200 ms feedback '
      + 'instead of silently drifting with unrelated animation timings',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      duration: 200,',
      replace: '      duration: 350,',
    }],
  },
  {
    id: 'device-touch-hover-gate-removed',
    guard: 'node --test --test-name-pattern="issue 212 removes the global touch latch" '
      + 'test/device-marker-polish-contract.test.mjs',
    because: 'touch must not leave a browser-matched device hover painted after the JS tooltip '
      + 'has already been cleared',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: '    :host([data-pointer-hover]) .dev:not(.unavail):hover {',
      replace: '    .dev:not(.unavail):hover {',
    }],
  },
  {
    id: 'pair-chamfer-returns',
    // #310: фаска возвращается в узел-двойку — остриё пары снова срезано
    // вопреки решению владельца.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 310" test/wall-thickness.test.mjs',
    because: 'узел ровно двух лучей обязан закрываться полным mitre — стены сходятся в точку',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        const patch = hit\n          ? [node.slice(), pA, hit, pB]\n          : [node.slice(), pA, pB];',
      replace: '        const visual = VISUAL_MITRE_LIMIT * Math.max(a.halfDepth, b.halfDepth);\n        const patch = hit && Math.hypot(hit[0] - node[0], hit[1] - node[1]) <= visual\n          ? [node.slice(), pA, hit, pB]\n          : (hit && chamferApex(node, pA, hit, pB, visual)) || [node.slice(), pA, pB];',
    }],
  },
  {
    id: 'butt-end-trim-disabled',
    // #310: торцевой трим отключён — зубец торца толстой стены снова торчит
    // из тонкой.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 310" test/wall-thickness.test.mjs',
    because: 'выступ прямоугольного торца за грань тонкой стены — это и есть зубец из отчёта владельца',
    patches: [{
      file: 'src/physical-geometry.ts',
      find: '  for (const { segmentIndex, wedge } of pairButtEndTrimWedges(allSegments, epsilon)) {',
      replace: '  for (const { segmentIndex, wedge } of pairButtEndTrimWedges([], epsilon)) {',
    }],
  },
  {
    id: 'butt-end-trim-unbounded',
    // #310: трим без ограничения окрестностью узла режет всё тело стены.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 310" test/wall-thickness.test.mjs',
    because: 'торцевой трим обязан быть адресным — не дальше 2·halfDepth от узла вдоль оси',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      const reach = Math.min(2 * self.halfDepth, self.length);',
      replace: '      const reach = self.length;',
    }],
  },
  {
    id: 'preflight-reason-lost-in-dialog',
    // #295: диалог обязан называть причину отказа по каждому пространству.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node demo/smoke_preflight_diagnostics.mjs',
    because: 'отказ preflight без причины недиагностируем — ровно исходный дефект #295',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "                ${failure.displayName}: ${this.host._t(`gs.preflight_reason_${failure.reason}` as I18nKey)}",
      replace: "                ${failure.displayName}",
    }],
  },
  {
    id: 'preflight-fingerprint-from-saved-config',
    // CODE-REVIEW-295-r1 M1: хэш геометрии обязан браться из кандидата,
    // который проверял preflight, а не из сохранённого конфига — иначе блок
    // повторяет то, что и так даст экспорт пространства.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node demo/smoke_preflight_diagnostics.mjs',
    because: 'диагностика с хэшем сохранённой геометрии не несёт ничего сверх экспорта (AC4)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    const spacesById = new Map(((candidate as any)?.spaces || [])",
      replace: "    const spacesById = new Map(((this._serverCfg as any)?.spaces || [])",
    }],
  },
  {
    id: 'span-cut-erases-the-door-wall',
    // #316 §3.1: легаси-кат обязан щадить атом, несущий проём — иначе дверь
    // остаётся на нулевой стене и миграция деградирует без нужды.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="keeps its wall through a legacy span cut" '
      + 'test/wall-segment-model.test.mjs',
    because: 'дверь внутри бывшей «границы» стояла в настоящей стене — занулять её атом значит переписать план (#316)',
    patches: [{
      file: 'src/wall-segment-model.ts',
      find: "      atom.zeroWall ||= coveredBy(canonicalZeroCuts)\n        || (coveredBy(legacyCuts) && !atomCarriesOpening(a, b));",
      replace: "      atom.zeroWall ||= coveredBy(canonicalZeroCuts) || coveredBy(legacyCuts);",
    }],
  },
  {
    id: 'migration-throws-over-an-opening-again',
    // #316 §3.4: initial migration никогда не кидает opening-host — реверт
    // возвращает глобальный блокер рисования beta.3.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="migrates unhosted instead of blocking" '
      + 'test/wall-segment-model.test.mjs '
      + '&& node demo/smoke_zero_wall_migration_unblocked.mjs',
    because: 'один конфликтный проём снова заблокировал бы структурные записи во всех пространствах (#316)',
    patches: [{
      file: 'src/wall-segment-model.ts',
      find: "    if (initialMigration) { delete opening.host; continue; }",
      replace: "    if (initialMigration) throw new WallSegmentModelError('opening-host', opening.id);",
    }],
  },
  {
    id: 'preflight-fallback-survives-dialog-close',
    // CODE-REVIEW-295-r1 M2: инлайн-фолбэк живёт одно показание диалога;
    // переживший закрытие блок подсунет в отчёт диагностику чужого отказа.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node demo/smoke_preflight_diagnostics.mjs',
    because: 'застрявший фолбэк отдаёт в баг-репорт JSON предыдущего отказа, не текущего (AC4)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "dismiss-on-scrim @hp-close=${() => { this._alignDialog = null; this._preflightClipboardFallback = null; }}>",
      replace: "dismiss-on-scrim @hp-close=${() => { this._alignDialog = null; }}>",
    }],
  },
  {
    id: 'preflight-diagnostics-without-reason',
    // #295: копируемый блок без reason бесполезен для отчёта об ошибке.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node demo/smoke_preflight_diagnostics.mjs',
    because: 'диагностический блок обязан нести reason каждого отказа',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "        reason: failure.reason,",
      replace: "        reason: undefined,",
    }],
  },
  {
    id: 'preflight-dev-log-disabled',
    // #295: dev-лог — второй канал диагностики, его потерю обязан ловить смок.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node demo/smoke_preflight_diagnostics.mjs',
    because: 'структурированная запись отказа в консоли — часть контракта диагностики #295',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    console.warn('[houseplan] optimize preflight failed', this._preflightDiagnostics(preflight, candidate));",
      replace: "    void preflight; void candidate;",
    }],
  },
  {
    id: 'visual-mitre-limit-back-to-4',
    // #309: порог визуального среза возвращается к классическим 4·h — шип на
    // острой паре и горб над узлом 3×50 отрастают обратно.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 309" test/wall-thickness.test.mjs',
    because: 'без визуального лимита mitre снова торчит на 2–4 толщины за габарит узла',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: 'export const VISUAL_MITRE_LIMIT = 1.5;',
      replace: 'export const VISUAL_MITRE_LIMIT = 4;',
    }],
  },
  {
    id: 'chamfer-disabled-full-mitre',
    // #309: фаска отключена — сверх лимита рисуется сырой mitre.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 309" test/wall-thickness.test.mjs',
    because: 'сектор сверх визуального лимита обязан закрываться фаской, а не вершиной',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const ux = apex[0] - node[0], uy = apex[1] - node[1];\n  const d = Math.hypot(ux, uy);\n  if (!(d > 0) || d <= limit + 1e-9) return null;',
      replace: '  const ux = apex[0] - node[0], uy = apex[1] - node[1];\n  const d = Math.hypot(ux, uy);\n  if (d >= 0) return null;',
    }],
  },
  {
    id: 'pair-patches-at-multiwall-nodes',
    // #309: скип узлов ≥3 лучей отключён — парный патч через чужой сектор
    // снова красит ступень на кресте смешанных толщин.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 309" test/wall-thickness.test.mjs',
    because: 'парный патч в узле ≥3 лучей живёт в чужом секторе и красит ступень поверх тонких полос',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  for (const node of nodes) {\n    if (coveredByFans(node)) continue;',
      replace: '  for (const node of nodes) {',
    }],
  },
  {
    id: 'chamfer-chord-instead-of-perpendicular',
    // #309: срез хордой pA–pB вместо перпендикуляра на пороге — это возврат
    // формы #249 (плоский бевел у самого узла), сектор худеет.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 309" test/wall-thickness.test.mjs',
    because: 'фаска обязана резать перпендикулярно направлению вершины на пороге, а не хордой между гранями',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const cA = cut(pA), cB = cut(pB);\n  if (!cA || !cB) return null;\n  return [[node[0], node[1]], pA, cA, cB, pB];',
      replace: '  return null;',
    }],
  },
  {
    id: 'junction-fans-disabled',
    // Юниты формы, не детектор: контрактные пробы детектора строятся из той
    // же функции и слепнут вместе с ней, а «T-узел даёт два веера» — внешняя
    // истина, не зависящая от мутируемого кода.
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'без вееров сектор между соседними полосами узла остаётся дырой — '
      + 'это и есть класс артефактов #302',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        push(chamferApex([P[0], P[1]], EA, mitre, EB, visual)\n          ?? [[P[0], P[1]], EA, mitre, EB]);\n        continue;',
      replace: '        continue;',
    }, {
      file: 'src/wall-thickness.ts',
      find: '      push([[P[0], P[1]], EA, A2, B2, EB]);',
      replace: '      void A2; void B2;',
    }],
  },
  {
    id: 'junction-fan-ignores-thick-length',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'mitre, шагнувший за короткий толстый саппорт, рисует латеральный '
      + 'фантом рядом с тонким продолжением (#271)',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          : tA > 1e-9 && tA <= A.thickLength && tB <= B.thickLength;',
      replace: '          : tA > 1e-9;',
    }],
  },
  {
    id: 'junction-reflex-outer-mitre-missing',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'рефлексный сектор — наружный угол между крайними лучами; без '
      + 'обратного mitre там остаётся вырез Y-60 из отчёта владельца',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        const directionOk = reflex\n          ? tA <= 1e-9 && tB <= 1e-9',
      replace: '        const directionOk = reflex\n          ? false',
    }],
  },
  {
    id: 'junction-fan-limit-back-to-249',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 309 the 57" test/wall-thickness.test.mjs',
    because: 'лимит веера 1.25·h — это отставка решения №5: узлы снова с '
      + 'вырезами и ступеньками вместо полного mitre',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '      const limit = MITRE_LIMIT * Math.max(A.halfDepth, B.halfDepth);\n      // Facing strip edges',
      replace: '      const limit = node.limit;\n      // Facing strip edges',
    }],
  },
  {
    id: 'junction-detector-blind',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="issue 302" test/wall-thickness.test.mjs',
    because: 'слепой детектор превращает инвариант «нет дыр» в декорацию — '
      + 'самопроверка на заведомо дырявой фикстуре обязана краснеть',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '        if (!inGeometry(geometry, x, y)) holes.push([x, y]);',
      replace: '        void x; void y;',
    }],
  },
  {
    id: 'junction-pieces-unbounded',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="concave vertex" test/wall-thickness.test.mjs',
    because: 'куски узла без клипа гладкой фасадной границей отращивают новый '
      + 'фасад на вогнутой вершине',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '          if (bound) ring = intersection(ring, bound);',
      replace: '          void bound;',
    }],
  },
  {
    id: 'hatch-step-ignores-cell-cm',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'шаг-константа — это и есть баг #230: одна и та же стена 15 см '
      + 'получала от 0.3 до 7.8 полос в зависимости от масштаба сетки',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const step = HATCH_BASE_STEP_UNITS * (HATCH_REFERENCE_CELL_CM / c);',
      replace: '  const step = HATCH_BASE_STEP_UNITS;',
    }],
  },
  {
    id: 'hatch-step-inverted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'множитель cell/5 вместо 5/cell — ошибка из описания issue; она не '
      + 'убирает разброс, а увеличивает его',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  const step = HATCH_BASE_STEP_UNITS * (HATCH_REFERENCE_CELL_CM / c);',
      replace: '  const step = HATCH_BASE_STEP_UNITS * (c / HATCH_REFERENCE_CELL_CM);',
    }],
  },
  {
    id: 'hatch-step-unclamped',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'без клампа патологический cell_cm рождает паттерн, который либо '
      + 'сливается в заливку, либо не попадает в стену ни одной полосой',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '  return Math.min(HATCH_MAX_STEP_UNITS, Math.max(HATCH_MIN_STEP_UNITS, step));',
      replace: '  return step;',
    }],
  },
  {
    id: 'hatch-density-solid-threshold-off',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs',
    because: 'порог по шагу на экране — единственная защита от каши на дальнем '
      + 'конце зума после того, как компенсация 1/zoom убрана',
    patches: [{
      file: 'src/wall-thickness.ts',
      find: '    && stepUnits * pxPerUnit < HATCH_MIN_STEP_PX;',
      replace: '    && false;',
    }],
  },
  {
    id: 'hatch-stroke-not-scaled',
    guard: 'node demo/smoke_wall_hatch_density.mjs',
    because: 'штрих обязан следовать за шагом: иначе на мелкой клетке полосы '
      + 'слипаются в сплошное пятно, а на крупной становятся волосяными',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const stripe = 2 * (step / HATCH_BASE_STEP_UNITS);',
      replace: '    const stripe = 2;',
    }],
  },
  {
    id: 'hatch-zoom-compensation-back',
    guard: 'node demo/smoke_wall_hatch_density.mjs',
    because: 'компенсация 1/zoom возвращает ровно то, ради устранения чего '
      + 'задача и делалась: стена меняет вид при зуме (решение владельца §4.2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        width="${step}" height="${step}" patternTransform="rotate(45)">',
      replace: '        width="${step}" height="${step}"\n'
        + '        patternTransform="rotate(45) scale(${Math.max(0.4, 1 / Math.max(this._zoom, 0.4)).toFixed(3)})">',
    }],
  },
  {
    id: 'hatch-static-renderer-untouched',
    guard: 'node demo/smoke_wall_hatch_density.mjs',
    because: 'статический рендерер — второй путь, рисующий тело стены; все '
      + 'golden-сцены снимаются при cell_cm 5, где его константа неотличима',
    patches: [{
      file: 'src/space-render.ts',
      find: '  const hatchStep = wallHatchStepUnits(cellCm);',
      replace: '  const hatchStep = 8;',
    }],
  },
  {
    id: 'partition-merge-rescales-rooms',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'комнаты хранятся в тех же координатах, что перегородки: лишнее деление '
      + 'уносит их в угол и примыкание к стене комнаты перестаёт находиться '
      + '(CODE-REVIEW-229-r1, High-1)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: `      .filter((poly: number[][] | null): poly is number[][] => !!poly),`,
      replace: `      .filter((poly: number[][] | null): poly is number[][] => !!poly)
      .map((poly: number[][]) => poly.map((p) => [p[0] / 1000, p[1] / 1000])),`,
    }],
  },
  {
    id: 'chain-merge-sees-own-draft',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'завершаемая цепочка ещё лежит в room_drafts, и её собственные концы '
      + 'нельзя принимать за чужое примыкание — иначе стык с существующей стеной '
      + 'никогда не срастается (CODE-REVIEW-229-r1, High-2)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '      if (exclude && draft?.id === exclude) return [];',
      replace: '      void exclude;',
    }],
  },
  {
    id: 'partition-merge-disabled',
    guard: 'node demo/smoke_wall_chain_merge.mjs',
    because: 'без вызова слияния прямая, нарисованная в несколько кликов, снова хранится '
      + 'набором отрезков со швами на каждом стыке (#229)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    this._mergeSpacePartitions(sp, drawnIds);',
      replace: '    void drawnIds;',
    }],
  },
  {
    id: 'partition-merge-ignores-thickness',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'сращивание отрезков разной толщины стирает намеренный переход толщины стены',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '  if (p.cm !== q.cm) return null;',
      replace: '  if (false) return null;',
    }],
  },
  {
    id: 'partition-merge-ignores-junction',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'слияние сквозь примыкание убирает узел, который держит третья стена, '
      + 'комната, колонна или черновик — §8.2 ТЗ',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '        if (junctionAt(at, list, new Set([list[i].id, list[j].id]), options.geometry, join)) continue;',
      replace: '        if (false) continue;',
    }],
  },
  {
    id: 'junction-checks-room-vertices-only',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'поиск примыкания комнаты только по вершинам пропускает T-стык к середине '
      + 'комнатной стены — штатный случай продукта (docs/specs/141-wall-junctions.md)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '      if (finite(a) && finite(b) && distToSegment(point, a, b) <= join) return true;',
      replace: '      if (finite(a) && dist(point, a) <= join) return true; void b;',
    }],
  },
  {
    id: 'partition-merge-keeps-relative-t',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'сохранение прежней доли вместо пересчёта двигает дверь вдоль стены: '
      + 'позиция проёма относительна длине хозяина, а она при слиянии меняется',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '  const mapped = move.base + t * move.span;',
      replace: '  const mapped = t;',
    }],
  },
  {
    id: 'partition-merge-skips-materialization',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'устаревшие x/y/angle — это то, что рисует старый читатель конфига; '
      + 'слияние канонизирует направление стены, поэтому проекция обязана '
      + 'переписаться (docs/CONFIG-COMPATIBILITY.md, #132)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: `    if (resolved) Object.assign(
      opening, materializePartitionOpening(opening, resolved, ctx.coordScale),
    );`,
      replace: '    void resolved;',
    }],
  },
  {
    id: 'chain-merge-sweeps-whole-space',
    guard: 'node --test --test-name-pattern="issue 229" test/wall-merge.test.mjs',
    because: 'слияние всего пространства при рисовании молча правит старые швы в стороне, '
      + 'минуя отчёт и отмену, которые обещаны им в «Оптимизировать планы» (§8.6 ТЗ)',
    patches: [{
      file: 'src/wall-merge.ts',
      find: '        if (seeds && !seeds.has(list[i].id) && !seeds.has(list[j].id)) continue;',
      replace: '        if (false) continue;',
    }],
  },
  {
    id: 'tab-reorder-not-persisted',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'перестановка вкладок, оставшаяся только в памяти, выглядит рабочей ровно до '
      + 'перезагрузки страницы — смок обязан требовать запись на сервер',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    cfg.spaces = applySpaceOrder(cfg.spaces || [], order);\n    this._saveConfig();',
      replace: '    cfg.spaces = applySpaceOrder(cfg.spaces || [], order);',
    }],
  },
  {
    id: 'tab-drag-target-follows-captured-source',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'pointer capture keeps pointermove targeted at the held tab; resolving the drop '
      + 'from that event target reproduces #243, where a real mouse can never reach another tab',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    const target = this._tabDropTargetAt(event.clientX, event.clientY, drag.id);',
      replace: '    const target = this._tabDropTargetAt(drag.x, drag.y, drag.id);',
    }],
  },
  {
    id: 'tab-drop-indicator-always-before',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'a single undirected marker cannot tell whether the held space will land before '
      + 'or after the target; #243 requires the divider on the actual insertion side',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "      return { targetId, placement: targetIndex < sourceIndex ? 'before' : 'after' };",
      replace: "      return { targetId, placement: 'before' };",
    }],
  },
  {
    id: 'tab-drop-outside-commits-last-target',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'leaving the tab strip must clear the preview and make release a no-op; retaining '
      + 'the last target makes an outside drop reorder spaces unexpectedly',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: `      targetId: target?.targetId || null,
      placement: target?.placement || null,`,
      replace: `      targetId: target?.targetId || drag.targetId,
      placement: target?.placement || drag.placement,`,
    }, {
      file: 'src/houseplan-card.ts',
      find: `    const target = event.type === 'pointerup' && drag?.moved
      ? this._tabDropTargetAt(event.clientX, event.clientY, drag.id)
      : null;`,
      replace: `    const target = event.type === 'pointerup' && drag?.moved
      ? drag.targetId ? { targetId: drag.targetId } : null
      : null;`,
    }],
  },
  {
    id: 'reorder-skips-materialization',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'без материализации привязки маркер без space и area уезжает вслед за порядком: '
      + 'его пространство решает firstSpaceId, а тот после перестановки другой (#220 §8.3)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const byId = new Map(pinned.map((entry) => [entry.id, entry.space]));',
      replace: '      const byId = new Map();',
    }],
  },
  {
    id: 'materialization-touches-bound-markers',
    guard: 'node --test --test-name-pattern="issue 220" test/space-order.test.mjs',
    because: 'материализация обязана трогать только маркеры, чьё пространство решает порядок; '
      + 'запись space маркеру, закреплённому HA-областью, кладёт в конфиг поле, которое '
      + 'сдвинет его в старое первое пространство в день смены области (ревью r1, H1)',
    patches: [{
      file: 'src/space-order.ts',
      find: '    if (area && areaToSpace[area]) continue;',
      replace: '    if (false) continue;',
    }],
  },
  {
    id: 'tab-drag-survives-release-outside',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'мышь, отпущенная мимо панели, обязана завершить жест: иначе перетаскивание '
      + 'зависает с moved:true и съедает следующий клик по вкладке (ревью r1, M1)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    window.addEventListener('pointerup', this._tabDragRelease);",
      replace: '    void 0;',
    }],
  },
  {
    id: 'tab-drag-outlives-the-card',
    guard: 'node demo/smoke_space_tab_reorder.mjs',
    because: 'слушатели жеста, пережившие disconnectedCallback, держат инстанс карточки '
      + 'и дают невидимой карточке записать порядок по следующему pointerup на странице '
      + '(ревью r2/r3, F1)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: `    this._endTabDrag();
    clearTimeout(this._tabSuppressClickTimer);`,
      replace: '    clearTimeout(this._tabSuppressClickTimer);',
    }],
  },
  {
    id: 'tab-reorder-eats-click',
    guard: 'node --test --test-name-pattern="issue 220" test/space-order.test.mjs',
    because: 'нулевой порог превращает обычный клик по вкладке в перетаскивание, и '
      + 'переключение пространств — основное действие панели — перестаёт работать',
    patches: [{
      file: 'src/space-order.ts',
      find: 'export const TAB_DRAG_THRESHOLD_PX = 4;',
      replace: 'export const TAB_DRAG_THRESHOLD_PX = 0;',
    }],
  },
  {
    id: 'tab-reorder-ignores-pointer-type',
    guard: 'node --test --test-name-pattern="issue 220" test/space-order.test.mjs',
    because: 'на тач-устройстве вкладки — это навигация View, где тап обязан оставаться тапом; '
      + 'решение владельца «Touch editor: not exposed» держится именно этой проверкой',
    patches: [{
      file: 'src/space-order.ts',
      find: "  if (ctx.pointerType !== 'mouse') return false;",
      replace: '  if (false) return false;',
    }],
  },
  {
    id: 'internal-path-ignores-query',
    guard: 'node scripts/backend-test-guard.mjs issue_225',
    because: 'разбор url строкой вместо urlsplit возвращает баг #225: кэш-бастер '
      + '?v=… делает имя файла не равным самому себе, ссылка читается как '
      + 'внутренняя-но-неканоническая, и бэкап с вложением снова не импортируется',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '    parsed = urlsplit(url)\n    if parsed.scheme or parsed.netloc:\n        return None\n    url = parsed.path',
      replace: '    url = url.split("?", 1)[0]',
    }],
  },
  {
    id: 'internal-path-trusts-foreign-host',
    guard: 'node scripts/backend-test-guard.mjs issue_225',
    because: 'доверие к path при наличии scheme/netloc позволяет '
      + '"https://evil.example/houseplan_files/files/m1/doc.pdf" разрешиться в локальный '
      + 'файл, хотя _looks_internal считает такую ссылку внешней (ревью r1, M1)',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '    if parsed.scheme or parsed.netloc:\n        return None',
      replace: '    if False:\n        return None',
    }],
  },
  {
    id: 'internal-path-allows-traversal',
    guard: 'node scripts/backend-test-guard.mjs issue_225',
    because: 'структурные проверки пути — единственное, что режет traversal после '
      + 'отделения query; снимать их нельзя. Мутант снимает обе сразу: по одной '
      + 'защита эшелонирована (sanitize-сравнение ловит "..") и мутант был бы '
      + 'эквивалентным — выяснено прогоном при реализации',
    patches: [{
      file: 'custom_components/houseplan/import_export.py',
      find: '        if not raw_name or "/" in raw_name:\n            return None',
      replace: '        raw_name = raw_name.split("/")[-1]\n        if not raw_name:\n            return None',
    }, {
      file: 'custom_components/houseplan/import_export.py',
      find: '            tail = url[len(prefix):].split("/")\n            if len(tail) != 2:\n                return None',
      replace: '            tail = url[len(prefix):].split("/")[-2:]',
    }],
  },
  {
    id: 'opening-dimensions-use-axis-ends',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="room dimensions stop at inner faces" '
      + 'test/opening-dimensions.test.mjs',
    because: 'a placement ruler must stop at the physical inner face endpoints, not silently '
      + 'return to the room-axis endpoints that #238 replaces',
    patches: [{
      file: 'src/opening-dimensions.ts',
      find: '  const [lo, hi] = run;',
      replace: '  const [lo, hi] = [basis.targetLo, basis.targetHi];',
    }],
  },
  {
    id: 'opening-dimensions-collapse-shared-side',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="shared wall keeps two independently resolved room sides" '
      + 'test/opening-dimensions.test.mjs',
    because: 'a shared wall has two independently inset room faces and must render four '
      + 'measurements; collapsing two owners back to one pair loses real geometry',
    patches: [{
      file: 'src/opening-dimensions.ts',
      find: '  if (owners.length > 2) return fallbackDimensions(basis);',
      replace: '  if (owners.length > 1) return fallbackDimensions(basis);',
    }],
  },
  {
    id: 'opening-dimensions-use-crossing-axis',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="independent T junction measures to the near masonry face" '
      + 'test/opening-dimensions.test.mjs',
    because: 'an independent partition ruler must meet the near physical face of a crossing '
      + 'wall; shrinking the boundary body to its axis recreates the incorrect distance',
    patches: [{
      file: 'src/opening-dimensions.ts',
      find: '      halfDepth,\n    });',
      replace: '      halfDepth: epsilon,\n    });',
    }],
  },
  {
    id: 'opening-dimension-overlay-hidden',
    guard: 'node demo/smoke_opening_inner_distances.mjs',
    because: 'correct numbers alone do not identify which physical span they describe; the '
      + 'placement preview must keep its dimension lines and endpoint ticks visible',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '            ${opMeasure ? this._renderOpeningDimensionGuides(opMeasure) : nothing}',
      replace: '            ${nothing}',
    }],
  },
  {
    id: 'grid-scale-visual-factor-constant',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="visual scale preserves" test/grid-scale.test.mjs',
    because: 'the visual baseline is 5 cm per cell, so a finer coordinate grid must enlarge '
      + 'legacy SVG visual constants by the reciprocal factor (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return GRID_VISUAL_REFERENCE_CELL_CM / value;',
      replace: '  return 1;',
    }],
  },
  {
    id: 'grid-scale-visual-factor-inverted',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="visual scale preserves" test/grid-scale.test.mjs',
    because: 'cell/5 shrinks visual constants on a finer grid, exactly reversing the physical '
      + 'equivalence contract (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return GRID_VISUAL_REFERENCE_CELL_CM / value;',
      replace: '  return value / GRID_VISUAL_REFERENCE_CELL_CM;',
    }],
  },
  {
    id: 'grid-scale-opening-symbol-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'door leaves, window bars and gate panels are visual geometry and must keep the '
      + 'same screen footprint on physically equivalent grids (#239)',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: '  const visualScale = gridVisualScale(spec.cellCm);',
      replace: '  const visualScale = 1;',
    }],
  },
  {
    id: 'grid-scale-opening-hit-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'the opening hover outline and action hitbox must not shrink when cell_cm becomes '
      + 'more precise; the smoke also clicks the real outer edge (#239)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const outlinePad = gridVisualUnits(10, this._cellCm);\n'
        + '      const hitPad = gridVisualUnits(12, this._cellCm);',
      replace: '      const outlinePad = 10;\n      const hitPad = 12;',
    }],
  },
  {
    id: 'grid-scale-plan-chrome-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'Plan architecture ink is visual chrome; leaving the wall outline at raw SVG units '
      + 'makes it five times thinner on a 1 cm grid (#239)',
    patches: [{
      file: 'src/styles/plan.styles.ts',
      find: '      stroke-width: calc(0.6px * var(--hp-cell-visual-scale, 1));',
      replace: '      stroke-width: 0.6px;',
    }],
  },
  {
    id: 'grid-scale-static-factor-missing',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'the secondary space card shares visual CSS with the full card and must receive '
      + 'the same per-space factor instead of silently drifting (#239)',
    patches: [{
      file: 'src/space-render.ts',
      find: ';--hp-cell-visual-scale:${gridVisualScale(cellCm)}',
      replace: '',
    }],
  },
  {
    id: 'grid-scale-iso-height-unscaled',
    guard: 'node demo/smoke_grid_scale_invariance.mjs',
    because: 'hidden isometric wall and floor heights are visual geometry and must project to '
      + 'the same raster at 1 and 5 cm per cell (#239)',
    patches: [{
      file: 'src/iso-scene-render.ts',
      find: '  const wallHeight = gridVisualUnits(ISO_WALL_HEIGHT, input.cellCm);\n'
        + '  const floorEdgeHeight = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, input.cellCm);\n'
        + '  const raisedHeight = gridVisualUnits(ISO_RAISED_OVERLAY_HEIGHT, input.cellCm);\n'
        + '  const cached = lruRead(input.cache, input.source.key);\n'
        + '  let value = cached.hit ? cached.value : undefined;',
      replace: '  const wallHeight = ISO_WALL_HEIGHT;\n'
        + '  const floorEdgeHeight = ISO_FLOOR_EDGE_HEIGHT;\n'
        + '  const raisedHeight = gridVisualUnits(ISO_RAISED_OVERLAY_HEIGHT, input.cellCm);\n'
        + '  const cached = lruRead(input.cache, input.source.key);\n'
        + '  let value = cached.hit ? cached.value : undefined;',
    }],
  },
  {
    id: 'grid-scale-metric-default-five',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="new-space defaults" test/grid-scale.test.mjs',
    because: 'new metric spaces must start at 1 cm per cell; restoring the old 5 cm default '
      + 'would preserve the defect for every new plan (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return imperial ? GRID_IMPERIAL_CELL_CM : 1;',
      replace: '  return imperial ? GRID_IMPERIAL_CELL_CM : 5;',
    }],
  },
  {
    id: 'grid-scale-imperial-default-wrong',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="new-space defaults" test/grid-scale.test.mjs',
    because: 'one imperial grid point means exactly one inch (2.54 canonical centimetres), '
      + 'not one centimetre (#239)',
    patches: [{
      file: 'src/grid-scale.ts',
      find: '  return imperial ? GRID_IMPERIAL_CELL_CM : 1;',
      replace: '  return imperial ? 1 : 1;',
    }],
  },
  {
    id: 'grid-scale-legacy-fallback-one',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="legacy space without cell_cm" test/canvas.test.mjs',
    because: 'missing cell_cm is stored-data compatibility and stays at the historical 5 cm; '
      + 'the new 1 cm value applies only at creation (#239)',
    patches: [{
      file: 'src/space-geometry.ts',
      find: '      cellCm: Number.isFinite(Number(s.cell_cm)) && Number(s.cell_cm) > 0\n'
        + '        ? Number(s.cell_cm) : 5,',
      replace: '      cellCm: Number.isFinite(Number(s.cell_cm)) && Number(s.cell_cm) > 0\n'
        + '        ? Number(s.cell_cm) : 1,',
    }],
  },
  {
    id: 'grid-scale-imperial-roundtrip-drift',
    guard: 'node demo/smoke_space_scale_defaults.mjs',
    because: 'the rounded imperial field is presentation only; saving it without an edit must '
      + 'not replace the exact canonical centimetre value (#239)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      sp.cell_cm = Number.isFinite(d.cellCm) && d.cellCm > 0\n'
        + '        ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, d.cellCm)) : 5;',
      replace: '      sp.cell_cm = gridCellFieldToCm(Number(d.cellCmInput), this._imperial);',
    }],
  },
  {
    id: 'grid-scale-physical-double-scaled',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="without double-scaling physical jambs" '
      + 'test/opening-symbol.test.mjs',
    because: 'wall-face depth is already converted from centimetres to render units; applying '
      + 'the visual factor again makes physical geometry five times too large (#239)',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: '    ? ((spec.face.cm / spec.cellCm) * spec.gridPitch) / 2',
      replace: '    ? (((spec.face.cm / spec.cellCm) * spec.gridPitch) / 2) '
        + '* gridVisualScale(spec.cellCm)',
    }],
  },
  {
    id: 'opening-symbol-flip-restores-edge-offset',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test test/opening-symbol-placement.test.mjs '
      + 'test/opening-symbol.test.mjs test/iso-openings.test.mjs',
    because: 'a saved flip changes only opening direction; restoring the released #242 '
      + 'door/window edge translation moves the symbol off the wall centreline (#250)',
    patches: [{
      file: 'src/opening-symbol-placement.ts',
      find: '  return { ox: 0, oy: 0 };',
      replace: "  if (_flipV && (_type === 'door' || _type === 'window'))\n"
        + "    return { ox: 0, oy: Math.hypot(_face.ox, _face.oy) };\n"
        + '  return { ox: 0, oy: 0 };',
    }],
  },
  {
    id: 'opening-gate-flip-cancels-turn',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="shared renderer centres every flip" '
      + 'test/opening-symbol.test.mjs',
    because: 'restoring the second flip_v inversion makes shared and partition gates emit '
      + 'the same first-leaf turn sign for both saved values even though their origin stays centred',
    patches: [{
      file: 'src/render/opening-symbol.ts',
      find: '    const gateAngle = spec.face.side * 10 * amount;',
      replace: '    const gateAngle = spec.face.side * sy * 10 * amount;',
    }],
  },
  {
    id: 'wall-identity-editor-commit-barrier-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="structural transaction crosses" '
      + 'test/wall-segment-model.test.mjs',
    because: 'a geometry writer that persists the mutable v7/v8 projection without rebuilding '
      + 'stable ids can detach thickness and opening hosts during any later editor operation (#282)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      } else committedCandidate = commitWallSegmentModel(liveCandidate).config;',
      replace: '      } else committedCandidate = liveCandidate;',
    }],
  },
  {
    id: 'wall-identity-history-restore-barrier-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="structural transaction crosses" '
      + 'test/wall-segment-model.test.mjs',
    because: 'Undo and Redo are a separate structural writer family; restoring a snapshot '
      + 'without rebuilding v8 references can persist stale room and opening identities (#282)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      committedCandidate = commitWallSegmentModel(restoredCandidate).config;',
      replace: '      committedCandidate = restoredCandidate;',
    }],
  },
  {
    id: 'wall-identity-optimize-barrier-bypassed',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="structural transaction crosses" '
      + 'test/wall-segment-model.test.mjs',
    because: 'Optimize repairs geometry outside the interactive editor; omitting its identity '
      + 'barrier would leave the authoritative catalogue behind the repaired projections (#282)',
    patches: [{
      file: 'src/plan-optimizer.ts',
      find: '    wallSegmentsMigrated = commitWallSegmentModelInPlace(config).migratedSegments;',
      replace: '    wallSegmentsMigrated = 0;',
    }],
  },
  {
    id: 'v8-draft-sanitation-shifts-segment-identity',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="draft sanitation drops only" '
      + 'test/wall-segment-model.test.mjs',
    because: 'skipping a duplicate adjacent point must drop its own zero edge instead of '
      + 'shifting the following model-v8 segment id onto the wrong carrier (#314)',
    patches: [{
      file: 'src/wall-segment-model.ts',
      find: '    const source = draft.segments?.[index - 1];',
      replace: '    const source = draft.segments?.[segments.length];',
    }],
  },
  {
    id: 'v8-rejected-physical-write-keeps-optimistic-draft',
    guard: 'npm run bundle:sync && node demo/smoke_v8_draft_write.mjs',
    because: 'a rejected config/set must synchronously discard its whole pending physical batch '
      + 'before the active draft can be promoted into a ghost partition (#314)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        const rolledBack = this._rollbackRejectedPhysicalWrites(strictEntries);',
      replace: '        const rolledBack = false;',
    }],
  },
  {
    id: 'area-relocation-loses-position-on-refusal',
    guard: 'npm run bundle:sync && node demo/smoke_area_relocation_safety.mjs',
    because: 'a rejected provenance write must restore every manual layout point deleted '
      + 'before config/set, or leave explicit attention when restoration also fails (#403)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '              await this._persistDevicePlacement(id, placement);',
      replace: '              void id;\n              void placement;',
    }],
  },
  {
    id: 'area-relocation-clears-whole-history',
    guard: 'npm run bundle:sync && node demo/smoke_area_relocation_safety.mjs',
    because: 'moving one marker to a new HA Area must invalidate only that marker\'s commands '
      + 'instead of silently erasing Undo and Redo for every other marker (#403)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '        const relocating = this._areaRelocationIds;\n'
        + '        this._devicePositionHistory.removeWhere(({ before, after }) =>\n'
        + '          relocating.has(before.deviceId) || relocating.has(after.deviceId));',
      replace: '        this._devicePositionHistory.clear();',
    }],
  },
  {
    id: 'area-cleanup-keeps-candidate-outside-current-snapshot',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="absent from the current snapshot" '
      + 'test/device-area-relocation.test.mjs',
    because: 'finite two-frame evidence belongs to one current snapshot binding; retaining a '
      + 'candidate after that binding was removed can later delete unrelated provenance (#434 AC8)',
    patches: [{
      file: 'src/device-area-relocation.ts',
      find: '    if (validBinding(binding) && Number.isFinite(revision) && snapshotBindings.has(binding)) {',
      replace: '    if (validBinding(binding) && Number.isFinite(revision)) {',
    }],
  },
  {
    id: 'support-stale-preview-response-revives-consent',
    guard: 'node demo/smoke_support_feedback.mjs',
    because: 'a late preview response must not restore exact plan geometry after attachment '
      + 'consent was revoked or a newer preview generation won (#418)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    return generation === this._supportPreviewGeneration\n"
        + '      && current?.draftId === draftId\n'
        + '      && current.attach;',
      replace: '    return true;',
    }],
  },
  {
    id: 'support-invalid-response-leaks-issued-token',
    guard: 'node demo/smoke_support_feedback.mjs',
    because: 'a syntactically valid token is already an allocated backend slot even when the '
      + 'rest of the preview response is invalid; it must be discarded independently of UI '
      + 'currentness instead of lingering until TTL (#434 AC10)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '      if (issuedToken) {\n'
        + '        const token = issuedToken;\n'
        + "        issuedToken = '';\n"
        + '        void this._discardSupportPreview(token);\n'
        + '      }',
      replace: '      void issuedToken;',
    }],
  },
  {
    id: 'support-edited-retry-reuses-old-idempotency-key',
    guard: 'node demo/smoke_support_feedback.mjs',
    because: 'a retry with changed outbound message, contact or preview must receive a new '
      + 'idempotency key instead of resolving to the first payload at the relay (#418)',
    patches: [{
      file: 'src/support-feedback.ts',
      find: '    idempotencyKey: state.submissionFingerprint\n'
        + '      && state.submissionFingerprint !== fingerprint\n'
        + "      ? randomId('report')\n"
        + '      : state.idempotencyKey,',
      replace: '    idempotencyKey: state.idempotencyKey,',
    }],
  },
  {
    id: 'support-timeout-claims-success',
    guard: 'node demo/smoke_support_feedback.mjs',
    because: 'a relay timeout, rate limit or unknown command must preserve the draft and expose '
      + 'manual recovery; claiming success loses the report while telling the user it was sent (#43)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: "    } catch (error: unknown) {\n"
        + "      if (!this._supportPatch(current.draftId, {\n"
        + "        status: 'error',\n"
        + '        errorCode: supportErrorCode(error),',
      replace: "    } catch (error: unknown) {\n"
        + "      if (!this._supportPatch(current.draftId, {\n"
        + "        status: 'success',\n"
        + "        reportId: 'HP-FALSE-SUCCESS',\n"
        + "        errorCode: '',",
    }],
  },
  {
    id: 'decor-raster-full-decode-skipped',
    guard: 'python3 -m pytest tests_backend/test_decor_assets.py -q -p no:cacheprovider',
    because: 'a valid-looking PNG whose IDAT is not a zlib stream must be refused before it '
      + 'enters the authenticated store; header parsing answers w/h/mime and cannot answer '
      + 'whether the raster decodes at all (#51 AC, аудит #430 п.1)',
    patches: [{
      file: 'custom_components/houseplan/decor_assets.py',
      find: '        with Image.open(BytesIO(data)) as image:\n'
        + '            image.load()\n'
        + '            if image.size != (width, height):\n'
        + '                raise DecorAssetError("invalid_image", "Image dimensions are inconsistent")\n'
        + '            if getattr(image, "is_animated", False):\n'
        + '                raise DecorAssetError("unsupported_image", "Animated images are unsupported")',
      replace: '        _ = (Image, BytesIO)',
    }],
  },
  {
    id: 'decor-physical-inventory-follows-sidecars',
    guard: 'node scripts/backend-test-guard.mjs physical_inventory '
      + 'tests_backend/test_decor_assets.py',
    because: 'quota is a physical-storage boundary: malformed/missing sidecars cannot make '
      + 'promoted blobs invisible, while sidecars without blobs consume no blob quota (#434 AC1)',
    patches: [{
      file: 'custom_components/houseplan/decor_assets.py',
      find: '        entries = list(root.iterdir())\n',
      replace: '        entries = list(root.glob("*.json"))\n',
    }],
  },
  {
    id: 'decor-catalog-accepts-sidecar-without-blob',
    guard: 'python3 -m pytest tests_backend/test_decor_assets.py -q -p no:cacheprovider '
      + '-k valid_shaped_sidecar_without_blob',
    because: 'catalog/list/resolve remain strict projections; a valid-looking sidecar must not '
      + 'materialise an image whose matching blob is absent (#434 AC4)',
    patches: [{
      file: 'custom_components/houseplan/decor_assets.py',
      find: '            or not blob.is_file()\n',
      replace: '',
    }],
  },
  {
    id: 'decor-orphan-repair-runs-after-quota',
    guard: 'python3 -m pytest tests_backend/test_ha_websocket.py -q -p no:cacheprovider '
      + '-k decor_asset_upload_deduplicates',
    because: 'an exact digest-proven orphan adds no physical bytes and must repair its sidecar '
      + 'even when physical count quota is already full (#434 AC2)',
    patches: [{
      file: 'custom_components/houseplan/http_api.py',
      find: '            if blob.exists():\n'
        + '                if not blob.is_file() or hashlib.sha256(blob.read_bytes()).hexdigest() != aid:',
      replace: '            if False and blob.exists():\n'
        + '                if not blob.is_file() or hashlib.sha256(blob.read_bytes()).hexdigest() != aid:',
    }],
  },
  {
    id: 'decor-orphan-repair-claims-reuse',
    guard: 'python3 -m pytest tests_backend/test_ha_websocket.py -q -p no:cacheprovider '
      + '-k decor_asset_upload_deduplicates',
    because: 'reused:true means a valid catalog entry predated the request; rebuilding a lost or '
      + 'broken sidecar creates that entry and must report false (#434 AC2)',
    patches: [{
      file: 'custom_components/houseplan/http_api.py',
      find: '                    os.replace(meta_temp, meta)\n'
        + '                    return row, False\n'
        + '                finally:',
      replace: '                    os.replace(meta_temp, meta)\n'
        + '                    return row, True\n'
        + '                finally:',
    }],
  },
  {
    id: 'decor-delete-skips-orphan-blobs',
    guard: 'python3 -m pytest tests_backend/test_ha_websocket.py -q -p no:cacheprovider '
      + '-k decor_asset_delete_removes_exact_orphans_only',
    because: 'explicit delete is the only bounded recovery path for invisible orphan blobs; '
      + 'depending on catalog metadata leaves quota permanently occupied (#434 AC3)',
    patches: [{
      file: 'custom_components/houseplan/websocket_api.py',
      find: '            for extension in ASSET_EXTENSIONS:\n',
      replace: '            for extension in ():\n',
    }],
  },
  {
    id: 'decor-svg-canonical-bytes-discarded',
    guard: 'python3 -m pytest tests_backend/test_decor_assets.py -q -p no:cacheprovider',
    because: 'the stored SVG must be the re-serialised canonical form, not the upload: keeping '
      + 'the original bytes silently reinstates whatever the parser dropped — prologue, '
      + 'comments, exotic spelling of the same tree (#51 ТЗ §3, аудит #430 п.2)',
    patches: [{
      file: 'custom_components/houseplan/decor_assets.py',
      find: 'return ValidatedAsset(canonical, "image/svg+xml"',
      replace: 'return ValidatedAsset(data, "image/svg+xml"',
    }],
  },
  {
    id: 'decor-svg-canonical-size-unchecked',
    guard: 'python3 -m pytest tests_backend/test_decor_assets.py -q -p no:cacheprovider',
    because: 'canonicalisation can grow the document fourfold by escaping text, so the 2 MiB '
      + 'limit must be re-applied to the canonical bytes: a 1.84 MiB upload otherwise lands '
      + 'as 7.35 MiB in the store (аудит #430 п.2)',
    patches: [{
      file: 'custom_components/houseplan/decor_assets.py',
      find: '    _check_size(canonical)\n',
      replace: '',
    }],
  },
  {
    id: 'decor-svg-external-url-guard-off',
    guard: 'python3 -m pytest tests_backend/test_decor_assets.py -q -p no:cacheprovider',
    because: 'javascript:, data:, http:, https: and // inside an allowed attribute of an allowed '
      + 'tag are caught by this rule alone; every "external" case of the original corpus was '
      + 'caught by tag or attribute allowlists instead (аудит #430 п.3)',
    patches: [{
      file: 'custom_components/houseplan/decor_assets.py',
      find: 'if any(token in low for token in ("javascript:", "data:", "http:", "https:", "//")):',
      replace: 'if False:',
    }],
  },
  {
    id: 'decor-image-flip-v-ignored',
    guard: 'node --test test/decor-assets.test.mjs',
    because: 'vertical flip is half of the image projection contract and had no witness of its '
      + 'own: the single #51 case set flip_h only, so dropping flip_v stayed green (#51 AC3, '
      + 'аудит #430 п.4)',
    patches: [{
      file: 'src/decor-assets.ts',
      find: '${shape.flip_v ? -1 : 1}',
      replace: '1',
    }],
  },
  {
    id: 'decor-image-opacity-ignored',
    guard: 'node --test test/decor-assets.test.mjs',
    because: 'the projection must carry the shape opacity; the only case asserted opacity 2 → 1, '
      + 'an expectation indistinguishable from hardcoding 1 (#51 AC4, аудит #430 п.4)',
    patches: [{
      file: 'src/decor-assets.ts',
      find: 'const opacity = clamp01(shape.opacity, 1);',
      replace: 'const opacity = 1;',
    }],
  },
  {
    id: 'decor-asset-id-shape-unchecked',
    guard: 'node --test test/decor-assets.test.mjs',
    because: 'the catalog row must prove its own asset_id shape: the malformed row of #51 kept '
      + 'the url of a real asset, so the url comparison caught it and the id regex could be '
      + 'deleted unnoticed (аудит #430 п.4)',
    patches: [{
      file: 'src/decor-assets.ts',
      find: "    if (!DECOR_ASSET_ID_RE.test(String(row.asset_id || '')) || row.url !== expectedUrl",
      replace: '    if (row.url !== expectedUrl',
    }],
  },
  {
    id: 'asset-resolve-readonly-membership-removed',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'decor_asset_resolve_readonly_is_limited_to_referenced_ids '
      + 'tests_backend/test_ha_websocket.py',
    because: 'a read-only household member needs referenced images for View but must not use '
      + 'assets/resolve to probe or hash arbitrary catalog ids (#432 AC2)',
    patches: [{
      file: 'custom_components/houseplan/websocket_api.py',
      find: '        allowed = requested & referenced\n',
      replace: '        allowed = requested\n',
    }],
  },
  {
    id: 'asset-integrity-cache-hit-disabled',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'integrity_cache_reuses_digest_and_caches_corrupt_signature '
      + 'tests_backend/test_decor_assets.py',
    because: 'unchanged valid and corrupt files must reuse the actual digest instead of '
      + 're-reading the blob for every WS resolve or HTTP GET (#432 AC5)',
    patches: [{
      file: 'custom_components/houseplan/asset_integrity.py',
      find: '            if cached is not None and cached.signature == before:\n',
      replace: '            if False and cached is not None and cached.signature == before:\n',
    }],
  },
  {
    id: 'asset-integrity-single-flight-disabled',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'integrity_cache_single_flights_same_path_and_releases_after_error '
      + 'tests_backend/test_decor_assets.py',
    because: 'parallel requests for one file version must share one streaming hash and wake '
      + 'all waiters after success or failure (#432 AC6)',
    patches: [{
      file: 'custom_components/houseplan/asset_integrity.py',
      find: '            flight = self._inflight.get(key)\n',
      replace: '            flight = None\n',
    }],
  },
  {
    id: 'asset-integrity-post-read-signature-ignored',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'integrity_cache_invalidates_changed_signature_and_rejects_mid_read_change '
      + 'tests_backend/test_decor_assets.py',
    because: 'a digest computed while the blob changes must fail dark and never become a '
      + 'trusted cache entry for either transport (#432 AC7)',
    patches: [{
      file: 'custom_components/houseplan/asset_integrity.py',
      find: '            stable = _signature(path) == before\n',
      replace: '            stable = True\n',
    }],
  },
  {
    id: 'asset-integrity-non-regular-file-admitted',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'integrity_verifier_rejects_non_regular_files_before_hashing '
      + 'tests_backend/test_decor_assets.py',
    because: 'a FIFO or device with a valid asset filename can block an HA executor forever; '
      + 'only regular files may reach the streaming hasher (#440 AC1)',
    patches: [{
      file: 'custom_components/houseplan/asset_integrity.py',
      find: '    if not stat.S_ISREG(current.st_mode):\n'
        + '        raise OSError("asset is not a regular file")\n',
      replace: '',
    }],
  },
  {
    id: 'asset-integrity-follower-waits-forever',
    guard: 'node scripts/backend-test-guard.mjs integrity_follower_has_a_bounded_wait '
      + 'tests_backend/test_decor_assets.py',
    because: 'a follower must fail dark after a bounded wait even if an injected or wedged '
      + 'owner never signals its single-flight event (#440 AC1)',
    patches: [{
      file: 'custom_components/houseplan/asset_integrity.py',
      find: '            if not flight.event.wait(ASSET_INTEGRITY_FOLLOWER_TIMEOUT_SECONDS):\n',
      replace: '            if not flight.event.wait():\n',
    }],
  },
  {
    id: 'room-tooltip-off-skips-pointer-modality',
    guard: 'node demo/smoke_room_tooltip_toggle.mjs',
    because: 'pen/touch pointermove inside an already hovered room must clear mouse-only hover '
      + 'even when the room information tooltip is disabled (#440 AC2)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    this._notePointer(ev);\n'
        + '    if (showRoomTooltipOf(this._settings)) return true;',
      replace: '    if (showRoomTooltipOf(this._settings)) return true;',
    }],
  },
  {
    id: 'decor-upload-invalid-image-reported-as-capacity',
    guard: 'node scripts/backend-test-guard.mjs '
      + 'decor_asset_upload_deduplicates_and_rejects_mime_spoofing '
      + 'tests_backend/test_ha_websocket.py',
    because: 'a corrupt orphan is a client/integrity rejection, not exhausted storage; only '
      + 'capacity_exceeded may produce HTTP 507 (#440 AC4)',
    patches: [{
      file: 'custom_components/houseplan/http_api.py',
      find: '            status = 507 if err.code == "capacity_exceeded" else 400\n',
      replace: '            status = 507\n',
    }],
  },
  {
    id: 'initial-view-ceiling-unplugged',
    guard: 'node --test test/bundle-assets.test.mjs',
    because: 'the initial-View ceiling must be ENFORCED by the CLI, not merely declared: this '
      + 'gate has been silently removable twice (#429 took the old ratchet out on the very '
      + 'release where it would have fired, and the growth of #438 went unnoticed for a beta)',
    patches: [{
      file: 'scripts/bundle-budget.mjs',
      find: '    const ceiling = initialViewCeilingViolation(result.initialViewGzipBytes);\n'
        + '    if (ceiling) throw new Error(ceiling.text);\n',
      replace: '',
    }],
  },
  {
    id: 'decor-oversize-hides-the-downscale-action',
    guard: 'node --test test/decor-image-upload.test.mjs',
    because: 'a decor source above the 2 MiB asset limit must still be offered as a reduced '
      + 'copy: the flag forbids keeping the ORIGINAL, and gating the whole action block on it '
      + 'is #427 — a bug that survived four review rounds because this path had no test at all',
    patches: [{
      file: 'src/backdrop-pick.ts',
      find: '      ${hard ? null : html`',
      replace: '      ${hard || !allowOriginal ? null : html`',
    }],
  },
  {
    id: 'decor-upload-loses-the-replace-flag',
    guard: 'node --test test/decor-image-upload.test.mjs',
    because: 'the guard dialog must upload into whichever slot the caller asked for: losing the '
      + 'replaceSelection flag silently turns "replace this image" into "arm the palette" and '
      + 'leaves the selected shape pointing at the old asset (#51 AC1, #433)',
    patches: [{
      file: 'src/decor-image-editor.ts',
      find: '      this.hooks.setGuardReplace(replaceSelection);',
      replace: '      this.hooks.setGuardReplace(false);',
    }],
  },
  {
    id: 'decor-upload-error-codes-collapse',
    guard: 'node --test test/decor-image-upload.test.mjs',
    because: 'each backend refusal code carries its own message: collapsing too_large into the '
      + 'generic io_error tells the user "something went wrong" where the product knows exactly '
      + 'what went wrong and how to fix it (#433)',
    patches: [{
      file: 'src/decor-image-editor.ts',
      find: "          too_large: 'backdrop.too_large_title',\n",
      replace: '',
    }],
  },
  {
    id: 'pure-backend-test-pulls-home-assistant',
    guard: 'python3 -m pytest tests_backend/test_backend_quality.py -q -p no:cacheprovider',
    because: 'a pure test module that imports an HA-dependent backend module must be caught '
      + 'statically: pytest aborts on collection, so ALL pure tests stop running and the '
      + 'output looks nothing like a normal failure (#436, the #389 pattern)',
    patches: [{
      file: 'tests_backend/test_projection.py',
      find: 'import copy\nimport importlib.util\nimport os',
      replace: 'import copy\nimport importlib.util\nimport os\n'
        + 'from custom_components.houseplan.store import async_save_config_state',
    }],
  },
  {
    id: 'benchmark-page-verdict-unwatched',
    guard: 'node demo/guard/verify-guard.mjs',
    because: 'the page benchmark of #423 must register its page with watchPage, and that must be '
      + 'proven by running it: the previous proof asked a regexp whether it still finds the '
      + 'substring the same test had just deleted (аудит #430 п.5)',
    patches: [{
      file: 'demo/benchmark_backdrop_decode.mjs',
      find: 'const page = watchPage(await (await browser.newContext()).newPage());',
      replace: 'const page = await (await browser.newContext()).newPage();',
    }],
  },
  {
    id: 'marker-reject-keeps-optimistic-candidate',
    guard: 'node demo/smoke_marker_write_rollback.mjs',
    because: 'a rejected semantic marker write must restore accepted config and View while '
      + 'leaving the independent Device editor draft available for Retry (#442 AC1)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '        rollbackOptimistic(this.host, attempt, contentFingerprint);\n'
        + "        this.host._regSignature = '';",
      replace: "        this.host._regSignature = '';",
    }],
  },
  {
    id: 'marker-rollback-keeps-enqueue-time-revision',
    guard: 'node demo/smoke_marker_write_rollback.mjs',
    because: 'a marker save queued behind an accepted write must guard rollback with the revision '
      + 'its own request used, while still yielding to genuinely newer content (#442 AC2)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '      if (attempt && liveFingerprint === attempt.attemptedFingerprint) Object.assign(attempt, { revision: this.host._cfgRev, attempted: candidate, attemptedFingerprint: candidateFingerprint });',
      replace: '',
    }],
  },
  {
    id: 'accepted-marker-rolled-back-by-layout-failure',
    guard: 'node demo/smoke_marker_write_rollback.mjs',
    because: 'config acceptance is the durable marker boundary: a later layout failure must not '
      + 'restore the marker that the server already accepted (#442 AC3)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: '      if (!configAccepted && attempt) {\n'
        + '        rollbackOptimistic(this.host, attempt, contentFingerprint);',
      replace: '      if (attempt) {\n'
        + '        this.host._serverCfg = attempt.previous;',
    }],
  },
  {
    id: 'vacuum-reject-keeps-optimistic-matrix',
    guard: 'node --test test/vacuum-calibration-write.test.mjs',
    because: 'a rejected calibration, including first use, must not leave its matrix or synthetic '
      + 'marker in the local accepted config (#442 AC5–AC7)',
    patches: [{
      file: 'src/vacuum-calibration-write.ts',
      find: '    rollbackOptimistic(host, attempt, contentFingerprint);\n    rebuild(host);',
      replace: '    rebuild(host);',
    }],
  },
  {
    id: 'vacuum-auto-reports-success-before-acceptance',
    guard: 'node --test test/vacuum-calibration-write.test.mjs',
    because: 'automatic calibration must stay busy and suppress both duplicate writes and success '
      + 'until config/set has actually resolved (#442 AC4)',
    patches: [{
      file: 'src/vacuum-calibration-write.ts',
      find: '    const saved = await saveVacuumMatrix(\n'
        + '      runtime, request.markerId, request.source, request.mapId, request.matrix, request.routeId,\n'
        + '    );',
      replace: '    const saved = true;\n'
        + '    void saveVacuumMatrix(\n'
        + '      runtime, request.markerId, request.source, request.mapId, request.matrix, request.routeId,\n'
        + '    );',
    }],
  },
  {
    id: 'optimistic-rollback-skips-same-root-fingerprint',
    guard: 'node --test test/serialized-write-queue.test.mjs',
    because: 'newer in-place content can retain the attempted object identity; rollback must still '
      + 'compare content and must never erase that newer owner (#442 AC2)',
    patches: [{
      file: 'src/serialized-write-queue.ts',
      find: '  if (!current || host._cfgRev !== attempt.revision\n'
        + '      || fingerprint(current) !== attempt.attemptedFingerprint) return false;',
      replace: '  if (!current || host._cfgRev !== attempt.revision\n'
        + '      || (current !== attempt.attempted\n'
        + '        && fingerprint(current) !== attempt.attemptedFingerprint)) return false;',
    }],
  },
  {
    id: 'zigbee-topology-overlay-layer-lowered',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'the active topology must paint above unrelated markers and room labels while '
      + 'remaining inside the existing plan camera context (#464 AC1)',
    patches: [{
      file: 'src/hp-zigbee-topology-overlay.ts',
      find: ':host { position: absolute; inset: 0; z-index: 7; display: block; pointer-events: none; }',
      replace: ':host { position: absolute; inset: 0; z-index: 1; display: block; pointer-events: none; }',
    }],
  },
  {
    id: 'zigbee-topology-endpoint-elevation-removed',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'complete source and drawable-neighbour marker roots must stay above every active '
      + 'topology primitive rather than being crossed by their own link (#464 AC1)',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: '.dev[data-hp-zigbee-topology-endpoint] { z-index: 8; }',
      replace: '.dev[data-hp-zigbee-topology-endpoint] { z-index: 1; }',
    }],
  },
  {
    id: 'zigbee-topology-hovered-endpoint-elevation-removed',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'a real CSS :hover has higher specificity than the base endpoint rule; the source '
      + 'must still remain above its active topology line (#464 AC1, code-review r1)',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: ':host([data-pointer-hover]) .dev[data-hp-zigbee-topology-endpoint]:hover { z-index: 8; }',
      replace: ':host([data-pointer-hover]) .dev[data-hp-zigbee-topology-endpoint]:hover { z-index: 1; }',
    }],
  },
  {
    id: 'zigbee-topology-unrelated-markers-raised',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'endpoint ownership is the exact rendered local link set; promoting every marker '
      + 'would restore the original occlusion behind unrelated devices (#464 AC1, AC2)',
    patches: [{
      file: 'src/hp-zigbee-topology-overlay.ts',
      find: '    this._setDesiredEndpointIds(lines.length || bubbles.length || hover.remoteCount\n'
        + '      ? [\n'
        + '        this._hovered,\n'
        + '        ...lines.map((line) => line.neighborMarkerId),\n'
        + '      ] : []);',
      replace: '    this._setDesiredEndpointIds(lines.length || bubbles.length || hover.remoteCount\n'
        + '      ? this.devices.filter((item) => item.space === this.currentSpace).map((item) => item.id) : []);',
    }],
  },
  {
    id: 'zigbee-topology-endpoint-cleanup-skipped',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'transient endpoint ownership must not survive leave, modality/mode changes or '
      + 'overlay disconnect and alter later marker stacking (#464 AC2)',
    patches: [{
      file: 'src/hp-zigbee-topology-overlay.ts',
      find: '  private _clearEndpointOwnership(): void {\n'
        + '    for (const marker of this._endpointElements) marker.removeAttribute(ENDPOINT_ATTRIBUTE);\n'
        + '    for (const marker of this._parent?.querySelectorAll<HTMLElement>(`[${ENDPOINT_ATTRIBUTE}]`) || []) {\n'
        + '      marker.removeAttribute(ENDPOINT_ATTRIBUTE);\n'
        + '    }\n'
        + '    this._endpointElements.clear();\n'
        + '  }',
      replace: '  private _clearEndpointOwnership(): void {\n'
        + '    this._endpointElements.clear();\n'
        + '  }',
    }],
  },
  {
    id: 'zigbee-topology-overlay-double-live-projection',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'a topology nested under the projected device layer must not receive a second '
      + 'camera transform and drift away during pan or zoom (#464 AC2)',
    patches: [{
      file: 'src/zigbee-topology-overlay-bridge.ts',
      find: '  return html`<hp-zigbee-topology-overlay aria-hidden="true" .hass=${input.hass} .devices=${input.devices}',
      replace: '  return html`<hp-zigbee-topology-overlay aria-hidden="true" data-hp-live-layer="camera" .hass=${input.hass} .devices=${input.devices}',
    }],
  },
  {
    id: 'zigbee-topology-unknown-casing-removed',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'an unknown-LQI dash needs one CSS pixel of dark casing on each side instead of '
      + 'the old low-contrast gray-only stroke (#464 AC3)',
    patches: [{
      file: 'src/hp-zigbee-topology-overlay.ts',
      find: '          stroke-width="4" stroke-dasharray="5 5" stroke-dashoffset="0" opacity=".9"></line>` : nothing}',
      replace: '          stroke-width="2" stroke-dasharray="5 5" stroke-dashoffset="0" opacity=".9"></line>` : nothing}',
    }],
  },
  {
    id: 'zigbee-topology-unknown-casing-gaps-filled',
    guard: 'node demo/smoke_zigbee_topology_hover.mjs',
    because: 'the wider casing must share the core dash rhythm; a solid casing would silently '
      + 'turn the unknown-quality link into a continuous route (#464 AC3)',
    patches: [{
      file: 'src/hp-zigbee-topology-overlay.ts',
      find: '          stroke-width="4" stroke-dasharray="5 5" stroke-dashoffset="0" opacity=".9"></line>` : nothing}',
      replace: '          stroke-width="4" stroke-dasharray="none" stroke-dashoffset="0" opacity=".9"></line>` : nothing}',
    }],
  },
  {
    id: 'zigbee-topology-zha-read-starts-scan',
    guard: 'node --test test/zigbee-topology.test.mjs',
    because: 'hover diagnostics may read the existing ZHA snapshot but must never turn a read '
      + 'into an implicit radio scan (#54 AC4)',
    patches: [{
      file: 'src/zigbee-topology-runtime.ts',
      find: "    return normalizeZhaTopology(await hass.callWS({ type: 'zha/devices' }));",
      replace: "    return normalizeZhaTopology(await hass.callWS({ type: 'zha/topology/update' }));",
    }],
  },
  {
    id: 'zigbee-topology-ambiguous-marker-selected',
    guard: 'node --test test/zigbee-topology.test.mjs',
    because: 'a Zigbee node with multiple drawable placements must fail closed instead of '
      + 'drawing a plausible but false neighbour line (#54 AC8)',
    patches: [{
      file: 'src/zigbee-topology.ts',
      find: '    if (candidates.length === 1) placements.set(node.key, {',
      replace: '    if (candidates.length >= 1) placements.set(node.key, {',
    }],
  },
  {
    id: 'topology-help-renders-without-aria',
    guard: 'node --test --test-name-pattern="кружок справки не рисуется|вызывается из блока" '
      + 'test/zigbee-topology.test.mjs',
    because: 'a help circle that opens without an accessible name is worse than no circle, and '
      + 'topologyT answers a missing key with the key itself — so absence has to be asked of the '
      + 'dictionary, not of the resolved string (#459 AC2)',
    patches: [{
      file: 'src/i18n/topology.ts',
      find: '  const value = DICTIONARIES[lang]?.[key] ?? en[key];',
      replace: '  const value = DICTIONARIES[lang]?.[key] ?? en[key] ?? key;',
    }],
  },
  {
    id: 'topology-help-drops-arrow-legend',
    guard: 'node --test --test-name-pattern="все шесть пунктов легенды|не путь пакета" '
      + 'test/zigbee-topology.test.mjs',
    because: 'a hint that names only colour and dashes passes «the help exists» while answering '
      + 'none of the questions the arrows raise — the very content this task waited for #457 to '
      + 'write (#459 AC3, AC3b)',
    patches: [{
      file: 'src/i18n/topology/ru.json',
      find: ' Стрелка ведёт к следующему устройству по пути к координатору: исходящая одна, входящие — те, кто ходит через это устройство. Линия без стрелки — запасной сосед. Это дерево маршрутов, которое строит House Plan, а не путь пакета в эту секунду: подпись на конце стрелки значит, что цель не на этом плане, а отсутствие стрелки — что путь неизвестен.',
      replace: '',
    }],
  },
  {
    id: 'zigbee-topology-z2m-camelcase-node-rejected',
    guard: 'node --test --test-name-pattern="real anonymized camelCase" test/zigbee-topology.test.mjs',
    because: 'the Zigbee2MQTT raw network-map contract uses ieeeAddr; accepting only the '
      + 'bridge/devices snake_case spelling makes every real scan fail as invalid (#450 AC1)',
    patches: [{
      file: 'src/zigbee-topology.ts',
      find: '    const ieee = normalizeIeee(record?.ieeeAddr ?? record?.ieee_address ?? record?.ieee);',
      replace: '    const ieee = normalizeIeee(record?.ieee_address ?? record?.ieee);',
    }],
  },
  {
    id: 'zigbee-topology-z2m-foreign-response-accepted',
    guard: 'node --test test/zigbee-topology.test.mjs',
    because: 'parallel Zigbee2MQTT requests share one response topic; only the matching '
      + 'transaction may complete this snapshot (#54 AC6)',
    patches: [{
      file: 'src/zigbee-topology-runtime.ts',
      find: '        if (value && transactionOf(value) === transaction) responseResolve?.(value);',
      replace: '        if (value) responseResolve?.(value);',
    }],
  },
  {
    id: 'zigbee-topology-z2m-malformed-response-waits-for-timeout',
    guard: 'node --test --test-name-pattern="malformed response immediately" test/zigbee-topology.test.mjs',
    because: 'a malformed response on the subscribed network-map topic must report invalid payload '
      + 'immediately instead of leaving the settings dialog loading for the full timeout (#54 AC16)',
    patches: [{
      file: 'src/zigbee-topology-runtime.ts',
      find: "        if (value === null) {\n          if (responseActive) responseReject?.(fail('invalid_payload'));\n          return;\n        }",
      replace: '        if (value === null) return;',
    }],
  },
  {
    id: 'zigbee-topology-z2m-subscriptions-leak',
    guard: 'node --test test/zigbee-topology.test.mjs',
    because: 'both MQTT subscriptions must be released after success or failure so one manual '
      + 'refresh cannot leave listeners processing later payloads (#54 AC6)',
    patches: [{
      file: 'src/zigbee-topology-runtime.ts',
      find: '        try { unsubscribe(); } catch { /* cleanup is best effort */ }',
      replace: '        try { void unsubscribe; } catch { /* cleanup is best effort */ }',
    }],
  },
  {
    id: 'zigbee-route-relationship-separators-normalized',
    guard: 'node --test --test-name-pattern="Z2M relationship strings" test/zigbee-topology.test.mjs',
    because: 'provider relationship strings must ignore separators before the parent tie-break '
      + 'uses them (#457 section 6.3 and code-review r1)',
    patches: [{
      file: 'src/zigbee-topology.ts',
      find: "  const compact = value.trim().toLowerCase().replace(/[\\s_-]+/g, '');",
      replace: "  const compact = value.trim().toLowerCase();",
    }],
  },
  {
    id: 'zigbee-route-parent-keeps-bfs-level',
    guard: 'node --test --test-name-pattern="uplink tree is deterministic" test/zigbee-topology.test.mjs',
    because: 'every parent must be one BFS level nearer the coordinator; accepting a same-level '
      + 'neighbour can create a cycle and break the defining #457 AC1 invariant',
    patches: [{
      file: 'src/zigbee-topology.ts',
      find: '      .filter(({ neighborKey }) => distances.get(neighborKey) === distance - 1)',
      replace: '      .filter(({ neighborKey }) => distances.get(neighborKey) === distance)',
    }],
  },
  {
    id: 'zigbee-route-local-arrow-not-inverted',
    guard: 'node --test --test-name-pattern="hover projects local route directions" test/zigbee-topology.test.mjs',
    because: 'the arrow on the hovered device uplink must point to its parent rather than away '
      + 'from the coordinator (#457 AC4)',
    patches: [{
      file: 'src/zigbee-topology.ts',
      find: "      const direction = isParent ? 'toward-neighbor'",
      replace: "      const direction = isParent ? 'toward-origin'",
    }],
  },
  {
    id: 'zigbee-route-parent-not-counted-twice',
    guard: 'node --test --test-name-pattern="hover projects local route directions" test/zigbee-topology.test.mjs',
    because: 'a remote parent already has a named route bubble and must not also inflate the '
      + 'legacy cross-space neighbour count (#457 AC6)',
    patches: [{
      file: 'src/zigbee-topology.ts',
      find: '        if (!isParent) remote.add(other.markerId);',
      replace: '        remote.add(other.markerId);',
    }],
  },
  {
    id: 'double-fit-free-background-owner-removed',
    guard: 'node --test --test-name-pattern="#449 only" test/room-fit.test.mjs',
    because: 'room, device and opening owners must never become a half of the free-background '
      + 'double-fit sequence (#449 AC4–AC5)',
    patches: [{
      file: 'src/room-fit.ts',
      find: "  if (!modality || input.mode !== 'view' || input.owner.kind !== 'background'",
      replace: "  if (!modality || input.mode !== 'view' || false",
    }],
  },
  {
    id: 'double-fit-navigation-block-ignored',
    guard: 'node --test --test-name-pattern="#449 moved" test/room-fit.test.mjs',
    because: 'a pan, pinch, swipe, long press or cancelled pointer must disarm the sequence '
      + 'instead of completing fit-all (#449 AC6)',
    patches: [{
      file: 'src/room-fit.ts',
      find: "      || input.blocked || candidate.pointerId !== input.pointerId",
      replace: '      || candidate.pointerId !== input.pointerId',
    }],
  },
  {
    id: 'double-fit-editor-mode-enabled',
    guard: 'node --test --test-name-pattern="#449 only" test/room-fit.test.mjs',
    because: 'the shortcut belongs only to View and kiosk; editor double-click contracts must '
      + 'remain untouched (#449 AC7)',
    patches: [{
      file: 'src/room-fit.ts',
      find: "!modality || input.mode !== 'view' || input.owner.kind !== 'background'",
      replace: "!modality || input.owner.kind !== 'background'",
    }],
  },
  {
    id: 'double-fit-bypasses-canonical-fit-all',
    guard: 'node demo/smoke_room_fit.mjs',
    because: 'the gesture must share the toolbar command, including far-object framing and '
      + 'room-focus cleanup, rather than resetting only camera zoom (#449 AC1, AC9)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: "    if (doubleFit) this._fitAll('double-tap');",
      replace: "    if (doubleFit) this._resetZoom('double-tap');",
    }],
  },
  {
    id: 'live-editor-view-mode-routes-live',
    guard: 'node --test test/live-editor.test.mjs',
    because: 'View is the product for two of three personas: the live editor path must never '
      + 'take over rendering there, or a plan nobody is editing stops reacting to Home '
      + 'Assistant (#451, #458)',
    patches: [{
      file: 'src/live-editor.ts',
      find: "  if (!host?.isConnected || host._mode === 'view') return false;",
      replace: '  if (!host?.isConnected) return false;',
    }],
  },
  {
    id: 'live-editor-first-gesture-frame-goes-live',
    guard: 'node --test test/live-editor.test.mjs',
    because: 'the first frame of a gesture may change selection and chrome, so it must stay '
      + 'reactive; routing it live leaves the newly selected object drawn in its previous '
      + 'state until the gesture ends (#451, #458)',
    patches: [{
      file: 'src/live-editor.ts',
      find: '  if (name !== undefined && gestureProperties.has(name)\n'
        + '      && oldValue == null\n'
        + '      && (host as unknown as Record<PropertyKey, unknown>)[name] != null\n'
        + '      && activeEditorGesture(host)) {\n'
        + '    // Pointerdown may change selection/chrome once. Subsequent moves stay live.\n'
        + '    return false;\n'
        + '  }\n',
      replace: '',
    }],
  },
  {
    id: 'live-editor-settlement-runs-ahead-of-paint',
    guard: 'node --test --test-name-pattern="live editor settlement waits" test/live-editor.test.mjs',
    because: 'the explicit live-editor barrier must resolve only after the scheduled DOM paint; '
      + 'an eager promise recreates the nondeterministic preview snapshot from #460',
    patches: [{
      file: 'src/live-editor.ts',
      find: '  return new Promise((resolve) => state.waiters.push({ revision, resolve }));',
      replace: '  return Promise.resolve();',
    }],
  },
  {
    id: 'live-editor-smoke-falls-back-to-double-raf',
    guard: 'node --test --test-name-pattern="browser smokes use the explicit" test/live-editor.test.mjs',
    because: 'a fixed number of animation frames is a timing guess, not evidence that the live '
      + 'editor applied its latest projection (#460)',
    patches: [{
      file: 'demo/smoke_furniture.mjs',
      find: '  const settleLive = () => c._editorRuntime?._whenLiveEditorSettled() ?? c.updateComplete;',
      replace: '  const settleLive = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));',
    }],
  },
  {
    id: 'pointer-move-queue-keeps-first-move',
    guard: 'node --test test/live-editor.test.mjs',
    because: 'the coalescing queue is last-wins: keeping the FIRST callback of an event turn '
      + 'means the pointer moves on and the plan paints where the finger used to be (#451, #458)',
    patches: [{
      file: 'src/pointer-move-queue.ts',
      find: '  if (queued) {\n    queued.run = run;\n    return;\n  }',
      replace: '  if (queued) {\n    return;\n  }',
    }],
  },
  {
    id: 'live-hass-tick-never-deferred',
    guard: 'node --test test/houseplan-render-lifecycle.test.mjs',
    because: 'a state tick arriving mid-gesture is deferred on purpose; rendering it '
      + 'immediately drops frames of the gesture the user is performing, and the deferral flag '
      + 'is what guarantees the skipped tick is replayed afterwards (#451, #458)',
    patches: [{
      file: 'src/live-interaction-runtime.ts',
      find: "    const defer = change === 'state' && this.active();",
      replace: '    const defer = false;',
    }],
  },
  {
    id: 'live-viewport-identity-projection-not-recognized',
    guard: 'node --test test/live-viewport.test.mjs',
    because: 'a settled viewport must be recognized as identity and leave NO compositor '
      + 'transform: an identity transform still switches the browser compositing path and '
      + 'shifts the settled raster by a few colour levels, which is exactly what makes golden '
      + 'frames flap (#451, #458)',
    patches: [{
      file: 'src/live-viewport.ts',
      // Первая редакция этого мутанта снимала `setLayerProjection(layer, null)`
      // из `commitHouseplanViewport` (так предлагал issue) — и тест оставался
      // ЗЕЛЁНЫМ: следом идёт `paintLiveViewport(root, painted, painted)`, а он
      // на равных аргументах даёт identity и обнуляет проекцию сам. То есть тот
      // цикл не контракт, а подстраховка. Настоящий контракт — распознавание
      // identity, и мутируется именно оно.
      find: '  projection.translateXPercent === 0',
      replace: '  projection.translateXPercent === 1',
    }],
  },
  {
    id: 'render-invalidation-unknown-key-ignored',
    guard: 'node --test test/render-invalidation.test.mjs',
    because: 'the classifier fails OPEN on Home Assistant keys it does not know: without that '
      + 'rule a new HA capability silently leaves the plan stale, and a stale plan looks '
      + 'exactly like a working one (#451, #458)',
    patches: [{
      file: 'src/render-invalidation.ts',
      find: '  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {\n'
        + "    if (!compared.has(key) && before[key] !== after[key]) return 'structural';\n"
        + '  }\n',
      replace: '',
    }],
  },
  {
    id: 'resize-live-preflight-keeps-every-room',
    guard: 'node --test test/resize-controller.test.mjs',
    because: 'live resize checks only the rooms the gesture touches; widening that to the whole '
      + 'plan turns every frame into a full-plan geometry check and the drag stutters on large '
      + 'plans — the very regression #451 removed (#458)',
    patches: [{
      file: 'src/resize-live-preflight.ts',
      find: '    return id && changed.has(id) ? [id] : [];',
      replace: '    return id ? [id] : [];',
    }],
  },
  {
    id: 'render-lifecycle-diagnostics-cache-never-invalidated',
    guard: 'node --test test/houseplan-render-lifecycle.test.mjs',
    because: 'the diagnostics cache must drop when the registry or a tracked state appears or '
      + 'disappears; a cache that never invalidates reports yesterday binding health as todays '
      + 'and the red dot for a silently added device never lights (#451, #458)',
    patches: [{
      file: 'src/houseplan-render-lifecycle.ts',
      find: '    if (!this.diagnosticsCache) return;\n',
      replace: '    if (!this.diagnosticsCache) return;\n    if (true) return;\n',
    }],
  },
  {
    id: 'iso-placement-cache-ignores-selected',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#473 W1" test/iso-scene-render.test.mjs',
    because: 'a selected plate must resolve its own placement; a signature without `selected` '
      + 'hands back the unselected cached one — a stale picture with no failure (#473, perf delta of #160)',
    patches: [{
      file: 'src/iso-scene-render.ts',
      find: "      input.layers.shadows ? 1 : 0, selected ? 1 : 0].join('|');",
      replace: "      input.layers.shadows ? 1 : 0].join('|');",
    }],
  },
  {
    id: 'iso-placement-cache-survives-silhouette-change',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#473 W2" test/iso-scene-render.test.mjs',
    because: 'placements are cached per wall-silhouette array identity; keying the cache by a '
      + 'constant serves «near the wall» for a plan whose wall is gone (#473)',
    patches: [{
      file: 'src/iso-scene-render.ts',
      find: '  let placements = isoOverlayPlacementCache.get(input.wallSilhouettes);',
      replace: '  let placements = isoOverlayPlacementCache.get(ISO_PLACEMENT_CACHE_ANY);',
    }, {
      file: 'src/iso-scene-render.ts',
      find: '    isoOverlayPlacementCache.set(input.wallSilhouettes, placements);',
      replace: '    isoOverlayPlacementCache.set(ISO_PLACEMENT_CACHE_ANY, placements);',
    }, {
      file: 'src/iso-scene-render.ts',
      find: 'export const ISO_OVERLAY_PLACEMENT_CACHE_LIMIT = 2048;',
      replace: 'export const ISO_OVERLAY_PLACEMENT_CACHE_LIMIT = 2048;\nconst ISO_PLACEMENT_CACHE_ANY: readonly IsoWallSilhouette[] = [];',
    }],
  },
  {
    id: 'iso-zoom-in-reuses-near-wall-plate',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#473 W3" test/iso-scene-render.test.mjs',
    because: 'zoom-in may reuse a placement only if the plate was never near a wall or was '
      + 'cleared within the cap; dropping the first guard reuses a pinned plate at a scale where it '
      + 'already cuts the wall (#473)',
    patches: [{
      file: 'src/iso-scene-render.ts',
      find: '      if (!previous.nearWallBefore',
      replace: '      if (true',
    }],
  },
  // #474: designer furniture artwork is a lazy chunk. Each protective contract
  // of the runtime and its integration gets one witness.
  {
    id: 'furniture-art-eager-import',
    guard: 'npm run build && node scripts/bundle-budget.mjs',
    because: 'a static import of the artwork anywhere in the View graph silently pulls ~10 KB gzip '
      + 'back into the initial graph — the exact debt #474 removes; the budget must see the chunk as lazy',
    patches: [{
      file: 'src/furniture.ts',
      find: "import { FURNITURE_ART_RUNTIME, type FurnitureArtHost } from './furniture-art-runtime';",
      replace: "import { FURNITURE_ART_RUNTIME, type FurnitureArtHost } from './furniture-art-runtime';\n"
        + "import './furniture-plan-art.generated';  // mutant: eager artwork",
    }],
  },
  {
    id: 'furniture-art-fallback-never-settles',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="settle into fallback" test/furniture-art-runtime.test.mjs',
    because: 'fallback must be a SETTLED state: a runtime that stays pending after two failed attempts '
      + 'keeps the boot gate waiting and re-imports forever (#352–#355 class)',
    patches: [{
      file: 'src/furniture-art-runtime.ts',
      find: '    if (this._art) return;\n    this._failed = true;',
      replace: '    if (this._art) return;\n    this._failed = false;  // mutant: never settle',
    }],
  },
  {
    id: 'furniture-art-no-retry-nonce',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="first attempt failing and the second succeeding" test/furniture-art-runtime.test.mjs',
    because: 'Chromium caches a failed module forever; the second attempt must be a different URL '
      + 'and must exist at all — a single attempt turns every transient failure into fallback',
    patches: [{
      file: 'src/furniture-art-runtime.ts',
      find: '    for (const attempt of [0, 1] as const) {\n      try {\n        const module = await this.options.load(attempt);',
      replace: '    for (const attempt of [0] as const) {\n      try {\n        const module = await this.options.load(attempt);',
    }],
  },
  {
    id: 'furniture-art-boot-gate-ignored',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="boot gate waits only while pending" test/furniture-art-runtime.test.mjs',
    because: 'the boot veil must hold while a plan with furniture waits for its artwork; a gate that '
      + 'never reports pending lets the first revealed frame miss every piece (#474 AC2)',
    patches: [{
      file: 'src/furniture-art-runtime.ts',
      find: "  return runtime.state() === 'pending' && configNeedsFurnitureArt(config, isDesigner);",
      replace: '  return false;  // mutant: veil never waits for artwork',
    }],
  },
  {
    id: 'furniture-placement-needs-art',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="wall magnet places a designer piece" test/furniture-art-runtime.test.mjs',
    because: 'the magnet needs the catalogue, not the artwork: checking the artwork refuses every '
      + 'designer placement while the chunk is pending (#474 AC6)',
    patches: [{
      file: 'src/furniture-placement.ts',
      find: '  if (!furnitureSymbol(symbol) || !(canvasW > 0) || !(canvasH > 0)',
      replace: "  if (!(furnitureSymbol(symbol) && (furnitureSymbol(symbol)?.g || FURNITURE_ART_RUNTIME.art(symbol))) || !(canvasW > 0) || !(canvasH > 0)",
    }, {
      file: 'src/furniture-placement.ts',
      find: "import { clampFurnSize, cmToNorm, furnitureSymbol } from './furniture';",
      replace: "import { clampFurnSize, cmToNorm, furnitureSymbol } from './furniture';\nimport { FURNITURE_ART_RUNTIME } from './furniture-art-runtime';",
    }],
  },
  {
    id: 'furniture-art-fingerprint-unchecked',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="foreign build fingerprint is terminal|adopt is synchronous, rejects" test/furniture-art-runtime.test.mjs',
    because: 'artwork from another build must be rejected on both paths (load and adopt): a stale '
      + 'chunk half-applied to a newer card is the #353 failure mode',
    patches: [{
      file: 'src/furniture-art-runtime.ts',
      find: '        if (module.FURNITURE_ART_FINGERPRINT !== this.options.expectedFingerprint) {',
      replace: '        if (false) {  // mutant: any build will do',
    }, {
      file: 'src/furniture-art-runtime.ts',
      find: '    if (fingerprint !== this.options.expectedFingerprint) {',
      replace: '    if (false) {  // mutant: any build will do',
    }],
  },
  {
    id: 'furniture-art-editor-adopt-skipped',
    guard: 'npm run bundle:sync && node demo/smoke_furniture.mjs',
    because: 'the editor imports the artwork statically and must hand it over synchronously; without '
      + 'adopt the palette previews and the placement ghost render empty on a plan without furniture (#474 r1)',
    patches: [{
      file: 'src/houseplan-editor-runtime.ts',
      find: 'FURNITURE_ART_RUNTIME.adopt(GENERATED_FURNITURE_ART, FURNITURE_ART_FINGERPRINT);',
      replace: 'void [FURNITURE_ART_RUNTIME, GENERATED_FURNITURE_ART, FURNITURE_ART_FINGERPRINT];  // mutant: no handover',
    }],
  },
  {
    id: 'iso-aabb-rejects-touching-wall',
    guard: 'npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs '
      + '&& node --test --test-name-pattern="#473 W4" test/iso-scene-render.test.mjs',
    because: 'the AABB pre-check must keep every silhouette within the safety gap; a strict '
      + 'overlap test drops walls the exact test would have caught and lets plates sit flush (#473)',
    patches: [{
      file: 'src/iso-overlays.ts',
      find: '  return a[0] <= b[2] + gap && a[2] >= b[0] - gap\n'
        + '    && a[1] <= b[3] + gap && a[3] >= b[1] - gap;',
      replace: '  return a[0] <= b[2] && a[2] >= b[0]\n'
        + '    && a[1] <= b[3] && a[3] >= b[1];',
    }],
  },
  {
    id: 'stage3-w1-camera-rotation-reset',
    guard: 'node --test --test-name-pattern="exact fixed" test/iso-projection.test.mjs',
    because: 'W1: the reviewed Stage 3 camera is exactly +4 degrees; a front-on camera must '
      + 'fail the exact projection contract (#160)',
    patches: [{
      file: 'src/iso-projection.ts',
      find: '  rotDeg: 4,\n',
      replace: '  rotDeg: 0,\n',
    }],
  },
  {
    id: 'stage3-w2-room-label-left-on-floor',
    guard: 'node --test --test-name-pattern="exact D2 overlay matrix" test/iso-overlays.test.mjs',
    because: 'W2: room labels/cards and value-bearing device roots belong to the raised plane; '
      + 'the D2 matrix must reject a floor-plane room label (#160)',
    patches: [{
      file: 'src/iso-overlays.ts',
      find: "  return showBorders && (kind === 'device' || kind === 'room-label' || kind === 'opening-lock')\n"
        + "    ? 'raised' : 'floor';",
      replace: "  return showBorders && (kind === 'device' || kind === 'opening-lock')\n"
        + "    ? 'raised' : 'floor';",
    }],
  },
  {
    id: 'stage3-w3-vacuum-raised-with-devices',
    guard: 'node --test --test-name-pattern="raises only device" test/isometric-contract.test.mjs',
    because: 'W3: the live vacuum puck/trail stays on the floor even while device, room and lock '
      + 'roots are raised (#160)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '      const point = this._scenePoint([cx, cy]);',
      replace: "      const point = this._renderProjection === 'iso'\n"
        + '        ? projectPlanPoint([cx, cy], gridVisualUnits(68, this._cellCm))\n'
        + '        : [cx, cy] as ScenePoint;',
    }],
  },
  {
    id: 'stage3-w4-device-target-loses-44px-floor',
    guard: 'node demo/smoke_isometric_contract.mjs',
    because: 'W4: the raised interactive root must own an actual 44 by 44 CSS-pixel hit target '
      + 'on both fine and coarse pointers (#160)',
    patches: [{
      file: 'src/styles/devices.styles.ts',
      find: '      width: max(44px, var(--device-shell-size));\n'
        + '      height: max(44px, var(--device-shell-size));',
      replace: '      width: var(--device-shell-size);\n'
        + '      height: var(--device-shell-size);',
    }],
  },
  {
    id: 'stage3-w5-runtime-nudge-writes-storage',
    guard: 'node demo/smoke_isometric_live_touch.mjs',
    because: 'W5: runtime nudge is presentation-only and must never write config, layout or '
      + 'browser storage (#160)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    return runtime.buildIsoOverlayRenderScene({',
      replace: "    localStorage.setItem('houseplan_stage3_nudge_mutant', space.id);\n"
        + '    return runtime.buildIsoOverlayRenderScene({',
    }],
  },
  {
    id: 'stage3-w6-no-borders-keeps-raised-plates',
    guard: 'node demo/smoke_isometric_live_touch.mjs',
    because: 'W6: show_borders:false is a true affine floor with no volume, raised plate, '
      + 'ground or tether layers (#160)',
    patches: [{
      file: 'src/houseplan-card.ts',
      find: '    if (!runtime || !layers?.structural || !structural) return null;',
      replace: '    if (!runtime || !layers || (!structural && disp.showBorders)) return null;',
    }, {
      file: 'src/houseplan-card.ts',
      find: '      wallSilhouettes: structural.wallSilhouettes,',
      replace: '      wallSilhouettes: structural?.wallSilhouettes ?? [],',
    }],
  },
  {
    id: 'stage3-w7-sun-state-enters-structural-key',
    guard: 'node demo/smoke_isometric_live_touch.mjs',
    because: 'W7: HA sun state is live paint and must not enter the structural fingerprint or '
      + 'cause topology rebuilds (#160)',
    patches: [{
      file: 'src/iso-scene-render.ts',
      find: '  onBuild(): void;\n}',
      replace: '  onBuild(): void;\n  liveFingerprint?: string;\n}',
    }, {
      file: 'src/iso-scene-render.ts',
      find: '    algorithm: 4,\n  })}`;',
      replace: '    algorithm: 4,\n  })}|${input.liveFingerprint ?? \'\'}`;',
    }, {
      file: 'src/houseplan-card.ts',
      find: '      onBuild: () => { this._isoStructuralBuildCount += 1; },',
      replace: "      liveFingerprint: JSON.stringify(this.hass?.states?.['sun.sun'] ?? null),\n"
        + '      onBuild: () => { this._isoStructuralBuildCount += 1; },',
    }],
  },
  {
    id: 'stage3-w8-material-defs-created-per-face',
    guard: 'node demo/smoke_isometric_contract.mjs',
    because: 'W8: Stage 3 material patterns and filters are shared O(1) definitions, never '
      + 'replicated for every face or marker (#160)',
    patches: [{
      file: 'src/iso-scene-render.ts',
      find: '          return svg`<path class="iso-wall-top" d=${face.d} data-component=${face.component}\n'
        + '            fill-rule="evenodd"></path>${layers.materialNuance',
      replace: '          return svg`${renderIsoDefs(layers, \'walls\', cellCm)}<path class="iso-wall-top" d=${face.d} data-component=${face.component}\n'
        + '            fill-rule="evenodd"></path>${layers.materialNuance',
    }],
  },
  {
    id: 'stage3-w9-gate-face-flip-reversed',
    guard: 'node --test --test-name-pattern="gate flips move unhosted structural face" '
      + 'test/iso-scene-render.test.mjs',
    because: 'W9: door/gate hinge and face basis must retain the reviewed flip convention '
      + 'independently of live leaf state (#160)',
    patches: [{
      file: 'src/iso-scene-render.ts',
      find: "        const faceFlipV = opening.type === 'gate' ? !opening.flipV : opening.flipV;",
      replace: "        const faceFlipV = opening.flipV;",
    }],
  },
  {
    id: 'stage3-w10-flat-fallback-counted-as-success',
    guard: 'node --test --test-name-pattern="runner fails closed" test/performance-workflow.test.mjs',
    because: 'W10: a dense benchmark sample in Flat fallback is invalid evidence and must fail '
      + 'before timings are accepted (#160)',
    patches: [{
      file: 'demo/benchmark_large_house.mjs',
      find: "        if (snapshot.effectiveProjection !== 'iso') failures.push('effective projection is not iso');",
      replace: "        if (false && snapshot.effectiveProjection !== 'iso') failures.push('effective projection is not iso');",
    }],
  },
  {
    id: 'stage3-w11-nudged-overlay-loses-tether',
    guard: 'node --test --test-name-pattern="wall-aware nudge" test/iso-overlays.test.mjs',
    because: 'W11: every non-zero nudge keeps a tether back to its immutable floor owner '
      + 'anchor (#160)',
    patches: [{
      file: 'src/iso-overlays.ts',
      find: '  const tetherVisible = nudged || nearWallBefore || nearWallAfter\n'
        + '    || !!input.hovered || !!input.focused || !!input.selected;',
      replace: '  const tetherVisible = !nudged && (nearWallBefore || nearWallAfter\n'
        + '    || !!input.hovered || !!input.focused || !!input.selected);',
    }],
  },
  {
    id: 'stage3-w12-separate-alpha-url-key-restored',
    guard: 'node --test --test-name-pattern="Labs iso is presentation-only" '
      + 'test/isometric-contract.test.mjs',
    because: 'W12: Stage 3 shares the one permanent hp_alpha switch; a feature-specific URL '
      + 'key or expiry must not return (#160)',
    patches: [{
      file: 'src/labs.ts',
      find: "params.getAll('hp_alpha')",
      replace: "params.getAll('hp_alpha_stage3')",
    }],
  },
  {
    id: 'color-picker-invalid-confirm-latch-removed',
    guard: 'node demo/smoke_color_picker.mjs',
    because: 'after an invalid HEX draft is normalized for display, repeated confirmation must '
      + 'still wait for a new valid input event; only the real picker lifecycle proves that the '
      + 'normalized fallback cannot bypass the #476 validation latch',
    patches: [{
      file: 'src/hp-color-opacity.ts',
      find: '    if (this._hexNeedsValidInput) {\n'
        + '      this._hexInvalid = true;\n'
        + '      return;\n'
        + '    }',
      replace: '    if (false) {\n'
        + '      this._hexInvalid = true;\n'
        + '      return;\n'
        + '    }',
    }],
  },
  {
    id: 'color-picker-confirm-click-through',
    guard: 'node demo/smoke_color_picker_consumers.mjs',
    because: 'the full-width confirmation inside a general-settings dialog must consume its own '
      + 'click before it reaches the picker surface; observing that direct ancestor keeps outer '
      + 'toolbar and modal stoppers from hiding removal of the #476 picker-level defense',
    patches: [{
      file: 'src/hp-color-opacity.ts',
      find: '  private _confirm(event: Event): void {\n'
        + '    event.preventDefault();\n'
        + '    event.stopPropagation();',
      replace: '  private _confirm(event: Event): void {\n'
        + '    event.preventDefault();',
    }],
  },
];

const mutationCardSource = readFileSync(join(repoRoot, 'src/houseplan-card.ts'), 'utf8');
const mutationEditorSource = readFileSync(join(repoRoot, 'src/houseplan-editor-runtime.ts'), 'utf8');
export const MUTANTS = MUTANT_DEFINITIONS.map((mutant) => ({
  ...mutant,
  patches: mutant.patches.map((patch) => relocateEditorPatch(
    patch, mutationCardSource, mutationEditorSource,
  )),
}));

// --- механика ---------------------------------------------------------------

export function applyPatches(root, patches) {
  for (const patch of patches) {
    const path = join(root, patch.file);
    const source = readFileSync(path, 'utf8');
    const hits = source.split(patch.find).length - 1;
    if (hits !== 1) {
      throw new Error(`${patch.file}: якорь найден ${hits} раз(а), нужен ровно 1 — реестр отстал от кода`);
    }
    writeFileSync(path, source.replace(patch.find, patch.replace));
  }
}

function sh(cmd, cwd, extraEnv = {}) {
  return spawnSync(cmd, {
    cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
}

function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), 'hp-mutant-'));
  const added = spawnSync('git', ['-C', repoRoot, 'worktree', 'add', '--detach', dir, 'HEAD'],
    { encoding: 'utf8' });
  if (added.status !== 0) throw new Error(`git worktree add: ${added.stderr}`);
  // node_modules не копируется — символическая ссылка на настоящий. Установка
  // зависимостей на каждого мутанта превратила бы вечерний гейт в суточный.
  symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'), 'junction');
  return dir;
}

function dropWorktree(dir) {
  // On Windows a directory junction can be traversed by recursive worktree
  // cleanup. Detach it first; otherwise removing the mutant may empty the real
  // repository's node_modules target instead of deleting only the junction.
  const modules = join(dir, 'node_modules');
  if (existsSync(modules)) unlinkSync(modules);
  spawnSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', dir], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Нужен ли гварду скомпилированный `test-build/` (#235).
 *
 * Гварды в реестре двух видов: длинные сами начинаются с
 * `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`, короткие —
 * сразу с `node --test`. В свежем worktree каталога `test-build/` нет вообще,
 * поэтому короткий гвард падал с `ERR_MODULE_NOT_FOUND` — и это читалось как
 * «мутант поймал поломку», хотя означало «гвард не смог исполниться». Компиляция
 * стоит секунд, поэтому шаг ставится только там, где гвард не делает его сам.
 */
export function guardNeedsTestBuild(guard) {
  return /(^|[\s&|;])node --test\b/.test(guard) && !guard.includes('tsconfig.test.json');
}

/**
 * Нужен ли гварду СОБРАННЫЙ бандл (#332).
 *
 * Бандл читают только браузерные проверки: смоки и golden-сцены грузят
 * дерево `demo/srv/assets/`, и мутант обязан попасть в entry и lazy chunks,
 * иначе
 * guard проверяет чистый код. Юнит- и бэкенд-гварды бандл не открывают ни в
 * каком виде (проверено по реестру и по исходникам тестов: dist/** читается
 * только как git-чекаут, который в worktree и так есть). Rollup-сборка —
 * самая дорогая часть прогона (255 мутантов × ~15-20 с), поэтому она
 * выполняется только там, где её результат кто-то откроет.
 */
export function guardNeedsBundle(guard) {
  return guard.includes('demo/') || guard.includes('bundle:sync');
}

/**
 * Тёплый старт компиляции мутанта (#332): скопировать `test-build/` вместе с
 * `.tsbuildinfo` из основного дерева. Мутант меняет один-два файла, и
 * инкрементальный tsc пересобирает только их дельту вместо всего проекта;
 * `.tsbuildinfo` сверяет файлы по хэшу содержимого, поэтому свежие mtime
 * worktree его не сбивают, а мутированный файл гарантированно пересобирается.
 * Отсутствие каталога в основном дереве — не ошибка: холодная сборка просто
 * идёт прежним полным путём.
 */
function seedTestBuild(dir) {
  const warm = join(repoRoot, 'test-build');
  if (!existsSync(warm)) return;
  cpSync(warm, join(dir, 'test-build'), { recursive: true });
}

/**
 * Собрать `test-build/` из мутированного src в каталоге мутанта.
 *
 * Код выхода `tsc` игнорируется сознательно, по той же причине, что и в
 * `buildBundle`: мутант воспроизводит поломку, а не образцовый код, и имеет
 * право быть нестрогим по типам. Доказательством служит появление каталога —
 * если его нет, падаем громко, а не отдаём тесту пустоту.
 */
function buildTestBuild(dir) {
  seedTestBuild(dir);
  sh('npx tsc -p tsconfig.test.json', dir);
  const fixed = sh('node scripts/fix-test-build.mjs', dir);
  if (!existsSync(join(dir, 'test-build'))) {
    throw new Error(`test-build не собрался в мутанте:\n${(fixed.stderr || fixed.stdout).slice(-2000)}`);
  }
}

function buildBundle(dir) {
  // Только rollup, без tsc --noEmit: мутант имеет право быть нестрогим по
  // типам — он воспроизводит поломку, а не образцовый код.
  const built = sh('npx rollup -c', dir);
  if (built.status !== 0) {
    throw new Error(`сборка мутанта упала:\n${(built.stderr || built.stdout).slice(-2000)}`);
  }
  const synced = sh('node scripts/bundle-sync.mjs', dir);
  if (synced.status !== 0) {
    throw new Error(`дерево бандла мутанта не синхронизировалось:\n${(synced.stderr || synced.stdout).slice(-2000)}`);
  }
}

function runMutant(mutant) {
  const dir = makeWorktree();
  try {
    applyPatches(dir, mutant.patches);
    if (guardNeedsBundle(mutant.guard)) buildBundle(dir);
    if (guardNeedsTestBuild(mutant.guard)) buildTestBuild(dir);
    const guard = sh(mutant.guard, dir);
    if (guard.status === 0) {
      console.log(`FAIL ${mutant.id}: тест остался зелёным на сломанном коде`);
      console.log(`     guard: ${mutant.guard}`);
      console.log(`     ${mutant.because}`);
      return false;
    }
    console.log(`ok   ${mutant.id}: тест покраснел, как обязан`);
    return true;
  } finally {
    dropWorktree(dir);
  }
}

// Чистый прогон каждого guard ровно один раз: тест, красный и без мутанта,
// «ловит» поломку тривиально и не доказывает ничего.
function runCleanGuards(mutants) {
  const guards = [...new Set(mutants.map((m) => m.guard))];
  const dir = makeWorktree();
  try {
    if (guards.some(guardNeedsBundle)) buildBundle(dir);
    // Один worktree на все чистые гварды — значит и компиляция одна.
    if (guards.some(guardNeedsTestBuild)) buildTestBuild(dir);
    for (const guard of guards) {
      const result = sh(guard, dir);
      if (result.status !== 0) {
        console.log(`FAIL чистый прогон: ${guard} красный без мутанта`);
        console.log((result.stderr || result.stdout).slice(-1500));
        return false;
      }
      console.log(`ok   чистый прогон: ${guard}`);
    }
    return true;
  } finally {
    dropWorktree(dir);
  }
}

/**
 * Мутанты, чьи патч-файлы задеты диффом (#332). Дифф-режим — для локальной
 * проверки и ревью-циклов; полный набор остаётся предрелизным контрактом,
 * поэтому пустая выборка — честный успех с явным сообщением, а не ошибка.
 */
export function selectChangedMutants(mutants, changedFiles) {
  const changed = new Set(changedFiles);
  return mutants.filter((m) => m.patches.some((patch) => changed.has(patch.file)));
}

/**
 * Детерминированный шард `index/total` (#332): реестр сортируется по id и
 * режется чересполосно, чтобы дорогие смок-мутанты (соседи по алфавиту)
 * не скапливались в одном шарде. Объединение шардов равно реестру,
 * пересечений нет — закреплено юнитом.
 */
export function shardMutants(mutants, index, total) {
  const ordered = [...mutants].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.filter((_, position) => position % total === index - 1);
}

function main(argv) {
  const idArg = argv.find((a) => a.startsWith('--id='))?.slice(5);
  let selected = idArg ? MUTANTS.filter((m) => m.id === idArg) : MUTANTS;
  if (idArg && !selected.length) {
    console.error(`мутант «${idArg}» не объявлен; --list покажет реестр`);
    return 2;
  }

  const changedArg = argv.find((a) => a === '--changed' || a.startsWith('--changed='));
  if (changedArg) {
    const range = changedArg.includes('=') ? changedArg.split('=')[1] : 'origin/dev..HEAD';
    const diff = spawnSync('git', ['-C', repoRoot, 'diff', '--name-only', range],
      { encoding: 'utf8' });
    if (diff.status !== 0) {
      console.error(`git diff ${range} не удался:\n${diff.stderr}`);
      return 2;
    }
    const files = diff.stdout.split('\n').filter(Boolean);
    const before = selected.length;
    selected = selectChangedMutants(selected, files);
    console.log(`дифф-режим ${range}: файлов в диффе ${files.length}, `
      + `мутантов затронуто ${selected.length} из ${before}`);
    if (!selected.length) {
      console.log('дифф не задевает ни одного patch.file — гонять нечего; '
        + 'полный реестр остаётся предрелизным контрактом');
      return 0;
    }
  }

  const shardArg = argv.find((a) => a.startsWith('--shard='))?.slice(8);
  if (shardArg) {
    const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(shardArg);
    if (!match || Number(match[1]) > Number(match[2])) {
      console.error(`--shard ожидает i/n с 1 <= i <= n, получено «${shardArg}»`);
      return 2;
    }
    const before = selected.length;
    selected = shardMutants(selected, Number(match[1]), Number(match[2]));
    console.log(`шард ${shardArg}: ${selected.length} из ${before} мутантов`);
  }

  if (argv.includes('--list')) {
    for (const m of MUTANTS) console.log(`${m.id}\n  guard: ${m.guard}\n  ${m.because}\n`);
    return 0;
  }

  if (argv.includes('--check')) {
    let stale = 0;
    for (const m of selected) {
      try {
        for (const patch of m.patches) {
          const source = readFileSync(join(repoRoot, patch.file), 'utf8');
          const hits = source.split(patch.find).length - 1;
          if (hits !== 1) throw new Error(`якорь найден ${hits} раз(а)`);
        }
        console.log(`ok   ${m.id}`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        stale++;
      }
    }
    return stale ? 2 : 0;
  }

  if (argv.includes('--build-only')) {
    for (const m of selected) {
      const dir = makeWorktree();
      try {
        applyPatches(dir, m.patches);
        buildBundle(dir);
        console.log(`ok   ${m.id}: патч лёг, бандл собрался`);
      } catch (error) {
        console.log(`FAIL ${m.id}: ${error.message}`);
        return 2;
      } finally {
        dropWorktree(dir);
      }
    }
    return 0;
  }

  if (!runCleanGuards(selected)) return 2;
  let caught = 0;
  for (const m of selected) if (runMutant(m)) caught++;
  console.log(`\nпоймано ${caught} из ${selected.length}`);
  return caught === selected.length ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
