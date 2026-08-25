# CODE-REVIEW-282-r1

- **Issue:** #282 — стабильная идентичность сегментов стен (ADR Stage 1)
- **Ветка:** `issue/282-wall-geometry-model`, HEAD `5adfdb5d` (после ребейза на `origin/dev` `f2460dc8`)
- **ТЗ:** `docs/specs/282-stable-wall-segment-identity.md` (spec-review зелёный на r2, `2f30c481`)
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4 до этого вердикта
- **Вердикт:** **красный**

## 1. Скоуп проверки

Диапазон: `git diff origin/dev...HEAD` (62 файла, +3641/−337), т.е. весь рабочий цикл
Stage 1 — persisted `wall_segments[]` catalog, `rooms[].wall_ids[]`, tagged
opening host, единый identity barrier `commitWallSegmentModel`/
`commitWallSegmentModelInPlace`, backend-зеркало (`wall_segment_model.py`,
`validation.py`), миграция v7→v8, compatibility-проекция `walls[]`, документация,
i18n, тесты (unit/backend/invariants/benchmark/mutation-gate/golden).

Это не локальная правка — это ревью полной первой реализации основного этапа
задачи, поэтому разбор велся полным объёмом (PROCESS.md §2.10: «разбор остаётся
полным, если ... задета новая подсистема» — здесь затронута каждая структурная
операция геометрии стен). Раздел «Унаследовано из r(N−1)» не нужен: это первый
заход код-ревью.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit/frontend | `npm test` | 1321 тестов, 1320 passed, 1 skipped, 0 failed |
| Build + sync bandle | `npm run build && npm run bundle:sync` + `cmp` трёх копий | зелёный, `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` побайтово идентичны |
| Docs fingerprint | `node scripts/check-docs.mjs` | зелёный (7 файлов, 10 внешних ссылок) — обязателен, диф трогает `src/**` |
| Model invariants | `npm run invariants -- --config <large-house.mjs, до и после миграции>` | зелёный на pre-v8 и post-v8 конфиге; расширенные v8-проверки (`room_wall_ids`, `opening_host→wall`) в `scripts/model-invariants.mjs` реально добавлены и сработали |
| Migration benchmark | `npm run benchmark:wall-model` | зелёный: 10 000 атомов, p95 208–284 мс (бюджет 500 мс), `passed:true` |
| Smoke selection | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 29 прямых совпадений, 6 зарегистрированных связей, 7 слабых, из 190 всего — вывод приложен ниже (§4) |
| Golden | `npm run golden:verify` | **красный**: 2 из ~140 сценариев — `optimize-orphan-references-dark-en`, `optimize-orphan-references-light-ru` (diffRatio 0.085/0.094 при пороге 0.0008) |
| Named/registered smokes | 6 «зарегистрированная связь» + 28 «прямое совпадение» (все, кроме уже покрытых) | **2 красных из 6** зарегистрированных, **7 красных из 28** прямых — см. §4 |
| Backend pure | не прогонялся мной (см. §6, «чего не проверял») | author указывает 146 passed/1 skipped локально на Windows |
| `pytest tests_backend` (полный, Linux) | не прогонялся | пре-релизный гейт, вне объёма код-ревью (§8) |
| Performance-профили (full performance_smoke) | не прогонялся | пре-релизный гейт |

Дешёвые гейты все зелёные. Расширенные (invariants, benchmark, smoke-select,
golden, целевые smoke) прогнаны, потому что diff меняет геометрию/ссылки на неё
и видимый результат (AC15 добавляет строку в диалог Optimize) — именно то
сочетание, для которого PROCESS.md §8 требует их «по необходимости». Именно эти
прогоны, а не дешёвые гейты, и нашли блокирующие находки ниже.

## 3. High — блокирующие находки

### H1. #278-guard «отклонить правку деградированного пространства» больше не срабатывает

**Файл:** `demo/smoke_wall_union_isolation.mjs` (не тронут этим диффом — 0 строк в
`git diff --stat origin/dev...HEAD`), корень вероятно в
`src/houseplan-card.ts:7261-7307` (`_commitPhysicalGeometry`).

**Воспроизведение:** тест не изменён этим диффом. На `origin/dev` (f2460dc8,
собран отдельным git-worktree, тот же `npm run build && npm run bundle:sync`):

```
node demo/smoke_wall_union_isolation.mjs → OK (все 11 проверок true)
```

