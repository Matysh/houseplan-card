# CODE-REVIEW-306-r2

- **Issue:** [#306](https://github.com/Matysh/houseplan-card/issues/306) — нулевые стены вместо виртуальных границ
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 1/4 (r1 — жёлтый, M1+M2 в скоупе, L1 на суждение автора; зелёный вердикт цикла не образует, §4/#227)
- **Ветка / SHA материала:** `issue/306-zero-thickness-walls` @ `9134d862667e907f877830207d78916697bf59f4` (`git status` чист, HEAD совпадает с SHA, названным автором в комментарии от 2026-08-26T11:07)
- **Предыдущий раунд:** `docs/reviews/CODE-REVIEW-306-r1.md`, вердикт жёлтый, материал `a66fb7ef53906bed33c6f92369b14e8e398be3bd`

## 1. Скоуп раунда — дельта, не задача целиком

Разбор ведётся по §2.10: r1 закрыл полный первый заход код-ревью (91 файл,
+4210/-2989), r2 — правки по трём находкам r1, ничего больше.

`a66fb7ef53906bed33c6f92369b14e8e398be3bd` — ancestor текущего HEAD (rebase не
происходил, `merge-base HEAD origin/dev == origin/dev`, ветка уже содержит весь
`dev`). Дельта `git diff a66fb7ef..HEAD` — 13 файлов, +406/-49:

```
custom_components/houseplan/frontend/houseplan-card.js | 13 +-  (D, сгенерировано)
dist/houseplan-card.js                                  | 13 +-  (D, сгенерировано)
docs/CHANGELOG.md                                        |  5 +-
docs/CHANGELOG.ru.md                                      |  5 +-
docs/images/09-device-info.png                            | bin  (D, сгенерировано)
docs/images/screenshots.json                               | 24 +-
docs/reviews/CODE-REVIEW-306-r1.md                          |290 + (документ этого же ревью)
src/houseplan-card.ts                                        | 48 +-
src/i18n/en.json                                              |  7 +-
src/i18n/ru.json                                              |  7 +-
src/plan-optimizer.ts                                          | 10 +-
test/i18n.test.mjs                                              | 29 +-
test/plan-optimizer.test.mjs                                     |  4 +-
```

Дельта локальна: не меняет контракт поведения (единая семантика `cm:0`, миграция,
Resize/Undo, backend-схема не тронуты), не задевает новую подсистему, не сопоставима
по объёму с задачей (13 файлов против 91, +406/-49 против +4210/-2989). Условия
«разбор остаётся полным» (ребейз на ушедший `dev`, смена контракта, новая
подсистема, сопоставимый объём) не выполнены — разбор по дельте, §2.10 п.4.

## 2. Как проверялось

### 2.1 Гейты — что прогнано лично

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, exit 0 |
| Unit | `npm test` | 1346 tests: 1345 passed, 1 skipped, 0 failed |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js`, затем `npm run bundle:sync` | green; все три копии (`dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/`) byte-identical, SHA-256 `189ad1c164d68494ef92fef48d50690e3c79d4b2fd46778cdd44900c30b7f16c` — совпадает с хешем, названным автором в хендоффе 2026-08-26T11:07 |
| Docs fingerprint | `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» — обязателен, дельта трогает `src/**` (i18n-строки, toast-wiring) |
| Смок-выборка по дельте | `node scripts/smoke-select.mjs --base a66fb7ef53906bed33c6f92369b14e8e398be3bd --head HEAD` | 15 «прямое совпадение» (`_showToast`, `_drawWallCm`, `NORM_W`); вывод и решение по каждой строке — §2.3 |
| Целевой браузерный смок (лично, Chromium песочницы) | `node demo/smoke_zero_walls.mjs` (после `npm run bundle:sync`) | green, все ключи `true`, включая `openingBlocksZero` (проверяет ровно путь `toast.zero_wall_opening_conflict`, переименованный этой правкой) |

### 2.2 Что НЕ прогонялось и почему

- **`node scripts/model-invariants.mjs`** — не прогонялся. Дельта не трогает
  геометрию/ссылки на неё: изменение в `plan-optimizer.ts` — чисто счётный
  рефакторинг (`legacyZeroContourLines(...)` вынесен в переменную и посчитана её
  длина, тело цикла и его эффект на `config`/`layout` не изменились, проверено
  построчным чтением диффа). `src/houseplan-card.ts` меняет только выбор ключа
  i18n для существующих веток `_showToast`, ни одна точка записи геометрии не
  задета. Гейт был green на предыдущем полном заходе (r1, `a66fb7ef`) и делта его
  не касается.
- **`npm run golden:verify` / golden-эталоны** — не прогонялся и не принимался.
  Дельта не меняет рендер, геометрию, стили или слои — только текст toast/Optimize
  и одну ре-акцептированную документационную PNG (см. ниже), в `demo/golden/baselines/**`
  изменений нет (подтверждено `git diff --stat` дельты).
- **`python -m pytest tests_backend -q`** — не прогонялся. Дельта не трогает
  `custom_components/**/*.py` (подтверждено `git diff --stat`).
- **Полный набор `demo/smoke_*.mjs` (191 файл)** — не прогонялся, дельта не
  задевает всё: точечная правка i18n-текста и Optimize-репортинга, не новый
  контракт поведения. Полный набор — предрелизный гейт (§8), не гейт ревью.
- **14 из 15 «прямых совпадений» смок-выборки не прогнаны отдельно** — проверены
  чтением на релевантность (детали §2.3), кроме уже прогнанного `smoke_zero_walls`.
- **Performance-профиль (`benchmark:wall-model`)** — не прогонялся: дельта не
  трогает горячий путь геометрии/кэшей, в AC13/AC17 не названа.

### 2.3 Разбор смок-выборки по дельте

`smoke-select.mjs` вернул только категорию «прямое совпадение» (15 файлов, порог
широкого символа — 39 смоков, ни один совпавший символ его не достиг). Проверка
каждой строки чтением содержимого смока на предмет реальной, а не по имени,
связи с изменёнными строками:

| Смок | Символ-триггер | Решение |
|---|---|---|
| `smoke_zero_walls.mjs` | не в списке (совпадение вне выборки) | **прогнан** — прямо проверяет `openingBlocksZero` через `toast.zero_wall_opening_conflict` |
| `smoke_partition_openings.mjs` | `_showToast` | не прогнан — файл не содержит ссылок на `zero_wall_*`/`cmRaw`, `_showToast` matched на несвязанной строке (grep пуст на релевантных паттернах) |
| `smoke_room_resize.mjs` | `_showToast` | не прогнан — тот же результат: нет ссылок на изменённые ветки |
| `smoke_help_affordance.mjs` | `_showToast` | не прогнан — про подсказки интерфейса, не про zero-wall toasts |
| `smoke_optimize_coordinate_canonicalization.mjs` | `_showToast` | не прогнан — файл не проверяет `spansMerged`/`legacyZeroWallsMigrated`/`gs.optimize_changes` (grep пуст) |
| `smoke_draw_wall_thickness.mjs` | `_drawWallCm` | не прогнан — единственная проверка `_drawWallCm === 15`, положительная толщина, не задевает ветку `=== 0` |
| `smoke_unified_wall_tool.mjs`, `smoke_wall_chain_merge.mjs`, `smoke_wall_face_overlap.mjs` | `_drawWallCm` | не прогнаны — нет проверок ambiguous-ветки или `=== 0` (grep пуст) |
| `smoke_wall_chain_thickness.mjs` | `_drawWallCm` | не прогнан — проверяет `=== 30`, не относится к дельте |
| `smoke_active_chain_ink.mjs`, `smoke_drag_bounds.mjs`, `smoke_grid_snap.mjs`, `smoke_infinite_canvas.mjs`, `smoke_junction_holes.mjs`, `smoke_wallthick_standalone.mjs` | `NORM_W` | не прогнаны — `NORM_W` совпал вне контекста дельты (модульная константа, используется в сотнях не связанных мест) |

Ни один из непрогнанных смоков не содержит ассерта на изменённые строки — совпадения
по имени символа, не по поведению. Слабых связей (категория «НЕОПРЕДЕЛЁННОСТЬ») в
выдаче не было вовсе.

## 3. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **M1** (Medium, в скоупе) — Optimize называл `cm:0` «виртуальными» (`gs.optimize_changes`), смешанный счётчик `spansMerged` вместо раздельных «legacy virtual spans migrated» / «zero-wall atoms merged» (§8.4 ТЗ) | En/ru-текст `gs.optimize_changes` заменён на «merged zero-thickness wall fragments» / «объединено отрезков стен нулевой толщины»; добавлен отдельный ключ `gs.zero_walls_migrated` и поле `OptimizeReport.legacyZeroWallsMigrated`, посчитанное отдельно от `spansMerged` в цикле миграции; в разметке добавлена отдельная строка `${r.legacyZeroWallsMigrated ? html...}` рядом со строкой `spansMerged` | `src/i18n/en.json:820-821`, `src/i18n/ru.json:820-821`, `src/plan-optimizer.ts:60-61,485,516-518,701`, `src/houseplan-card.ts:16937-16939`; unit `test/i18n.test.mjs:53-77` (проверяет буквальный текст + `cardSource` ссылку), `test/plan-optimizer.test.mjs:600` (`assert.equal(first.report.legacyZeroWallsMigrated, 1)` — тест умеет падать: сборка без нового поля/счётчика провалит оба ассерта) |
| **M2** (Medium, в скоупе) — changelog не предупреждал о backup перед миграцией model v9, хотя §12.2 ТЗ прямо требует | В оба changelog добавлено предложение «Export a backup before the first structural save, import or **Optimize plans** that writes model v9: downgrade to an older version does not understand the new wall model, and restoring that backup is the supported way back» / рус. эквивалент | `docs/CHANGELOG.md:10-15`, `docs/CHANGELOG.ru.md:17-22`, оба в одном коммите `f15bdc67` (`User-Visible: yes`, оба changelog в том же коммите — трейлер-требование выполнено) |
| **L1** (Low, на суждение автора) — 4 i18n-ключа §15 ТЗ (`toast.zero_wall_opening_conflict`, `toast.zero_wall_ambiguous`, `toast.zero_wall_migration_blocked`, `gs.zero_walls_migrated`) переиспользовали обобщённые ключи вместо выделенных | Все четыре ключа заведены отдельно в en/ru и **подключены** в местах вызова: `toast.zero_wall_opening_conflict` заменил `toast.zero_wall_opening` в трёх местах блокировки проёма; `toast.zero_wall_ambiguous` подключён веткой `this._drawWallCm === 0 ? 'toast.zero_wall_ambiguous' : 'toast.wall_repair_ambiguous'` в обоих местах ambiguous-репейра стены; `toast.zero_wall_migration_blocked` подключён через новый хелпер `_showWallModelMigrationBlocked`, который сам выбирает специализированный или общий ключ по `_hasLegacyZeroWallFields()`; `gs.zero_walls_migrated` — см. M1 | `src/houseplan-card.ts:7350-7368` (хелперы), `:8143-8146,8221-8224` (ambiguous), `:8349,11721,11761` (opening conflict), `:7439,7571,15679` (migration blocked через хелпер); unit `test/i18n.test.mjs:72-91` — новый тест `issue 306 zero-wall failures have dedicated symmetric copy`, проверяет и текст, и присутствие имени ключа в собранном `cardSource` |

Все три находки закрыты по коду, не по заявлению автора: правки прочитаны построчно,
`_drawWallCm === 0` подтверждена как геттер активной толщины инструмента «Стены»
(`src/houseplan-card.ts:6700`, используется тем же паттерном в соседней проверке
`cmRaw === 0` строкой ниже), рефакторинг `plan-optimizer.ts` не меняет побочных
эффектов миграции (тело цикла идентично, добавлено только присваивание счётчика).

## 4. Новые находки

Нет. High: 0, Medium: 0, Low: 0.

Дельта — точечная (текст toast/changelog + разделение счётчика Optimize), риск
регрессии низкий: изменённые ветки — либо чистое добавление счётчика без влияния
на существующий эффект (M1), либо документация (M2), либо выбор строки по уже
существующему и повсеместно используемому в этом же файле предикату `=== 0` (L1).
`smoke_zero_walls` — единственный смок, реально проверяющий один из трёх
изменённых путей (`toast.zero_wall_opening_conflict`), зелёный.

## 5. Что проверено и корректно

- Trailers коммитов дельты: `f15bdc67` — `Issue: #306`, `User-Visible: yes`, оба
  changelog в том же коммите; `db4e0ef9` — документ ревью, `User-Visible: no`;
  `9134d862` — приёмка скриншотов, `Source:` на прогон CI, `User-Visible: no`. Все
  три корректны по `PROCESS.md` §10.2/AGENTS.md.
- **Одно число — один источник**: `gs.zero_walls_migrated` показывает
  `r.legacyZeroWallsMigrated`, `gs.optimize_changes` показывает `r.spansMerged` —
  это два разных по смыслу счётчика (legacy-конвертация и слияние атомов),
  каждый вычисляется и отображается ровно один раз, дублирования одной и той же
  величины нет.
- Приёмка скриншотов (`docs/images/screenshots.json`, `09-device-info.png`)
  ссылается на реальный прогон CI (`Source:` в коммите), проведена после смены
  `sourceFingerprint`, вызванной правками `src/**`; `check-docs.mjs` подтверждает
  соответствие текущему `src/**`. Единственное изменённое изображение —
  `09-device-info.png`, что совпадает с заявлением автора («17 пикселей,
  delta=1»); остальные девять кадров сохранили прежний `imageSha256` при новом
  `sourceSha256` — ожидаемо для чисто-текстовых изменений, не меняющих их вёрстку.
- AC13 (Optimize показывает counts) и AC18 (документация/changelog описывают
  backup) — единственные AC, доказательство которых дельта задевает; оба
  подтверждены заново по коду и тестам выше (§3).

## 6. Чего не проверял

- Полный HA backend harness (`python -m pytest tests_backend`, полный) — дельта
  не трогает Python; итоговый гейт — CI job `backend` на точном SHA.
- `golden:verify` — дельта не меняет визуал; в `demo/golden/baselines/**`
  изменений нет.
- 14 из 15 смоков с «прямым совпадением» символа — решение по каждому в §2.3,
  ни один не содержит ассерта на изменённые строки.
- Полный набор `demo/smoke_*.mjs` и `performance_smoke` — предрелизный гейт,
  не гейт этого раунда.
- Ручное исполнение приложения в браузере — не выполнялось; доказательство
  идёт через `smoke_zero_walls.mjs` (реально исполняется в Chromium песочницы)
  и чтение кода для остального.

## 7. Унаследовано из r1

Без повторной проверки в этом раунде принято по `docs/reviews/CODE-REVIEW-306-r1.md`
(материал `a66fb7ef53906bed33c6f92369b14e8e398be3bd`):

- полный разбор AC1–AC9, AC10 (кроме переименованного ключа — закрытие показано
  в §3 этого документа), AC11, AC12, AC14–AC18 (кроме changelog-строки — §3);
- проверка backend-схемы (`validation.py`, `wall_segment_model.py`) чтением +
  автором названный прогон «pure backend — 206 passed, 1 skipped»;
- единая семантика `cm:0` без `zero_kind`/compatibility-маркера (AC3, grep по
  всему r1-диффу);
- Glow/солнце через общий resolver (AC5–AC7, `src/zero-walls.ts`);
- защита проёмов от потери на уровне backend+frontend+смок (AC10, часть про
  сам guard, не про текст toast);
- touch-контракт, i18n-полнота (кроме 4 ключей §15, разобранных в §3),
  release-артефакты (кроме changelog-строки backup);
- model-invariants и golden — green на `a66fb7ef` (полный первый заход).

## Вывод

Все три находки r1 (M1, M2, L1) закрыты по коду, не по заявлению автора. Новых
находок нет. Дешёвые гейты (typecheck, test, build+bundle, check-docs — дельта
трогает `src/**`) green лично. Целевой смок, реально проверяющий изменённый путь,
green. Задача готова к очереди на пре-релиз.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**
