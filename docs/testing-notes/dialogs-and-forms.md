# Диалоги, формы и сводная панель

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

## Вопрос о несохранённых настройках (#610)

- [ ] В русской локали четыре формы настроек показывают **Вернуться** и
      **Не сохранять**: первая кнопка сохраняет черновик, вторая закрывает
      форму без сохранения [auto: `demo/smoke_discard_copy.mjs`].
- [ ] Заголовок и кнопка потери черновика используют
      `mdi:content-save-off-outline`; обычный warning без override сохраняет
      иконки открытого замка [auto: `demo/smoke_discard_copy.mjs`; mutation:
      `discard-confirm-action-icon-falls-back-to-lock`].
- [ ] RU/EN/DE/FR на 320–640 px, light/dark и DPR 1/2 сохраняют одну строку,
      полный текст, безопасный autofocus и возврат к форме
      [auto: `demo/smoke_dialog_polish_603.mjs`].

## Числовые поля со слайдером (#608)

- [ ] В настройках комнаты поле размера имени принимает `120` посимвольно:
      до выхода из поля черновик и слайдер остаются на прежнем значении, после
      выхода оба показывают 120; очистка поля возвращает последнее
      подтверждённое значение [auto: `demo/smoke_range_line_draft.mjs`].
- [ ] В настройках пространства `123` становится 125 только после завершения
      ввода; движение слайдера во время незавершённого ввода отбрасывает текст
      и сразу синхронизирует поле [auto: `demo/smoke_range_line_draft.mjs`,
      `demo/smoke_dialog_config_parity.mjs`].
- [ ] Возврат раннего clamp на каждом `input` делает свидетель красным
      [mutation: `range-line-clamps-every-keystroke`].

## Toggle confirmation state (#103)

- [ ] Every executable `ToggleNextEffect` formats current and expected lines
      without deriving direction from the state label; `toggle` names Home
      Assistant as the authority and a no-operation intent produces no lines
      [unit: `device-toggle.test.mjs`].
- [ ] All-off/mixed/partial groups use only executable targets for their
      active/total count and show skipped targets as a separate line
      [unit: `device-toggle.test.mjs`].
- [ ] EN/RU confirmation renders prompt → current → expected → skipped before
      the buttons, wraps a long name at 390 px and has no horizontal scroll
      [auto: `smoke_toggle_confirmation.mjs`].
- [ ] A state race with the same target executes the newly resolved direction;
      a changed target set makes zero service calls and shows the existing
      retry toast [auto: `smoke_toggle_confirmation.mjs`].
- [ ] Cover, virtual-light, HA-control and Run confirmations keep their
      existing actuation/cancel contracts [auto: `smoke_cover_tap`,
      `smoke_virtual_light_toggle`, `smoke_ha_controls`, `smoke_controls`,
      `smoke_tap_run`].

## Unified color and opacity picker (#57)

- [ ] RGB↔HSV round trips stay within one RGB channel; 3/6-digit HEX input is
      normalized and invalid drafts never become persisted colors
      [unit: `color-picker.test.mjs`].
- [ ] Every existing `hp-color-opacity` consumer receives per-card localized
      labels through the unchanged color/opacity event contract, and the shared
      component contains no native `input[type=color]`
      [unit: `color-picker.test.mjs`].
- [ ] The localized full-width OK button is the final picker control, remains at
      least 40 CSS px high in native and fallback surfaces, and closes without a
      duplicate value event or click-through to the parent card
      [unit: `color-picker.test.mjs`, auto: `smoke_color_picker.mjs`,
      `smoke_help_affordance.mjs`].
- [ ] Invalid HEX keeps the picker open and focused on its error even after a
      repeated OK; only new valid HEX input unlocks confirmation, while live
      color/opacity updates and the existing outside/trigger/Escape close paths
      retain their values [auto: `smoke_color_picker.mjs`].
- [ ] At 390 px the one surface exposes hue, saturation, brightness, HEX and
      opacity without horizontal overflow; keyboard Shift+Arrow, touch pointer
      cancellation, invalid HEX recovery, Escape focus return and disabled mode
      remain safe [auto: `smoke_color_picker.mjs`].
