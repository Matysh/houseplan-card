# CODE-REVIEW-890-r1

Issue: #890 · трек: ask · заход r1 · блокирующих циклов израсходовано 0 из 4
Материал: `a0ed8cb8bccfd465c43b8832239c8fe3e0679711` (рабочая копия на нём, `git diff origin/dev...HEAD`, 7 issue-коммитов)
Предыдущий этап: SPEC-REVIEW-890-r2 — зелёный, ТЗ готово к разработке.

## Скоуп

ТЗ (тело issue #890) ставит шесть контрактных требований:
1. Cache — только cold-start hint, не authority поверх принятой/ожидающей пары; повторный `setConfig` той же инсталляции не откатывает принятую ревизию.
2. Принятый config write обновляет cache из согласованной пары; отказ localStorage не превращает success в failure; draft не попадает в cache как accepted.
3. Vacuum write передаёт свой optimistic attempt через writer; отказ без конфликта откатывает именно его; поздний отказ после новой authority её не трогает.
4. New-device ack владеет своей транзакцией: success снимает флаг, отказ восстанавливает именно свой ID без авто-retry.
5. config-save unauthorized ≠ backup unauthorized текст.
6. Смена HA-соединения/пользователя не передаёт старую authority новому контексту (queue/counter/rollback isolation), same-connection reconnect не теряет draft.

Изменённые файлы: `src/config-adoption.ts` (центральный класс идентичности), новые модули
`src/config-write-context.ts`, `src/new-device-ack.ts`, точки вызова в
`src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`,
`src/editors/vacuum-maps-section.ts`, `src/room-device-discovery.ts`, 4 словаря,
релиз-леджер, каноны (ARCHITECTURE/CONFIG-COMPATIBILITY/DEVELOPMENT/STATUS),
реестр мутантов, тесты.

**Риск по изменённым участкам (#707):**
- `migration` (`src/config-adoption.ts`, ~44 строки): покрыт AC1/AC2/AC3/AC6 — cache
  pairing, point-wise layout acceptance, context reset, optimistic ownership.
  Прочитан весь файл целиком, прослежены все пять публичных точек изменения
  идентичности (`adoptResponses`, `adoptMergedLayout`, `acceptConfigWrite`,
  `acceptPairWrite`, `acceptLayoutPosition`) и их юнит-тесты.
- `ux` (новый ключ `err.config_write_unauthorized` в de/en/fr/ru): покрыт AC5.
  Проверено, что он не вытесняет `backup.error.unauthorized` (общий `_errText`
  делится между config-save и прочими путями, но backup всегда формируется через
  отдельный `_backupErrorText`, который проверяет `backup.error.*` раньше и
  никогда не доходит до нового перехвата).

Трек `ask` → оба класса сверены с AC, маршрут `fix` (не `reclassify`, это поле
только для `show`).

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | PASS (принято без повтора) | Зелёный Validate на точном SHA `a0ed8cb8`: https://github.com/Matysh/houseplan-card/actions/runs/38639746978 |
| `npm run build` | PASS (прогнан локально) | Нужен был свежий `dist/` для ручного запуска смоков (не коммитится вне релизного коммита); результат совпал с Validate |
| `node scripts/mutation-gate.mjs --check` | PASS | 7 новых определений (`config-foreign-context-keeps-old-write-queue`, `config-foreign-reply-decrements-new-context-count`, `config-foreign-context-restores-old-optimistic-attempt`, `config-live-setconfig-restores-stale-cache`, `config-foreign-write-reply-revives-authority`, `vacuum-route-write-forgets-canonical-attempt`, `new-device-ack-forgets-rejection-ownership`) — все `ok`, `find`-якоря уникальны; 322/200 browser guards и 4 прежних warning совпадают с тем, что задокументировано в `docs/testing-notes/mutation-browser-guards.md` (не новые) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выполнено | Подтверждена широкая выборка по общим host-полям (`_regSignature`, `_cfgRev`, `_loadOk`, …) плюс зарегистрированная связь `smoke_new_device.mjs ← room-device-discovery.ts` (старая, #879) |
| `node demo/smoke_config_authority.mjs` (новый, центральная проба AC1/AC4/AC6, включая B-before-A race для View и editor writer) | PASS | Прогнан на свежей сборке материала |
| `node demo/smoke_vacuum_route_draft.mjs` | PASS | — |
| `node demo/smoke_marker_write_rollback.mjs` | PASS | — |
| `node demo/smoke_config_reload_race.mjs` | PASS | — |
| `node demo/smoke_cold_view_toggle.mjs` | PASS | — |
| `node demo/smoke_post_write_adoption.mjs` | PASS | — |
| `node demo/smoke_space_delete_with_devices.mjs` | PASS | — |
| `node demo/smoke_new_device.mjs` | PASS | — |

**Чего не проверял и почему:**
- `golden:verify` — диф не меняет рендер/геометрию, нет метки `ci:golden`, визуальных hunks нет.
- `npm run invariants` — диф не меняет геометрию модели; vacuum-write канонизация числовая, уже существующая, не новая.
- `pytest tests_backend` — Python не менялся.
- performance-гейт — не назван в AC.
- Исполнение зарегистрированных мутантов — по правилу трека: мутанты не гоняются в разработке ни на одном треке, только ночью; моя обязанность — убедиться, что защита названа мутантом с уникальным якорем (сделано через `--check`) и что юнит/smoke-тест содержит явный отрицательный сценарий без мутации (прочитано построчно для всех шести AC, см. ниже).
- Прямое применение патча к `src/*.ts` для ручного «покраснения» — инструмент Edit отказал с ожидаемым отказом прав («ревьюер не правит продуктовый код»); это ожидаемо, а не находка. Доказательство падения теста получено чтением (контрольный assert опирается на удаляемую строку один в один) плюс структурной проверкой `mutation-gate --check`, а не исполнением.
- Полный `npm run gate:small` — не повторялся; он уже входит в принятый Validate на этом SHA, повторный прогон только расходует бюджет без нового знания.

## Находки

Нет High. Нет Medium.

**Low (снято ревьюером, не блокирует):**
`src/houseplan-card.ts:5305`, функция `_persistDevicePlacement` — ранний guard
`if (this._serverStorage && (!isCurrent() || !this._loadOk)) throw new Error('config authority changed');`
не несёт `{ code: 'context-changed' }`, в отличие от второго guard в той же
функции тремя строками ниже (`:5333`) и от аналогичных мест в
`_sendConfigCandidate`/`_writeConfig`. Конкретный сценарий: контекст (HA-соединение)
меняется ровно в момент commit перетаскивания устройства, до начала записи —
`_errText` не находит код, выводит нелокализованный `e.message` =
«config authority changed» в тосте `toast.pos_save_failed`. Это не новый класс
дефекта: `_errText` специально документирован так обрабатывать error без кода
(«Errors WITHOUT a code... keep showing their message: there is nothing better
to show»), поведение существующее и принятое для всей кодовой базы. Окно гонки
узкое (между release pointer и первой проверкой guard, раньше первого `await`),
AC не называет этот путь (AC1–AC6 — про config-save/vacuum/ack, не про point-wise
drag commit), сам путь получил guard только сверх контракта, не по требованию
АС. Решение: не блокирует, зафиксировано как заметка для автора на будущую
полировку (однострочная правка — добавить `{ code: 'context-changed' }`), цикл
не открывается.

## Что проверено и корректно

- **AC1 (cache fence).** `restoreCached` (`config-adoption.ts:303`) теперь
  отказывает, если `this.config || this.acceptedCache` уже установлены —
  проверено юнит-тестом `#890 AC1: a repeated warm-cache restore cannot replace
  accepted or pending authority` и натively в `smoke_config_authority.mjs`
  (`liveSetConfigKeepsAccepted`, `historyPreserved`, `fixedFloorKeepsDraft`,
  `defaultFloorKeepsAuthority`, `coldHintPaintsWithoutWriter` +
  `coldWriteRefused`). `_loadOk`-гейт в `_sendConfigCandidate`/`_persistLayout`
  отдельно не даёт записи с холодного кэша до настоящего ответа сервера.
- **AC2 (accepted cache pairing).** Прослежена вся цепочка `rememberAccepted`
  во всех пяти точках мутации идентичности, включая тонкое различие
  `layResp === undefined` (конфиг-only acceptance, cache остаётся с прежним
  layout) vs `layResp === null` (явный пустой layout, cache обнуляется) —
  оба случая отдельно воспроизведены в
  `#890 AC2: config-only acceptance never pairs an unseen layout revision with
  old cached positions` построчной трассировкой с ожидаемыми `layout_rev`.
  Storage quota exception не отменяет already-accepted write — `smoke_config_authority`
  `cacheFailureKeepsSuccess`.
- **AC3 (vacuum attempt ownership).** `attempt` теперь действительно доходит
  до `_writeConfig`/`_saveConfigNow` (было: создавался и терялся — ровно баг
  F60 из issue); перед отправкой `attempt.attemptedFingerprint` синхронизируется
  с канонизированным кандидатом (`houseplan-editor-runtime.ts:1574`), поэтому
  нормализация транзитных float-координат не ломает `rollbackOptimistic`'s
  fingerprint-сравнение. Поздний отказ после новой independent authority не
  откатывает её — юнит `#890 AC3` в `vacuum-maps-section.test.mjs` и нативно в
  `smoke_vacuum_route_draft.mjs`.
- **AC4 (new-device-ack ownership).** Новый модуль `new-device-ack.ts` даёт
  acknowledgement собственный `beginOptimistic`/`epoch`-привязанный rollback;
  `transport`/`unauthorized` восстанавливает только свой ID без повторной
  автозаписи (`ackHasNoRetryLoop`), `conflict` перечитывает сервер, поздний
  независимый discovery не затирается. Три юнит-теста в
  `new-device-ack.test.mjs` покрывают оба кода отказа, conflict-reload и
  гонку с параллельным discovery; `smoke_config_authority`
  (`failedAckRestoresAttention`, `acceptedAckOnlyClearsItsId`) и
  `smoke_marker_write_rollback` (переписан под раздельную транзакцию ack/save)
  подтверждают то же на реальном диалоге устройства.
- **AC5 (разные тексты).** `configWriteErrorKey` перехватывает `unauthorized`
  только внутри общего `_errText`; явной проверкой (чтением, не догадкой)
  подтверждено, что backup export/import всегда проходит через
  `_backupErrorText`, который матчит `backup.error.*` раньше и никогда не
  доходит до нового перехвата — контекст backup не меняется, как требует ТЗ.
  `configWriteErrorKey({code:'conflict'})` остаётся `null` — conflict-тост не
  тронут. Все 4 словаря заполнены согласованным текстом.
- **AC6 (foreign HA fence).** Самая рискованная часть диффа — финальный коммит
  `a0ed8cb8` добавляет ровно то, что последний коммент автора называл
  известным незакрытым багом (общий `_writesPending`/`_writeChain` душил
  принятие B, пока не осела старая A). Прослежено построчно: `WeakSet`
  `optimisticAttempts` обнуляется в `resetContext()`, поэтому старый attempt
  навсегда теряет право на rollback даже при совпавшем content+revision у
  независимых инсталляций (юнит `#890 AC6: old-context rollback loses
  ownership...`); `ownsPending()` проверяет только `generation`, не
  `authority`, поэтому поздний `.finally()` чужого контекста не трогает
  счётчик нового. Автор дополнительно подтвердил это нативным свидетелем
  поверх обоих продакшен-writer'ов (View и editor) с удержанными promise —
  я прогнал именно этот файл (`smoke_config_authority.mjs`) и все сборки
  B-before-A (`editorFastLoadBeforeOldReply`,
  `editorLateOldReplyKeepsOwnCounter`, `editorOwnWriteSettlesItsCounter`,
  `viewFastLoadBeforeOldReply`, …) прошли зелёным. `ConfigWriteContext`
  использует тот же сигнал идентичности (`hass.connection ?? hass.callWS` +
  `user.id`), что уже работает в `configReloadContext`
  (`config-reload-authority.ts:192`) для несвязанной, но похожей задачи —
  это не новое допущение о стабильности `hass.connection`, а переиспользование
  существующего в кодовой базе, уже проверяемого прецедента.
  Temporary disconnect (`hass = null`) не считается сменой инсталляции —
  юнит `owner.observe(null) === false` плюс `owns(claim) === true` после.
- **Трейлеры.** Все 7 коммитов несут `Issue: #890`; `User-Visible: yes` стоит
  только на первом коммите `51ced875`, и именно в нём добавлены оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) — текст соответствует
  реализации (откат к старому кэшу, vacuum routes, New-флаг, разные тексты
  unauthorized), без лишних заявлений.
- **Release-ledger.** `docs/release-ledger/v1.80.1/890.json` →
  `category: stable-fix`. Проверено фактически, не на слово: `git show
  v1.80.1:src/houseplan-card.ts` действительно содержит `restoreCached` и
  `new_device_ids`-acknowledgement, `git show v1.80.1:src/editors/vacuum-maps-section.ts`
  содержит `persistRoutes`/`_saveConfigNow` — обоснование «эти пути уже есть в
  предыдущем stable» фактически верно, классификация оправдана.
- **tsconfig.test.json** — только добавляет два новых файла (`config-write-context.ts`,
  `new-device-ack.ts`) в список тестовой сборки, без смыслового изменения.
- **`test/config-adoption-ownership.test.mjs`** — ratchet-счётчик
  `_serverCfg` в `houseplan-card.ts` понижен `3 → 2` (а не повышен): прямое
  присваивание `_serverCfg = {...}` в `_ackNewDevice` вынесено в
  `new-device-ack.ts`, что проходит через `stageLocalConfig`/`setConfig`, а не
  через сырое поле — архитектурное улучшение, не ослабление теста.
- **Документация.** ARCHITECTURE/CONFIG-COMPATIBILITY/DEVELOPMENT/STATUS и
  `docs/testing-notes/mutation-browser-guards.md` обновлены точно: числа
  (322/200, 160) совпадают с живым выводом `mutation-gate.mjs --check`, не
  разошлись.

## Вердикт

Зелёный. High: 0, Medium: 0. Единственная находка — Low, снята ревьюером без
влияния на вердикт (см. выше). Все шесть AC доказаны либо исполняемым тестом
с подтверждённым отрицательным сценарием/зарегистрированным мутантом, либо
прослежены построчным чтением с явной записью «проверено чтением». Самый
рискованный участок диффа (B-before-A гонка по общим write-очередям,
добавленная последним коммитом в ответ на известный баг) — воспроизведён
нативным браузерным свидетелем и перепрогнан мной на точном материале.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/890-config-authority`, коммит `a0ed8cb8bccf` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `39356d21350662ad93269bf23dc06afce7ce46e5`
  ```
  git log --all --format='%H %T' | grep 39356d213506
  ```
- Тело issue: `53f15d481a01b5f9dde0f6077b245ff062eafa0f6b4cc153e5885336fca9395b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1MzMsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NjIyOTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTUyLCJvdXRwdXRfdG9rZW5zIjo1NzcxMywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxODkyODcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMDQyNjU0OCwiY29zdFVzZEVzdGltYXRlIjozLjQxOTg5MTYwMDAwMDAwMX1dLCJ0dXJucyI6MTA0LCJkdXJhdGlvbk1zIjo3MjY1MzUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjozLjQyNDUxNDYwMDAwMDAwMDYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4685 output_tokens=57731 cache_creation_input_tokens=189287 cache_read_input_tokens=10426548 num_turns=104 -->
