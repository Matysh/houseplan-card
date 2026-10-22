# CODE-REVIEW-1031-r2

Вердикт: **зелёный** · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0

Материал: `70a0f7e83486c9f66310165c3380dcfa57f04e6d` (сверено `git rev-parse HEAD`).
Ветка `issue/1031-zigbee-settings-refresh`. Merge-base с `origin/dev` —
`f5e4be134a66fc59e0ac9d53adc5895f8abd3103` — тот же, что был базой материала
r1 (`c3b63601f`). Новой перебазировки на ушедший вперёд `dev` нет: коммит
`70a0f7e83` лишь фиксирует сборку в документации, это не действие ребейза.

## Скоуп

Трек `ask`, этап code, второй заход. Делта относительно материала r1
(`c3b63601f360643697eb1c2a4de914125b1ede8d`, не резолвится локально — SHA
перезаписан принудительным пушем после исправления, это штатно) — ровно два
содержательных коммита поверх прежнего дерева:

- `d115a4454` fix(zigbee): keep detached settings subscriptions retired after save
- `a3705cc65` test(zigbee): await lazy editor readiness after fixture reload

Плюс служебные `4f26733a4` (публикация CODE-REVIEW-1031-r1.md ботом, docs-only)
и `70a0f7e83` (фиксация итогового байт-баланса бандла после слияния ручных
конфликтов, тоже docs/JSON-only). Остальные файлы задачи (zigbee-topology-action.ts,
houseplan-editor-runtime.ts::_saveSettingsDialog, general-settings-dialog.ts,
general-form-state.ts, dialog-baseline.ts, i18n/topology/*.json) не менялись с
r1 — разбор по §2.10 ведётся по дельте, с независимой перепроверкой
унаследованного там, где это дёшево (см. «Унаследовано из r1»).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| High: заявленные автором «43 PASS» для `demo/smoke_zigbee_enable_refresh.mjs` не воспроизводились — смок падал необработанным исключением в `setup()` сразу после `page.reload()`, т.к. не ждал ленивую `_ensureEditorRuntime()` перед кликом по настройкам | Коммит `a3705cc65`: в `setup()` добавлена `await page.evaluate(() => window.__card._ensureEditorRuntime());` сразу после `page.waitForFunction(() => window.__card?._booting === false)` и до `installHpTestOnPage`/открытия диалога — тот же приём, что уже в `smoke_zigbee_topology_job.mjs:49` | `demo/smoke_zigbee_enable_refresh.mjs:29-34`; лично прогнан на материале r2 — **44/44 PASS**, без исключений (протокол ниже) |

Находка была только про тестовую обвязку; r1 уже читал продуктовый код
(`zigbee-topology-action.ts`, `_saveSettingsDialog({keepOpen})`,
`dialog-baseline.ts`, `hp-zigbee-topology-settings.ts`, i18n) и признал его
соответствующим ТЗ, но не имел работающего живого доказательства AC1–AC8 —
это доказательство теперь получено (раздел «Гейты» ниже).

Отдельно автор сам нашёл и закрыл до этого раунда ещё один дефект (комментарий
13:34, до запуска r1-модели): детач `hp-zigbee-topology-settings` во время
удержанного save позволял `ZigbeeTopologyLoadGate.finally → requestUpdate()`
повторно захватить metadata lease после отключения компонента (скан не
стартовал, но подписка воскресала). Это коммит `d115a4454`, разобран ниже как
часть дельты этого раунда, так как материал r1 его уже содержал (коммит
датирован 16:37, до red-вердикта 14:13... — **уточнение**: по времени коммитов
`d115a4454` (16:37:33) идёт *после* red-вердикта r1 (14:13:12) и после
`4f26733a4` (14:13:58, публикация документа r1). Значит это не досрочное
самоисправление до r1 (комментарий 13:34 предшествовал самому r1), а фактически
первый коммит дельты r1→r2 вместе с `a3705cc65`. Текст комментария автора
13:34 описывает тот же дефект заранее, но закоммитить его смог только в составе
этого цикла. Итог не меняется: обе правки — предмет дельты r2, обе проверены
ниже.

## Разбор дельты

### `d115a4454` — detached metadata lease

`src/hp-zigbee-topology-settings.ts`, две строки:

```diff
- const metadataWanted = this.active && this.embedded && this._admin;
+ const metadataWanted = this.isConnected && this.active && this.embedded && this._admin;
...
-      changed: () => this.requestUpdate(),
+      changed: () => { if (this.isConnected) this.requestUpdate(); },
```

Прочитан полный актуальный `updated()`/`_load()` (`src/hp-zigbee-topology-settings.ts:118-181, 357-374`).
Механизм дефекта: `ZigbeeTopologyLoadGate.run()` вызывает `options.changed()`
в `finally` безусловно, даже если элемент к этому моменту отсоединён
(`disconnectedCallback` не трогает `pending`, только `invalidate()` — эпоха,
которая блокирует именно `load()`, не влияет на последующий `requestUpdate()`).
Lit выполняет запланированное обновление и на отключённом элементе — это
`updated()` штатно продолжает жить.

- До фикса: `requestUpdate()` после детача запускал `updated()`, где
  `metadataWanted` не проверял `isConnected` → лиз метаданных (`_metadataRelease`)
  реакватировался на уже удалённом компоненте.
- После фикса: оба условия проверяют `isConnected`, поэтому ни `updated()` не
  планируется для отключённого элемента в этом пути, ни `metadataWanted` не
  становится true, если бы он всё же выполнился.

Новый регистровый мутант `zigbee-enable-refresh-detached-reacquires-metadata-1031`
(`scripts/mutation-registry.mjs`) откатывает ровно эти две строки, guard —
`node demo/smoke_zigbee_enable_refresh.mjs`, зарегистрирован корректно
(подтверждено `mutation-gate.mjs --check`, static ok). Проверено чтением: сам
скан (`load()`) и без фикса не стартовал бы повторно — его отдельно гейтит
`current()` с тем же `isConnected`/epoch, так что регрессия строго про
переиспользование подписки на метаданные, не про скан. Соответствует AC4.

Новый негативный смок-сценарий `detachedSaveCannotReacquireMetadata`
(`demo/smoke_zigbee_enable_refresh.mjs:210-233`) проверяет четыре условия после
детача и резолва удержанного save: `hadMetadata` (предусловие — лиз был
захвачен), `!el.isConnected`, `!el._metadataRelease`, `!el._unsubscribe`,
`!el._loadGate.pending`. Из них реально чувствительны к этому мутанту только
`!el._metadataRelease` (прослежено построчно — см. выше); `!el._loadGate.pending`
всегда `false` независимо от фикса (`finally` сбрасывает его безусловно), а
свойства `_unsubscribe` у класса вовсе нет (`grep` не находит — есть `_release`
для рантайм-подписки и `_metadataRelease` для метаданных), так что этот
конъюнкт тавтологически истинен. **Low, не блокирует**: мёртвое условие в
тесте не ослабляет и не усиливает защиту — реальная защита держится на
`!el._metadataRelease`, который действительно переключается мутантом (прослежено
и подтверждено живым прогоном ниже). Автору стоит убрать несуществующее поле
из условия при следующей правке файла, в отдельный цикл это не выношу.

### `a3705cc65` — ожидание ленивого runtime в smoke setup

Разобрано выше как закрытие High-находки r1. Дополнительно проверено: вызов
вставлен **до** `installHpTestOnPage`/подмены `card.hass` и до клика по
`[data-hp="settings"]` — порядок совпадает с рабочим паттерном из
`smoke_zigbee_topology_job.mjs:46-49`.

## Гейты

**Дешёвые (`tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy --verify`)
подтверждены зелёным Validate на этом SHA** (ссылка в задаче ревью,
39814796137) — не перегонялись.

Выполнено лично на материале ревью (воспроизвожу, что Validate не покрывает —
смоки по диффу/AC и защитный мутант-registry static-check):

| Команда | Результат |
|---|---|
| `npm run build` | чисто, `tsc --noEmit` + rollup, dist собран за 29.9с |
| `node scripts/bundle-sync.mjs` | бандл синхронизирован в `demo/srv/assets` |
| `node demo/smoke_zigbee_enable_refresh.mjs` | **44/44 PASS** (все названные в AC1–AC8 проверки, включая `detachedSaveCannotReacquireMetadata`, 4 языка × light/dark × 360px + keyboard) |
| `node demo/smoke_zigbee_topology_job.mjs` | **24/24 PASS** — общий файл класса (`hp-zigbee-topology-settings.ts`) не регрессировал по соседнему lifecycle (background job, cancel, reopen, permission loss) |
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/zigbee-topology-action.test.mjs` | **5/5 PASS** — целевой unit save/load-координации и baseline (AC2/AC5), включая «старый owner отвергается» |
| `node demo/smoke_general_settings_form.mjs` | PASS |
| `node demo/smoke_signal_visibility.mjs` | PASS |
| `node demo/smoke_signal_visibility_lifecycle.mjs` | PASS |
| `node demo/smoke_zigbee_incomplete_reasons.mjs` | PASS |
| `node demo/smoke_lazy_editor_chunk.mjs` | PASS |
| `node demo/smoke_editor_draft_exit.mjs` | PASS |
| `node scripts/ratchets.mjs report` | `monolith bundleBytes: факт 3339916 · потолок 3339916 (0)` — байт-баланс точно совпадает с заявленным обновлением, других метрик в полосе без расхождений |
| `node scripts/unused-locals-gate.mjs` | PASS, числа совпадают с заявленными автором |
| `node scripts/mutation-gate.mjs --check` | PASS, 1775 определений, `execution=0` (static-only, мутанты не исполнялись — политика) |
| `node scripts/process-gate.mjs --issues` | PASS, 7 коммитов, 0 предупреждений, трейлеры `Issue:`/`User-Visible:` на каждом некоммите-docs |

Чего не проверял и почему:
- Мутанты **не исполнялись** (ни зарегистрированный `zigbee-enable-refresh-detached-reacquires-metadata-1031`, ни прежние) — только статическая регистрация, согласно общей политике раунда (ночной workflow — единственное разрешённое место исполнения).
- `pytest tests_backend` / Python — Python-файлы и WS API в диффе отсутствуют (`git diff --stat ... -- 'custom_components/**' 'tests_backend/**'` пуст), не применимо.
- `npm run invariants` — геометрия плана и ссылки на неё не менялись (список файлов диффа не содержит geometry/canvas/wall), не применимо.
- Полный HA harness, живой HA, релизные/ночные полные наборы, performance-бенчмарки — не требуются объёмом задачи (§8), в AC не названы.
- `golden:verify` — рендер плана не меняется (только текст кнопок/подсказок в диалоге настроек и i18n), метки `ci:golden` нет, намеренных сдвигов кадра автор не заявлял и класс изменений этого не предполагает.

## AC — проверено и корректно

Все восемь AC проверены комбинацией чтения (для логики, не изменившейся с r1)
и личного исполнения (для нового/изменившегося): таблица «AC · чем доказан ·
чем краснеет» автора (комментарий 13:28) совпадает с кодом и с живым прогоном:

- AC1 — `oneSaveWhileDoubleClickWaitsForAck`, `ackPrecedesOneScanWithRevision` — PASS в живом прогоне; `_loadGate.run()` синхронно отбрасывает повторный клик, пока `pending=true` (`zigbee-topology-action.ts:14`).
- AC2 — `failedSaveKeepsRetryableDraftWithoutScan`, `conflictCannotStartAndLeavesRetryableDraft` — PASS; `prepare` выходит `return` без `load()` при falsy/реджекте, `catch` в `_saveSettingsDialog` возвращает `busy:false` для ретрая.
- AC3 — `zhaUsesSaveThenReadWithoutRadioScan`, `savedOnRefreshDoesNotCommitOtherDraftFields` — PASS; `prepare: this.savedEnabled ? undefined : this.prepareLoad` — сохранённый ON не вызывает save.
- AC4 — все retire-сценарии (`disconnect/session/connection/user/permission/off`) + новый `detachedSaveCannotReacquireMetadata` — PASS; разобрано построчно выше.
- AC5 — `laterEditsSurviveKeepOpenAndRemainDirty`, `cleanCloseNeedsNoDiscardConfirmation`, unit «old sessions cannot change baseline» — PASS; `acceptDialogBaseline` фенсит по `owner`-сессии (`dialog-baseline.ts:36`).
- AC6 — `invalidFormCannotSaveOrStart`, `nonAdminCannotInvokeSaveCallback`, `standaloneWithoutCallbackRemainsSaveFirst` — PASS; `canPrepareLoad=canSave` использует тот же гейт, что обычная кнопка Save (`general-settings-dialog.ts:41`).
- AC7 — i18n 4 языков (en/ru/de/fr) сверены построчно, текст RU/EN совпадает с ТЗ дословно; смоки 360px × light/dark × keyboard — PASS.
- AC8 — `toggleAndRepeatedRenderDoNotSaveOrLoad` — PASS; соседний `smoke_zigbee_topology_job` (background/cancel/reopen) не регрессировал.

## Прочее по диффу

- Трейлеры `Issue: #1031` на каждом из 7 коммитов; `User-Visible: yes` ровно на
  `9c25cb409`, и в этом же коммите правки `docs/CHANGELOG.md` + `docs/CHANGELOG.ru.md`
  (проверено `git show --stat`).
- Release-ledger `docs/release-ledger/v1.82.0/1031.json`: `category: "stable-fix"`,
  обоснование — баг существующей (давно выпущенной) функции Zigbee-связей, не
  новой бета-фичи. `v1.82.0` — подтверждённый «Latest stable tag» (`docs/STATUS.md:21`),
  записи зигби-связей в `CHANGELOG.md` датируются задолго до текущего бета-цикла
  `v1.83.0` (открыт для #1005, `docs/STATUS.md:68`) — `introducedBy` не требуется,
  классификация корректна, milestone релиза не затрагивается неверно.
- i18n: все 12 новых ключей (`save_and_update`/`save_and_read_zha`/`save_and_load_help`
  × en/ru/de/fr) переведены, используются в обеих разметках компонента
  (встроенной и полной — `src/hp-zigbee-topology-settings.ts:392,435,441,481,506`),
  осиротевших ключей нет. Это единственный риск-класс, названный в этом заходе
  («ux», 12 новых ключей) — полностью покрыт AC7.
- Одно число — один источник: байт бандла `3 339 916` встречается в
  `scripts/monolith-baseline.json`, `docs/DEVELOPMENT.md` и комментарии автора —
  во всех трёх один и тот же источник (`node scripts/ratchets.mjs report`),
  сверено лично и совпадает точно.
- USER-GUIDE.md/.ru.md: текст кнопок и пояснения дословно совпадают с реализованными
  i18n-строками и ТЗ.

## Унаследовано из r1

Без повторного исполнения, но с точечной перепроверкой чтением (файлы не
менялись между материалом r1 `c3b63601f` и r2 `70a0f7e83`, т.к. merge-base с
`dev` идентичен):

- Принятие ТЗ — `docs/reviews/SPEC-REVIEW-1031-r1.md`, зелёный, High/Medium 0/0.
- Корректность продуктовой логики `zigbee-topology-action.ts`
  (`ZigbeeTopologyLoadGate` single-flight/epoch), `houseplan-editor-runtime.ts::_saveSettingsDialog`
  (валидированный CAS-writer, `keepOpen`, повторная проверка owner/connection/user
  перед решением закрыть/оставить диалог, возврат `boolean` как честный ACK —
  строки 9347-9417) и `general-settings-dialog.ts` (проводка `prepareLoad`/`canPrepareLoad`/`settingsSession`)
  — установлена в `CODE-REVIEW-1031-r1.md`; в этом раунде перечитана мной
  самостоятельно (раздел «Разбор дельты» выше опирается на неё) без расхождений.
- Трейлеры, changelog, release-ledger на коммите `9c25cb409` — приняты r1,
  переподтверждены мной `process-gate.mjs --issues` и прямым чтением diff.
- Не-скоуп (Python/WS API, admin-only, background jobs, геометрия, LQI #1029)
  — подтверждено в r1 чтением кода; в дельте r2 эти области не затронуты.

## Маршрут

`route: fix` (не `show`, вердикт зелёный — reclassify не применяется).
Побочных находок вне скоупа нет, новые issue не заводились (режим `mode=issues`
по `REVIEW_FINDINGS_POLICY`, снимок сверен — совпадает с доверенным снимком
prepare, расхождений нет; поводов его применять не возникло).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1031-zigbee-settings-refresh`, коммит `70a0f7e83486` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3845ee49b022a718357390ca219f07ca26ef5439`
  ```
  git log --all --format='%H %T' | grep 3845ee49b022
  ```
- Тело issue: `ca030988210605e5e20c9c6f17a1030eb1d2bf42ff0b58493b965f61c03647eb`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5ODksIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDg0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTQsIm91dHB1dF90b2tlbnMiOjQwNTg2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NzA1OSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjYzODkwOTUsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zNTIxNDN9XSwidHVybnMiOjYyLCJkdXJhdGlvbk1zIjo3MDI3MTQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjM1NzIyNywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5103 output_tokens=40605 cache_creation_input_tokens=167059 cache_read_input_tokens=6389095 num_turns=62 -->
