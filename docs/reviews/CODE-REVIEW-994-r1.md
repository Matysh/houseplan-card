# CODE-REVIEW-994-r1

Issue: #994 — «Ночной мутационный гейт: убрать отчёт в Telegram»
Этап: code · Трек: show · Заход: r1 · блокирующих циклов использовано 0 из 2
Материал: `5952858755aba41ae5b612425e1a5deed3e3e4f1` (рабочая копия на этом SHA,
`git log --oneline origin/dev..HEAD`: `595285875`, `fa24b1232`)

## Скоуп

Класс B (инфраструктура CI), класса A нет — задача корректно минует анализ и
ТЗ-ревью и входит сразу в `S7-code-review` (AGENTS.md «Rule #1», класс
infra). ТЗ — тело issue #994: убрать отправку сводки отказа ночного
мутационного гейта в Telegram-чат, оставить issue единственным адресатом.

Изменённые файлы:
- `.github/workflows/_mutation-gate.yml` — шаг `Telegram`, аргумент
  `--telegram-out`, упоминания в имени job и комментариях убраны.
- `scripts/mutation-gate-report.mjs` — `telegramSummary()` и запись
  `mutation-telegram.txt` удалены как мёртвый код.
- `test/mutation-gate-report.test.mjs`, `test/mutation-gate.test.mjs` —
  старые проверки Telegram-сводки/секретов сняты, добавлены защитные тесты
  AC1/AC2.
- `docs/release-ledger/v1.81.0/994.json` — классификация `infra`.

Тонкий `mutation-gate.yml` (main) и `announce.yml` по ТЗ не трогаются — в
диффе не изменены; подтверждено чтением (`grep TELEGRAM .github/workflows/*.yml`
— секреты остались только в `announce.yml`, где они и нужны).

## Как проверялось

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (в `_mutation-gate.yml` нет `api.telegram.org`/`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`; job `report` по-прежнему заводит/дописывает issue) | `test/mutation-gate.test.mjs` — `#994: отказ ночного гейта не пишет в Telegram — адресат только issue` (105/105 зелёных в прогоне с соседними workflow-тестами) | Обычный отрицательный случай, исполнен: та же регулярка против текста workflow **до** патча (`git show fa24b1232^:.github/workflows/_mutation-gate.yml`) даёт `true` — тест был бы красным на старом коде, это проверено исполнением node-скрипта, не чтением на веру |
| AC2 (отчётчик не экспортирует `telegramSummary`, не пишет `mutation-telegram.txt`; тело отчёта issue не изменилось) | `test/mutation-gate-report.test.mjs` — `#994: отчётчик не готовит сводку для Telegram` + не тронутые тесты `#604`/`#795`, проверяющие тело отчёта (103/103 зелёных) | Обычный отрицательный случай: старый `scripts/mutation-gate-report.mjs` (до `fa24b1232`) содержит `export function telegramSummary` — проверено чтением исторического блоба (`git show fa24b1232^:scripts/mutation-gate-report.mjs | grep`), то есть утверждение `'telegramSummary' in module === false` было бы ложным на прежнем коде |

Оба AC — по сути регрессионный гард (фиксируют отсутствие удалённого кода и
канала), не валидация пользовательского ввода и не геометрический инвариант,
но тест-таблица «чем краснеет» заполнена для обоих на всякий случай и
подтверждена исполнением, а не только чтением диффа.

Выполненные прогоны (песочница, Node 22.23.3, установка не требовалась):
- `node --test test/mutation-gate-report.test.mjs test/mutation-gate.test.mjs` → **103/103**, совпадает с цифрой автора.
- `node --test test/classify-changes.test.mjs test/default-branch-workflows.test.mjs test/mutation-shards-899.test.mjs test/validate-workflow.test.mjs test/workflow-pipefail.test.mjs` → **105/105**, совпадает с цифрой автора; в этих файлах нет жёстких привязок к старому имени job/Telegram-тексту, переименование `report.name` их не задевает.
- `node scripts/mutation-gate.mjs --check` → exit 0, `static-readiness: execution=0 caught=unknown (nightly only)` — статический `--check`, не исполнение, как и требует политика («Отрицательные проверки и мутанты»); caught этим не доказывается и не заявляется.
- `python3 -c "yaml.safe_load(...)"` над `_mutation-gate.yml` → парсится, `report.name == "Отказ расписания: issue"`, список jobs не сократился.
- `node -e` с `validateEntry` из `scripts/release-ledger.mjs` над `docs/release-ledger/v1.81.0/994.json` (issue 994, baseStable v1.81.0) → проходит без исключения.
- `grep -rn "telegramSummary|mutation-telegram|telegram-out"` по репозиторию → единственное совпадение — сам негативный тест (`'telegramSummary' in module`); мёртвых ссылок на удалённый код не осталось.
- Трейлеры обоих коммитов: `Issue: #994`, `User-Visible: no` на каждом — корректно, видимое для пользователя продукта поведение (карточка, HACS) не меняется; changelog не трогается, что и требуется при `no`.