- [ ] The color-only Glow consumer keeps the same picker without an opacity row,
      and native/fallback floating surfaces remain mutually exclusive with help
      [auto: `smoke_help_affordance.mjs`].
- [ ] The Hue range keeps `0…359`, step 1 and its existing input events while its
      WebKit/Blink and Gecko tracks expose the same cyclic spectrum. A dual
      theme-aware ring keeps the native thumb distinct from every hue, while
      forced-colors falls back to system track/thumb rendering [unit:
      `color-picker.test.mjs`, auto: `smoke_color_picker.mjs`].
- [ ] The dark mobile and light desktop open-picker goldens are reviewed from the
      complete Linux artifact before a beta; baseline acceptance is not part of
      the implementation loop [golden: `decor-color-popover-mobile-ru`,
      `decor-color-popover-desktop-en`].

## Unified picker coverage for every color field (#180)

- [ ] A recursive source contract rejects every native `input[type=color]` in
      product TypeScript and fixes the complete shared-component inventory at
      13 template instances [unit: `color-picker.test.mjs`].
- [ ] The 11 general light/temperature/LQI/Glow/wall palettes and the space room
      colour move their existing opacity into the unified picker; color and
      alpha update one parent draft atomically [unit: `color-picker.test.mjs`,
      auto: `smoke_color_picker_consumers.mjs`].
- [ ] Global background, space background and activity ripple are color-only;
      opening/closing does not materialize an inherited/default value, and
      Default/Inherit restore `null` without adding alpha
      [auto: `smoke_color_picker_consumers.mjs`].
- [ ] General settings keep one exclusive picker open among 12 swatches; marker
      activity colour and ripple size use separate, non-overlapping mobile rows,
      ripple size remains independent, and cancelling the space dialog writes
      no color draft [unit: `color-picker.test.mjs`, auto:
      `smoke_color_picker_consumers.mjs`].
- [ ] The three new dialog families are reviewed from the complete Linux
      artifact before a beta; implementation does not accept their baselines
      [golden: `general-color-popover-desktop-en`,
      `device-ripple-color-popover-mobile-ru`,
      `space-room-color-popover-desktop-ru`].

## Contextual help (issues #68 and #86)

- [ ] A setting with complete EN/RU/DE/FR help body and ARIA copy shows one 32 px
      desktop / 40 px coarse-pointer button with the outlined circled-question
      icon. Mouse hover, keyboard focus and tap open the same text surface
      [auto: `smoke_help_affordance`].
- [ ] Empty or whitespace-only help body produces no trigger. A non-empty body
      without a complete ARIA label also produces no trigger; neither case adds
      a tab stop or reserves visible space [auto: `smoke_help_affordance`].
- [ ] Escape, outside pointer, owning-dialog scroll, toast and a competing colour
      picker close help in the documented order. The Popover and portal fallback
      paths stay inside the visual viewport [auto: `smoke_help_affordance`].
- [ ] Opening help by hover, focus or tap changes neither `clientHeight`,
      `scrollHeight` nor `scrollTop` of the owning dialog body. The native
      Popover and forced portal fallback have the same no-layout-shift contract
      [auto: `smoke_help_affordance`].
- [ ] Party 1 contains exactly the 11 agreed logical settings: space scale,
      general and device Glow radius, room fill, source role and controlled
      sources, general/space north, general/space background, zero-thickness
      wall style and the show-hidden catalog filter. The regular and onboarding
      space dialogs expose the same five space-help controls; opening help does
      not change a draft setting or the session-only filter
      [unit: `i18n.test`; auto: `smoke_help_affordance`;
      mutation: `settings-help-party1-placement-removed`].
- [ ] `marker.controls_hint`, `gs.bg_daynight_hint`, `gs.north_hint` and
      `space.zero_wall_help` are absent from all four dictionaries and production
      templates; state-specific sun/Glow notes remain visible [unit: `i18n.test`].

## Help & private feedback (#43)

