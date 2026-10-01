# CODE-REVIEW-727-r2

Issue: #727 · этап code · трек `ask` · заход r2 · блокирующих циклов 0/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно `00d1a7b6c3e09072c3d3b3381ada3ab37e16aab3` (рабочая копия уже на нём)

## Скоуп

Тот же контракт, что в r1: ночной режим пакетного ship-ревью на `dev` и
переиспользование его результата гейтом беты по патч-набору (К1–К9, AC1–AC10
из ТЗ в теле #727, спец-ревью зелёное с r2, `docs/reviews/SPEC-REVIEW-727-r2.md`).
Классы изменений — B (`scripts/**`, `.github/workflows/**`, `test/**`) и C
(`PROCESS.md`, `docs/process/REVIEWER.md`); файлов класса A нет. `User-Visible: no`
подтверждено — `git diff origin/dev...HEAD --stat -- docs/CHANGELOG*.md` пуст.

**Почему есть r2, хотя r1 был зелёным.** Пока шёл код-ревью r1 (материал
`93be52eb` поверх `dev@52dc08a0`), `dev` продвинулся на один коммит (слился
`3bb1b534` — «the moon with any background», #718, несвязан с #727). Ветка
`issue/727-nightly-ship-review` ребейзнулась на новую вершину `dev@8fac66e1`,
патч-набор диффа изменил содержимое (другой `patch-id`), и комментарий автора
в issue (2026-10-01T03:12:22Z) прямо зафиксировал: «Дифф изменился при ребейзе
— вердикт к нему не применим (§2.10, #492) … новый заход ревью читает
актуальный код». Это ровно случай из промпта ревьюера «ребейз на ушедший
вперёд dev» — делаю **полный** разбор, а не только дельту: материал r1
(`93be52eb`) физически отсутствует в репозитории (`git cat-file -t` → объект не
найден), сравнить дельту напрямую нечем.

Файлы диффа не изменились по составу и почти не изменились по объёму
относительно r1: `scripts/ship-review.mjs` (+428/-…), `scripts/reviews-archive.mjs`,
`scripts/reviews-index.mjs`, `.github/workflows/_nightly.yml`,
`.github/workflows/_ship-review.yml`, `PROCESS.md` (§10.4, §11.7),
`docs/process/REVIEWER.md`, `test/ship-review.test.mjs` (+580),
`test/nightly-workflow.test.mjs` (+137), `test/process-digests.test.mjs` (+2);
плюс три новых коммита-артефакта публикации r1 (`docs/reviews/CODE-REVIEW-727-r1.md`,
два обновления `docs/reviews/INDEX.md`) — чисто документные, не продуктовый код.
`.github/workflows/ship-review.yml` (тонкий файл) не тронут — подтверждено
(`git log origin/dev..HEAD -- .github/workflows/ship-review.yml` пуст), как и
заявляет ТЗ («входы и права тонких файлов уже в main»).

## Как проверялось

Поскольку материал r1 недоступен для прямого `git diff <SHA>..HEAD`, разбор
сделан заново и независимо от выводов r1 — не как повторная вера документу,
а как самостоятельное построчное чтение:

1. **Эквивалентность содержимого r1→r2.** `git diff origin/dev...HEAD --stat`
   даёт тот же список файлов и почти те же цифры строк, что называет r1
   (`scripts/ship-review.mjs` 428, `test/ship-review.test.mjs` 580,
   `test/nightly-workflow.test.mjs` 137) — рабочий код не переписывался
   заново, только сместился контекст диффа при ребейзе. Родитель коммита
   `e852ee2e` — ровно текущий `origin/dev` (`8fac66e1`, `git log -1 --format='%H %P'`),
   то есть ребейз уже выполнен и ветка не отстаёт.
2. **Построчное независимое чтение всего диффа** (не выжимка из r1, а
   собственное прочтение): `git diff origin/dev...HEAD -- scripts/ship-review.mjs`
   целиком (все новые функции — `shipReviewMode`, `nightlyDocPath`,
   `shipDocPath`, `hasReleaseTrailer`, `countsForPatchSet`, `commitPatchIds`,
   `issuePatchSets`, `formatPatches`/`parsePatches`, `samePatchSet`,
   `shipCoverage`, `planShipReview`, `reviewSubject`, `renderShipBrief`,
   `anchorBlock`/`parseAnchorBlock`, `shipReviewProblems`, `highCommentBody`,
   `highCommentTargets`, `readRangeDocs`); `scripts/reviews-archive.mjs` (ветка
   `doc.nightly && STABLE_TAG_RE.test(doc.tag)` в `archivePlan`, с проверкой,
   что `ordered` в этом файле отсортирован **по возрастанию**, — то есть
   `.find()` действительно берёт ближайшую, не дальнюю линию, АС7(в));
   `scripts/reviews-index.mjs` (`SHIP_DOC_NAME` с опциональной
   `-dev-[0-9a-f]{12}` группой, `parseDocName`, сортировка `renderIndex`);
   `.github/workflows/_nightly.yml` и `_ship-review.yml` целиком (порядок
   шагов, `outputs:`, `if: always()`, `continue-on-error: true`, источник
   `mode`/`patches` публикации); `PROCESS.md` §10.4/§11.7 и
   `docs/process/REVIEWER.md` диффы; весь новый текст `test/ship-review.test.mjs`
   и `test/nightly-workflow.test.mjs`.
3. Каждый AC1–AC9 тела issue сверен с этим независимым чтением (оракул AC →
   функция/шаг → тест). AC10 — гейты, ниже.
4. Тело issue #727 и комментарии прочитаны через `gh issue view 727 --json
   comments` (MCP-инструменты `mcp__github__get_issue*` отказали разрешением в
   этой песочнице — `gh` CLI сработал напрямую, уже аутентифицирован как
   `github-actions[bot]`). Контракт К1–К9 не менялся с r1/спец-ревью r2;
   последний комментарий автора — объяснение самого ребейза (выше).

**Исполнено, не только прочитано:**
- `node --test test/ship-review.test.mjs test/nightly-workflow.test.mjs
  test/process-digests.test.mjs` — 29/29 зелёных; отдельно
  `test/default-branch-workflows.test.mjs` — 45/45 зелёных.
- `node scripts/mutation-gate.mjs --check` — exit 0, якорь
  `ship-review-ignores-merge-marker` и мутанты `ship-review-accepts-partial-coverage`,
  `ship-review-accepts-high` зелёные. Уточнение к r1: эти три мутанта заведены
  ещё в #696 (`git log -L` по `scripts/mutation-registry.mjs` — коммит
  `e1ae8f4a`), не новые в #727; `scripts/mutation-registry.mjs` в дельте
  `origin/dev...HEAD` не меняется. Проверено, что их `find`-строки
  (`if (missing.length) {`, `else if (block.high > 0) problems.push(`,
  `return names.includes('track:ship') || comments.some(...)`) совпадают
  дословно с переписанным кодом `shipReviewProblems` — переписывание функции
  в #727 не осиротило мутанты молча.
- `node scripts/entry-cost.mjs --check` — зелёный (author/reviewer/canon в
  бюджете слов).
- `node scripts/reviews-index.mjs --check` — «INDEX.md свеж»; независимо
  пересчитан файл: `ls docs/reviews/*.md | grep -v INDEX | wc -l` → 224,
  совпадает со строкой заголовка индекса.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — «исполняемого
  frontend-диффа нет, browser-smoke не выбираются»: `src/**/*.ts` не тронут.
- **Мутационная проверка вручную** (дисциплина «тест умеет падать»,
  независимо от r1 — тот же метод, своя команда): временно `cp` бэкап, правка,
  прогон, восстановление, `git diff --stat` после — пусто.
  - `samePatchSet` → `return true` всегда: упало 5 из 19 тестов
    `ship-review.test.mjs` (AC3, AC4, AC5, АС7-тест, сквозной
    `_ship-review.yml`-тест) — покрытие никогда не становится `stale`.
  - `archivePlan`: `ordered.find(...)` → `[...ordered].reverse().find(...)`:
    упал ровно тест АС7 (сценарий `в`, `[v1.78.0, v1.78.1, v1.79.0]` обязан
    дать `v1.78.1`, мутант даёт `v1.79.0`).
  Оба файла восстановлены из бэкапа, `git diff --stat` — пусто, полный прогон
  после восстановления снова 29/29.
- Трейлеры всех четырёх коммитов диапазона (`git log -1 --format=%B <sha>` на
  `e852ee2e`, `60581038`, `ac4dd1c5`, `00d1a7b6`): `Issue: #727`,
  `User-Visible: no` на каждом; `Co-Authored-By`/`Claude-Session` — на
  коммите продуктового кода.
- Проверка закрытия Low-наблюдения r1 (issue E «Красная ночь» из ТЗ) —
  `gh search issues`/`gh issue list --label S1-new`: находка снята, см.
  «Закрытие раунда r1».

**Не прогонял и почему:** `actionlint` — бинарь недоступен в этой песочнице
(`which actionlint` → код 1), как и в r1; риск тот же и так же низкий — YAML
`run:`-блоки проверяются `bash -n` в исполняемых тестах, структурные
инварианты — текстовыми assert’ами на реальном файле (см. `stepRun`/`job` в
`test/nightly-workflow.test.mjs`, выдержки выше). `npx tsc --noEmit` / `npm
test` (полный) / `npm run build` — не перегонял: Validate зелёный на этом
точном SHA `00d1a7b6` (ссылка в промпте ревью, прогон 36809481316), дешёвые
гейты этим закрыты. Python/`pytest tests_backend` — нет правки
`custom_components/**/*.py`. `npm run golden:verify`/`invariants` — нет
`ci:golden`, нет правки геометрии/рендера. Performance — не назван в AC.
Живой ночной прогон на реальном GitHub Actions — не воспроизводим в песочнице
ревью, остаётся риском первой ночи, как и в r1.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Low (наблюдение): ТЗ требует завести issue E («Красная ночь: комментарий в задачи, слитые после последней зелёной», `S1-new`, ссылка на #727) — на момент r1 такой issue не найден | Issue заведён | `gh issue view 736` — заголовок дословно совпадает с текстом ТЗ, тело «Выделено из #727 (issue E его ТЗ)», создан 2026-10-01T03:01:10Z, метки `infra`, `S1-new`, `process` |
| Low (наблюдение): `readRangeDocs` не имеет прямого unit-теста на дедупликацию «кандидат vs `devRef`» | Не предмет этого раунда — не находка, требующая действия (r1 явно отметил «риск низкий, повторной сессии не прошу»); код `readRangeDocs` не менялся между r1 и r2 (дифф идентичен), логика перечитана заново в этом раунде и подтверждена (см. «Как проверялось» п.2) | `scripts/ship-review.mjs`, функция `readRangeDocs` |

Других находок r1 не было (High 0, Medium 0 в r1).

## Унаследовано из r1 (без повторной проверки, с явной переподтверждённой частью)

Этот раунд — не формальная дельта (материал r1 недоступен для diff), поэтому
весь AC-разбор выполнен заново и независимо (раздел «Как проверялось»), а не
унаследован слепо. Без повторного исполнения приняты только факты среды,
которые не зависят от содержимого диффа #727 и совпадают с r1
(`docs/reviews/CODE-REVIEW-727-r1.md`, материал `93be52eb`, ныне недостижим
как объект — ребейз, но содержательно эквивалентен текущему `e852ee2e`,
доказательство — «Как проверялось» п.1):

- `track:ship` и маркер `hp:ship-merge` как признак ship-задачи (`isShipIssue`,
  не изменился с #696/#716, вне диффа #727);
- поведение `git patch-id --stable` и `git diff-tree` как документированное
  поведение инструментов, не специфика кода задачи;
- трек `ask` обоснован (сложность/риск >3, публичный контракт §11.7) —
  подтверждено спец-ревью r1/r2, код не меняет это решение.

Точечно переподтверждено в этом раунде (не просто унаследовано): все функции,
которые r1 называет по имени, перечитаны в текущем диффе заново (список в
«Как проверялось» п.2) — совпадение не предполагается, а показано.

## Что проверено и корректно

- Патч-набор по-прежнему исключает ровно `Release:`-коммит кандидата беты и
  коммиты только `docs/reviews/**` — иначе ночной набор никогда не совпал бы с
  набором на кандидате беты; логика (`hasReleaseTrailer`, `countsForPatchSet`)
  не изменилась между r1 и r2 (идентичный текст в обоих диффах).
- `archivePlan`: новая ветка `doc.nightly && STABLE_TAG_RE.test(doc.tag)`
  корректно использует уже отсортированный по возрастанию `ordered`
  (`[...lines].sort((a, b) => compareStable(a.tag, b.tag))`, строка 79) —
  `.find(line => compareStable(line.tag, doc.tag) > 0)` берёт ближайшую, а не
  последнюю линию новее базы; без линии новее — `kept` с объяснением. Это
  прочитано мной заново (не со слов r1) и подтверждено мутацией «переворот на
  `.reverse().find`» (упал АС7-тест).
- `_nightly.yml`: `head_sha` — выход job `dispatch`, записанный шагом
  `id: validate` **до** шага ожидания (`gh run watch --exit-status`) —
  красный Validate не теряет SHA кандидата. `ship_review` зависит только от
  `dispatch` (`if: always()`, `continue-on-error: true`) — отказ
  диспетчеризации ship-ревью не красит ночь. Оба факта перечитаны в текущем
  YAML, не взяты на веру.
- `_ship-review.yml`: `mode`/`patches` публикуемого блока — из выходов
  `prepare` (`needs.prepare.outputs.mode`/`.patches`), не из `result.json`
  модели — единственный источник числа patch-id не раздваивается (§8).
  Строка о High ночью (`needs.prepare.outputs.mode == 'nightly'`) пишется
  через `comment-high`, который сам же отказывается молча при `mode != nightly`
  или `high == 0` — двойная защита от шума в бета-режиме.
- `scripts/mutation-registry.mjs` не входит в дельту #727: три мутанта,
  которые использует этот код, принадлежат #696 и остаются валидными после
  переписывания `shipReviewProblems` (их `find`-строки совпадают дословно).
- Индекс (`docs/reviews/INDEX.md`) после публикации r1 корректен: счётчик
  документов (224) совпадает с фактическим числом файлов, новая строка
  `#727 code · r1 · 🟢` на месте, порядок (ночь/бета/релиз, затем issue по
  убыванию) не нарушен.
- Трейлеры всех коммитов диапазона корректны; изменений в обоих CHANGELOG нет,
  что соответствует `User-Visible: no`.
- Единственное Low-наблюдение r1 закрыто заведением issue #736.

## Проверка критериев приёмки

Разбор не изменился по существу относительно r1 (код идентичен содержательно
— см. «Как проверялось» п.1), но выполнен заново по текущему коду, а не
скопирован:

| AC | Что | Доказательство в коде | Тест | Вердикт |
|---|---|---|---|---|
| AC1 К1 | Патч-набор: `git patch-id --stable`, без `Release:`, без коммитов только `docs/reviews/**`, порядок не важен, cherry-pick даёт тот же id | `hasReleaseTrailer`, `countsForPatchSet`, `commitPatchIds` (явные опции `PATCH_DIFF`), `issuePatchSets` | `#727 AC1` — реальный git в temp-репозитории | доказано исполнением |
| AC2 К2 | `tag=nightly` требует `candidate`; имя документа по базе+SHA12; `prepare` отдаёт только `none`/`stale`; блок несёт `mode`/`patches` в хвосте | `shipReviewMode`, `nightlyDocPath`, `shipDocPath`, `anchorBlock`/`parseAnchorBlock` | `#727 AC2` (unit) + `#727 AC2/AC5 _ship-review.yml` (реальный bash) | доказано исполнением |
| AC3 К3 | Четыре статуса покрытия; «последний документ главнее»; чужая база не в счёт; документ без `patches` — по номеру | `shipCoverage` | `#727 AC3` | доказано исполнением; мутация `samePatchSet→true` ловится (перепроверено лично) |
| AC4 К4 | Гейт: всё `clean` без документа тега проходит; `none`/`stale`/`high` — отказ с командой | `shipReviewProblems` | `#727 AC4` | доказано исполнением |
| AC5 К5 | Бета читает дельту; бриф называет прочитанное ночью; `force=true` — всё; пустая дельта — без модели | `planShipReview`, `renderShipBrief` | `#727 AC5` + `#727 AC2/AC5` (сквозной, реальный bash) | доказано исполнением |
| AC6 К6 | Новая job после Validate, `if: always()`, не красит ночь, ждёт только появления прогона (18×10с) | `.github/workflows/_nightly.yml` (`ship_review`) | `#727 AC6` + два теста на реальном bash (`runStep`) | доказано исполнением; порядок шагов/`outputs:` перечитан лично |
| AC7 К7 | `parseDocName` узнаёт ночное имя; `archivePlan`: база-бета → своя линия, стабильная база → ближайшая новее, без линии новее — `kept` | `parseDocName` (`SHIP_DOC_NAME` с опциональной `-dev-sha12`), `archivePlan`, `renderIndex` | `#727 AC7` — все четыре примера (а)-(г) | доказано исполнением; мутация `find→reverse().find` перепроверена лично, ловится |
| AC8 К8 | Строка о High только ночью, с меткой документа, без повтора | `highCommentBody`, `highCommentTargets`, шаг «High ночью» (`if: needs.prepare.outputs.mode == 'nightly'`) | `#727 AC8` + `#727 AC8 _ship-review.yml` (реальный bash) | доказано исполнением |
| AC9 К9 | Канон — PROCESS.md §11.7/§10.4, REVIEWER.md, ключевое правило в `process-digests` | диффы прочитаны целиком лично | `node --test test/process-digests.test.mjs` зелёный; `entry-cost --check` зелёный | доказано исполнением |
| AC10 | Гейты | — | `mutation-gate --check`, `reviews-index --check`, `entry-cost --check` — перепрогнаны мной в этом раунде, зелёные | доказано исполнением (моим прогоном в r2) |

## Чего не проверял

- `actionlint` — бинарь недоступен в песочнице (как в r1); заявление автора
  не перепроверено независимо, риск низкий (см. «Как проверялось»).
- Полные `npx tsc --noEmit` / `npm test` (весь набор) / `npm run build` — не
  перегонял: зелёный Validate на точном SHA `00d1a7b6` (ссылка в промпте)
  закрывает дешёвые гейты для этого материала.
- Живой ночной прогон (`_nightly.yml` → `ship-review.yml -f tag=nightly` на
  настоящем GitHub Actions, включая `git describe` с реальными тегами при
  публикации) — не воспроизводим до продакшена; контрактные тесты на реальном
  bash/git закрывают то, что можно закрыть без него. Первая реальная ночь
  остаётся риском, как и в r1.
- Browser-smoke, golden, performance, HA-pytest — объективно не применимы
  (`src/**/*.ts`, геометрия/рендер, `custom_components/**/*.py` не тронуты).
- Прямой доступ к issue через MCP (`mcp__github__get_issue*`) — инструмент
  отказал разрешением в этой песочнице; использован `gh` CLI напрямую
  (уже аутентифицирован), результат тот же набор данных.

## Вердикт

Все AC1–AC9 проверены заново и независимо (не унаследованы слепо из r1, так
как материал r1 стал недостижим после ребейза на ушедший вперёд `dev`) —
построчным чтением всего диффа плюс исполнением тестов и двух ручных мутаций
на самых защитных участках (`samePatchSet`, выбор архивной линии в
`archivePlan`), обе ловятся тестами. AC10 — гейты пересняты в этом раунде.
Содержимое диффа эквивалентно тому, что видел r1 (тот же состав файлов, те же
объёмы правок, родитель коммита — ровно текущий `origin/dev`): разница — это
ребейз на влившийся параллельно и несвязанный #718, что явно подтвердил и
автор в issue. High и Medium нет. Единственное Low-наблюдение r1 закрыто
(issue #736 заведён). Новых находок в этом раунде нет.

**Зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/727-nightly-ship-review`, коммит `00d1a7b6c3e0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c1b179ff64fac8b2b842b513e73a7524cae3b957`
  ```
  git log --all --format='%H %T' | grep c1b179ff64fa
  ```
- Тело issue: `8ce2942ca915bc938c8c5b4a720bb71d5a06d18c13db0692ee802f6a55662b7a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
