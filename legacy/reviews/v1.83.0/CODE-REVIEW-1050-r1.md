# CODE-REVIEW-1050-r1

Issue: #1050 · Этап: code · Трек: ask · Заход: r1 · блокирующих циклов израсходовано 0/4
Материал: `6b4f59f6dc7a78eee5bfb6cf6328c2a3fb7a7f0e` (рабочая копия на нём, `git rev-parse HEAD` сверен)
SPEC: r1, зелёный (6379571189, body sha256 9111455c1703…), продуктовый вопрос закрыт владельцем («вариант 2»)

## Скоуп

ТЗ issue #1050: новое значение `settings` в `markers[].tap_action` («Настройки
устройства») и смена назначения правого клика в View на тот же диалог, вместо
HA more-info. Для `!writer OR kiosk` — отказ с подсказкой, без побочных
действий. Диапазон материала `origin/dev..HEAD` — 10 коммитов, 41 файл, классы
A (frontend `src/`, backend `validation.py`/`support_wire_schema.py`, i18n
de/en/fr/ru), B (demo/smoke, test/, tests_backend/, scripts/mutation-registry,
scripts/support-relay), C (каноны, changelog, ledger, STATUS/ARCHITECTURE).
Риск по изменённым участкам из промпта — все три класса (`migration`:
`validation.py:2039`, `devices`: `device-toggle.ts:468`, `ux`: новые i18n ключи)
прочитаны и сверены с AC ниже.

## Как проверялось

Static-first: материал читался один раз (`git log`/`git diff
origin/dev...HEAD`), затем адресно — risky hunks и файлы из REVIEW_CONTEXT.
Принят готовый proof validate-gate на точном SHA
(https://github.com/Matysh/houseplan-card/actions/runs/40145874505,
«review-light proof is complete») — его результаты не повторялись, только
прочитаны логи соответствующих джобов для сверки заявленных автором чисел.
Дополнительных команд (npm test/tsc/gate:small/мутанты) ревьюер не запускал —
пробелов, требующих адресного прогона, не найдено.

| Гейт | Статус | Где видно |
|---|---|---|
| Frontend types/units/bundle-sync (`Фронтенд: типы, юниты, мутанты, синхрон бандла`) | PASS, 1223/1223 node-тестов, 0 fail | run 40145874505, job 121027063037, `# tests 1223 / # pass 1223 / # fail 0` |
| Backend pytest в HA harness (`Бэкенд: pytest в Home Assistant`) | PASS, 2273 passed, 1 skipped; coverage 89.9% ≥ baseline 87.2% | job 121027063038, `Backend unit tests (pure + HA harness, coverage)` |
| Support relay unit tests | PASS, 41/41 | тот же job, `Ran 41 tests in 4.152s — OK` |
| Браузер: выбранные проверки push (adресные смоки по диффу) | PASS: `smoke_device_settings_action.mjs`, `smoke_editor_gestures.mjs`, `smoke_isometric_contract.mjs`, `smoke_tap_ctx.mjs` | job 121027441229, 4× `passed smoke …` на SHA 6b4f59f |
| Hassfest / HACS / Предполёт / Геометрия TS-Python parity / Упаковка | PASS (не затронуты риском, но прогнаны) | тот же run, зелёные джобы |
| Golden / полная browser-матрица / perf-смок / мутанты-по-диффу (ночные) | Пропущены сознательно (`"golden":{"mode":"none","reason":"no golden demand"}`) | план задачи не требует Golden; соответствует §8 — полные наборы это предрелизный гейт |
| `node scripts/mutation-gate.mjs --check` (статическая готовность) | PASS, execution 0 (ночной прогон, не гейт ревью) | заявлено автором, согласуется с политикой — ни один мутант не исполнялся ни автором, ни ревьюером |

**Чего не проверял:** ночной полный mutation run, Golden baseline acceptance,
performance-гейт (не назван в AC), полную browser-матрицу (437/438 смоков) —
все они вне объёма гейта code-review на `track:ask` без заявленного визуального
или perf-риска (§8). Также не проверял отдельно факт будущей выкладки
`support-relay` (не в скоупе S7, заявлено автором как пост-S8 шаг).

## Разбор по AC