- [ ] Header order is Fit/zoom → General settings → Help; Help has a 44×44
      target, remains available in View and all editors, and is absent in kiosk.
      About appears once in Help, Russian routes to the Russian User Guide and
      every other locale routes to English [unit: `support-feedback.test.mjs`;
      pre-beta: support dialog smoke/golden matrix].
- [ ] A fresh dialog has empty message/contact and attachment off. Empty or
      over-limit Unicode input cannot submit; Ctrl/Cmd+Enter uses the same
      guard [unit: `support-feedback.test.mjs`; pre-beta: phone validation
      smoke].
- [ ] Preview builds no external request and exposes exact JSON bytes, size and
      hash. Download equals preview; refresh changes the package namespace;
      expiry/discard/replacement and successful submit invalidate only the
      intended owner/draft token [backend: `test_support_package.py`,
      `test_ha_websocket.py`; pre-beta: browser network capture].
- [ ] Forbidden sentinels (raw and escaped/base64), unknown fields, names, HA
      ids, URLs/paths and live states never reach package bytes. Geometry and
      referential pseudonyms survive [backend: `test_support_package.py`].
- [ ] Relay transport uses only the compiled HTTPS host, follows no redirect,
      bounds timeouts/response and never reflects provider text. Relay request,
      rate/idempotency, spool-before-delivery and purge tests run in CI
      [backend: `test_ha_support_transport.py`; relay: `python -m unittest
      discover -s scripts/support-relay/tests -q`].
- [ ] Success keeps a copyable report id; failure keeps the draft and exact
      attachment with Retry, Copy message, Download and manual links. Old or
      mismatched backend leaves About/Guide usable but exposes no fake submit
      [pre-beta: success/429/timeout/unknown-command smokes in light/dark].

## v1.71 audit polish (#434)

- [ ] Physical decor inventory counts exact lower-hex allow-listed blob files
      and their real sizes independently of sidecars; a valid-shaped sidecar
      without its blob remains absent from catalog/list/resolve
      [backend: `test_decor_assets.py`; mutations:
      `decor-physical-inventory-follows-sidecars`,
      `decor-catalog-accepts-sidecar-without-blob`].
- [ ] Exact orphan re-upload repairs metadata at a full physical quota with
      `reused:false`; valid catalog reuse stays `true`, and digest mismatch
      changes no file. Explicit delete removes all and only exact allow-listed
      blob names plus the sidecar [HA: `test_ha_websocket.py`; mutations:
      `decor-orphan-repair-runs-after-quota`,
      `decor-orphan-repair-claims-reuse`, `decor-delete-skips-orphan-blobs`].
- [ ] Static cards learn exact `decor_assets_api:1` only from fresh config/get,
      revoke it on downgrade and never resolve without it. Positive and missing
      resolve caches share only connection + config revision + sorted id set;
      failed calls retry [unit: `config-store`, `space-card-audit-lows`,
      `decor-assets`; smoke: `smoke_space_card_decor_capability`].
- [ ] Ready→warm cancels an existing dangerous-action promise and removes its
      dialog while preserving the committed body; a request in warm refuses,
      and warm→ready allows immediately before another render
      [smoke: `smoke_danger_confirm_branches`; mutations:
      `danger-confirm-warm-language-guard-removed`,
      `danger-confirm-warm-transition-cancel-removed`].
- [ ] Area absence evidence cannot outlive its current snapshot binding
      [unit: `device-area-relocation`; mutation:
      `area-cleanup-keeps-candidate-outside-current-snapshot`].
- [ ] The smoke job has its own 20-minute bound and each file is wrapped by GNU
      `timeout --kill-after=10s 180s`; both German route waits have one-second
      diagnostics [unit: `smoke-exception-guard`; CI: `validate.yml`].
- [ ] Every well-formed token from an invalid, stale or locally unadoptable
      support preview response is discarded exactly once; malformed tokens are
      not echoed and cleanup never hides the original failure
      [smoke: `smoke_support_feedback`; mutation:
      `support-invalid-response-leaks-issued-token`].

## Надёжность сводной панели (#493)

