# CODE-REVIEW — issue #1132, заход r1

Материал: `a7196f76bedd639dd554c1d8943d56e2840fc455` (HEAD, неизменна в ходе ревью).
Трек: ask. Этап: code.

## Скоуп

Перенос 12 согласованных UI-правок (UI-001…UI-012) итерации beta4 в продукт:
общий device-face (bevel/Off-glyph), панель (группы/редакторы/перенос без
скрытия действий), печать (UI Kit), внешние экраны (удаление опции «кнопки
поверх плана», инертный legacy `controls`), LQI поверх текста комнаты.
Изменённые продуктовые файлы: `src/houseplan-card.ts`, `src/panel-header-flow.ts`,
`src/pdf/hp-pdf-dialog.ts`, `src/styles/devices.styles.ts`,
`src/styles/panel-header.styles.ts`, `src/summary-panel-runtime-loaded.ts`,
`src/summary-panel-style.ts`, `src/external-screens.ts`,
`src/editors/external-screens.ts`, i18n `settings/{de,en,fr,ru}.json`; плюс
адресные тесты/golden/smoke/документы/release-ledger/mutation-registry.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` (тело issue, handoff, политика находок),
`docs/TOUCH-SUPPORT.md`, `docs/DEVICE-PRESENTATION.md` (через диф), затем через
`run_check(read:diff)` прочитан полный авторский патч (`task-patch`, база
`3779df5a9ef402cbb0daebd6994b666323b6ae3f`) и `run_check(read:log)` — пять
коммитов диапазона. Независимо прослежены все изменённые продуктовые hunks
(построчно, не по выжимке) и перекрёстно сверены с существующими источниками
(`src/pointer-modality.ts`, `src/external-screens.ts`, `src/panel-route-kiosk.ts`,
`src/houseplan-card.ts` — места чтения `_externalScreen.controls`). Тестовые
файлы (`demo/smoke_ui_polish_1132.mjs`, `demo/smoke_panel_header_overflow.mjs`,
`demo/golden/device-offline.mjs`, `demo/golden/external-screens.mjs`,
`test/external-screens.test.mjs`, `test/summary-panel-runtime.test.mjs`,
`test/golden-matrix.test.mjs`, `test/styles-split.test.mjs`,
`test/device-marker-polish-contract.test.mjs`) прочитаны целиком в месте
изменений, чтобы подтвердить, что ассерты способны покраснеть на откате
конкретного изменения (не только декларативны).

Выполненные через `run_check`: `read:diff`, `read:log` (оба `passed`,
`materialUnchanged:true`). Дополнительных `smoke:*`/`unit:*`/`build:*` не
запускал: ни один обнаруженный риск или AC не остался без пригодного PASS —
см. ниже таблицу reuse.

## Риск по изменённым участкам (#707): класс «touch»

Указанные строки `src/pdf/hp-pdf-dialog.ts:129,135,154` (`PointerEvent`,
`pointerdown`, `pointermove`) — это подключение общего `PointerModalityController`
(`src/pointer-modality.ts`) к новому `hp-pdf-dialog`, тот же паттерн, что уже
используется в `space-card.ts`, `houseplan-editor-runtime.ts`, `houseplan-card.ts`,
`hp-help.ts`, `hp-color-opacity.ts`, `hp-settings-select.ts`, `hp-dialog.ts`
(`:host([data-pointer-hover])`-гейт). Логика определения модальности
(`nextPointerModality`/`pointerHoverAllowed`) не менялась и покрыта
`test/pointer-modality.test.mjs` (не в диффе — переиспользуется). Новый код —
только подписка/отписка (`connectedCallback`/`disconnectedCallback`,
симметричные `addEventListener`/`removeEventListener`, `connect`/`disconnect`).
Функционально это покрыто AC5/UI-006 («крестик получает штатную анимацию
наведения… reduced-motion»): `demo/smoke_ui_polish_1132.mjs:94-100` реально
наводит мышь (`close.hover()`) на `hp-pdf-dialog`, проверяет
`data-pointer-hover` + `--hp-dialog-close-hover-transform` и отдельно
reduced-motion (`printCloseReducedMotion`) — входит в PASS `ui_polish_1132` из
проверенного proof. Отдельного touch-негатива для этого диалога нет, но он не
нужен: инвариант «touch не создаёт hover» уже закрыт в общей библиотеке и не
дублируется для каждого потребителя. **Класс touch — покрыт**, риска нет;
проверено чтением общего кода и существующего PASS-свидетеля, не отдельным
исполнением.

## Разбор по AC (построчно читал hunks, не полагался только на handoff)

- **AC1 (визуальное соответствие)** — `docs/design/1132-beta4-ui/implementation-2026-10-30/{product,reference,overlap}` пакет и `comparison.json`/`sha256.json` зафиксированы; это в скоупе proof `review-light-golden`, не пересчитывал.
- **AC2–4 (панель 44px/группы/фокус)** — `src/styles/panel-header.styles.ts` переписывает `.tabs .tab`, `.modes .modetab`, `.compact-space-select` на явные 44px/радиусы/гейт `[data-pointer-hover]`; `focus-visible` заменяет UA-рамку на `outline:2px solid var(--hp-accent)` (UI-004). `demo/smoke_panel_header_overflow.mjs` переписан содержательно: убран хрупкий `rows===2` (высота ≤140px), заменён на счёт уникальных Y-координат видимых контролов (`row.rows`), что корректно обобщается на 3+ ряда; добавлены `allControlsWithinHeader`/`actionsNeverHidden` вместо старого gear-меню сценария — старые «phoneKeepsAllWriterActions»/«phoneEscapeRestoresVisibleTrigger» кейсы удалены вместе с удалённым phone-gear (замена пути согласно §7.2, старое поведение явно заменено новым тем же тестом).
- **AC5 (печать)** — `hp-pdf-dialog.ts` переведён на `hpf-toggle`/`hpf-form` общий kit; `--hp-dialog-*` custom properties перенесены с `:host` на `hp-dialog` (сам диалог красится вовне, в light DOM родителя — корректно, т.к. `hp-dialog` — отдельный элемент внутри shadow root `hp-pdf-dialog`). PDF/SVG writer не тронут (вне `changedFiles`). Hover/reduced-motion — см. выше.
- **AC6 (Off-glyph)** — `src/styles/devices.styles.ts` убирает `--device-core-inset-shadow` (bevel, UI-001) и правило `.dev.power-off .device-core > ha-icon { opacity:.35 }` (UI-010). Подтверждено жёстко закодированными ассертами на `1` вместо `.35` в `demo/smoke_approved_ui.mjs:76-85` и `demo/golden/device-offline.mjs:12-17` — числовой oracle, не словесное описание.
- **AC7 (kiosk controls)** — `renderControls()` (`src/summary-panel-runtime-loaded.ts`) теперь безусловно `return nothing` при `this.host._kiosk`, независимо от `_externalScreen.controls`. Грепом по `src/houseplan-card.ts` подтверждено, что `.controls` поля `_externalScreen` нигде больше не читается (использует только `cycle/idle/hidden_devices/rotation/icon_scale/font_scale`) — поле действительно инертно, как требует ТЗ. `src/panel-route-kiosk.ts` по-прежнему парсит `hpcontrols` в `overrides.controls`, но раз рендер его не читает, легаси-URL не может вернуть кнопки — подтверждено тестом `test/summary-panel-runtime.test.mjs` (`renderControls()` без аргумента, безусловный `nothing` при `_kiosk=true` для всех трёх режимов). `src/external-screens.ts`: `defaultExternalScreen` → `controls:false`, `externalScreensOf` по-прежнему требует `typeof row.controls === 'boolean'` (lossless round-trip старых профилей) — подтверждено тестом `test/external-screens.test.mjs:24-30` (закодирован `controls:true` в «malformed/unknown-fields» фикстуре и проверено, что кодек пропускает его как есть). Конструктор лишился поля/опции `controls` (`editors/external-screens.ts`, `i18n` 4 языков синхронно).
- **AC8 (LQI)** — `.dev .lqi { z-index:3 }` + новый `.dev:where(:has(.lqi)) { z-index:2 }` поднимают слой над текстом комнаты. Проверка — не только z-index: `demo/smoke_ui_polish_1132.mjs:49-85` считает реальные закрашенные пиксели (`pixels.ink>=3 && pixels.collisions>=1 && pixels.preserved===pixels.ink`) в Flat/2.5D, обеих темах — это прямое пиксельное доказательство требуемого «пересечение текстов, а не только z-index».
- **AC9 (бюджеты/процесс)** — `scripts/monolith-baseline.json` обновлён до факта (3722083 B), ledger/DEVELOPMENT.md документируют рост и действующее разрешение владельца (#1038/#976) — не ослабление гейта, а учтённый факт. `scripts/mutation-registry.mjs` обновлён под новый код точечно (3 мутанта на изменённые селекторы/условия), статическая декларация, не исполнялись — соответствует политике.

## Защитные AC — таблица «чем доказан / чем краснеет»

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC6 (Off-glyph opacity=1, инвариант) | `smoke_approved_ui.mjs` (`faces['offline-icon'].glyph.opacity === 1`) — в PASS `ui_polish`/`approved_ui` проверенного proof | Возврат правила `.dev.power-off .device-core > ha-icon{opacity:.35}` в `devices.styles.ts` даёт `glyph.opacity===.35` → ассерт красный |
| AC7 (легаси `controls=true`/`hpcontrols=1` не возвращает кнопки) | `test/summary-panel-runtime.test.mjs` (`renderControls()` под `_kiosk=true` во всех трёх режимах) | Если `renderControls()` вернёт любой узел при `_kiosk=true` — `assert.equal(..., nothing)` красный |
| AC3 (перенос не прячет действия) | `demo/smoke_panel_header_overflow.mjs` — `width*actionsNeverHidden`/`allControlsWithinHeader` по сетке ширин 320…1800 | Любой скрытый `data-hp` экшен или контрол за пределами `head` → конкретный `check(...)` по ширине красный |
| AC9 (бюджет не ослаблен) | `scripts/monolith-baseline.json` + budget-гейт из `gate:small` (в proof) | Рост сверх задекларированного/недокументированное снятие лимита красит budget-проверку |

## Находки

Не обнаружено находок High или Medium в скоупе изменений. Отдельно
проверенный класс риска «touch» (`PointerEvent`/`pointerdown`/`pointermove` в
`hp-pdf-dialog.ts`) — переиспользование уже проверенной инфраструктуры,
функционально покрыт существующим PASS, дефектов не найдено.

## Что не проверялось повторно (переиспользован proof)

Согласно note к ciEvidence, `validate-gate`
(https://github.com/Matysh/houseplan-card/actions/runs/40982832507) на этом
точном SHA уже зелёный и помечен «review-light-golden proof is complete».
Переиспользованы без повторного запуска: `gate:small` (build/types/no-new-any/
private-writes/render-layout-reads/CSS-consumers/product+tooling units/
coherent-bundle/gzip/lint/metrics), `process-gate --issues` (трейлеры
Issue/User-Visible), `mutation-gate --check` (статическая регистрация, без
исполнения), все перечисленные в handoff `smoke_*`/`demo/golden/*` прогоны
(`panel_header_overflow`, `panel_header_touch`, `mobile_view_header`,
`header_compact_spaces`, `houseplan_panel`, `mode_transition`, `ui_polish_1132`,
`pdf_export`, `svg_export`, `device_icon_design`, `device_preview_parity`,
`device_offline`, `approved_ui`, `device_signal_topology`, `device_hit_capsules`,
`external_screens`, `panel_route_kiosk`, `summary_panel_polish`, `summary_panel`,
`e2e_primitive_fields`, `e2e_hooks`), а также полный golden-matrix regen
(`node --test test/golden-matrix.test.mjs` → 59/59) и четыре точечных golden
capture (`device-offline-{dark,light}`, `external-screen-constructor-{dark,light}`)
после дополнительной правки Golden-препаратов в коммитах `b40869b72`/`15f7b539c`/
`a7196f76b`. Смена SHA на `review`/`docs`-уровне (golden-препараты, не продукт)
не отменила пригодность proof — продуктовые/build файлы побайтово совпадают с
ранее проверенным `3945705...` (по заявлению автора, не пересчитывал хэш
отдельно — не требовалось, т.к. A-файлы вне диффа golden-препаратов).

Полные неизменённые наборы (`gate:small` целиком, глобальный release CI,
живой HA E2E) намеренно не перезапускались повторно — не являются предметом
ревью-гейта (§8), входят в предрелизный S8.

## Маршрут

route: fix (согласно предписанной классификации #726/#707 для этого захода).

## Гейты: что прогнано здесь / что нет

- Прогнано здесь: `run_check(read:diff)` (passed, полный патч), `run_check(read:log)` (passed, 5 коммитов).
- Не прогонялось здесь (переиспользован зелёный proof, см. выше): `gate:small`, `process-gate`, `mutation-gate --check`, все `smoke:*`/`golden` из списка. Основание: ни один риск/AC не остался без пригодного витнеса, входы/среда/oracle не менялись после proof.
- Не прогонялось в принципе (вне объёма ревью-гейта, предрелизный этап): полный release CI, живой HA E2E, глобальный baseline accept.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjdjNTMyNGI0OThhYmM5MDhmMjQ3Zjg1NDhhOTEyNjcyNzQ1NGE5YTM4NzIzYmZlZWRlZGZhYmIxYWEzYzRjODQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIyNWFiMGFhNzE3ZTk3ZGI3ZjAxNjYzMTk1MjE0N2ZkOWVjZTU1MjZjYTQ1MzQ3YTMxMTFiODU5YjQ4NmRjZTU2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTMyLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJhNzE5NmY3NmJlZGQ2MzlkZDU1NGMxZDg5NDNkNTZlMjg0MGZjNDU1IiwidHJlZSI6IjBiODZmNDlhNmI2YmY1MDk2N2E5Y2UwOWViZWY1YzE3OTk2NWVjZGQiLCJib2R5RGlnZXN0IjoiZTA3NTIxNzAzMGJiZTdkOGUxOGQ2YzYyZmQ0ZmNhZDdlYjVkNGMzMmMzYzI5NDIwMjZkOGIwZjc4ZGQ4OTJhOCIsInByb2R1Y2VyUnVuIjoiNDA5ODQyMzE3MDIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImUyZTQ2YTRlMzBkN2E3YjA4NTFkNDRhOTBmOTNmYzE4Mjc2OGNlMjE0NDlkYjZkMzZhNzFlNzc0ZDc0ZjUyNTciLCJ2ZXJkaWN0RGlnZXN0IjoiYzRjZjJlZmZhODA5ZGE0Yjg4Y2RhM2Y5ZGE1MjA3YTUzMGNjYzE3MjUyNzI5YTY2ZDQ2ZWYwYzI0MWVkNzY0OSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzYTVkYTI0MTNiNTMyZDE4OGRmNmY0MDkxZGE1YWU2OGM5YTQzY2Y0NWI0YWQwNjE5OTc5ZGZlZjUyZDFlODY4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTEyNTUxOTA0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTMyI2lzc3VlY29tbWVudC02NTEyNTUxOTA0IiwiYm9keURpZ2VzdCI6ImE2MDViZTgwODU1NGJiNTUwNmY3YmNjZjQzYzVmN2UyYzk1MWM5MWM1YzZjMzdmN2U3NjJhMzE1ZWY2OGIzN2EifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1132-beta4-ui`, коммит `a7196f76bedd` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0b86f49a6b6bf50967a9ce09ebef5c179965ecdd`
  ```
  git log --all --format='%H %T' | grep 0b86f49a6b6b
  ```
- Тело issue: `e075217030bbe7d8e18d6c62fd4fcad7eb5d4c32c3c2942026d8b0f78dd892a8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40984231702,"run_attempt":1,"digest":"6ddc40722aac8eb24108ca6a411e984071699955ab29d2e18b2b46e2d9b9b753"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzQsIm91dHB1dF90b2tlbnMiOjI0NjkwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1NzU4MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQxMDI2MDksImNvc3RVc2RFc3RpbWF0ZSI6MS42OTc4OTM4MDAwMDAwMDA2fV0sInR1cm5zIjo0NSwiZHVyYXRpb25NcyI6MzQ3MDQ0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42OTc4OTM4MDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=74 output_tokens=24690 cache_creation_input_tokens=157581 cache_read_input_tokens=4102609 num_turns=45 -->
