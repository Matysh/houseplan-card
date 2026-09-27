# CODE-REVIEW-176-r1

Issue: #176 — удалить мёртвый код старого инструмента Partition после #173.
Трек: `small` (лёгкий), тип `tech-debt`, `User-Visible: no`.
Ревьюер ≠ автор, свежая сессия без контекста реализации.

## Скоуп

Диапазон: `git log --oneline origin/dev..HEAD` → один коммит
`f66e671 refactor: remove dead partition tool state` (`Issue: #176`,
`User-Visible: no`), ветка `issue/176-remove-dead-partition-tool`.

`git diff origin/dev...HEAD --stat`: 16 файлов, +142/−127. Продукт:
`src/houseplan-card.ts`, `src/i18n/en.json`, `src/i18n/ru.json`. Гейты/тесты:
`test/unified-wall-tool-source.test.mjs` (новый), `test/golden-matrix.test.mjs`,
`demo/smoke_free_walls.mjs`, `demo/smoke_plan_snap_overlay.mjs`,
`demo/golden/harness.mjs`. Документация: `docs/STATUS.md`, `docs/TESTING.md`,
`docs/images/screenshots.json` + два PNG. Сгенерированное: три bundle-копии.
Состав в точности совпадает с разделом «Затрагиваемые поверхности» ТЗ —
расширения скоупа нет.

ТЗ (лёгкий трек, тело issue) прошло `SPEC-REVIEW-176-r1` зелёным цветом.