- [ ] `test/summary-panel.test.mjs` строит индекс по 10 000 HA entities,
      находит exact `entity_id` через полный индекс, ограничивает выдачу 100
      строками и доказывает 0 rebuild при смене state value и ровно один при
      add/remove/friendly-name change.
- [ ] `test/summary-panel-runtime.test.mjs` доказывает authority локальных
      200%/150% при repeated same-key `setConfig`, stable-id ownership после
      reorder/delete и lifecycle generation при route/user/permission/kiosk,
      disconnect/reconnect и поздних async completion.
- [ ] `tests_backend/test_summary_panel.py`, `test_ha_websocket.py` и
      `test_ha_import_export.py` проверяют одну writer matrix: omission/explicit
      empty, readable и старую broken reference, Optimize, full/space/plan-only
      import, Optimize/Import Undo, copy и delete вместе с independent-setting
      sentinels.
- [ ] Перед `S7-code-review`: `node demo/smoke_summary_panel.mjs`. Fixture
      содержит 200 rows и 10 000 states; закрытые строки не содержат entity
      options, открыт ровно один picker (до 100 entity + 3 system + current
      broken), а после трёх warmups и 20 samples действуют бюджеты open p95
      ≤250 ms и input p95 ≤50 ms. Тот же smoke проверяет 320/390 CSS px,
      RU/EN, light/dark, admin/household/kiosk и 200% text без горизонтального
      overflow и с targets не меньше 44 px.
- [ ] `node scripts/mutation-gate.mjs --changed origin/dev..HEAD` обязан поймать
      снятие DOM bound, state-value rebuild, local-scale authority, lifecycle
      generation и Optimize writer guard. Полные golden/smoke/performance и
      Linux CI HA harness остаются обязательным гейтом точного SHA беты.

## Идентичность сводной панели в Masonry (#561)

- [ ] `test/summary-panel.test.mjs` пересоздаёт весь production-shaped
      `hui-masonry-view`: canonical `cards=[A,B,C]`, wide-колонки `[A,C] [B]`
      и новый narrow DOM `[A,B,C]`. Slots обязаны остаться
      `masonry-v2:0/1/2`, без коллизии old C → new B.
- [ ] Тот же unit проверяет live reflow, nested stack через ShadowRoot,
      remount внутренней House Plan card, два nested instances и повторную
      попытку resolution после временно отсутствующего `masonry.cards`.
- [ ] `test/summary-panel-runtime.test.mjs` доказывает отсутствие localStorage
      read/write при unresolved identity, отсутствие импорта/удаления старого
      DOM-path key и независимое восстановление show/scale одинаковых карточек
      после полного reload.
- [ ] Мутант `summary-masonry-identity-uses-visual-dom-path` возвращает
      структурный DOM path вместо canonical index; focused #561 unit обязан
      покраснеть. Перед бетой selected summary-panel smoke проверяет ротацию
      touch/kiosk viewport по общему release-процессу.

## Доступность основного View (#565)

- [ ] `test/device-presentation.test.mjs` доказывает whole-segment
      дедупликацию доступного имени во всех четырёх локалях, сохранение порядка
      и отсутствие ложного удаления при частичном совпадении.
- [ ] `demo/smoke_household_journeys.mjs` проверяет именованную навигацию и
      единственный `aria-current="page"`, реальный Tab-focus tooltip, переход к
      следующему устройству, blur-cleanup и попадание подсказки в viewport.
      Комбинированный mouse+keyboard сценарий доказывает, что комната не
      заменяет focus-tooltip, другое устройство сохраняет обычный hover, а
      pointerleave восстанавливает подсказку всё ещё сфокусированного устройства.
- [ ] `demo/smoke_space_card.mjs` считает сегменты тревоги в доступном имени
      статической карточки и не добавляет ей интерактивность.
- [ ] Мутанты `view-current-space-aria-removed`,
      `device-accessible-label-dedup-removed`,
      `device-focus-tooltip-handler-removed` и
      `device-focus-tooltip-blur-cleanup-removed`, а также мутанты раунда r2
      `device-focus-tooltip-room-hover-overwrites` и
      `device-pointer-leave-clears-focus-fallback` обязаны покраснеть на своих
      заявленных гардах.
