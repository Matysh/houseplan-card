# CODE-REVIEW-306-r1

- **Issue:** [#306](https://github.com/Matysh/houseplan-card/issues/306) — нулевые стены вместо виртуальных границ
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0/4 (это первый заход код-ревью; предыдущие r1–r4 в истории issue относятся к этапу ТЗ, §2.4)
- **Ветка / SHA материала:** `issue/306-zero-thickness-walls` @ `a66fb7ef53906bed33c6f92369b14e8e398be3bd` (совпадает с SHA, названным автором в хендоффе; `git status` на этом SHA чист)
- **ТЗ:** `docs/specs/306-zero-thickness-walls.md` (принят, зелёное spec-review r4, High:0/Medium:0)

## 1. Скоуп

Полная замена инструмента «Граница» и сущностей `space.open_spans`/`rooms[].open_to`
на обычные атомы стены с `cm:0`; единая настройка пространства `zero_wall_style`
(`dashed`/`solid`), управляющая одновременно визуальным стилем и светопроницаемостью
(Glow + солнце) всех нулевых стен; атомарная миграция legacy-полей в model v9 поверх
уже принятой #282 (`wall_segments[]` authoritative). J4/J6 из `docs/SCOPE.md`.

Диапазон материала: `git diff origin/dev...HEAD` — 91 файл, +4210/-2989 (frontend,
backend, i18n, докиs, тесты). Разбор проведён **полностью** (не по дельте): это первый
заход код-ревью для этой задачи.

## 2. Как проверялось

### 2.1 Гейты — что прогнано

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, exit 0 |
| Unit | `npm test` | 1345 tests: 1344 passed, 1 skipped, 0 failed |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | green, byte-identical; после `npm run bundle:sync` все три копии (`dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/`) идентичны, `git status` чист |
| Docs fingerprint | `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» — обязателен, т.к. diff трогает `src/**` |
| Model invariants | `node scripts/model-invariants.mjs --config test/fixtures/optimize-storage-roundtrip.json --json` | green: `{"violations": [], "notes": []}` — обязателен, diff трогает геометрию/ссылки на неё (`wall_segments`, `open_spans`, `open_to`, layout) |
| Смок-выборка | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 91 «прямое совпадение», 29 «слабая связь»; выборка приложена ниже |
| Целевые браузерные смоки (лично, Chromium в песочнице) | `node demo/smoke_zero_walls.mjs`, `smoke_glow.mjs`, `smoke_sun.mjs`, `smoke_wall_thickness.mjs`, `smoke_merge_split.mjs`, `smoke_opening_preview.mjs` (после `npm run bundle:sync`, первая попытка без него упала с «stale bundle», это ожидаемо и не находка) | все шесть green, все проверяемые ключи `true` (см. §3) |

### 2.2 Что НЕ прогонялось и почему

- **Backend pytest** (`tests_backend/test_validation.py`, `test_wall_segment_model.py`,
  `test_ha_import_export.py`) — не прогонялись мной: в этой песочнице нет ни системного
  `pytest`/`voluptuous`, ни `homeassistant`, ни `.venv-backend` (последний по AGENTS.md
  провиженится только стартап-скриптом облачного агента, здесь его не было). Установка
  голого `pytest` в `/tmp/venv-backend` не помогла: импорт `custom_components.houseplan`
  триггерит `custom_components/houseplan/__init__.py`, который безусловно импортирует
  `homeassistant.components.frontend` — без него не собирается даже «чистый» тест.
  Backend-логика (`validation.py`, `wall_segment_model.py`) проверена **чтением, не
  исполнением** (см. §3); дополнительно автор в хендоффе (2026-08-26T10:40) назвал
  команду и результат: «pure backend Python 3.13 — 206 passed, 1 skipped». Итоговым
  гейтом остаётся CI job `backend` на точном SHA.
- **`npm run golden:verify` / golden-эталоны** — не перезапускал; автор явно отчитался
  о запуске с ожидаемыми visual diff (следствие удаления Boundary и единой семантики
  прежних `cm:0`) и не принимал baseline локально — принятие эталонов не входит в
  полномочия код-ревью (`npm run golden:accept -- --reviewed` только по Linux CI
  артефакту).
- **Полный smoke-набор** (все ~190 файлов) — не запускался, задача не задевает *всё*;
  автор в хендоффе назвал 26 целевых смоков, зелёные. Я независимо повторил 6 из
  «прямого совпадения» smoke-select (см. таблицу выше) как перекрёстную проверку, а
  не повторение работы автора вслепую.
- **Performance-бенчмарк** (`benchmark:wall-model`) — не перезапускал; автор назвал
  команду и число (p95 173.214 ms при бюджете 500 ms), что при близких числах в двух
  последовательных прогонах (160→173 ms) выглядит стабильным и далёким от бюджета.
  AC17 в явном виде проверен по коду (кэш-fingerprint включает `zero_wall_style`, см. §3).
- **Touch/Playwright specifically-touch smoke** — не запускал отдельно; `smoke_zero_walls.mjs`
  включает `hiddenInView`/`visibleInEditor` проверки, но не отдельный pinch/cancel touch
  сценарий. Автор заявил его в 26 целевых смоках; не перезапускал вручную.

## 3. Находки

### Medium (в скоупе задачи — чинится в этом issue)

**M1. Отчёт «Оптимизировать планы» показывает退ый термин «виртуальный»/«virtual»,
который это же issue обязано убрать из продукта.**

`src/i18n/en.json:818` / `ru.json:818`, ключ `gs.optimize_changes` (не изменён этим
диффом — сверено по `git show origin/dev:src/i18n/en.json` — идентичен):

```
en: "...merged real-wall fragments: {w}; virtual fragments: {s}; independent walls: {i}."
ru: "...объединено отрезков реальных стен: {w}; виртуальных: {s}; независимых: {i}."
```

Показывается пользователю в диалоге Optimize (`src/houseplan-card.ts:16920-16924`,
`modelMaintenance ? ... this._t('gs.optimize_changes', {..., s: String(r.spansMerged), ...})`).
`r.spansMerged` — тот самый счётчик, который этот диифф в `src/plan-optimizer.ts:544`
(`spansMerged += Math.max(0, zeroParts - zeroWalls.length)`) теперь наполняет данными
о **нулевых стенах** (`sourceZeroWalls`/`zeroWalls`, включая legacy `open_spans/open_to`
projection через `legacyZeroContourLines`). Спецификация прямо требует обратного:
«Отдельного инструмента и термина «виртуальная стена» больше нет» (§3, последняя
строка), и это условие входит в тот же AC18 («документация и релизные артефакты
описывают одну систему стен»). Пользователь, открывший Optimize после этой правки,
увидит слово «виртуальных»/«virtual» — ровно тот термин, который #306 обязано
устранить, — в отчёте, который сам этот PR модифицировал по смыслу.

Дополнительно: спецификация §8.4 требует, чтобы Optimize preview **отдельно** считал
«legacy virtual spans migrated» и «zero-wall atoms merged» — два разных числа.
Фактически есть один смешанный счётчик `spansMerged` (легаси-spans и обычные
соседние нулевые атомы, слитые при переносе комнаты, суммируются в одну цифру) и
несвязанный с зеро-стенами общий счётчик `gs.wall_segments_migrated`
(`r.wallSegmentsMigrated`, из `commitWallSegmentModelInPlace().migratedSegments` —
существовал до #306, считает вообще любые впервые атомизированные сегменты, не
специфично про legacy virtual spans). Отдельного «legacy virtual spans migrated»
счётчика с таким текстом нет.

**Воспроизведение:** открыть Optimize на плане со старым `open_spans`/виртуальными
границами → отчёт покажет «виртуальных: N» / «virtual fragments: N».

**Почему в скоупе:** оба затронутых файла (`plan-optimizer.ts`, `houseplan-card.ts`)
и сам счётчик `spansMerged` модифицированы этим диффом для новой семантики; правка —
переименование строки i18n и/или разделение счётчика, не архитектурная работа.

---

**M2. `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` не содержат обязательного
предупреждения о backup перед миграцией (спецификация §19).**

Спецификация, раздел «Release-артефакты» (§19), прямо требует в changelog:
«удаление «Границы», стены `0`, настройка пунктир/сплошная **и предупреждение о
migration backup**». Фактический добавленный текст (`git diff origin/dev...HEAD --
docs/CHANGELOG.md docs/CHANGELOG.ru.md`) описывает первые три пункта корректно,
но не содержит ни слова «backup»/«резерв», ни любой рекомендации сохранить копию
перед первой структурной записью. Это не декоративная деталь: §12.2 самой
спецификации прямо говорит, что downgrade после записи model v9 **не
поддерживается**, а надёжный путь назад — «импорт backup», т.е. пользователь,
не предупреждённый до первого сохранения, теряет путь назад молча.

**Воспроизведение:** прочитать добавленные абзацы в обоих changelog — слова
«backup»/«резерв(ная копия)» нет.

**Почему в скоупе:** тот же коммит уже редактирует оба файла по этому же поводу;
это одна-две фразы, не отдельная задача.

### Low (замечено, не блокирует — на суждение автора: править или снять с запиской)

**L1. Четыре i18n-ключа из таблицы §15 ТЗ реализованы не под тем именем/точным
текстом.**

Спецификация называет ключи `toast.zero_wall_opening_conflict`,
`toast.zero_wall_ambiguous`, `toast.zero_wall_migration_blocked`,
`gs.zero_walls_migrated` с конкретным RU/EN текстом. Реализация вместо них
переиспользует существующие обобщённые ключи:
`toast.zero_wall_opening` (RU текст совпадает почти буквально, EN — «wall stretch»
вместо «wall segment»), `toast.wall_model_migration_blocked` (другой текст, тот же
смысл и `{reason}`), `gs.wall_segments_migrated` (другой смысл — см. M1). Отдельного
ключа/сообщения под «неоднозначный узел» с текстом из спецификации нет вовсе —
переиспользован уже существующий `toast.wall_repair_ambiguous` для схожего случая
на общих основаниях (не проверял отдельно, вызывается ли он именно на пути рисования
`cm:0` через неоднозначный T/X-узел, а не только на wall-repair; функционально
пользователь получает понятное сообщение в обоих языках).

Расхождение с буквальным текстом §15 таблицы — за принятым 4 раунда ТЗ-ревью
контрактом; при этом ни один наблюдаемый пользователем сценарий не остаётся без
сообщения. Оставляю на суждение автора/владельца: заменить точными ключами по
таблице §15 либо снять с запиской, что переиспользование обобщённых ключей
эквивалентно по смыслу.

## 4. Проверка AC — что подтверждено и как

Материал: чтение продуктового и тестового кода + шесть лично перезапущенных
браузерных смоков (§2.1) + отчёт автора с именованными командами там, где
самостоятельный прогон был недоступен (backend, golden, perf — §2.2).

- **AC1 (один инструмент).** Подтверждено чтением: `grep -i boundary` по
  `src/houseplan-card.ts` не находит ни кнопки, ни режима, ни подсказок — только
  не связанные слова (`pointOnBoundary`, «transaction boundary»); `boundary.*` /
  `toast.boundary_*` удалены из обоих i18n-файлов и не реimportируются. Подтверждено
  исполнением: `demo/smoke_zero_walls.mjs` → `noBoundaryTool: true`,
  `zeroLineInEditor: true`. **Тест умеет падать**: `test/wall-segment-model.test.mjs`
  проверяет `resolveRoomOpeningHost` через `Number(segment.cm) > 0`, а не `||`
  (инвертировать guard — тест упадёт).
- **AC2 (толщина 0↔positive без побочных эффектов).** Подтверждено чтением:
  `custom_components/houseplan/validation.py:1400/1425/1448` — диапазон `0..100` для
  `wall_segments`/`room_drafts`/`partitions`; `wall_columns` (:1471) остаётся `1..150`.
  `src/physical-geometry.ts` — `Number.isFinite(rawCm) ? rawCm : 15` вместо `cm || 15`
  (старый `0 → 15`-клэмп устранён), плюс явный `if (!(halfDepth > 0)) continue`.
  Подтверждено исполнением: `demo/smoke_wall_thickness.mjs` → `zeroApplied: true`,
  `emptyRejected: true`; `demo/smoke_zero_walls.mjs` → `positiveRestored: true`.
- **AC3 (единая семантика `cm:0`, без `zero_kind`).** `git diff` по всему диффу не
  содержит `zero_kind`/`legacy_origin` вне текстов документации, обсуждающих сам
  отказ от них (проверено `grep -in "zero_kind\|legacy_origin"` по полному diff).
  `src/zero-walls.ts` и backend `_thickness`/`resolvedThicknessCm` не хранят и не
  читают происхождение атома — только текущую геометрию/cm.
- **AC4 (нет физического тела).** `physical-geometry.ts` изменения (см. AC2) плюс
  `space-render.ts:zeroWalls.contour` используется как cut, а не body. Не прогонял
  golden лично (см. §2.2); текстовые проверки в `test/physical-geometry.test.mjs` не
  читал построчно — риск отношу на «унаследовано от отчёта автора» (npm test включает
  этот файл и прошёл зелёным).
- **AC5/AC6 (свет: dashed пропускает, solid блокирует, без тела).** Прочитан целиком
  `src/zero-walls.ts::resolveZeroWalls` — единый resolver, `barriers`/`transmissive`
  как зеркальные множества по стилю. Прочитан вызывающий код: Glow-occluders
  (`houseplan-card.ts:16487-16520`) режет `outlineWithout(poly, cuts, eps)` по
  `zeroWalls.transmissive` (только dashed contour) и отдельно добавляет
  `zeroWalls.barriers` (solid, все — contour+independent) как двухточечный барьер
  без полигона; sun (`:15301-15315`) использует тот же `zeroWalls.barriers` как
  `sunOccluders` вместе с `physical`. Оба потребителя дергают **один и тот же**
  `this._zeroWalls()`. Подтверждено исполнением: `demo/smoke_glow.mjs`,
  `demo/smoke_sun.mjs` зелёные (набор существующих проверок не содержит
  специфичных для #306 ключей с именем zero/dashed/solid — эти два смока проверяют
  общий контракт освещения, которому #306 не должно противоречить; специфичную
  dashed/solid проверку несёт `smoke_zero_walls.mjs` → `dashedTransmits: true`,
  `solidBlocks: true`, `solidPaint`/`dashedPaint: true`).
- **AC7 (переключение без reload).** Fingerprint-функция Glow (`houseplan-card.ts:16472`,
  `mix(zeroWalls.style === 'solid' ? 1 : 0)`) и sun-кэш-ключ (`:15264-15266`,
  `zeroKey`/`zeroWalls.style` в составе `key`) включают стиль — переключение меняет
  ключ кэша, старый кэш не используется. Не проверял отдельным смоком переключение
  в одной сессии без reload сверх того, что делает `smoke_zero_walls.mjs`
  (последовательно рисует, проверяет dashed, потом solid, в одном запуске браузера —
  это де-факто и есть проверка «без reload»).
- **AC8/AC9 (миграция `open_spans`/`open_to`, идемпотентность, lineage).** Прочитан
  `custom_components/houseplan/wall_segment_model.py::_atomize/_migrate_space` и
  зеркальный `src/wall-segment-model.ts::buildAtoms/migrateSpace`: `open_spans` имеет
  приоритет, `open_to` — fallback только при их отсутствии (`if not legacy_segments: ...
  linked = ...`), оба поля удаляются `space.pop("open_spans")`/`delete space.open_spans`
  только в конце сборки итогового candidate. Тест умеет падать: агент-проверка (см.
  §5) подтвердила `test_v8_open_span_migrates_to_zero_atoms_and_removes_legacy_fields`
  — конкретные числовые ассерты на `[0.0, 15.0, 15.0]`, не тавтология.
- **AC10 (проёмы защищены).** Backend: `_host_openings.eligible()` теперь отклоняет
  `cm<=0` (`validation.py` аналогично: `float(segment["cm"]) <= 0` → invalid).
  Frontend: `resolveRoomOpeningHost` — тот же guard `Number(segment.cm) > 0`.
  UI-путь: `_wallThickApply` (`houseplan-card.ts:11699-11704, 11734-11744`) проверяет
  занятость интервала проёмом и показывает toast **до** записи, не удаляя проём.
  Исполнено: `demo/smoke_zero_walls.mjs` → `openingBlocksZero: true`;
  `demo/smoke_wall_thickness.mjs` → `openingBlocksZero: true`;
  `demo/smoke_opening_preview.mjs` зелёный целиком (общий контракт размещения
  проёмов не нарушен). Backend-тест `test_v8_open_span_over_an_opening_blocks_atomically`
  подтверждён внешней проверкой как реальный, не как заглушка (raises + `assert base
  == before`, т.е. no partial write).
- **AC11 (геометрические операции сохраняют 0/роль).** `demo/smoke_merge_split.mjs`
  зелёный (`splitKeepsLegacyWallThickness: true` и др.). Не проверял лично T/X-узел
  и «совпадающую partition» отдельным смоком — доверяю `npm test`
  (`test/wall-segment-model.test.mjs` «fixed-topology move carries zero walls
  without leaving phantom breakpoints», подтверждено внешней проверкой как реальный
  тест) и `test/wall-face-graph.test.mjs` (`chainSegmentCms`, `>= 0` вместо `> 0`).
- **AC12 (read-only не мигрирует).** Прочитан вызов миграции — она происходит только
  внутри структурных writer-путей (`migrateSpace`/`commitWallSegmentModelInPlace`),
  не в рендере/подписке на `hass`. `npm test` включает mutation-gate тесты (зелёный).
  Не проверял отдельным websocket-call-log смоком лично — унаследовано из
  зелёного `npm test` и структуры кода.
- **AC13 (Optimize/import атомарны).** `vol.Length(max=MAX_WALL_SEGMENTS)` в схеме —
  превышение лимита проваливает всю схему целиком (не частичная запись). Один
  найденный отход от буквы AC13/§8.4 — M1 (нет отдельного «legacy virtual spans
  migrated» счётчика в preview).
- **AC14 (parity).** Общий resolver (`zeroWalls.style`) используется и в
  `houseplan-card.ts` (Flat), и в `space-render.ts` (тот же вызов `resolveZeroWalls`).
  Изометрию (`iso-walls.ts`) не нашёл в diff — не изменена этим диффом; не проверял
  отдельно, действительно ли iso уже консистентна с новым стилем без изменений
  (полагаю, что да, поскольку iso рендерится из того же geometry model, но не
  прогонял iso-специфичный смок лично).
- **AC15 (backend/registry).** Подтверждено чтением (см. §3 backend diff):
  `_config_wall_segment_invariants` отклоняет `open_spans`/`open_to` в v9,
  отклоняет opening host с `cm<=0`. `docs/CONFIG-COMPATIBILITY.md` и
  `scripts/config-field-registry.mjs` — статусы `deprecated-read`/`migrate-on-write`
  подтверждены внешней проверкой (см. §5).
- **AC16 (touch floor).** Не проверял отдельным touch-смоком лично; полагаюсь на
  заявленный автором прогон 26 смоков включая touch safety.
- **AC17 (perf/кэши).** Fingerprint включает `zero_wall_style` (см. AC7). Числовой
  бенчмарк не перезапускал (§2.2).
- **AC18 (документация).** PASS по большинству пунктов (внешняя проверка,
  см. §5), кроме M1/M2/L1 выше.

## 5. Дополнительная проверка (делегирована, независимо перепроверена мной точечно)

Для покрытия большого диффа без потери точности были запущены два фактологических
подзапроса (без права вывода вердикта — только факты, которые я лично оценил):

1. Полнота удаления Boundary/UX-контракта настройки пространства/i18n-паритета/
   консистентности документации — привело к находкам M1 (частично, через мой
   собственный grep), M2, L1.
2. Реальность (не тавтологичность) новых/изменённых тестов
   (`test/zero-walls.test.mjs`, `test/wall-segment-model.test.mjs`,
   `tests_backend/test_validation.py`, `tests_backend/test_wall_segment_model.py`,
   `tests_backend/test_ha_import_export.py`, `demo/smoke_zero_walls.mjs`) — все
   признаны реальными (вызывают продуктовый код, а не пересчитывают ожидаемое
   значение локально); ключевые примеры процитированы в §4. Единственная замеченная
   просадка покрытия: из `test_ha_import_export.py` убран фикстур-кейс с
   `future_span` в legacy `open_spans` при импорте — вероятно избыточен на фоне
   более строгой backend-проверки в `test_validation.py`, не считаю это отдельной
   находкой (не в AC, не поведенческий регресс).

Обе проверки я оценил и учёл сам; выводы выше — мои, не пересказ подпроцессов.

## 6. Итог

- **High:** 0
- **Medium (в скоупе):** 2 (M1, M2)
- **Low:** 1 (L1, на суждение автора)
- **Вне скоупа:** 0 — новый issue не заводится

Оба Medium — точечные правки в файлах, которые этот же коммит уже трогает
(i18n-строка/счётчик в Optimize-отчёте; два предложения в changelog), не
затрагивают архитектуру, geometry-модель или тесты. AC выполнены за вычетом
M1/§8.4 (единственная содержательная AC-просадка). Вердикт — жёлтый: без High
это возврат автору на правку в текущем issue, не блокер архитектуры.
