# CODE-REVIEW-1021-r1

Issue: #1021 «Подготовить trusted preflight к удалению устаревшей копии dist/ (#1016)»
Трек: show · Этап: code · Заход: r1 · блокирующих циклов использовано 0 из 2
Материал: `c1b6a221e74dba9cae52914e3b232c4f05ab2c10` (база `3e3ab77eb811ad3e8e6b69a5c7bd112eb16dae6a`),
диапазон `origin/dev..HEAD`, 2 коммита:
`35dad0c27 fix(process): prove duplicate bundle retirement before review`,
`c1b6a221e test(process): align bundle witnesses with retirement predicate`.
Вердикт: **зелёный**, `route: fix`.

## Скоуп

Инфраструктурная подготовка (класс B, scripts/**) читателя provenance/preflight к
будущему удалению дублирующей копии `dist/` (#1016): правило #657 «бандл меняет
только релизный кандидат» получает исключение — доказанное Git удаление путей
`dist/` не требует трейлера `Release:`, при этом любое добавление/изменение
`dist/` и любое изменение или удаление `custom_components/houseplan/frontend/`
(HACS-снимок) по-прежнему требуют `Release:`. Продуктовый код, бандл, версии и
релизы не меняются; обе цели (#1016) остаются заблокированными до отдельной
задачи. Это закрывает инфраструктурную предпосылку задач J4/J6 (поддержание
цепочки поставки карточки в рабочем состоянии) — не строку Core user jobs
напрямую, но корректно отнесено к `category: infra` в release-ledger, что я
проверил отдельно (см. ниже). AC из тела issue: AC1 (правило
`bundleCommitErrors`/`committedBundleMustMatch`), AC2 (CLI `--must-match` и
`review-preflight` несут доказательство удаления), AC3 (preflight остаётся
только форматной проверкой, identity/ledger/handoff не ослаблены).

## Маршрут (§5, #726)

| Критерий | Проходит? |
|---|---|
| complexity | да — три небольших скрипта + тесты, низкий риск |
| surfaces | да — одна поверхность: конвейер проверки provenance коммита (hook + CLI + preflight) |
| migration | да — нет миграции конфига, нет новых compatibility-полей |
| ux-contract | да — `User-Visible: no` на обоих коммитах, пользовательского поведения нет |
| perf-touch | да — чистый tooling, нет влияния на рендер/touch |
| undocumented | да — новое поведение зафиксировано в самом PROCESS.md (новый абзац), docs/DEVELOPMENT.md и docs/STATUS.md тем же коммитом |

Все критерии §5 пройдены → `route: fix`.

## Как проверялось

Зелёный Validate на этом SHA подтверждён (ссылка в задаче ревью), поэтому
`npx tsc --noEmit` / `npm test` / `npm run build` + сверку трёх копий бандла
не перегонял. Дифф не трогает рендер/геометрию/Python — golden, инварианты,
pytest не применимы.

| Гейт | Команда | Результат |
|---|---|---|
| Целевые unit (4 файла, названные автором) | `node --test --test-reporter=dot test/bundle-policy.test.mjs test/review-preflight.test.mjs test/commit-provenance.test.mjs test/process-digests.test.mjs` | PASS, exit 0 (сам прогнал на материале) |
| Static readiness 4 обновлённых якоря mutation-registry | `node scripts/mutation-gate.mjs --check --id=provenance-skips-bundle-rule` (и ещё 3: `bundle-policy-rule-off`, `bundle-policy-always-compares`, `bundle-policy-candidate-not-compared`) | `ok` по всем четырём, `execution=0 caught=unknown (nightly only)` — честно, не выдаётся за caught |
| Process-digests/issues gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 ожидаемый WARN «инфраструктурный диапазон — статусная метка не требуется до S7» |
| Трейлеры коммитов | чтение `git log` | `Issue: #1021` и `User-Visible: no` на обоих коммитах, классы A/B не содержат; changelog не требуется |
| release-ledger | чтение `docs/release-ledger/v1.82.0/1021.json` | `category: infra`, обоснование относительно `baseStable: v1.82.0` корректно; `introducedBy` не требуется (не правка бета-фичи) |
| Негативный случай (защитный AC2) | прочитан и исполнен тестом `#1021 actual Git deletion is not a release...` в `test/bundle-policy.test.mjs`: реальный `git rm -qr dist`, коммит, затем `git rm custom_components/houseplan/frontend/houseplan-card.js` и прогон неизменённого `validate-commit-provenance.mjs --staged` | хук отклоняет удаление HACS-копии без `Release:` (`status != 0`, сообщение матчит `changes only in a.*Release`); я подтвердил это исполнением всего набора — тест «умеет падать» в нужном месте, это обычный negative-input case на неизменённой реализации, не мутант |

### Чего не проверял и почему

- `npx tsc --noEmit`, `npm test` (полный), `npm run build` + сверка бандла —
  не перегонял: Validate зелёный на этом же SHA (ссылка в задаче), гейт дешёвый
  и уже подтверждён.
- `npm run gate:small` — не перегонял; автор привёл команду и результат (PASS,
  204 с) в хендоффе, это полноценное свидетельство, а сам гейт уже покрыт
  Validate+целевыми тестами выше.
- golden/`ci:golden`, performance, инварианты модели, `pytest tests_backend` —
  не применимы: нет изменений рендера/геометрии/Python, метки `ci:golden` нет,
  производительность не названа в AC.
- Мутанты из реестра (ночной прогон) не исполнял и не мог: это запрещено вне
  ночного workflow даже ревьюеру; доказательство AC2 построено на обычном
  negative-input case выше, не на запуске зарегистрированного мутанта.

## Находки

Находок нет. High: 0, Medium: 0.

Побочных находок вне скоупа также нет — доверенный снимок
`REVIEW_FINDINGS_POLICY` (`mode: issues`) не задействован: новых issue не
заводится, т.к. нечего заводить.

Мелкое наблюдение без статуса находки (Low, не блокирует): новая
`withoutRetiredDeletions(files, deletedFiles)` в `scripts/bundle-policy.mjs`
сравнивает `path.startsWith('dist/')` без замены `\`→`/`, в отличие от
`isBundlePath`, которая нормализует разделители. Поскольку `git diff`/`diff-tree`
всегда отдают пути с `/` независимо от ОС (включая Windows), на практике это не
воспроизводится, а при расхождении сторона отказа безопасна (лишний отказ, не
пропуск). Не поднимаю это отдельным Medium.

## Что проверено и корректно

- `bundleCommitErrors`/`committedBundleMustMatch` (`scripts/bundle-policy.mjs`):
  `withoutRetiredDeletions` вычитает из списка путей только те `dist/…`, что
  реально отмечены Git как удалённые (`deletedFiles`); добавления/изменения
  `dist/` и любые изменения/удаления `frontend/` под фильтр не попадают и
  по-прежнему требуют `Release:` — подтверждено юнитами и реальным Git-фикстура-
  тестом.
- `commitShape` (историческая проверка CLI) и `collectReviewInput`/`checkReviewInput`
  (`review-preflight.mjs`) теперь собирают `deletedFiles` тем же `git diff-tree
  --diff-filter=D` и прокидывают их в `validateCommitMessage`/`bundleCommitErrors`
  — доказательство идёт из Git, не из текста коммита, как и требует AC2.
- В `validate-commit-provenance.mjs` хук commit-msg (`--staged`) раньше строил
  `files` с `--diff-filter=ACMR`, из-за чего чисто-delete коммит (в т.ч. удаление
  HACS-копии `frontend/`) вообще не виден хуку и не ловился на месте (ловился
  только исторической проверкой CI без фильтра). Новый код убирает фильтр и
  параллельно считает `deletedFiles`, так что хук теперь **тоже** ловит
  удаление `frontend/` без `Release:` — защита не ослаблена, а подтянута к
  уровню исторической проверки; это прямо подтверждается новым Git-фикстура-
  тестом и совпадает с формулировкой автора «staged deletion frontend теперь
  тоже проверяется хуком».
- Побочный эффект снятия `--diff-filter=ACMR`: `isDocsOnlyCommit`/`changesGolden`
  на хуке теперь тоже видят файлы, если коммит их только удаляет (раньше —
  видели только историческая проверка). Это делает хук строже/точнее в сторону
  существующей исторической проверки, а не слабее; отдельного теста на этот
  побочный эффект нет, но объём для `track:show`/`complexity`-≤3 соразмерен.
- Четыре патча `mutation-registry.mjs`, чей `find`-текст ссылался на старые
  строки кода, актуализированы на новые строки — сверил `grep` по текущим
  файлам: все четыре строки присутствуют дословно; `mutation-gate --check`
  зелёный по всем четырём статически.
- Документация (`PROCESS.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`) описывает
  именно то поведение, которое добавлено в коде, без расхождений с AC1–AC3.
- Трейлеры `Issue:`/`User-Visible:` на месте на обоих коммитах класса B;
  `User-Visible: no` — changelog не требуется, не проверялся.
- Таблица «AC · чем доказан · чем краснеет» в хендоффе автора заполнена по
  всем трём AC, третий столбец не пуст — соответствует требованию §2.7 для
  защитных AC.

## Маршрут побочных находок

`REVIEW_FINDINGS_POLICY`: `mode=issues` (доверенный снимок prepare). Побочных
находок Medium вне скоупа нет — новый issue не заводился.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1021-dist-retirement-reader`, коммит `c1b6a221e74d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ea2a365c6f00b0baa31b53ad0f434d3602b0d636`
  ```
  git log --all --format='%H %T' | grep ea2a365c6f00
  ```
- Тело issue: `cd8d0b15decfde37f4b8860fb6976cc938687620df9bd005283abc25a6af3055`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMTAsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTg1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1MCwib3V0cHV0X3Rva2VucyI6MjQ0NTMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODUyNTMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxOTY1ODMzLCJjb3N0VXNkRXN0aW1hdGUiOjAuOTc4ODA4NjAwMDAwMDAwM31dLCJ0dXJucyI6MzIsImR1cmF0aW9uTXMiOjMxODQ4MCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTgzOTkzNjAwMDAwMDAwMiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5160 output_tokens=24468 cache_creation_input_tokens=85253 cache_read_input_tokens=1965833 num_turns=32 -->
