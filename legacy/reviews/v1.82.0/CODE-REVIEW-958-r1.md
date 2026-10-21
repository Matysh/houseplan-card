# CODE-REVIEW — issue #958, заход r1

Материал: `da637da8acb29551ac2ce99f4e1f2b041158036a` (рабочая копия на нём же).
Диапазон: `origin/dev..HEAD` = 1 коммит `fix(release): retain own second-parent beta
membership evidence` (Issue: #958, User-Visible: no).
Этап: code · Трек: show · Заход r1 · блокирующих циклов использовано 0 из 2.

## Скоуп

Инфраструктурная задача B/C, без изменения продукта: `readCandidateHistory` в
`scripts/release-membership.mjs` обходил диапазон `previous-release..candidate`
только по first-parent, из-за чего собственная доставка #931, достижимая через
второго родителя merge (принятие темы #947), не засчитывалась в
RELEASE-MEMBERSHIP — тот же класс потери истории, что #916 уже закрыл для
каталога, но не для prerelease membership.

Изменённые файлы (9): `scripts/release-membership.mjs`,
`test/task-delivery-903.test.mjs`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/analysis/958-beta-membership-evidence.md`,
`docs/analysis/958-ordinary-original-red.txt`,
`docs/analysis/958-real-931-green.json`, `docs/release-ledger/v1.81.0/958.json`.
Ничего из запрещённого в «Объёме» issue (продукт, UI, зависимости, схемы HA,
golden, бюджеты, pipeline permissions, параметры публикации, policy допуска) не
тронуто — подтверждено по `git diff --stat` и чтением полного диффа.

## Как проверялось

- Полное чтение изменённого диапазона `scripts/release-membership.mjs`
  (целиком — единственная содержательная правка: `git log --first-parent` →
  `git log --topo-order` в `readCandidateHistory`, граница диапазона и выбор
  предыдущего тега (`describe --first-parent`) не тронуты).
- Полное чтение диффа `test/task-delivery-903.test.mjs`: расширен существующий
  real-git сценарий `#916/#958 second-parent delivery retains its own
  catalogue and beta membership evidence` — добавлена сторонняя ветка `side`
  с собственной реализацией issue #2, отдельный beta-тег на этой ветке,
  слияние через `--no-ff` с чужим issue-трейлером, непримёрженная ветка
  `not-merged` с issue #999, явная проверка, что merge/promotion-трейлеры не
  подменяют доказательство, и повторная immutable-проверка после движения HEAD.
- Чтение docs/analysis/958-*: текст red-свидетельства, доказательства на
  реальном принятом `dev510bab19` и итогового markdown-отчёта — сверено, что
  заявленное в них совпадает с тем, что я воспроизвёл сам (ниже).
- Чтение правок `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`
  и `docs/release-ledger/v1.81.0/958.json` целиком — формулировки совпадают с
  фактическим поведением кода, без лишних утверждений.
- `grep` по использованиям `readCandidateHistory`/`release-membership` в
  репозитории — других точек вызова, зависящих от прежнего first-parent
  порядка, не найдено; остальные потребители (`release-review.mjs`,
  `release-ledger.mjs`, CI workflow) используют только публичный контракт
  (issue → commits), не порядок/топологию.

### Самостоятельно прогнанные гейты (диффовые смоки)

Validate на этом SHA уже зелёный (ссылка в материале задачи), поэтому
`npx tsc --noEmit`/`npm run build` не перегонял — диапазон не трогает
`src/**/*.ts` (единственный include в `tsconfig.json`), пересборка бандла
бессмысленна. Прогнал сам, т.к. это ровно затронутые диффом тесты:

```
node --test test/task-delivery-903.test.mjs test/release-membership.test.mjs test/release-ledger.test.mjs
# 32 pass, 0 fail — совпадает с цифрой в docs/analysis/958-beta-membership-evidence.md
```

Раздельно: `test/release-membership.test.mjs` — 3 pass; `test/release-ledger.test.mjs`
— 6 pass; `test/task-delivery-903.test.mjs` — 23 pass. Всё зелёное.

## Находки

Нет. High: 0, Medium: 0. Побочных находок вне скоупа тоже нет — других путей
не трогали, ничего не заводится (режим `mode=issues`, но заводить нечего).

## Что проверено и корректно

- **AC1 (собственная доставка второго родителя учитывается под своим issue/SHA,
  а не под чужим merge-трейлером).** Правка — замена `--first-parent` на
  `--topo-order` в `git log` диапазона `base..candidate`; `--first-parent` в
  `describe` для выбора предыдущего релизного тега не тронут, как и требует
  «Объём» issue. Без `--first-parent` `git log A..B` обходит все предки через
  любого родителя (стандартная семантика git range), что и возвращает
  доставки со стороны второго родителя merge; `--topo-order` влияет только на
  порядок вывода, не на состав, и не используется потребителями для чего-то
  кроме агрегации по issue (`Set`/`Map`), так что смена порядка не
  регрессирует другую логику.
- **Красный свидетель на неизменённом ридере.** `docs/analysis/958-ordinary-original-red.txt`
  — результат прогона именно нового расширенного теста (TAP, `own second-parent
  delivery is reachable: false !== true`) на коде до правки. Это обычный
  negative-input прогон на исходной реализации (политика разрешает), не
  мутация: патч применён к тесту/фикстуре, а не к `release-membership.mjs`.
  После однострочной правки тот же тест зелёный — я воспроизвёл это сам
  (раздел выше), не полагаясь только на приложенный лог.
- **Реальное свидетельство на принятом материале.** `docs/analysis/958-real-931-green.json`
  — создание и verify RELEASE-MEMBERSHIP на настоящем `dev510bab19d90aa45b5b254cc12df16beafd71b77b`
  находит все 11 собственных SHA доставки #931 и не приписывает ей merge #947.
  Формат ровно соответствует `MEMBERSHIP_SCHEMA`/`validateReleaseMembership`.
- **AC2 (окно истории и подмена evidence).** Непримёрженная ветка (`not-merged`,
  issue #999) и история до previous-release тега по-прежнему исключены —
  проверено расширенным тестом и структурой самого алгоритма (range
  `base.sha..candidate` отсекает недостижимое независимо от флага обхода
  родителей). SPEC-only и `Release:`-промоушен коммиты по-прежнему
  исключаются той же веткой `taskDelivery(commit) === 'spec-review' ||
  /^Release:\s*/m.test(...)` — не тронута. Подмена SHA (`forged` sha,
  несоответствие `historicalTrace`) по-прежнему отказывает в
  `verifyReleaseMembershipAgainstGit` — код этой проверки не менялся, и тест
  это упражняет (`throws(... /does not prove issue/)`).
  Все 32 сфокусированных теста (`task-delivery-903`, `release-membership`,
  `release-ledger`) зелёные без мутаций — проверил сам, см. выше.
- **Документация.** `ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md` описывают
  ровно то, что делает код: «all reachable parents» для диапазона membership,
  «previous release tag is still selected on the first-parent line»,
  SPEC/promotion-исключения не изменились. Формулировки не расходятся с кодом
  и не утверждают лишнего (например, не говорят, что #957 — несвязанная
  проблема недостижимых деревьев spec-материала — решена этой задачей; issue
  это явно и не требовал).
- **Release-ledger запись.** `docs/release-ledger/v1.81.0/958.json`: категория
  `infra`, `baseStable: v1.81.0` совпадает с текущим `cycle.json`
  (`baseStable: v1.81.0`, `targetStable: v1.82.0`), обоснование — правка учёта
  релиза, без изменения поведения продукта. Инфраструктурная/внутрибетная
  правка корректно не относится к пользовательскому milestone.
- **Трейлеры.** `Issue: #958`, `User-Visible: no` — соответствует: наблюдаемое
  поведение продукта не меняется (сам код приложения не тронут), поэтому
  правка CHANGELOG не требуется и не сделана — корректно.
- **Отсутствие расширения объёма.** Diff не содержит изменений UI, зависимостей,
  схем HA, golden, бюджетов, pipeline permissions, параметров публикации —
  проверено по списку изменённых файлов и чтением диффа целиком.

## Чего не проверял и почему

- `npx tsc --noEmit` и `npm run build` со сверкой бандла — не перегонял.
  Validate на этом же SHA зелёный (ссылка в задаче), а диапазон не касается
  `src/**/*.ts` (единственный `include` в `tsconfig.json`) и не меняет сборку
  фронтенда — пересборка не несёт новой информации.
  Поэтому прогнал только три сфокусированных тестовых файла, напрямую
  упражняющих изменённую функцию (см. выше), это и есть diff-driven смоук для
  этой задачи.
- Полный `npm test` целиком — не перегонял отдельно: Validate на этом SHA его
  уже прогнал зелёным; диапазон не трогает ничего за пределами
  `scripts/release-membership.mjs`, у которого нет других потребителей,
  чувствительных к порядку истории (проверено `grep`).
- Ручное исполнение CLI-команд `release-membership.mjs create|verify|list` на
  текущем репозитории — не делал: это исполнение мутанта/эксперимента над
  предметом ревью вне ночного workflow, запрещено политикой; доказательство
  уже дано воспроизводимым `node --test` и реальным JSON-свидетельством на
  зафиксированном коммите `dev510bab19…`, которое я прочитал и сверил со
  схемой, а не исполнил заново.
- gate:small (полный pre-push гейт) — не перегонял; автор привёл его
  собственный зелёный прогон (144с/0fail) в комментарии issue, а полный набор
  — предрелизный гейт, не гейт код-ревью (PROCESS.md §8); достаточно
  диффовых тестов, которые я воспроизвёл сам.
- Смоки UI/браузер — не применимо: задача не трогает UI/фронтенд, Chromium не
  требовался (issue не называет смоук).

## Маршрут §726

Критерии: complexity ≤3 (правка в одну строку обхода git log + расширение
существующего теста — сложность и риск низкие), surfaces — одна поверхность
(release accounting script), migration — нет миграции конфига/новых
compatibility-полей, ux-contract — нет нового UX-контракта (продукт не
меняется), perf-touch — нет влияния на производительность/touch, undocumented
— ожидаемое поведение зафиксировано в ARCHITECTURE/DEVELOPMENT/STATUS этим же
коммитом. Все критерии §5 проходят → `route: fix`.

## Вердикт

Зелёный. High: 0, Medium: 0. Находок, возвращаемых автору, нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/958-beta-membership`, коммит `da637da8acb2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d442490ba9decf503d3bca3e65384975f382dbc3`
  ```
  git log --all --format='%H %T' | grep d442490ba9de
  ```
- Тело issue: `634362796d40887a1fca2b4f74d762ccb6572609e98945a9adee9dd2afea9b8b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDEsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjE1OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0MCwib3V0cHV0X3Rva2VucyI6MTM3NDYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NTU5MjEsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMTM2NTIxLCJjb3N0VXNkRXN0aW1hdGUiOjAuNTg4NTI4MjAwMDAwMDAwMX1dLCJ0dXJucyI6MjgsImR1cmF0aW9uTXMiOjE3NDg2NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNTkzNzQ0MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5141 output_tokens=13769 cache_creation_input_tokens=55921 cache_read_input_tokens=1136521 num_turns=28 -->
