# CODE-REVIEW · issue #1097 · заход r2

**Материал:** `9386c7ace890f0f7c729bed1f9675a60306ebf02` (рабочая копия на этом SHA).
**Вердикт:** green
**Маршрут:** fix (трейлер #726)

## Скоуп

Повторный раунд — объём по дельте (PROCESS.md §2.10). Материал предыдущего
раунда — `31135f084a7868eea027db3de767e4a3339eaddb` (r1, жёлтый, 1 Medium в
скоупе). SHA резолвится в текущем дереве (подтверждено `read:log`). Дельта
r1→r2 — ровно два коммита, оба docs-only:

- `c18807253999b67c33b0daf49f71b5667f4e4835` — `docs: review document for
  #1097` (публикация отчёта r1 в `docs/reviews/CODE-REVIEW-1097-r1.md`, не
  трогает продуктовый код и changelog);
- `9386c7ace890f0f7c729bed1f9675a60306ebf02` — `docs: remove duplicate
  opening drag changelog entries` (фактический фикс единственной находки r1).

Ни один файл из `src/`, `test/`, `demo/` в дельте не менялся — весь
независимый разбор геометрии/touch-поверхности жеста (`opening-drag-preview.ts`,
`_opPointerMove/_opPointerUp`, `pointercancel` в `_opPointerUp`
`houseplan-editor-runtime.ts:6265`, `_wallUnionGeometry`/`_physicalBodiesR`
в `houseplan-card.ts`, `interaction-types.ts`, `physical-geometry.ts`) из r1
остаётся в силе без повторной проверки (см. «Унаследовано из r1»). AC,
которых дельта касается, — ни один напрямую (changelog не входит в
AC1–AC8), но релиз-артефакты (§8, «одна строка на issue в обоих
changelog») проверены заново как предмет самой находки.

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT (тело issue, хендофф r2,
ciEvidence), `docs/reviews/CODE-REVIEW-1097-r1.md` (опубликованный отчёт
r1, неизменный — подтверждено байт-в-байт тем же содержимым в
`read:diff`), текущее содержимое `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md`.

Исполнено:

| Check | Результат | Зачем запущен |
|---|---|---|
| `read:log` | PASS | подтвердить коммиты дельты r1→r2 и их порядок/сообщения |
| `read:diff` | PASS | подтвердить итоговое содержимое `CHANGELOG.md`/`CHANGELOG.ru.md` и что `docs/reviews/CODE-REVIEW-1097-r1.md` добавлен без изменений относительно опубликованного текста r1 |

Не запускал (и почему): `build:*`, `unit:*`, `smoke:*`,
`demo/benchmark_opening_drag.mjs`, Golden, mutation-реестр — материал
`src/`, `test/`, `demo/` не менялся относительно r1 (подтверждено
`read:log`/`read:diff` — в дельте нет ни одного файла из этих каталогов),
среда и oracle те же; r1 уже дал пригодное зелёное покрытие по всем этим
категориям, а `ciEvidence` (`review-light-golden proof is complete`,
https://github.com/Matysh/houseplan-card/actions/runs/40729647602)
подтверждает план проверок именно для `9386c7ace` целиком. Смена SHA
из-за docs-коммитов сама по себе не отменяет это доказательство. Полный
`gate:small`/ночная mutation-матрица не нужны — задача дельты докс-онли,
несопоставима по объёму с предрелизным гейтом (§8).

## Находки

Нет. Единственная находка r1 (Medium в скоупе, дубль строки #1097 в
`CHANGELOG.md`/`CHANGELOG.ru.md`) закрыта (см. ниже). Новых находок по
дельте r2 не выявлено.

Побочных находок нет (outside scope, mode=issues — пусто).

## Что проверено и корректно

- `docs/CHANGELOG.md`, раздел «Unreleased»: ровно одна строка `(#1097)`
  (строка 8), полный текст сохранён (pan/zoom/quarter-turn из уточнённой
  версии), дубль-черновик удалён.
- `docs/CHANGELOG.ru.md`, раздел «Не выпущено»: ровно одна строка
  `(#1097)` (строка 14), тот же текст в переводе.
- Пустая строка перед записью #1097 в обоих файлах — не артефакт дедупа:
  подтверждено `read:diff` (итоговый diff от `dev` показывает только `+1`
  добавленную строку на каждый файл, пустая строка — контекст, уже
  существовавший в базе до задачи).
- `docs/reviews/CODE-REVIEW-1097-r1.md` в дереве материала идентичен
  содержимому, которое я независимо прочитал как опубликованный отчёт r1
  (включая его собственный блок «Материал раунда» и receipt) — коммит
  `c18807253` не вносит расхождений.
- Коммит `9386c7ace` — ровно удаление дублирующих строк, не затрагивает
  ничего из `src/`, `test/`, `demo/`, release-ledger — подтверждено
  списком изменённых файлов дельты (только два changelog-файла) и
  содержимым diff.

## Чего не проверял

- Повторно AC1–AC8 и трассировку `opening-drag-preview.ts`,
  `_opPointerMove/_opPointerUp`, `_wallUnionGeometry`/`_physicalBodiesR`,
  `rawPatches`/non-enumerable риск, release-ledger `stable-fix`
  обоснование, абзацы `CANVAS.md`/`DEVELOPMENT.md`/`STATUS.md`/
  `ARCHITECTURE.md` — всё это из r1, файлы не менялись в дельте r2, в
  силе без повторной проверки (см. ниже).
- `build:*`/`unit:*`/`smoke:*`/Golden/benchmark/mutation — не требуются
  для docs-only дельты; см. обоснование в «Как проверялось».

## Закрытие раунда r1

| находка | чем закрыта | где это видно |
|---|---|---|
| Medium (в скоупе): дублирующая строка #1097 в `docs/CHANGELOG.md` (было строки 8–9) и `docs/CHANGELOG.ru.md` (было строки 14–15) — одна и та же возможность описана дважды подряд | Коммит `9386c7ace890f0f7c729bed1f9675a60306ebf02` («docs: remove duplicate opening drag changelog entries») удаляет по одной дублирующей строке в каждом файле, оставляя полную уточнённую версию (с упоминанием pan/zoom/quarter-turn) | `docs/CHANGELOG.md:8` — ровно одна строка `(#1097)`; `docs/CHANGELOG.ru.md:14` — ровно одна строка `(#1097)`; `read:diff` показывает чистый `+1` добавленную строку на файл относительно `dev` |

## Унаследовано из r1

Документ: `docs/reviews/CODE-REVIEW-1097-r1.md`, материал
`31135f084a7868eea027db3de767e4a3339eaddb`, вердикт yellow (High 0,
Medium 1 — закрыт выше). Принято без повторной проверки в r2, так как ни
один из перечисленных файлов не входит в дельту r1→r2:

- Независимая трассировка жеста `_opDrag`: `src/opening-drag-preview.ts`
  (новый файл, 215 строк, прочитан целиком — `OpeningDragWalls`,
  `prepare/render`, fallback через `try/catch` → `null`); `drag.preview`
  живёт до `_opPointerUp`, `_cfgEpoch` растёт один раз на коммите, а не на
  кадре (`houseplan-editor-runtime.ts`); явный канонический fallback со
  счётчиком `_openingDragFallbackBuilds`, отдельным от
  `_floorCacheBuilds.*`/`_wallUnionPool`; `_cancelOpeningDrag` сбрасывает
  драфт без записи.
- `pointercancel` токен в `_opPointerUp` (`houseplan-editor-runtime.ts:6265`)
  — touch-риск класса, разобранного в r1.
- `_wallUnionGeometry()`/`_physicalBodiesR()` (`houseplan-card.ts`) ключуются
  по сохранённой записи этажа, а не по драфту — кэш остаётся тёплым весь
  жест.
- Исправление non-enumerable `rawPatches` в конверте пула
  (`houseplan-card.ts`, `physical-geometry.ts`) — риск найден и проверен
  независимо в r1, подтверждён unit-тестом `test/opening-drag.test.mjs`.
- `src/interaction-types.ts`: форма `OpeningDragState` (драфт/оригинал
  разделены).
- AC1–AC8: исполненные в r1 `unit:test/opening-drag.test.mjs`,
  `smoke:demo/smoke_opening_drag.mjs`,
  `smoke:demo/smoke_partition_openings_preview.mjs`,
  `smoke:demo/smoke_floor_cache_reuse.mjs`,
  `smoke:demo/smoke_opening_measure.mjs`,
  `unit:test/core-file-budget.test.mjs`, `static:mutation-registry`,
  `static:bundle-budget`, `build:build/test/bundle:sync/typecheck` — все
  PASS на материале, который не менялся с тех пор (подтверждено
  `read:log`/`read:diff` для дельты r2).
- `docs/release-ledger/v1.82.0/1097.json` — классификация `stable-fix` с
  обоснованием, проверенным чтением стабильной `_opPointerMoveNow`.
- `docs/CANVAS.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
  `docs/ARCHITECTURE.md` — абзацы, согласующиеся с кодом.
- Переиспользованный `review-light-golden`/`validate-gate`
  (https://github.com/Matysh/houseplan-card/actions/runs/40721621816 для
  r1-материала и https://github.com/Matysh/houseplan-card/actions/runs/40729647602
  для точного `9386c7ace`) — план проверок подтверждён целиком, включая 3
  strict Golden сцены AC8 и product/tooling/docs CI.

## Гейты: прогнал / не прогонял

Прогнал в этом раунде: `read:log`, `read:diff` (адресно для подтверждения
дельты и закрытия находки).

Не прогонял: `build:build`, `build:test`, `build:bundle:sync`,
`build:typecheck`, `unit:test/opening-drag.test.mjs`,
`unit:test/core-file-budget.test.mjs`, все `smoke:*`,
`demo/benchmark_opening_drag.mjs`, Golden, `static:mutation-registry`,
`static:bundle-budget`, `gate:small`, mutation execution — материал,
среда и oracle для них не изменились с r1 (дельта r2 — только два
changelog-файла и добавленный документ ревью), r1 уже дал пригодное
зелёное покрытие, а `validate-gate` подтвердил план проверок именно для
точного SHA `9386c7ace` (receipt приложен в REVIEW_CONTEXT). Полные
наборы (ночная mutation-матрица, полный `gate:small`) — предрелизный
гейт, не гейт ревью docs-only дельты (§8).

## Решение

Green: находка r1 закрыта корректно (воспроизводимо, на конкретных
строках, не заявлением автора), delta r1→r2 не вносит нового кода и не
расширяет риск. High 0, Medium 0. Маршрут — fix (трейлер #726).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6Ijg1YjI2NDcyYjE0ZTU2MmRhYTc3NDAxNjU5N2JhYTk3MjZiMjJmNmQyODg3ZWNiMWQ2MmFkZWE2NWNhOTI2YjUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxZDhiNDVhZjkxYTliYmNhMGRkOThjM2FlN2FlMTExZTZjMzc2MDI3NmFkMjk0OWVhOTczMGI5MWViNmJjN2RiIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI5Mzg2YzdhY2U4OTBmMGY3YzcyOWJlZDFmOTY3NWE2MDMwNmViZjAyIiwidHJlZSI6ImJiMzlkNjljMjRjMzZlNTU1MWJjNWQ1NDIxZTBlMmVjZWJkZTQ5YmQiLCJib2R5RGlnZXN0IjoiMWRmN2MwZGZlZDc2YzNmMTk5ZTY0MmM3YTkzOWQwYWRiMDU3ZTYzN2VlYWMyYjA5Njc3YTlkZDdkYjYzMTk3MCIsInByb2R1Y2VyUnVuIjoiNDA3MzIxOTIyNjEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjRjMjhiYTViZTI5MTFhYjk1NTZmZmMyZjM1ZDU4ZDA1MjVmMjM3YjE5NTQ2YTg5MTVmZWMwOGQxNTA5Y2M2ZmMiLCJ2ZXJkaWN0RGlnZXN0IjoiMzI1NGZlODA3NjcyMzdhNzRkOGM0OTlkNmIzMWU2NGZhZWNiN2M1MTg4ZDM4MGZmNDliZWI1OGFkYzc1MmZhNCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1MDJiMTgzNzE1MGZhYmU4NjhjOWJlODQwMDU0MWVhN2YxYTE3N2E1MDU5YzZlNTU0ZmY2N2FhZDAyZTk5NWRmIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDc1NjMzMzUxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk3I2lzc3VlY29tbWVudC02NDc1NjMzMzUxIiwiYm9keURpZ2VzdCI6ImYxOWExMzA0N2M0YmFiYTJhYjFlZDljOWY5ZDViMzAyNjIzM2I4MGUzMjgzYmE5OTdmYWQ5N2ZmMmU2NGI1N2QifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1097-opening-drag`, коммит `9386c7ace890` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bb39d69c24c36e5551bc5d5421e0e2ecebde49bd`
  ```
  git log --all --format='%H %T' | grep bb39d69c24c3
  ```
- Тело issue: `1df7c0dfed76c3f199e642c7a939d0adb057e637eeac2b09677a9dd7db631970`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40732192261,"run_attempt":1,"digest":"a2ca32317da64b6480ed3e4a2a6d195f275a136e5df4ae74475c07b32bd5205a"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzQsIm91dHB1dF90b2tlbnMiOjE0NTgxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjgwMzIwLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTE2MzExNywiY29zdFVzZEVzdGltYXRlIjowLjY5OTc4MTR9XSwidHVybnMiOjIzLCJkdXJhdGlvbk1zIjoxNzgwOTYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjY5OTc4MTQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=34 output_tokens=14581 cache_creation_input_tokens=80320 cache_read_input_tokens=1163117 num_turns=23 -->