### Чего не проверял и почему

- `npx tsc --noEmit`, полный `npm test`, `npm run build` + сверка трёх копий
  бандла — не перегонял: Validate на этом SHA (`595285875`) зелёный,
  https://github.com/Matysh/houseplan-card/actions/runs/39564823357 — дешёвые
  гейты уже подтверждены (#343), дифф не трогает `src/**`/TS/бандл.
  Запущенные выше точечные прогоны (103+105 юнитов) покрывают изменённые
  файлы без повторного полного набора.
- Golden/смоки/`pytest tests_backend`/инварианты геометрии/performance — не
  применимо: диффа в `src/**`, Python или геометрии нет, AC их не называет;
  `smoke-select.mjs` не запускал — изменение ограничено CI-инфраструктурой
  вне поверхностей, которые смоки покрывают.
- Полное ночное исполнение mutation-реестра — не прогонял и не могу:
  регистрация/исполнение мутантов вне ночного workflow запрещено ревьюеру
  тем же пунктом политики, что и автору; «чем краснеет» выше доказано
  обычными отрицательными случаями против исторического кода, а не
  исполнением зарегистрированного мутанта.
- Ручной дёрг job `report` в реальном GitHub Actions (сеть/секреты/`gh`
  недоступны в песочнице) — не выполнялся; корректность подтверждена
  статическим разбором YAML и текстовыми гардами выше.

## Находки

Нет. High: 0, Medium: 0. Дифф делает ровно заявленное: убирает шаг
`Telegram`, аргумент `--telegram-out`, экспорт `telegramSummary` и запись
файла сводки, переименовывает job, оставляет issue единственным адресатом
отказа; `mutation-gate.yml` (main) и `announce.yml` не тронуты, как и
требует ТЗ. Классификация релиз-леджера (`infra`) обоснована и проходит
`validateEntry`; обоснование верно описывает, что это решение владельца по
адресату уведомления, а не пользовательская функциональность — в
пользовательский milestone не входит.

Побочных находок нет (доверенный снимок политики:
`mode=issues` — релевантен только при находках Medium вне скоупа; таких не
обнаружено, новых issue не заводилось).

## Маршрут (§5, #726)

`route: fix`. Критерии §5 для трека `show` пройдены:
- complexity — изменение CI-шага и мёртвого кода, сложность/риск низкие;
- surfaces — одна поверхность (job `report` workflow + его отчётчик);
- migration — нет миграции конфига, новых полей совместимости нет;
- ux-contract — нет: продукт (карточка, HA-интеграция) не меняется, Telegram-
  адресат — внутренний канал оповещения CI, не UX карточки;
- perf-touch — не затронуты;
- undocumented — ожидаемое поведение зафиксировано в самом теле issue
  (явное решение владельца 2026-10-21, однозначные AC1/AC2).

## Что проверено и корректно

- Удаление Telegram-шага и мёртвого кода выполнено полностью и симметрично
  (workflow + скрипт + тесты), без зависших ссылок.
- `announce.yml` и тонкий `mutation-gate.yml` (main) не задеты, секреты
  `TELEGRAM_*` остаются только там, где нужны.
- Permissions job `report` не требовали правки (Telegram использовал только
  секреты, не GitHub `permissions:`) — ничего лишнего не удалено и не забыто.
- Трейлеры и release-ledger корректны, `User-Visible: no` соответствует
  отсутствию изменений в changelog.

## Вердикт

Зелёный. Все AC доказаны исполненными тестами с подтверждённой способностью
падать на историческом коде; побочных находок и расхождений с ТЗ нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/994-mutation-no-telegram`, коммит `5952858755ab` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `49113a067c23b2aa0f2e297c85d997acfb8261a9`
  ```
  git log --all --format='%H %T' | grep 49113a067c23
  ```
- Тело issue: `d4db5481c2b93dc929308f043c1292b6fe141dbe9590c96647af74153dd5ca15`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDAsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTl9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjU2LCJvdXRwdXRfdG9rZW5zIjoxNjM4OSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo2NDk4NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE4NTU5ODYsImNvc3RVc2RFc3RpbWF0ZSI6MC43OTUxMzUyMDAwMDAwMDAzfV0sInR1cm5zIjozOCwiZHVyYXRpb25NcyI6NDMwNjkyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC44MDAzMjUyMDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5156 output_tokens=16407 cache_creation_input_tokens=64984 cache_read_input_tokens=1855986 num_turns=38 -->
