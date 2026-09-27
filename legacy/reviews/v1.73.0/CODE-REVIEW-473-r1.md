# CODE-REVIEW-473-r1

- **Issue:** #473 — «Перф-регрессия Stage 3 в 6,5–17 раз прошла два раунда ревью:
  раунд постфактум на perf-дельту #160 и перф-смок в код-ревью задач отрисовки»
- **Ветка:** `issue/473-iso-perf-witnesses`, **SHA материала:** `d95255ad`
  (`git rev-parse HEAD` сверен непосредственно перед выводом вердикта)
- **Этап:** code · **Заход:** r1 (первый заход код-ревью; ревью ТЗ на этом же
  issue уже прошло два захода r1(жёлтый)/r2(зелёный) — это отдельный бюджет
  циклов, §10.4)
- **Класс изменений:** только B (`test/**`, `scripts/**`,
  `.github/workflows/**`) и C (`docs/**`, `PROCESS.md`) — **ни одного файла
  класса A**, `src/**` не тронут вовсе

## Скоуп

Диапазон `origin/dev...HEAD`, 16 файлов, +1259/−16. Две части по ТЗ
(`docs/specs/473-iso-perf-witnesses-and-smoke.md`):

1. Четыре мутанта-свидетеля в `scripts/mutation-gate.mjs` на механизмы
   перф-дельты #160 (LRU-кэш размещений, кэш по идентичности массива силуэтов,
   гард повторного использования при зуме внутрь, AABB-отсечение) плюс гарды в
   `test/iso-scene-render.test.mjs` (AC1, AC2).
2. Диффозависимый `performance_smoke` в `.github/workflows/validate.yml`:
   новые выходы `perf_iso`/`perf_interaction` job `changes`, вынесенные из
   inline-shell в `scripts/classify-changes.mjs`, условные шаги смока с
   бюджетами `demo/performance/budgets-isometric-smoke.json` /
   `budgets-interaction-smoke.json`, набор профилей в ключе `reuse` (AC3–AC5,
   AC8), плюс ручное воспроизведение AC6/AC7 и правка `PROCESS.md` §8.

Продуктовый код (`src/**`) не меняется нигде — подтверждено:
`git diff origin/dev...HEAD -- src/` пуст.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто, без вывода |
| unit | `npm test` | `tests 2092 / pass 2091 / fail 0 / skipped 1` |
| build | `npm run build` | собран, без ошибок |
| копии бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «0 в 0 файлах» (диф не трогает `src/**`) |
| выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «браузерных смоков не выбирается» — диф не трогает `src/**/*.ts`, выбирать нечего |
| workflow YAML | `python3 -c "yaml.safe_load(...)"` | валиден |
| свидетель W1 | `node scripts/mutation-gate.mjs --id=iso-placement-cache-ignores-selected` | чистый прогон ok, мутант «покраснел, поймано 1 из 1» |
| свидетель W2 | `--id=iso-placement-cache-survives-silhouette-change` | поймано 1 из 1 |
| свидетель W3 | `--id=iso-zoom-in-reuses-near-wall-plate` | поймано 1 из 1 |
| свидетель W4 | `--id=iso-aabb-rejects-touching-wall` | поймано 1 из 1 |
| AC3 негативный прогон | вручную снят `if: needs.changes.outputs.perf_iso == 'true'` у шага «Изометрический профиль по диффу», прогнан `node --test --test-name-pattern="перф-смок добавляет профиль ровно при своём выходе changes" test/validate-workflow.test.mjs` | падает (`AssertionError`, ожидаемый `if:` не найден); файл восстановлен, `git status` чист |
| AC5 негативный прогон | вручную убран суффикс `-${{ needs.reuse.outputs.performance_smoke_set }}` из save-ключа `reuse`, прогнан тест «ключ reuse перф-смока различает наборы профилей» | падает; файл восстановлен |
| AC8 негативный прогон | в `scripts/classify-changes.mjs` регэксп `perf_iso` испорчен (`iso-nonexistent-`), прогнан `test/classify-changes.test.mjs` | 2 из 7 тестов падают; файл восстановлен |
| AC4 | `node --test test/performance-budget.test.mjs` | оба новых smoke-бюджета проходят сравнение `hardMaxMs`/`stat`/`longTasks`/`heap`/`cacheEntries` с полными профилями, синтетический отчёт 9870 мс красит `timing.firstStableRenderMs.median` |
| весь релевантный набор одним прогоном | `node --test test/classify-changes.test.mjs test/performance-budget.test.mjs test/validate-workflow.test.mjs test/performance-workflow.test.mjs test/iso-scene-render.test.mjs` | `tests 61 / pass 61 / fail 0` |

