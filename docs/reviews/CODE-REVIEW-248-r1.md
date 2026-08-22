# CODE-REVIEW-248-r2

- Issue: [#248](https://github.com/Matysh/houseplan-card/issues/248) — «Оптимизировать» не идемпотентна после записи и reload
- Ветка: `issue/248-optimize-idempotence`
- ТЗ: `docs/specs/248-optimize-idempotence.md` (SPEC-REVIEW-248-r1, зелёный)
- Этап: code (PROCESS.md §2.7), **заход r2**, трек обычный
- Вердикт: **зелёный**

## Расхождение с переданным заголовком задачи

Заголовок этого запуска называл «заход r1 · блокирующих циклов 0/4». Это не
соответствует действующему состоянию issue и было исправлено по факту, а не
принято на слово:

- в комментариях #248 уже есть код-ревью с вердиктом **красный · заход r1 ·
  блокирующих циклов 1/4 · High: 1** (находка H1 — устаревший docs-отпечаток);
- документ того раунда уже закоммичен в дерево задачи —
  `docs/reviews/CODE-REVIEW-248-r1.md`, коммит `e468414` (текущий HEAD);
- автор закрыл H1 и владелец явно написал «Возвращаю задачу в code review
  для захода r2».

Соответственно этот документ — **`-r2`**, а не `-r1`; публикация в
`docs/reviews/` не должна затирать уже существующий `CODE-REVIEW-248-r1.md`.
Бюджет циклов после этого зелёного вердикта остаётся **1/4** (зелёный вердикт
цикл не тратит, #227).

Отдельно к самому раунду r1: его вердикт не называл SHA, на котором получен —
только производная находка H1 упоминает `HEAD (cbdd5a7)` внутри своего текста.
Формально это ровно то расхождение, которое делает раунд 2 менее
воспроизводимым, чем должен быть; в этот раз SHA раунда явно зафиксирован
(см. ниже), чтобы для потенциального r3 не потребовалось той же реконструкции.

**SHA раунда r1 (материал предыдущего вердикта):** `cbdd5a7e73b2b7afd1e05bee453154d3e75cd60b`
(реконструирован из текста находки H1 — там же единственная явная привязка).
**SHA этого раунда (r2, текущий HEAD):** `e468414c241900f2175923cfb0901a73e86e9767`.

## Скоуп ревью

Предмет раунда — дельта `git diff cbdd5a7..HEAD`, а не задача целиком (PROCESS.md
§2.10): три коммита сверх `cbdd5a7` —

- `5ad4280` test: complete Optimize storage fixtures (`User-Visible: no`)
- `120b491` test: require schema-valid Optimize fixture (`User-Visible: no`)
- `e468414` docs: review document for #248 (`User-Visible: no`, только
  `docs/reviews/CODE-REVIEW-248-r1.md`, класс C, не участвует в проверке
  статуса issue по process-gate)

Дельта касается ровно 4 файлов кроме самого review-документа:

```
docs/images/05-plan-context-tray.png              | Bin 345560 -> 345559 bytes
docs/images/screenshots.json                      |  24 +--
test/fixtures/optimize-storage-roundtrip.json     |   4 +
tests_backend/test_coordinate_canonicalization.py |   2 +
```

`src/**` и `custom_components/houseplan/**/*.py` в дельте не тронуты —
продуктовый фикс идемпотентности (`src/plan-optimizer.ts`) целиком лежит в
`cbdd5a7` и уже был разобран в r1. Дельта — это (а) закрытие H1 (docs
fingerprint) и (b) самостоятельная находка автора по итогам первого CI:
общая fixture не проходила backend-схему без `view_box`.

Разбор оставлен полным по чувствительным точкам, а не «только H1»: раунд не
локален формально (дельта пересекает docs-гейт и backend-fixture-контракт
AC4), поэтому ниже переисполнены typecheck/test/build/check-docs/process-gate
и целевой AC5-смок, а не только прочитан diff.

## Как проверялось

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | 1116/1116 pass, 0 fail, 0 skip |
| `npm run build` | green |
| `cmp dist/… custom_components/…/frontend/… && cmp dist/… demo/srv/assets/…` | все три бандла идентичны байт-в-байт |
| `git status --porcelain` после build | пусто — закоммиченный бандл уже актуален |
| `node scripts/check-docs.mjs` | green — «Documentation checks passed (7 files, 10 external links)» — H1 закрыт |
| `node scripts/smoke-select.mjs --base cbdd5a7 --head HEAD` | «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)» — дельта раунда не выбирает ни один смок |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | воспроизведено идентично отчёту r1: 1 файл src, 5 символов (`AlignReport`, `PLAN_MODEL_VERSION`, `SpaceReferenceReport`, `canonicalizeConfigGeometry`, `canonicalizeLayoutGeometry`), НЕОПРЕДЕЛЁННОСТЬ |
| `node demo/smoke_optimize_coordinate_canonicalization.mjs` | green, все 16 полей `true` (включая `serverEventReloadIsExactNoOp`, `coldReloadIsExactNoOp`) — перепрогнан лично на текущем HEAD, не только унаследован |
| `node scripts/mutation-gate.mjs --check` | green, все мутанты валидны статически, включая три из #248 (`optimize-storage-boundary-removed`, `optimize-config-storage-half-raw`, `optimize-layout-storage-half-raw`) |
| `node scripts/process-gate.mjs` | green, диапазон `origin/dev..HEAD`, 6 коммитов, 0 предупреждений |
| `node scripts/process-gate.mjs --issues` | green (issue #248 в `S7-code-review`) |
| `python3 -c "import pytest"` / `import voluptuous` | оба `ModuleNotFoundError` — окружение этой ревью-сессии не содержит backend-харнесс, как и в r1 |
| `gh run view 32602363169 --json status,conclusion,headSha,jobs` | **исполнено, не унаследовано на слово**: `conclusion: success`, `headSha: 120b491…`, job `backend` — success (`pip install pytest … pytest-homeassistant-custom-component …` + `python -m pytest tests_backend/ -q` — success), job `docs` — success, `process-gate` — success |
| `git diff 120b491..HEAD --stat` | подтверждает, что HEAD (`e468414`) = проверенное CI-дерево `120b491` + только `docs/reviews/CODE-REVIEW-248-r1.md` — CI-результат применим к текущему HEAD без экстраполяции |
| `gh run view 32602050492 --json conclusion,workflowName,headBranch` | success, `Docs screenshots`, ветка `issue/248-optimize-idempotence` — легитимная пересъёмка, не самодельный PNG |

Дешёвые гейты прогнаны заново, как требует §2.10 (код изменился, они стоят
минуты). Тяжёлые — по дельте: golden/полный smoke-набор/performance не
прогонялись (обоснование в «Чего не проверял»), backend pytest не исполнялся
локально, но подтверждён предъявленным CI-прогоном на точном дереве текущего
HEAD, а не восстановлен из слов автора.

## Находки

Нет находок High или Medium в этом раунде.

**Low (на усмотрение, не блокирует):** заголовок задачи, полученный этой
сессией, называл неверный заход/бюджет (`r1 · 0/4` вместо фактических
`r2 · 1/4`). Указано выше в отдельном разделе, не дублируется здесь как
отдельная находка кода — это дефект оркестрации запуска ревью, а не диффа
#248, и не входит в скоуп автора. Если он повторяется на других issue, стоит
завести `process`-issue отдельно от #248.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (High) — `check-docs.mjs` красный на `cbdd5a7`: `docs/images/screenshots.json` хранит устаревший `sourceFingerprint`, `src/plan-optimizer.ts` из диффа делает его неактуальным | Пересъёмка через каноническую джобу `Docs screenshots` (workflow_dispatch) на Chromium 151.0.7922.34, принята `npm run docs:accept -- --reviewed`; `sourceFingerprint`/`sourceSha256` в `docs/images/screenshots.json` обновлены на `3f3237694ccc9aabd77df6204c598797dc528c2f7a23520915083486666be740` во всех 10 сценариях | Коммит `5ad4280`; лично перепрогнан `node scripts/check-docs.mjs` на HEAD `e468414` → green; `gh run view 32602050492` → success на ветке задачи; из 10 PNG изменился только `05-plan-context-tray.png` (345560→345559 байт, один `imageSha256` из десяти), остальные девять байт-в-байт прежние — подтверждено `git diff cbdd5a7..HEAD -- docs/images/screenshots.json \| grep imageSha256` |
| **L1** (Low) — хендофф говорил «1115 pass, 1 skip», факт — «1116 pass, 0 skip» | Объяснено, не правкой: разные среды (Windows platform-skip у автора, Linux 0 skip у ревьюера r1), оба числа корректны для своей среды | Комментарий владельца «Закрытие CODE-REVIEW-248-r1»; лично перепрогнан `npm test` на HEAD `e468414` → `1116 pass, 0 skip`, совпадает с числом, которое r1 сессия получила на Linux — outcome: no_change_needed |

## Унаследовано из r1

Принято без повторной проверки в этом раунде, поскольку дельта `cbdd5a7..HEAD`
не касается ни одного из перечисленных файлов (подтверждено `git diff
cbdd5a7..HEAD --stat`, см. «Скоуп ревью»). Источник — `docs/reviews/CODE-REVIEW-248-r1.md`,
коммит `e468414` (уже в дереве), проверено на SHA `cbdd5a7`:

- **AC1** — `test/plan-optimizer.test.mjs`, тест «issue 248 Optimize stays a
  no-op across the nine-decimal storage round-trip»; мутационный guard
  `optimize-storage-boundary-removed` подтверждён исполнением в r1 (тест
  краснеет без правки границы в `src/plan-optimizer.ts`). Не тронуто дельтой.
- **AC2** — параметризованный тест по `cell_cm` 1/3/5/1000 в
  `test/plan-optimizer.test.mjs`; существующий ULP-тест «six-room» подтверждает,
  что реальный шум по-прежнему даёт `changed:true`, счётчики не занулены
  безусловно. Не тронуто дельтой.
- **AC3** — `custom_components/houseplan/store.py:150-229`,
  `websocket_api.py:1554-1666`: обе половины записи (`optimize_pending` и live
  store) канонизируются независимо; backend production-код не менялся (§13.5
  ТЗ). В r1 это было «проверено чтением, не исполнением» из-за отсутствия
  `pytest` в сессии; **в этом раунде дополнительно подтверждено исполнением**
  через `gh run view 32602363169` — job `backend` success на `120b491`, то
  есть на дереве, идентичном текущему HEAD за вычетом самого review-документа.
- **AC4** (частично) — общая fixture `test/fixtures/optimize-storage-roundtrip.json`
  и её потребители в Node/Python. Наследуется факт «одна fixture, оба
  runtime» из r1; **не** наследуется схемная валидность фикстуры на момент
  `cbdd5a7` — это ровно то, что дельта раунда исправляет (см. «Как
  проверялось» и разбор `view_box` ниже), поэтому по AC4 сделана
  дополнительная самостоятельная проверка, а не чистое наследование.
- **AC5** — `demo/smoke_optimize_coordinate_canonicalization.mjs`,
  расширенный под `serverEventReloadIsExactNoOp`/`coldReloadIsExactNoOp`.
  Файл не тронут дельтой; тем не менее смок лично перепрогнан на текущем HEAD
  (см. таблицу гейтов) — совпадает с r1: все 16 полей `true`.
- **AC6** (документация) — `docs/CANVAS.md` §9.5, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, оба changelog: содержание не
  тронуто дельтой, разобрано и принято в r1.
- Трейлеры `cbdd5a7` (`Issue: #248`, `User-Visible: yes`, оба changelog в том
  же коммите) — унаследовано, не перепроверялось повторно (коммит не входит в
  дельту раунда).
- Смок-выборка полного диффа `origin/dev...HEAD` (5 символов,
  НЕОПРЕДЕЛЁННОСТЬ, три целевых смока с прямой/тематической связью запущены
  и зелёные в r1: `optimize_coordinate_canonicalization`,
  `optimize_geometry_preflight`, `optimize_micro_interval`) — воспроизведено
  идентично инструментом в этом раунде (см. таблицу), сами смоки `_preflight`
  и `_micro_interval` не перезапускались повторно, т.к. их файлы не в дельте.
- `golden:verify` и полный набор 167/169 браузерных смоков — не прогонялись
  ни в r1, ни здесь; обоснование (diff не меняет геометрию/рендер, golden —
  предрелизный гейт по AC6 и §12 ТЗ) наследуется без изменений, т.к. дельта
  этого раунда тем более не касается рендера (только docs-манифест, фикстура,
  один assert).
- Performance — не названо в AC, чувствительный путь (`O(n)` проход) не
  тронут дельтой; наследуется из r1.

## Проверено и корректно (сверх наследования)

- **Закрытие H1** — не принято на слово: `check-docs.mjs` лично перепрогнан
  зелёным на HEAD `e468414`, `git status` после `npm run build` чист, а
  сравнение `imageSha256` по всем 10 сценариям показывает ровно один
  изменённый файл (`plan-context-tray`, 1 байт), как и утверждал автор —
  никакой другой скриншот не «съехал» тайком.
- **Самостоятельная находка автора (`view_box`)** — до фикса
  `test/fixtures/optimize-storage-roundtrip.json` не содержал обязательное
  поле `vol.Required("view_box")` (`custom_components/houseplan/validation.py:984`);
  без него `CONFIG_SCHEMA(source["config"])` в
  `test_optimize_roundtrip_fixture_has_one_backend_canonical_target` не могла
  бы пройти. Значение `[0, 0, 1, 1]` проверено против `_view_box()`
  (`validation.py:566-570`): `x=0, y=0` в допуске `_GEOM`, `w=1, h=1` в
  допуске `_EXTENT` (`0.001..CANVAS_LIMIT`) — валидно и не вырождено (не
  повторяет баг HP-1502-01 про `[0,0,0,0]`). Значение идентично в `input` и
  `expected` для обеих geometry (`fine`, `regular`) — канонизация не должна
  его менять, что и подтверждает зелёный backend-прогон в CI.
- **AC3/AC4 backend-доказательство теперь подтверждено исполнением, а не
  только чтением** — `gh run view 32602363169` называет точный SHA (`120b491`)
  и job (`backend`) с командой `python -m pytest tests_backend/ -q`, success;
  `git diff 120b491..HEAD --stat` показывает, что единственная разница между
  проверенным CI-деревом и текущим HEAD — файл `docs/reviews/CODE-REVIEW-248-r1.md`
  (класс C, не участвует в тестах). Это устраняет ограничение «проверено
  чтением, не исполнением», отмеченное в r1 для AC3.
- **Docs screenshots run легитимен** — `gh run view 32602050492` подтверждает
  workflow `Docs screenshots` на ветке задачи с успешным результатом, то есть
  принятие через `docs:accept --reviewed` соответствует правилу §8 PROCESS.md
  (не самодельный локальный кадр).
- **Трейлеры дельты** — `5ad4280`, `120b491`, `e468414` все несут
  `Issue: #248`; `User-Visible: no` корректен для всех трёх (тесты/fixture/
  docs-манифест и сам review-документ не меняют пользовательское поведение
  сверх того, что уже задокументировано в `cbdd5a7`).
- **process-gate** зелёный на полном диапазоне `origin/dev..HEAD` (6
  коммитов, 0 предупреждений) и с `--issues` (статус issue #248 соответствует
  `S7-code-review`).

## Чего не проверял

- Полную матрицу 167/169 браузерных смоков — не унаследовано слепо: лично
  подтверждено, что `smoke-select` даёт тот же результат («НЕОПРЕДЕЛЁННОСТЬ»,
  5 символов) на полном диффе `origin/dev...HEAD`, и что дельта этого раунда
  (`cbdd5a7..HEAD`) вообще не выбирает смоков (`src/**/*.ts` не тронут).
  Целевой AC5-смок перепрогнан лично; `_preflight` и `_micro_interval` — нет
  (не в дельте, зелёные в r1).
- `npm run golden:verify` — diff (полный и дельта) не меняет геометрию, стили
  или слои рендера; предрелизный гейт по AC6/§12 ТЗ.
- `python -m pytest tests_backend -q` — не исполнялся локально
  (`pytest`/`voluptuous` не установлены в этой сессии), но подтверждён через
  `gh run view` на CI-прогоне точного дерева HEAD минус review-документ —
  это сильнее «проверено чтением», хотя и не то же самое, что личное
  исполнение.
- Оба backend-мутанта (`optimize-config-storage-half-raw`,
  `optimize-layout-storage-half-raw`) — `mutation-gate.mjs --check`
  подтвердил только статическую валидность патча (якорь найден), не факт,
  что тест краснеет с мутацией; их guard (`backend-test-guard.mjs`) тоже
  требует `pytest`, недоступного в сессии. Backend CI job (`python -m pytest
  tests_backend/ -q`) не запускает `mutation-gate.mjs`, поэтому исполнение
  этих двух мутантов не подтверждено ни в r1, ни здесь — фактическое
  исполнение остаётся долгом до следующего Linux-сеанса с установленным
  `pytest`, но не блокирует зелёный вердикт: сам факт что тест существует и
  статически бьёт по нужной строке проверен, а полное отсутствие исполнения
  этих двух конкретных мутантов было тем же ограничением уже в r1 и не
  регрессировало.
- Полный Linux HA harness (полная HA-обвязка, не только `tests_backend/`
  pure-подмножество) — вне скоупа код-ревью, канонический прогон в CI/WSL.
- Performance-профили — не названы в AC, чувствительные пути не тронуты
  дельтой.
