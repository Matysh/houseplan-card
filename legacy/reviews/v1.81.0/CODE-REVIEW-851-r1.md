# CODE-REVIEW-851-r1

Материал: `653325410fd5d63b3d3c4fbe07f2f6e3aaf479fc` (рабочая копия на этом SHA,
`git rev-parse HEAD` сверен). Один коммит в диапазоне `origin/dev..HEAD`:
«Protect editor drafts and allow safe exit from failed wall chains»,
трейлеры `Issue: #851` / `User-Visible: yes` на месте. Трек: ask. Заход r1,
блокирующих циклов использовано 0 из 4. Маршрут вердикта зафиксирован
промптом: `fix`.

## Скоуп

Зелёное `SPEC-REVIEW-851-r1` приняло АС1–АС5: защита dirty create для
marker/room (не только edit), владение сессией диалога/async-решений,
безопасный выход из отказавшего `_finishWallChain`, честная формулировка
pending/saved в новых i18n-ключах, явное снятие low-гипотез без witness
(empty bounds, diagonal handles, stylus parity). Диапазон правки:
`src/editors/{dialog-baseline,draft-close,draft-actions,room-save}.ts`,
`src/editor-chain-exit.ts` (новые), `src/houseplan-editor-runtime.ts`,
`src/houseplan-card.ts`, `src/hp-dialog.ts`, `src/editors/{marker-dialog,
room-settings-dialog}.ts`, `src/radar-setup.ts`, 4 локали, тесты/смоки,
бюджет бандла/монолита, changelog RU/EN, release-ledger.

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build` + bundle-sync | Зелёные — приняты по ссылке на Validate этого SHA (run 38440941406, success); дополнительно сам прогнал `npm run build` (tsc --noEmit + rollup) и `npm run bundle:sync` локально — тоже зелёные | #343: дешёвые гейты на этом SHA уже подтверждены |
| `node scripts/mutation-gate.mjs --check` (static-readiness, без исполнения) | PASS: `definitions=1388, execution=0`; новые/изменённые мутанты `editor-draft-close-ignores-session-owner`, `editor-chain-exit-skips-current-intent-check`, `dialog-ha-disconnected-reject-reopen-enabled` — все `ok` (анкор найден в текущем исходнике, guard парсится) | Мутанты в разработке не исполняются (§2.7, #709) — проверена только регистрация, не caught/compile |
| `node demo/smoke_editor_draft_exit.mjs` (AC-смок, реальная сборка) | Зелёный, все 33 ассерта `true` | Сам собрал (`npm run build && bundle:sync`) и прогнал в headless Chromium; после — `git checkout -- dist && git clean -fd dist` вернул рабочую копию к исходному состоянию |
| `node demo/smoke_room_settings.mjs` | Зелёный (40 ассертов) | Регрессия по изменённому `room-settings-dialog.ts` |
| `node demo/smoke_wall_chain_merge.mjs` | Зелёный (9 ассертов) | Регрессия по переименованному `_finishWallChain`→`_finishWallChainForNavigation` на пути слияния стен |
| `node demo/verify_ha_dialog_discard_recovery.mjs` (офлайн authentic HA) | Зелёный, включая новые `851 new device: authentic HA Keep restores draft and focus/discard closes` | Целевая проверка риска `hp-dialog.ts:493` (двойной `requestAnimationFrame` для восстановления фокуса) на настоящей сборке HA-диалога, не на подделке |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Выполнен; 176 прямых совпадений (широкий дифф по общим полям рантайма — `_mode`, `_tool`, `_curSpaceCfg` и т.п.), 1 зарегистрированная связь | Полный прогон всех 176 непропорционален объёму задачи (§8); прогнал выборочно самые рискованные по теме диффа (выше), остальное — предрелизная обязанность, не гейт этого ревью |

### Риск по изменённым участкам (трек ask — сверка с AC ТЗ)

- **perf** `src/hp-dialog.ts:493` (`requestAnimationFrame`) — не отдельный необследованный risk-класс: это одноразовая (не в цикле) двойная отложенная попытка восстановить фокус после переоткрытия модалки, прямо требуемая контрактом п.2 ТЗ («Esc/отказ в подтверждении… возвращают фокус в редактируемый элемент», AC2). Подтверждено исполнением на настоящем HA-диалоге (`verify_ha_dialog_discard_recovery.mjs`, кейсы `continue restores input focus` и новый `851 new device: … Keep restores draft and focus`), а не только разбором кода.
- **ux** новые ключи `editor.chain_finish_failed_title/_message`, `editor.chain_finish_pending_message`, `editor.keep_editing`, `editor.leave_unfinished` (de.json и зеркально en/fr/ru) — покрыты таблицей UX-текстов ТЗ (контракт, раздел «i18n») и контрактом п.5 АС4; `chain_finish_pending_message` не назван в таблице буквально, но прямо предписан ТЗ («имена ключей допускают техническое уточнение», «при pending/refused write сообщение не должно объявлять стены сохранёнными») — текст реализации (`The drawn walls are saved` только при `saved`, иначе явно `does not confirm...`) точно соответствует условию. Все 4 локали синхронны построчно.

Оба класса покрыты AC ТЗ; оснований для `reclassify` нет (и этот промпт их не просит — трек ask, маршрут `fix`).

### Чего не проверял

- Полную матрицу из 176 «прямых совпадений» smoke-select — непропорционально объёму правки (общие поля `_mode`/`_tool`/`_space` трогает почти любой editor-diff); прогнал три наиболее рискованных по теме (room-settings, wall-chain-merge, authentic HA fixture) плюс собственный AC-смок задачи.
- `golden:verify` — метки `ci:golden` нет, визуальный рендер плана не меняется (только текст, `inert`-атрибут формы и фокус), riск кадра не вижу.
- `pytest tests_backend` — Python не менялся.
- `npm run invariants -- --config <export>` — диф не меняет геометрические алгоритмы (wall union/snap/resize); он оборачивает существующие вызовы (`_commitPhysicalGeometry`, `_finishWallChain`) навигационной/сессионной защитой и на коммите-неудаче восстанавливает ровно тот же локальный снимок состояния, что был до попытки — новой геометрической записи или трансформации нет.
- Исполнение мутантов (caught/compile) — по правилу #709 это ночная обязанность, не ревью; проверил только статическую регистрацию (выше).
- Touch-вариант `HP_SMOKE_WIDTH=390` для нового смока — не гонял сам (документирован в `docs/DEVELOPMENT.md` как ручной, не CI-автоматический прогон; touch для редактора — best effort по ТЗ, а не предмет этой задачи).

## Находки

Нет ни одной. Разбор per-AC ниже.

## Что проверено и корректно (по AC)

- **AC1** (dirty create защищён, pristine/edit/radar не регрессируют): `markerDirty`/`roomDirty` сравнение против снимка, взятого в момент открытия/каждого следующего элемента очереди face/split (`rememberRoomBaseline` добавлен во все точки открытия: `_beginWallFaceBatch`, `_splitClick`, `_decideWallFace`); `_openInboxMarker` корректно переснимает baseline ПОСЛЕ подстановки системных полей (`binding`/`name=''`), иначе системная подстановка ложно считалась бы вводом пользователя — реализация это учла. Транзиентные ключи (`busy`, `uploadId`, раскрытие списков) исключены из отпечатка в уже существующих `marker-form-state.ts`/`room-form-state.ts` (не в этом диффе, но проверено чтением — не регрессирует). Подтверждено исполнением `smoke_editor_draft_exit.mjs` (`pristineNewDeviceClosesWithoutQuestion`, `newDevice*HasOneQuestion/KeepPreservesInputAndFocus/DiscardDoesNotWrite`, `returnToInitialIsPristine`).
- **AC2** (Keep/discard, identity/generation сессии, warm remount): `dialogSession`/`sessions` WeakMap выдаёт новый объект-токен на каждый `rememberDialogBaseline`, включая `restoreDialogBaseline` тёплого ремаунта (юнит `#851 dialog ownership is replaced even when identical values are reopened or transferred warm` подтверждает отдельный токен для `warm`). `requestDraftClose` перепроверяет `current()` и `dialogSession(...) === owner` и до, и после await подтверждения — поздний ответ A не способен закрыть/перефокусировать B (юнит «late answer A cannot close or refocus B», мутант `editor-draft-close-ignores-session-owner` зарегистрирован и статически годен). Радар: один общий вопрос на закрытие (`requestMarkerClose` выбирает ровно один `request` — либо discard, либо radar — никогда оба), что прямо закрывает риск «double confirm с radar» из аналитики. Исполнением подтверждено `lateRoomSaveDoesNotCloseB` и authentic-HA `continue restores input focus`.
- **AC3** (refused Save сохраняет форму; stale face — fail-closed без старой геометрии): `saveRoomEdit` (`room-save.ts`) не очищает `_nameSel`/`_roomDialog`/baseline до `await this._saveConfigNow(attempt)`; на успех — проверка identity (`dialogSession === owner && _space === spaceId && _roomEditId === roomId && roomDraftKey === savedDraft`) перед закрытием/обнулением; на ошибку — `_rollbackOptimistic`, baseline и ввод не трогаются. В `_commitRoom` два разных отказа различены буквально: «main room исчез» (stale, #874) — `forgetRoomBaseline` + явный toast + закрытие формы, геометрия не применяется; «локальный preflight отказал» (`!committed`) — восстановление `_path/_activeWallChainId/.../_splitSel` из снимка `session`, взятого до попытки, без `forgetRoomBaseline` — форма остаётся рабочей для повтора. Подтверждено исполнением: `invalidRoomRangeIsProtectedAndRefocused`, `refusedRoomSaveKeepsFormAndInput/RollsBackConfig/KeepsDirtyProtection`, `retrySaveClosesOnlyAfterAcceptance`.
- **AC4** (failed finish: продолжить/повторить/выйти; saved partitions не удаляются; stale navigation игнорируется): `EditorChainExit.request/invalidate` — монотонный `sequence`, поздний ответ после `invalidate()` не достигает `leave/navigate` (юнит «replaced intent, changed geometry and disconnected lifecycle reject stale answers»; мутант `editor-chain-exit-skips-current-intent-check` зарегистрирован). `finishWallChainForNavigation`'s `current` замыкает mode/tool/space/revision/epoch/chain/путь/обе dialog-сессии — широкий fence именно по перечню контракта п.6 ТЗ. `leave()` вызывает только `_cancelPath()` (чистит исключительно session-local `_path/_activeWallChainId/_activeWallChainPartitionIds/...`, не трогает `sp.partitions`/`sp.walls`/`_geometryHistory`). Каждая существующая точка вызова `_finishWallChain` для навигации (`_setMode`, `_activateMarkupTool`, Reset-кнопка, `_slideTo`, `#space`-хэш, Escape) переведена на обёртку — статически закреплено тестом `#477` (`writer-fixed-point.test.mjs`, точечные `assert.match` по срезам функций). Хэш-навигация: `_onHashChange` откатывает URL на фактический этаж до решения и восстанавливает запрошенный хэш только после согласия — проверено `pendingHashRestoresActualFloor/rejectedHashKeepsUrlAndFloor/acceptedHashExecutesRequestedNavigation`. Полный матричный смок прогнал сам: `failedFinishOffersSafeExit/KeepChangesNothing`, `leaveReleasesOnlySessionAndSelectsRequestedTool`, `failedEscapeLeavesIntoSelect`, `{reset,space,editor,retry}LeaveDoesNotRewriteWallsOrHistory/ReachesDestination`, `retryFinishesThroughOriginalSafeTransaction` — все `true`, включая то, что `writes`/`_geometryHistory.size` не меняются при отказном выходе.
- **AC5** (low-гипотезы: witness или явное снятие; touch floor и route-reset не тронуты): `invalidRoomRangeIsProtectedAndRefocused` — witness для «initial validation» (ранее красный сценарий теперь защищён и рефокусирован). Empty bounds / diagonal handles / stylus — явно не тронуты, задокументированы как снятые без witness (комментарий автора, `docs/DEVELOPMENT.md`). `_leaveCardRoute` по-прежнему вызывает `_setMode('view', false)`, и `interactive=false`-ветка `finishWallChainForNavigation` молча `_cancelPath()` без вопроса — проверено чтением: это единственный путь, где `animate=false`, то есть ровно «реальный route departure», а не пользовательский жест (grep подтвердил единственное место вызова `_setMode(..., false)`). Touch — ширина по умолчанию 1100 (desktop), `HP_SMOKE_WIDTH=390` — ручной прогон, не автоматизирован (зафиксировано выше в «чего не проверял»), что соответствует «touch best effort» из ТЗ, а не обязательству этой задачи.

**Трейлеры и release-артефакты.** `Issue: #851` / `User-Visible: yes` на коммите; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены в том же коммите, текст на двух языках описывает одно и то же поведение без расхождений числа/факта. `docs/release-ledger/v1.80.1/851.json`: `category: stable-fix`, rationale обоснован (формы/Save/finisher уже есть в v1.80.1, это защита существующих сценариев, не полировка новой беты) — соответствует авторскому суждению §11.9, `introducedBy` не требуется (не внутрибетная правка).

**Один источник чисел.** `LAZY_EDITOR_GZIP_CEILING = 258_481` (bundle-budget.mjs) и `bundleBytes: 2815621`/`hostRefs: 5216`/`harnessPrivates: 102` (monolith-baseline.json) — согласованы между собой и с текстом авторского комментария об измерении; других мест с тем же числом не нашёл, расхождения источника нет.

## Вердикт

Зелёный. AC1–AC5 доказаны либо исполнением (named smokes, authentic HA fixture, unit-тесты с реальным падением на мутации по коду — мутанты зарегистрированы и статически годны), либо разобраны чтением с явной пометкой там, где исполнение не требовалось (route-departure ветка). Защитные AC имеют непустой столбец «чем краснеет» — мутант в реестре или воспроизведённый негативный сценарий в самом тесте. Документация (ARCHITECTURE/DEVELOPMENT/USER-GUIDE ru+en/UX-MODES/WALL-THICKNESS), i18n (4 локали), changelog и release-ledger согласованы с кодом и друг с другом.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/851-editor-dirty-exit`, коммит `653325410fd5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0c02144caa3f2d993a07f505fe6fa0536c11793c`
  ```
  git log --all --format='%H %T' | grep 0c02144caa3f
  ```
- Тело issue: `56f629ef2e3079f3ca8aa4fe1b46f3cbdb0e8798ed3b8f1f03464667192c6101`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0OTYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTg2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNTgsIm91dHB1dF90b2tlbnMiOjQ1Njc5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2ODA1NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjk5NDY5MjQsImNvc3RVc2RFc3RpbWF0ZSI6My4xMTg3MDY4MDAwMDAwMDA0fV0sInR1cm5zIjo5MiwiZHVyYXRpb25NcyI6NzcyMzQxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4xMjMyOTI4MDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4654 output_tokens=45697 cache_creation_input_tokens=168054 cache_read_input_tokens=9946924 num_turns=92 -->