На HEAD (`5adfdb5d`), дважды подряд, детерминированно:

```
"degradedPhysicalEditRejected": false      (ожидалось true)
"rejectedEditHasNoHistoryOrWrite": false   (ожидалось true)
"rejectedEditHasLocalizedToast": false     (ожидалось true)
FAILED (3)
```

Сценарий смока (issue #278): на фикстуре с уже деградированным canonical-union
(`status: 'degraded-extra'`) прямая правка толщины стены (`walls[0].cm += 1`)
должна быть отклонена `_checkSpacePhysicalGeometry` без записи в историю и без
WS-записи, с тостом `toast.geometry_unsafe`. Сейчас `writes !== 0` и/или
`_geometryHistory.size !== 0` — то есть **правка прошла и была сохранена**, хотя
пространство остаётся геометрически некорректным (то самое, что #278 явно
запрещает).

Это прямое попадание в риск, названный самим ТЗ (§16): «Новая identity
используется для удаления старых geometry guards» — и в AC12: «Точный ID не
является поводом удалить существующую union isolation либо ослабить geometry
preflight». Похоже, что перестройка `wall_segments`/`walls[]` внутри
`commitWallSegmentModel` (переписывает `space.walls` целиком из catalog,
`wall-segment-model.ts:482-486`) меняет вход, который видит
`_checkSpacePhysicalGeometry` в `_commitPhysicalGeometry` (строка 7287), и старая
деградированная конфигурация после прохождения через барьер перестаёт
распознаваться как небезопасная — либо fingerprint-guard на строках 7279-7284
("no-op" ветка) срабатывает раньше, чем должен. Это не разобрано до конца — это
находка «оно не работает», а не диагноз; автору нужно трассировать
`_commitPhysicalGeometry` на этой фикстуре.

**Доказательство:** тест умеет падать (см. воспроизведение — падает на HEAD,
проходит на dev с байт-идентичным файлом теста).

### H2. Широкая регрессия структурных операций редактирования

**Файлы:** восемь именованных demo-smoke, ни один не тронут этим диффом
(`git diff --stat` подтверждён для каждого — 0 строк).

Все восемь **зелёные на `origin/dev`** (проверено тем же способом — отдельный
git-worktree на `f2460dc8`, идентичный собранный бандл) и **красные на HEAD**,
детерминированно (перепроверено вторым прогоном для двух из них):

| Smoke | Упавшая проверка | Что означает |
|---|---|---|
| `smoke_resize_pointer_real_plan.mjs` | `both_rooms_commit_ten_steps`, `wall_metadata_preserved` (24 записи толщины → 29), `undo_byte_exact` | Resize на реальном 8-комнатном плане плодит лишние атомы вместо чистого частичного split; Undo **не** восстанавливает byte-exact исходный конфиг — возвращает раздутый v8-catalog вместо исходного v7-документа |
| `smoke_wall_chain_thickness.mjs` | `legacyResumedFullVector` | продолжение (resume) ранее сохранённой цепочки стен теряет полный вектор толщины |
| `smoke_unified_wall_tool.mjs` | `cleanSplitRetainsParentMetadata`, `cleanSplitConsumesDivider` | «чистый» split цепочки не сохраняет метаданные родителя и не поглощает divider — то самое split-lineage поведение, которое AC4 требует доказать |
| `smoke_wall_face_overlap.mjs` | `partialOverlapKeepsRoomsUntilDecision` | частичное перекрытие граней не удерживает комнаты до явного решения пользователя |
| `smoke_edit_walk.mjs` | `walk_first_floor_seed1/2/3` (все три) | fuzz-walk (случайные ресайзы) на фикстуре `real-plan-first-floor.json` расходится с ожидаемым инвариантом на каждом из 3 сидов; `real-plan-second-floor.json` не задет |
| `smoke_editor_tabs.mjs` | `tabCrossLimitKeepsDraftWithFeedback` | лимит на cross-стены при рисовании перестал сохранять черновик с обратной связью |
| `smoke_plan_snap_overlay.mjs` | `openingGapDoesNotActivateSnap` | снап-оверлей активируется там, где не должен (зазор проёма) |
| `smoke_partition_openings.mjs` | `tooShortPartitionHasNoPreviewAndExplainsWhy`, `hostBodyHasFullDepthOpeningGap`, `rigidHostMoveKeepsTAndMovesProjectionAtomically` | предпросмотр слишком короткой перегородки, полнота глубины проёма и атомарный перенос host+projection при жёстком перемещении — все три ломаются |

**Доказательство:** все девять (H1 + 8 из этой таблицы) — тесты, которые умеют
падать: зафиксирована пара «зелёный на dev / красный на HEAD» на байт-идентичном
файле теста для каждого. Это не флуктуация — `wall_union_isolation` и
`partition_openings` перепроверены повторным прогоном с тем же результатом.

Из 34 релевантных по `smoke-select.mjs` смоков (6 «зарегистрированная связь» + 28
«прямое совпадение», кроме уже покрытых в реестре), не прогнаны только 7 «слабая
связь, одно распространённое имя» (`_path`) — они не были приоритетными на фоне
уже найденных 9 красных, но и не гарантированно зелёные; см. §6.

**Итог по H1+H2:** это прямой ответ на обязанность ревьюера «оно вообще
работает» (PROCESS.md §2.7). Ответ — нет, не в текущем виде. AC3 (identity не
зависит от геометрии), AC4 (split/merge lineage), AC6 (opening host), AC8
(read-only/atomic failure), AC12 (regression floor) заявлены как доказанные
именно этими и смежными смоками/автотестами, но конкретно эти девять
доказательства не проходят на предъявленном коде. Обе находки блокируют
(High), проверять глубже уже не требуется по методологии — предъявленных
детерминированных воспроизведений достаточно, чтобы вернуть задачу автору.

## 4. Medium — по существу задачи (чинятся в этом же issue, #202)

Ниже сохранены для одного цикла ревью: даже после устранения H1/H2 эти находки
останутся, и лучше не резать возврат на несколько дублирующих раундов.

### M1. AC15 добавил новую строку в Optimize-диалог — golden baseline не обновлён

`npm run golden:verify` (не тронут этим диффом: `demo/golden/matrix.mjs` и
`harness.mjs` — 0 строк в diff) красен на двух существующих сценариях:
`optimize-orphan-references-dark-en` (diffRatio 0.0845 при пороге 0.0008),
`optimize-orphan-references-light-ru` (0.0940). Разница — ровно новая строка
диалога «Wall segments stabilised: 25.» / «Стабилизировано сегментов стен: 25.»
(AC15, `gs.wall_segments_migrated`), подтверждено визуально по
`artifacts/golden/diff/optimize-orphan-references-dark-en.png` и `actual/…png`.
Изменение видимого результата — ожидаемое и правильное, но §18 ТЗ и PROCESS.md
§3.13 требуют принятия нового эталона только через
`npm run golden:accept -- --reviewed` на полном Linux CI-артефакте; сейчас
`demo/golden/baselines/**` не тронут диффом вовсе.

### M2. AC5 «executable source/AST guard + bypass mutant for each writer family» реализован уже, чем заявлено

`test/wall-segment-model.test.mjs:191-205` — не AST, а построчный `indexOf`/regex
по двум именованным методам (`_commitPhysicalGeometry`, `_applyGeometryState`),
проверяющий, что каждый содержит нужный вызов. Это разумный choke-point тест,
но не «перечисление всех входов записи», как заявлено в AC5 и повторено в
`docs/TESTING.md` («Structural writers are enumerated by
`scripts/mutation-gate.mjs`»). В самом `scripts/mutation-gate.mjs` (строки
2875-2887) — ровно один мутант, откатывающий вызов в
`_commitPhysicalGeometry`; для вызова в `_applyGeometryState` (Undo/Redo restore,
строка ~7397 диффа) и для вызова в `src/plan-optimizer.ts:656`
(`commitWallSegmentModelInPlace` внутри `optimizePlans`) — **никакого мутанта
нет**. Гипотетический новый метод-писатель, минующий оба известных choke-point и
вызывающий `_writeConfig` напрямую, не будет пойман ни тестом, ни
mutation-gate — то есть именно тот сценарий, который явно называет AC5
(«новый путь записывает … партиции … мимо barrier»), не покрыт механически.
Формулировку в `docs/TESTING.md` и/или объём guard нужно привести в
соответствие.

### M3. `wall_model_client_outdated` не срабатывает в реалистичном сценарии старого клиента

`validate_wall_model_transition` (`custom_components/houseplan/validation.py:138-155`)
поднимает `WallModelClientOutdatedError` только когда `old_model >= 8 and
new_model < 8` — то есть только если клиент явно откатил `model_version`. Но §10.2
ТЗ описывает другой, более реалистичный случай: старый клиент **сохраняет**
`model_version: 8` (просто эхом), не трогает `wall_segments`/`wall_ids`, но
меняет `poly`/`walls`/openings. Этот случай ловит независимая
`_config_wall_segment_invariants` (validation.py:1718-1808, часть
`CONFIG_SCHEMA`, применяется декоратором `websocket_command` **до** тела
`ws_config_set`) — но она поднимает обычный `vol.Invalid`, не
`WallModelClientOutdatedError`, поэтому код ошибки не `wall_model_client_outdated`.
Фронтенд показывает дружелюбный тост только по точному совпадению кода
(`src/houseplan-card.ts:7499`, `:15746`: `e?.code === 'wall_model_client_outdated'`).
Итог: частичная запись всё ещё не проходит (безопасность данных сохраняется), но
пользователь вместо «обновите карточку и перезагрузите страницу» увидит общую
ошибку схемы. `tests_backend/test_wall_segment_model.py:145-168` покрывает только
узкий explicit-downgrade вариант, не этот.

### M4. Регрессионный тест issue #248 ослаблен без обновления фикстуры

`test/plan-optimizer.test.mjs`, тест «issue 248 Optimize stays a no-op across the
lattice storage round-trip» (диапазон AC12: #197/#224/#249/…/#288-302 включает
идемпотентность Optimize):

```diff
-      assert.deepEqual(first.config, storageRoundtripFixture.expected.config);
+      assert.equal(first.config.model_version, PLAN_MODEL_VERSION);
+      assert.ok(first.config.spaces.every((space) => Array.isArray(space.wall_segments)));
+      assert.deepEqual(
+        first.config.spaces.map((space) => space.rooms.map((room) => room.poly)),
+        storageRoundtripFixture.expected.config.spaces.map((space) => (
+          space.rooms.map((room) => room.poly)
+        )),
+      );
```

`test/fixtures/optimize-storage-roundtrip.json` не тронут этим диффом (0 строк) —
его `expected.config` остался в v7-форме и не отражает реальный v8-выход, поэтому
полное побайтовое сравнение стало технически невозможным без правки фикстуры и
было заменено сравнением только `rooms[].poly`. Побочный эффект: тест больше не
проверяет byte-parity `wall_segments`/`wall_ids`/`walls[]`-проекции для этого
именованного регрессионного сценария — то самое ослабление, которое AC12
запрещает как побочный эффект.

## 5. Что проверено и корректно

- **Migration determinism/idempotence** — `test/wall-segment-model.test.mjs`
  (детерминированный hash-seed, суффиксы `-2`/`-3` при коллизии, идемпотентность
  повторного `commitWallSegmentModel`) читал и прогонял; тесты реальные (проверял
  `deterministicWallSegmentId` вручную по независимо вычисленному
  SHA-256/base32) — совпадает.
- **Backend-зеркало валидации** (`_config_wall_segment_invariants`,
  `validation.py:1718-1808`) — независимая от фронтенда проверка unique-id,
  owner-count 1/2, dangling refs, edge-geometry parity, `walls[]`↔`wall_segments`
  parity, opening host fit/overlap; прочитано полностью, соответствует AC2/AC11.
- **Import/export remap** (`import_export.py`, `build_space_merge`) — remap всех
  id идёт через `secrets.token_hex(4)`, никогда через геометрическое совпадение;
  соответствует AC10 и явному запрету ТЗ («collision с target никогда не
  resolve-ится геометрическим совпадением»).
- **i18n** — новые ключи `toast.wall_model_migration_blocked`,
  `toast.wall_model_client_outdated`, `gs.wall_segments_migrated`,
  `wall_model.reason.*` присутствуют и совпадают в en/ru, с одинаковыми
  плейсхолдерами.
- **Документация** — `WALL-THICKNESS.md`, `ARCHITECTURE.md`,
  `CONFIG-COMPATIBILITY.md`, `CANVAS.md`, `TESTING.md`, `USER-GUIDE.{ru,}.md`
  обновлены содержательно и точно описывают новую модель;
  `USER-GUIDE.ru.md`/`.md` используют «стабильный внутренний идентификатор» только
  в контексте объяснения автоматического обновления старого плана — соответствует
  исключению AC16, не течёт в обычный UI.
- **`config-field-registry.mjs`** — `wall_segments`, `rooms[].wall_ids`,
  `room_drafts[].segments[].id`, `openings[].host=wall` зарегистрированы как
  `current` v8, с описанной миграцией/совместимостью.
- **Performance** — `npm run benchmark:wall-model` реальный (не no-op,
  синтетическая геометрия 10 000 атомов), p95 208-284 мс < 500 мс бюджета.
- **Единственный источник числа** — толщина теперь имеет один источник
  (`wall_segments[].cm`), `walls[]` — регенерируемая проекция, backend проверяет
  их точное соответствие построчно (validation.py:1752-1766); `test/single-source-numbers.test.mjs`
  не тронут этим диффом и продолжает покрывать форматирование.
- **Трейлеры** — `Issue: #282`, `User-Visible: yes` на коммите реализации; оба
  changelog (RU+EN) правлены в этом же коммите с содержательным описанием
  пользовательского эффекта (без обещания нового UI).

## 6. Чего не проверял и почему

- **Полный `pytest tests_backend` на Linux/CI** — недоступен в этой среде
  (`homeassistant` не установлен, только pure-subset потенциально прогоняем;
  чтение кода вместо исполнения для backend-веток `test_ha_import_export.py`,
  отмечено как «проверено чтением» в переписке с фоновыми агентами, не
  исполнением). Это канонически пре-релизный гейт (PROCESS.md §8), но
  AC9/AC10 частично опираются именно на HA-harness тесты.
- **`performance_smoke` (полный)** — пре-релизный гейт, не гейт ревью; AC14
  проверен целевым бенчмарком (см. §5), это достаточно для код-ревью объёма.
- **7 «слабая связь» смоков** (`smoke_align_guides`, `smoke_card_tool_conflict`,
  `smoke_editor_gestures`, `smoke_esc_dialogs`, `smoke_island_rooms`,
  `smoke_optional_space_model`, `smoke_pan_any_zoom` — связь только по `_path`) —
  не прогонялись: после того как 9 из 34 более сильно связанных смоков оказались
  красными, находка уже достаточна, чтобы вернуть задачу автору; дальнейшая
  трассировка именно этих семи не добавила бы новой информации для вердикта.
  Автору стоит прогнать их вместе с полным набором перед повторной сдачей.
- **Golden — полный набор** (~140 сценариев) — прогнан полностью (не частично),
  результат в §2/§3.M1; это уже полный прогон, не выборка.
- **`npm run docs:accept`/скриншоты** — не пересъёмка, `check-docs.mjs` зелёный,
  этого достаточно; коммит `5adfdb5d` уже содержит обновлённые PNG после
  ребейза, это не предмет этого ревью.
- **Корневая причина H1/H2** не диагностирована до конкретной строки — воспроиз­
  ведение и локализация («какой смок, какая проверка, зелёный на dev/красный на
  HEAD») предоставлены; дальнейшая трассировка — работа автора, не ревьюера
  (ревьюер не правит продуктовый код).

## 7. Резюме

Красный вердикт: две категории High-находок (H1 — байпас guard #278 на
деградированном пространстве; H2 — детерминированная регрессия в восьми
именованных структурных smoke-тестах: Resize+Undo на реальном плане, wall-chain
resume, unified-wall split lineage, wall-face overlap, edit-walk fuzz на
first-floor фикстуре, editor-tabs cross-limit, plan-snap-overlay, partition
openings), плюс четыре находки Medium в скоупе задачи (устаревший golden
baseline для AC15, недокументированно узкий AC5-guard, необрабатываемый
`wall_model_client_outdated` для реалистичного старого клиента, ослабленный
без обновления фикстуры регрессионный тест #248).

Дешёвые гейты (`typecheck`/`test`/`build`/`check-docs`/`invariants`/
`benchmark`) зелёные — модель миграции, backend-валидация, i18n и документация
сами по себе выполнены методологически аккуратно. Но именно те проверки, которые
PROCESS.md §8 требует «по необходимости, определяемой diff'ом» (golden,
целевые browser-smoke), обнаружили, что барьер `commitWallSegmentModel`,
подключённый в существующие структурные пути редактирования, ломает их —
включая явный safety-guard issue #278 и Undo-байт-точность. Задача возвращается
в «В разработке»; после исправления H1/H2 нужен новый заход код-ревью (не только
повторная проверка находок — весь набор smoke, зафиксированный здесь как
красный, должен стать зелёным, и полный regression floor AC12 нужно
перепроверить, поскольку правка H1/H2, скорее всего, коснётся самого барьера).