**Не прогонял и почему:**

- `npm run golden:verify` — диф не меняет визуал (`src/**` не тронут, эталоны
  не тронуты); автор отдельно предупредил, что `dev` уже красный на golden
  из-за непересъёмки #471 (`be5eeb41`) — это не имеет отношения к дельте
  #473, отдельная проблема вне скоупа этого ревью;
- `python -m pytest tests_backend -q` — диф не трогает `custom_components/**/*.py`;
- `node scripts/check-docs.mjs` — правило требует его при диффе по `src/**`;
  здесь `src/**` не тронут, отпечаток скриншотов не может устареть от этого
  диффа;
- `node scripts/model-invariants.mjs` — диф не трогает геометрию, ссылки на
  неё, `layout`, `marker.space`, `open_spans`;
- полный перф-прогон (`benchmark:large-house` локально) — задача сама
  описывает его как «AC6/AC7 доказаны один раз при реализации», числа уже
  записаны автором в хендоффе и внутренне согласуются с бюджетами (см. ниже);
  повторный прогон стоил бы часы ради проверки арифметики, которую я сверил
  чтением;
- полный `scripts/mutation-gate.mjs` без `--id` (все ~40+ мутантов) — задача
  добавляет только 4 новых, гонять весь набор ради ревью четырёх — не
  соразмерно (§8); проверены именно новые.

Зелёного Validate на SHA `d95255ad` нет (описано в задании), поэтому дешёвые
гейты прогнаны мной лично, см. таблицу выше — все зелёные.

## AC — доказательство и «чем краснеет»