| AC | Что реализует | Доказательство | Вердикт |
|---|---|---|---|
| AC1 (новый `tap_action: settings`, Save/reopen, copy, backup/import) | `logic.ts:925` добавляет `'settings'` в `TAP_ACTIONS` (автоматически появляется в селекторе `marker-dialog.ts:417-419` через `t('tap.settings')`); `validation.py:2039` и `support_wire_schema.py` принимают токен | `test/logic.test.mjs` (канонический порядок), `test/device-settings-action.test.mjs` (`virtualDeviceCopy` не трогает соседние поля), `tests_backend/test_validation.py::test_every_tap_action_the_editor_offers_is_accepted` (параметризован по живому `TAP_ACTIONS`, включая негативный `"launch-missiles"` → `vol.Invalid`), `tests_backend/test_ha_import_export.py::test_issue1050_settings_action_survives_export_parse_and_apply` (full/space export→parse→apply сохраняет `tap_action/tap_target/tap_confirm/description/future`), smoke `selector:SavePersistsSettingsWithoutTouchingConfirmation`/`selector:reopenTargetsSameDeviceAndSavedValue` (PASS в CI) | Доказан |
| AC2 (короткий mouse/touch/Enter/Space открывают тот же marker, без Toggle/Run/more-info) | `houseplan-card.ts:5889` ветка `action === 'settings'` перед `guarded`-логикой confirm; `_keyDevice` (строка 6020) делегирует в `_clickDevice`, то есть Enter/Space используют тот же dispatch | smoke `current()`-проверки `exactTargetAndOnlySettings`/`noServiceWriteMoreInfoOrPressFeedback` для tap/Enter/Space/touch × Flat/2.5D (PASS в CI); **RED-before/GREEN-after**: `docs/development-notes/device-settings-validation.json` фиксирует прогон на неизменённом `4dd092a` — `settingsTapOpensExactCurrentDialog: false`, `settingsIsOfferedInActualSelector: false` (5 ожидаемых фейлов), после реализации 113/113 PASS на том же сценарии | Доказан, тест умеет падать (зафиксированный RED) |
| AC3 (right-click открывает тот же диалог независимо от tap action, включая `none`; подавление браузерного меню; Devices/long-press не тронуты) | `_ctxDevice` (houseplan-card.ts:5842-5850) безусловно вызывает `_openMarkerDialog(d, true)` после `preventDefault/stopPropagation`, ветка `devices`-режима (`deviceCopy.open`) не тронута | smoke `rightSavedNone` (right-click при сохранённом `none` всё равно открывает), `native:trustedConsumedContextMenu`; `smoke_editor_gestures.mjs`/`smoke_isometric_contract.mjs` обновлены "на дельту контракта" (владелец сознательно сменил поведение — §12 про `не подавлять ради зелёного` соблюдён, было `moreInfoCalls===1/2`, стало `moreInfoCalls===0` + явный `dialog-cancel` между проверками), все 4 смока PASS в CI на точном SHA | Доказан |
| AC4 (`!writer OR kiosk` → подсказка, ни одного UI/service/lazy; HA admin не подменяет writer) | `_openMarkerDialog` (houseplan-card.ts:9586-9592): `!deviceEditorAllowed(...) \|\| viewSettings && !this._loadOk` → toast с устойчивым id `'toast.device_settings_unavailable'` до какой-либо lazy-загрузки; `deviceEditorAllowed` = `writer && !kiosk` (device-editor-access.ts:2) | Ordinary negative-input (не мутант): smoke-цикл `for (const denial of ['no-write','kiosk','unloaded'])` проверяет RU/EN точный текст тоста, `noLazyRequestOrRuntime` (0 запросов раннера), `adminDoesNotOverrideHousePlanPermission` (admin=true, но доступ всё равно заблокирован) — все PASS в CI; это обычный отрицательный случай с результатом, применимый как «чем краснеет» для защитного AC | Доказан, «чем краснеет» = сам ordinary negative case (денай-матрица), PASS |
| AC5 (cold lazy import, retirement матрица: connection/user/ABA/route/mode/space/hidden/delete/move/rebind/permission/detach/newest) | `currentMarkerSettingsDevice`/`markerSettingsTargetKey` (view-action-context.ts:36-46) + замыкание `current()` в `_openMarkerDialog`, перепроверяющее request/isConnected/mode/navigation/loadOk/authority/config/epoch/layoutRev перед каждым открытием, включая после `_ensureEditorRuntime().then` | Зарегистрированный мутант `view-settings-retired-intent-accepted` (scripts/mutation-registry.mjs) со статусом «не исполнялся» (execution 0, нightly-only — соответствует общей политике); ordinary negative: 13 сценариев `retirementCases` в `smoke_device_settings_action.mjs` (`held/<kind>:oldIntentDoesNotOpen`), все PASS в CI; юнит `test/device-editor-permissions-runtime.test.mjs` — «rechecks a retired current-target resolver after deferred Properties» | Доказан; «чем краснеет» = id мутанта (не исполнялся) + параллельный ordinary negative case (PASS) |
| AC6 (существующие info/toggle/run/none/legacy cover/hidden/confirmation/touch/hit-ownership/Devices-меню не ломаются) | `projectedTapAction` (device-toggle.ts:467-469) добавляет `'settings'` в белый список, неизвестный токен по-прежнему fail-closed → `'info'` (строка 473-475); `_deviceBindingActive` оставлен для toggle/run путей, из `_ctxDevice` убран намеренно (диалог настроек не требует активного HA-байндинга) | `test/device-settings-action.test.mjs` (`projectedTapAction('future-action','light') === 'info'`, `toggleOriginOf(settingsDevice) === null`), 4 риск-смока из AC3 покрывают pinch/geometry/area/lock регрессии, backend `test_support_wire_schema.py` негативный кейс (`"future-settings"`/`{"private":...}` → `WireRejected`) | Доказан |
| AC7 (каноны/guide/changelog/ledger, gate/hook, независимое ревью) | `docs/ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`, `UX-MODES.md`, `TOUCH-SUPPORT.md`, `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.md`/`.ru.md`, `CHANGELOG.md`/`.ru.md`, `docs/release-ledger/v1.82.0/1050.json` | Прочитаны построчно — терминология совпадает с `tap.settings`/toast-строками из i18n дословно; ledger `category: major`, `baseStable: v1.82.0` (текущий stable-тег, не beta) с развёрнутым обоснованием (новая видимая возможность + смена жеста, без миграции данных) — авторское суждение, не механический вывод из `User-Visible` | Доказан |