## Как проверялось

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit` | да | чисто, без ошибок |
| `npm test` | да | 908/908, совпадает с хендоффом автора |
| `npm run build` + сверка 3 bundle-копий | да | `cmp` dist↔frontend↔demo/srv — идентичны |
| `test/unified-wall-tool-source.test.mjs` изолированно, затем на **дореформенном** `src/houseplan-card.ts`+`en.json`+`ru.json` (снятых из `origin/dev`) | да | на новом коде: 2/2 green; на старом коде (до #176): оба подтеста падают (`title.markup_partition` присутствует, `this._tool === 'partition'` matches) — тест умеет падать |
| `node demo/smoke_unified_wall_tool.mjs` (назван в AC2) | да | все 19 проверок `true`, `OK` |
| `node demo/smoke_free_walls.mjs` (назван в AC2, тронут диффом) | да | все 13 проверок `true`, `OK` |
| `node demo/smoke_plan_snap_overlay.mjs` (назван в AC2, тронут диффом) | да | все 35 проверок `true`, `OK` |
| `node scripts/check-docs.mjs` (без `--external`) | да | «Documentation checks passed (7 files, 10 external links)» — проверяет ровно то, что тронул диффом `screenshots.json` |
| `python -m pytest tests_backend` | нет | диапазон не касается `custom_components/**/*.py` (проверено `git diff --stat -- '*.py'` — пусто) |
| `npm run golden:verify` | нет | диапазон не меняет golden-baseline (`demo/golden/baselines/**` не тронут) и не расширяет визуальный контракт: оба реальных `planSnap`-сценария в `demo/golden/matrix.mjs` уже используют `tool: 'draw'` — сужение допустимых значений в `golden-matrix.test.mjs`/`harness.mjs` не меняет поведение существующих сценариев. Отложено на предрелизный гейт по правилу «полные наборы — гейт релиза, не ревью» |
| Остальные 124 браузерных смока | нет | диапазон касается только draw/partition-веток Plan editor; названные в AC покрывают все тронутые файлы, остальные поверхности (View, Devices editor, sun/light, isometric и т.д.) не задеты диффом |
| Полный производительный профиль | нет | в AC не назван, диффом не затронут (изменение — вычитание мёртвых веток, не новый путь выполнения) |

## Проверка AC по пунктам

**AC1 — «мёртвый tool-state удалён».**
Подтверждено чтением и исполнением. `grep` по `src/houseplan-card.ts` не находит
ни одного сравнения `this._tool` с `'partition'` в любом порядке, самого
`MarkupTool`/`MARKUP_TOOLS` без `'partition'`, метод `_partitionClick` отсутствует.
Диспетчер клика (`_markupClick`, ветка после `'column'`, строка ~6826) падает в
единственный default-путь Walls, ровно как заявлено в контракте №1. Источник
доказательства — `test/unified-wall-tool-source.test.mjs`, который я прогнал и
на новом, и на дореформенном исходнике: тест умеет падать (см. таблицу выше).
**Доказано.**

**AC2 — «совместимость и существующие независимые стены сохранены».**
- Legacy warm-token: `normalizeUnifiedWallTool('partition') === 'draw'`
  (`src/wall-face-graph.ts:53-55`) не тронут этим диффом; покрыт существующим
  (неизменённым) `test/wall-face-graph.test.mjs:21` и я прогнал `npm test`
  зелёным. Проверено чтением цепочки `normalizeMarkupTool` →
  `normalizeUnifiedWallTool`, вызываемой из `_restoreViewport` при
  `this._tool = normalizeMarkupTool(vp.tool)` (строка 2651) — единственная точка
  присвоения `_tool` из внешнего/сохранённого значения.
- Persisted-модель: `space.partitions`, `PartitionCfg`, `kind: 'partition'` у
  selection/drag/opening-host, `_partitionDeleteDialog`, `_limitReached('partition')`
  (лимит на количество, не tool-state), история `history.partition_add`,
  `physical.partition_properties` — все на месте, я перечислил их `grep`ом и
  ни один не зависит от `this._tool`.
- Создание независимой стены через завершение открытой Walls-chain, snap
  первого/второго клика, pan/pinch/pointercancel, свойства и удаление —
  подтверждено исполнением `smoke_unified_wall_tool`, `smoke_free_walls`,
  `smoke_plan_snap_overlay` (все green, см. таблицу).
**Доказано.**

**AC3 — «удалены только осиротевшие тексты и тестовый старый API».**
En/ru сверены построчно (`grep` по обоим locale): отсутствуют
`title.markup_partition`, `markup.hint_partition`, `physical.partition_size_title`
— ровно три ключа из ТЗ, включая самостоятельно найденный автором третий; при
этом `markup.partition`, `physical.partition_properties`, `history.partition_add`
присутствуют. Дополнительная проверка вне репозитория подтвердила, что удалённые
ключи не используются больше нигде (`grep` по `*.ts/*.mjs/*.json/*.md` — только
исторические документы ревью). Golden matrix/harness теперь принимают только
`'draw'`; я проверил, что оба реальных `planSnap`-сценария в
`demo/golden/matrix.mjs` уже были на `'draw'`, так что визуальный результат не
меняется (подтверждено чтением, не `golden:verify`). `npm run build` и `cmp`
трёх bundle-копий — зелёные. **Доказано.**

## Побочная находка — не дефект

`docs/images/06-device-editor.png` и `06-device-display-preview.png` изменили
`imageSha256` (не только `sourceSha256`) — на первый взгляд странно для
`User-Visible: no` рефактора Plan editor, раз эти два скриншота относятся к
Device editor. Извлёк оба PNG из `origin/dev` и `HEAD`, сравнил пикселями
(`PIL.ImageChops.difference`): разница ограничена одним пикселем на координате
(1141,18)-(1142,19), отклонение ±1 только по одному каналу — это шум
рендеринга/антиалиасинга при пере-захвате скриншотов, обязательном из-за смены
`sourceFingerprint` (хеш всего `src/**`, а не только тронутых строк), а не
видимое изменение продукта. Остальные 7 скриншотов вообще не изменили
`imageSha256`. Не является находкой — зафиксировано, чтобы объяснить бинарный
diff, а не оставить его без разбора.

## Находки

Нет находок уровня High или Medium. Low не заведено — не найдено ни одного
предмета, который стоило бы фиксировать как Low.

## Что проверено и корректно

- Все обязательные быстрые гейты зелёные (typecheck/test/build+cmp).
- AC1–AC3 доказаны либо автотестом с проверенной способностью падать, либо
  прямым исполнением названных в AC браузерных смоков, либо чтением с явной
  пометкой.
- Трейлеры коммита корректны: `Issue: #176`, `User-Visible: no`; при `no`
  changelog не требуется и не тронут — соответствует правилу.
- Имя ветки `issue/176-remove-dead-partition-tool` соответствует трейлеру.
- Скоуп диффа совпадает с «Затрагиваемые поверхности» ТЗ файл-в-файл; попутных
  правок «раз уж я здесь» не найдено.
- Граница «мёртвый tool-code vs живая persisted-модель независимых стен»
  выдержана по всему файлу — ни одно использование `kind: 'partition'` /
  `space.partitions` не привязано к `this._tool`.
- `docs/TESTING.md` обновлён точно: новая строка про legacy-токен ссылается на
  `wall-face-graph.test` — этот тест существовал и до #176 (диффом не тронут),
  проверил утверждение `assert.equal(normalizeUnifiedWallTool('partition'), 'draw')`
  напрямую в файле.
- `docs/STATUS.md` корректно добавляет #176 в описание текущего цикла бета-4.

## Чего не проверял

- Полный HA-бэкенд-харнесс (`python -m pytest tests_backend`) — диапазон не
  трогает `custom_components/**/*.py`, гейт не применим.
- `npm run golden:verify` — не прогонял; аргументация в таблице выше (сужение
  контракта не задевает реальные сценарии, подтверждено чтением
  `demo/golden/matrix.mjs`). Это сознательное решение, а не молчаливый пропуск;
  выполнится штатно на предрелизном гейте.
- Оставшиеся 124 из 127 браузерных смоков — не относятся к тронутым draw/
  partition-путям Plan editor; полный набор не запускался, т.к. задача не
  задевает все поверхности.
- Performance-профили — не названы в AC и не затронуты диффом (чистое
  вычитание недостижимого кода не меняет hot path).
- `node scripts/check-docs.mjs --external` (сетевые ссылки) — прогнан без
  `--external`, сетевую часть не гонял, чтобы не делать внешние вызовы из
  ревью-сессии; она не зависит от этого диффа (никакие ссылки не менялись).
- Ручного тестирования в браузере не было — по процессу его нет в цикле;
  роль ручной проверки здесь выполняет прогон именованных в AC смоков.

## Вердикт

Зелёный. Цикл r1/2 (лёгкий трек, лимит код-ревью — 2). High: 0. Medium: 0.
Находок для возврата или для отдельного issue нет.