| AC | Заявлено | Чем доказан | Чем краснеет |
|---|---|---|---|
| AC1 | 4 свидетеля в реестре, каждый ловится | `mutation-gate.mjs --id=<witness>`, 4/4 «поймано 1 из 1» (прогнано мной) | сами мутации из таблицы §4 ТЗ; проверено воспроизведением |
| AC2 | envelope без коллизий = точный резолвер до nudge | код-чтение: `resolveIsoOverlayPlacement` (`src/iso-overlays.ts:449-457`) строит `baseFootprint` и решает `nearWallBefore` **до** нужного участка nudge-логики одинаково независимо от того, есть ли стены; при `resolveCollisions:false` `wallSilhouettes` подаётся пустым (`iso-scene-render.ts:849`), значит `nearWallBefore` всегда `false` и nudge не применяется — итоговые границы буквально равны `baseFootprint`, что и есть «точный резолвер до nudge». Существующий тест (строки 391–395, **добавлен исходной перф-дельтой #160, не этой задачей**) подтверждает поведенчески: `nearWallBefore=false`, отдельная запись кэша. **Проверено чтением, не исполнением** — по формулировке спеки «нет однозначной мутации», согласовано ещё на ревью ТЗ (r2) | нет однозначной мутации (заявлено в ТЗ и подтверждено чтением: обе ветки используют один и тот же `baseFootprint`) |
| AC3 | `changes` отдаёт `perf_iso`/`perf_interaction`; смок добавляет профиль ровно при своём выходе | `test/validate-workflow.test.mjs` (контрактный тест на YAML) + мой негативный прогон | снятие `if:` у шага — тест падает (проверено вручную) |
| AC4 | smoke-бюджеты валидны для `--absolute-only`, повторяют `hardMaxMs` полных | `test/performance-budget.test.mjs`, сверка JSON построчно (я перечитал оба файла — потолки идентичны) | несовпадение `hardMaxMs`/`stat`/списка метрик — тест `assert.equal`/`assert.deepEqual` красится напрямую |
| AC5 | ключ `reuse` различает наборы профилей | `test/validate-workflow.test.mjs` + мой негативный прогон (снятие `-performance_smoke_set` из save-ключа) | тест падает (проверено вручную) |
| AC6 | на `de215578` изометрический smoke-бюджет краснеет по первому кадру | ручное воспроизведение автором: артефакт CI-прогона 34013995127 (`isometric-candidate.json`, 7 образцов) прогнан через `benchmark:compare --absolute-only --budgets=...isometric-smoke.json` → 11 отказов, включая `firstStableRenderMs` 9870/3500. Числа (9870, 30545, 12000 для `maxTotalP95Ms`) я сверил построчно с committed `budgets-isometric-smoke.json` — совпадают | команда и результат названы в issue (хендофф), не «verified» без содержания |
| AC7 | текущий `dev`/ветка укладывается в потолки за 3 образца | ручной прогон автора: isometric 29 с (`firstStableRenderMs` 1241/3500, `switchCycle` 1401/8000, `modelReady` 1158/3000), interaction 36 с (`firstStableRenderMs` 2501/3000, `interactionSeries` 2350/3000, `hoverSeries` 200/500) — все числа ниже потолков в committed JSON, сверено | доказательство «в CI этой ветки» технически недостижимо (дифф без продуктовых путей) — верно и подтверждено повторно; ручной способ адекватен |
| AC8 | диффозависимость доказана на функции классификации | `test/classify-changes.test.mjs`, 7 тестов, плюс мой негативный прогон (испорченный regex `perf_iso`) | 2/7 тестов падают при испорченном паттерне (проверено вручную) |

## Что проверено и корректно

- Все 4 патча мутантов (`find`/`replace`) в `scripts/mutation-gate.mjs`
  побайтово совпадают с текущим `src/iso-scene-render.ts` /
  `src/iso-overlays.ts` — не устарели после ребейза на #471
  (`plate`→`footprint`), что подтверждается их успешным прогоном.
- `demo/performance/budgets-isometric-smoke.json` и
  `budgets-interaction-smoke.json` — `hardMaxMs`, `stat`, набор метрик,
  `longTasks`, `heap.hardMaxGrowthBytes`, `cacheEntries`, `renderedDevices`
  идентичны соответствующим `budgets-large-house-*.json` (сверено вручную и
  тестом); регрессионные коэффициенты сознательно отсутствуют, как в ТЗ.
- Изменение `.github/workflows/validate.yml`: `classify` пишет через
  `scripts/classify-changes.mjs` вместо inline-`has()`, все три fallback-ветки
  (`dev`, force-push, пустая база) переведены на `--all`; ключ `reuse`
  расширен `performance_smoke_set`, использован согласованно и в
  lookup-, и в save-шаге; `needs: changes` у `reuse` и `performance_smoke`
  корректны; YAML валиден.
- Регекспы `perf_iso`/`perf_interaction` в `scripts/classify-changes.mjs`
  покрывают все существующие файлы `src/iso-*.ts`, `src/live-*.ts`,
  `src/render-*.ts`, `houseplan-render-lifecycle.ts`, `houseplan-card.ts`
  (проверено по дереву — все плоские, без подкаталогов).
- Трейлеры на всех 9 коммитах диапазона — `Issue: #473`,
  `User-Visible: no` — корректны для infra/process-задачи без
  пользовательского поведения; ветка называется `issue/473-iso-perf-witnesses`.
- Документация — `PROCESS.md` §8 и `demo/performance/README.md` описывают
  ровно то, что реализовано; `docs/specs/README.md` получил строку. Всё в тех
  же коммитах, что и код (правило §11 PROCESS.md).
- Никаких файлов класса D (`dist/**`, `custom_components/houseplan/frontend/**`)
  в диапазоне коммитов нет — сборка/копия проверены мной локально, не
  закоммичены.
- Автор честно зафиксировал независимую проблему (красный golden на `dev` от
  #471) вместо того, чтобы скрыть или чинить её здесь — соответствует «скоуп
  не расширяется».

## Находки

Нет ни одной находки уровня High или Medium. Диапазон не меняет продуктовый
код, все заявленные механизмы свидетельствования воспроизведены мной лично с
отрицательными прогонами (AC1, AC3, AC5, AC8), AC2/AC6/AC7 разобраны по коду
и по числам и признаны корректными.

Low (не блокирует, снимается записью): хендофф-комментарий группирует AC2 с
AC1 под «свидетели (AC1, AC2)», не проговаривая явно, что AC2 доказывается
чтением, а не мутацией — из-за чего эта явная запись отсутствовала до
настоящего документа. Формально требование §2.7 («либо тест… либо явная
запись „проверено чтением“») выполнено этим документом; отдельного цикла
это не стоит.

## Чего не проверял (и почему — см. таблицу гейтов)

`golden:verify`, `pytest tests_backend`, `check-docs.mjs`,
`model-invariants.mjs`, полный `mutation-gate.mjs` без `--id`, повторный
запуск `benchmark:large-house` локально — все перечислены в таблице «Как
проверялось» с причиной непрогона.

## Вердикт

Зелёный. Очередь на пре-релиз (`S8-merged` после слияния конвейером).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/473-iso-perf-witnesses`, коммит `d95255ada269` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e510f97d0d84d89d12cfd1d4448c3368bd6a2475`
  ```
  git log --all --format='%H %T' | grep e510f97d0d84
  ```
- ТЗ `docs/specs/473-iso-perf-witnesses-and-smoke.md`, блоб `5e2068d0dcab862fdf8964a3ec6966f1e73c2431`
  ```
  git log --all --find-object=5e2068d0dcab862fdf8964a3ec6966f1e73c2431 -- docs/specs/473-iso-perf-witnesses-and-smoke.md
  ```
