# CODE-REVIEW-905-r1

Материал: `dcec4cb2e5271f99a4b9db71630f82a26153b2df` (рабочая копия на этом SHA,
`git rev-parse HEAD` сверен). Единственный коммит в диапазоне `origin/dev..HEAD`:

```
dcec4cb2 fix(process): align negative evidence with nightly-only execution
Issue: #905
User-Visible: no
```

Validate на этом SHA зелёный (run 38756989657) — `npx tsc --noEmit`, `npm test`,
`npm run build` + сверка копий бандла не перегонялись, засчитаны по ссылке
(§8, #343).

## Скоуп

Диапазон `git diff origin/dev...HEAD` — 11 файлов, только класс B/C: правка
промпта ревьюера (`.github/workflows/_process.yml`), канона (`PROCESS.md`),
двух дайджестов (`docs/process/AUTHOR.md`, `docs/process/REVIEWER.md`),
`docs/TESTING.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, расширение `test/process-digests.test.mjs`, новый
`docs/analysis/905-negative-evidence-2026-10-15.md` и
`docs/release-ledger/v1.80.1/905.json`. Ни одного файла `src/**`, `scripts/**`
(кроме чтения существующих модулей в тесте) или продуктового Python —
правка целиком текстовая/process-infra, как и заявлено в ТЗ (не-скоуп прямо
исключает verdict schema, бюджеты, CI-права, mutation executor).

Задача закрывает найденное в журнале противоречие между PROCESS §2.7 (запрет
ручной мутации вне ночи) и TESTING/промптом (разрешение «прогона со снятой
защитой» и рецепт восстановления дерева после него) — обслуживает
целостность самого ревью-конвейера, т.е. работу над `docs/SCOPE.md` как
инфраструктуру процесса, а не один из трёх персон-сценариев продукта; это
корректно для класса `infra`/`process`.

## Как проверялось

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | Построчное сравнение PROCESS.md §2.7 (строки 258–288), `docs/TESTING.md` правило 4, общего раздела `docs/process/REVIEWER.md` «Отрицательные проверки и мутанты» (new, до `## Ревью ТЗ`) и фактического `Review` prompt в `_process.yml` — старое разрешение «для чистых юнитов достаточно прогона со снятой защитой» и рецепт `git checkout -- .`/`git clean -fd` после проверки «умеет ли тест падать» удалены из всех четырёх источников, не продублированы рядом с новым запретом | Прогнал ad-hoc сверку той же логики (`policyProblems`, скопированной из нового теста) на блобах `origin/dev` этих же четырёх файлов через `git show` — старый текст фейлит все 4 проверки (`missing: …`, `retired permission/recipe: без названной мутации` / `ревьюер мутирует и затем восстанавливает`), текущий HEAD проходит 0 problems. Файлы рабочей копии не трогались, только чтение другого git-blob'а — не мутация предмета ревью |
| AC2 | `node --test test/process-digests.test.mjs` — новый тест «#905 AC1/AC2 common policy reaches the actual prompt for every stage/track» рендерит реальный `Review` prompt-scalar (через `findStep`/regex на буквальный YAML-блок, не копию текста) для всех 6 комбинаций `spec/code × ask/show/ship` и проверяет наличие политики и отсутствие старых фраз в каждой | Тест явно падает на `assert.fail` при любом ещё не обработанном `${{ }}`-выражении (защита от рендеринга мимо реального prompt) и на `policyProblems` — проверено тем же прогоном против `origin/dev`-текста (см. AC1) |
| AC3 | Новый тест «#905 AC3 ordinary input fixtures and static readiness are not caught execution evidence» — `policyProblems` on фразе «для чистых юнитов достаточно прогона со снятой защитой» ловит `retired permission/recipe`; `definitionProblems({})` ловит пустую декларацию; `isProofOutcome` для `registered`/`static-readiness`/`ordinary-pass` возвращает `false`, для `assertion-killed` (синтетический receipt) — `true`, т.е. синтетическая классификация отделена от настоящего ночного caught | `node --test test/process-digests.test.mjs` зелёный (см. ниже); сами ассерты содержат встроенные негативные случаи (`assert.ok(definitionProblems({}).length > 0 …)`) — тест компактно доказывает себя без внешнего мутанта, т.к. предмет AC3 — текстовый/метаданный контракт, а не продуктовый гард |

Прогнано лично на `dcec4cb2`:

- `node --test test/process-digests.test.mjs` — 8/8 passed, 0 failed, 0 skipped.
- `node --test test/process-digests.test.mjs test/process-track.test.mjs
  test/workflow-hygiene.test.mjs test/workflow-pipefail.test.mjs
  test/review-doc-guard.test.mjs test/testing-doc.test.mjs
  test/entry-cost.test.mjs test/monolith-text-anchors.test.mjs
  test/review-preflight.test.mjs` — 152/152 passed, 0 failed, 0 skipped,
  совпадает с цифрой из хендоффа автора (152/152 на этом же SHA).
- Отрицательный свидетель (AC1/AC2, таблица выше): ad-hoc скрипт в `/tmp`
  (вне репозитория, удалён после прогона), `git show origin/dev:<file>` для
  `docs/process/REVIEWER.md`, `docs/TESTING.md`, `PROCESS.md`,
  `.github/workflows/_process.yml` — старый текст всех четырёх проваливает ту
  же проверку, что и внутри нового теста. Рабочая копия и предмет ревью не
  изменялись ни на миг — это чтение другого git-объекта, не временный патч
  исполняемой реализации/гарда, поэтому не запрещённая этим же патчем
  практика.
- `ls` существующих хелперов (`test/helpers/workflow-step.mjs`,
  `scripts/mutation-registry.mjs`, `scripts/mutation-registry-check.mjs`,
  `scripts/mutation-guard-outcome.mjs`), импортированных новым тестом, —
  подтвердил, что это переиспользование уже существующих до этой задачи
  модулей, а не новый код в скоупе.
- Поиск ретированных формулировок по всему репозиторию (кроме `legacy/**`,
  исключённого по умолчанию, и `docs/reviews/**` — исторические записи):
  `прогон(а) со снятой защитой`, `без названной мутации`,
  `после проверки «умеет ли тест падать»`, `ревьюер мутирует и затем
  восстанавливает` — совпадений в активном каноне/промпте/дайджестах нет.

## Чего не проверял и почему

- `npx tsc --noEmit`, `npm test` (полный), `npm run build` + сверка трёх
  копий бандла — не перегонял: зелёный Validate на этом точном SHA уже
  подтверждён (run 38756989657), дифф не трогает `src/**` и бандл не
  меняется.
- `smoke-select.mjs`, `golden:verify`, `pytest tests_backend`, `npm run
  invariants` — не прогонял и не требовались: diff не содержит фронтенд-,
  геометрических или Python-изменений (нет `ci:golden`, нет правки
  гео/устройств), AC задачи не называют ни один из этих гейтов.
- `mutation-gate.mjs` (полный ночной прогон) и реестр мутантов — не
  прогонял: правило задачи и общая политика конвейера однозначны — поимку
  подтверждает только ночь, её отсутствие не находка.
- Фактическое поведение модели-ревьюера на реальном прогоне (будет ли она
  действительно следовать новому тексту) — не проверяется: это
  согласованность инструкций, а не гарантия поведения; сама задача прямо
  декларирует этот предел в разделе «Риски» ТЗ, и я его не отменяю.

## Находки

Блокирующих (High) и находок Medium — в скоупе или вне скоупа — не найдено.

Технический вопрос, уже снятый ревьюером спецификации (SPEC-REVIEW-905-r1,
про сохранение инженерной защиты `git reset --hard` (#365) отдельно от
убираемой рамки «мутация — ожидаемая практика»), на этом коде подтверждён
фактом: `git reset -q --hard "origin/$target"` и `git clean -fdq -e
node_modules` в `.github/workflows/_process.yml` не удалены и не ослаблены —
удалена только характеристика ручной подмены как рутинной практики в
комментарии рядом, сам защитный механизм на месте. Новой находки нет.

Low (не блокирует, не открывает цикл): не нашёл дополнительных. Low из
SPEC-REVIEW-905-r1 (AC без явного тега `unit`/`ревью кода` из §2.5) не
переносится на код — это замечание к формулировке ТЗ, а не к реализации, и
уже снято ревьюером ТЗ.

## Что проверено и корректно

- Трейлеры коммита: `Issue: #905`, `User-Visible: no` — присутствуют;
  `User-Visible: no` корректен (чистая правка process/инструкций, нет
  видимого пользователю поведения), changelog не требуется и не тронут —
  подтверждено отсутствием `docs/CHANGELOG*.md` в диффе.
- `docs/release-ledger/v1.80.1/905.json`: `schema: 1`, `category: "infra"`,
  обоснование относительно `v1.80.1` — соответствует заявленному (нет
  пользовательского изменения между stable), milestone не назначается,
  согласуется с «Release-артефакты» ТЗ.
- Общая политика вынесена в раздел `## Отрицательные проверки и мутанты`
  `docs/process/REVIEWER.md`, физически ДО `## Ревью ТЗ` (проверено индексом
  строки в файле) — закрывает собственную находку ревью ТЗ про
  неоднозначность расположения правила внутри `## Трек show`; старый
  дублирующий абзац внутри `## Трек show` удалён, а не оставлен рядом.
- `_process.yml`: политика видна в теле хендофф-промпта для любых
  track/stage (блок после «Трек: …», общий для всех веток `${{ }}`), а не
  только в show-специфичной ветке.
- Один источник числа: единственная количественная величина, которую диффу
  правдоподобно приписать пользователю видимой (отсутствует — задача не
  меняет ни одного UI-числа); дублирования «одно число — два источника»
  (§8) в этом диффе нет.
- Не-скоуп ТЗ (verdict schema, бюджеты/модель/max-turns, CI-права, ночной
  график, mutant registry implementation, исторические verdict/S8) —
  подтверждён чтением диффа: ни один из этих файлов/значений не задет
  (`--max-turns 150`, `REVIEW_DOC: ${{ runner.temp }}/review-document.md`
  и пр. в `_process.yml` не изменились за пределами текста политики).
- Переиспользуемые в новом тесте модули (`scripts/mutation-registry.mjs`,
  `scripts/mutation-registry-check.mjs`, `scripts/mutation-guard-outcome.mjs`,
  `test/helpers/workflow-step.mjs`) существовали до этой задачи и не
  изменены — новый тест только читает их экспорт.

## Вердикт

Зелёный. Диапазон AC1–AC3 закрыт текстом и тестами, тест-сенситивность
подтверждена отрицательным свидетелем без мутации предмета ревью, защитный
механизм `git reset --hard`/`git clean -fd` сохранён, release-ledger и
трейлеры корректны. Блокирующих и Medium-находок нет, цикл не открывается.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/905-review-mutation-policy`, коммит `dcec4cb2e527` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1ef90085824ad029029d54de02c4d97f629fe6e6`
  ```
  git log --all --format='%H %T' | grep 1ef90085824a
  ```
- Тело issue: `8601865be43037058f65625a35c6afa933cfc5d04380ffb076e0d055e9b03fe4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNzksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzY5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0NCwib3V0cHV0X3Rva2VucyI6MTUxMjgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzU1MjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNDgzODAzLCJjb3N0VXNkRXN0aW1hdGUiOjAuNzUwMjA4NjAwMDAwMDAwMX1dLCJ0dXJucyI6MzUsImR1cmF0aW9uTXMiOjE4NTE2MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzU0NTc3NjAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4323 output_tokens=15146 cache_creation_input_tokens=75520 cache_read_input_tokens=1483803 num_turns=35 -->