## Трейлеры и видимые числа

Все 10 коммитов несут `Issue: #1050`. Первый коммит `7956d680b` —
`User-Visible: yes` и в том же коммите правит оба `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md`; остальные 9 — `User-Visible: no` (правки B/C/merge).
Единственное видимое пользователю число в диффе — состав `TAP_ACTIONS`/пункт
«Действия по нажатию»: источник один — `src/logic.ts` (`TAP_ACTIONS`), из
которого селектор диалога (`marker-dialog.ts`) и таблицы `USER-GUIDE.md`/`.ru.md`
берут один и тот же список; дублирования с независимым источником не найдено.

## Находки

Нет High/Medium ни в скоупе, ни вне скоупа. Побочных находок нет
(`REVIEW_FINDINGS_POLICY`: `mode=issues` — новый issue не требуется, так как
находок, попадающих под эту ветвь, не возникло).

## Что проверено и корректно

- Единый dispatch короткого клика/тапа/Enter/Space (`_clickDevice`/`_keyDevice`)
  и отдельный путь right-click (`_ctxDevice`) оба сходятся в
  `_openMarkerDialog(d, true)`, `tap_confirm` не применяется к `settings`
  (ветка стоит раньше `guarded(...)`).
- Разрешённая `deviceEditorAllowed` проверка выполняется до начала lazy-import
  (`if (viewSettings && !current()) return;` до `_ensureEditorRuntime()`), что
  соответствует «не загружать editor ради отказа».
- `currentMarkerSettingsDevice` отвергает hidden/другой space/другой
  bindingKind/bindingRef/marker.binding — связка с `markerSettingsTargetKey`
  не даёт подставить соседа.
- Backend/relay enum держатся побайтно идентичными
  (`support_wire_schema.py` и `scripts/support-relay/hp_relay/support_wire_schema.py`,
  SHA256 совпадают по заявлению автора — дифф текстово идентичен).
- `scripts/config-schema.json`, `scripts/ci-registry-inventory.json`,
  `scripts/smoke-links.mjs`, `docs/testing-notes/mutation-browser-guards.md`
  регенерированы/обновлены согласованно с новым файлом/тестом/мутантом.
- i18n RU/EN текст `tap.settings` и `toast.device_settings_unavailable`
  совпадает дословно с текстом ТЗ; DE/FR добавлены дополнительно (не требовались
  ТЗ, не вредят).
- Старый контракт правого клика (`moreInfoCalls===1/2`) в
  `smoke_editor_gestures.mjs`/`smoke_isometric_contract.mjs`/`smoke_tap_ctx.mjs`
  переписан на новый осознанно (комментарии `#1050: View context opens…`), а не
  подавлен — соответствует «не скрывать ради зелёного» (ТЗ, план автотестов).

## Унаследовано из r<N−1>

Неприменимо — это первый заход код-ревью (r1) по этому issue; код-ревью r0 не
существовало. Унаследован только зелёный SPEC r1 (см. «Скоуп» выше), который
сам по себе не образует цикл кода.

## Маршрут

`route: fix` (трек `ask`, код-ревью, вердикт не предполагает reclassify).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1050-device-settings`, коммит `6b4f59f6dc7a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `843fd6f24016f8301ba40b576a766ad9feaf6518`
  ```
  git log --all --format='%H %T' | grep 843fd6f24016
  ```
- Тело issue: `9111455c1703178c9b2451b079c8799e6abfd4f679bc9247facc351637d19849`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMjAsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTF9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjExNiwib3V0cHV0X3Rva2VucyI6MzI3OTgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTUyNzc2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjQ0NDA0NCwiY29zdFVzZEVzdGltYXRlIjoyLjIyODEyNDc5OTk5OTk5OTR9XSwidHVybnMiOjY3LCJkdXJhdGlvbk1zIjo0MTkwNTcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjIzMzIzNDc5OTk5OTk5OTUsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5136 output_tokens=32816 cache_creation_input_tokens=152776 cache_read_input_tokens=6444044 num_turns=67 -->
