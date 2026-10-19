# CODE-REVIEW-969-r1

Issue: #969 · этап code · заход r1 · блокирующих циклов использовано 0 из 2 · трек show
Материал: `08768c40bb3867ecc5d2c9ddd09df770efa38ba5` (рабочая копия на нём, `git rev-parse HEAD` сверен)
База: `origin/dev` = `cab6ce5e21629b43f8a7fe02f88170620f2fd34c`
Диапазон: `git log --oneline origin/dev..HEAD` — один коммит;
`git diff origin/dev...HEAD --stat`:

```
docs/DEVELOPMENT.md                  | 13 +++++++
docs/STATUS.md                       |  8 +++-
docs/release-ledger/v1.81.0/969.json |  7 ++++
test/dev-build.test.mjs              | 71 ++++++++++++++++++++++++++++--------
4 files changed, 82 insertions(+), 17 deletions(-)
```

## Скоуп

Задача — инфраструктурный ремонт: `test/dev-build.test.mjs:227` упал в CI (Validate
#968, attempt 1, SHA `ce30aa4c1`) с `ENOTEMPTY` при очистке временного bare-репозитория
(`rimrafSync`), единственный ограниченный повтор на том же SHA прошёл. Задача по
ТЗ в теле issue ограничена только `test/dev-build.test.mjs` и сопровождающей
документацией/release-ledger; `scripts/dev-build.mjs`, `ha-track-dev.sh`, stand
updater и продукт — вне скоупа.

Класс изменения — B (тест) + C (документация), без класса A. Трейлеры коммита:
`Issue: #969`, `User-Visible: no` — соответствует отсутствию изменений поведения
продукта; changelog не требуется и не тронут. `docs/release-ledger/v1.81.0/969.json`
классифицирован `category: infra`, без milestone — сверено по прецеденту
(идентичная по форме задача `docs/release-ledger/v1.81.0/925.json`, тот же паттерн
"ship-review" fixtures, уже принятый владельцем); `introducedBy` для `category:
infra` не требуется (`scripts/release-ledger.mjs:35` требует его только для
`line-fix`). `node scripts/release-ledger.mjs catalogue --candidate=HEAD --issue=969`
прошёл без ошибок схемы.

Трек `show` (по умолчанию, задача меньше трёх AC порога не превышает). Критерии
§5 route:
- complexity ≤3 — да, механический перенос уже принятого паттерна (`receive.autogc`/
  `maintenance.auto`/`gc.auto` + bounded `rmSync`) из `#717`/`#925`/`merge-candidate.test.mjs`/
  `commit-amend.test.mjs`/`merge-continuation-882.test.mjs` в ещё один тестовый файл;
- surfaces — одна (один тестовый файл, один фикстурный контур);
- migration — нет config/compat полей;
- ux-contract — нет, продукт не меняется;
- perf-touch — нет;
- undocumented — паттерн уже документирован в `docs/DEVELOPMENT.md` (раздел
  "Ship-review fixtures (#925) disable automatic maintenance…", строка выше правки)
  и расширен тем же абзацем на dev-build.

Все шесть критериев пройдены → `route: fix`.

## Как проверялось

Дешёвые гейты на этом SHA подтверждены Validate (`run 39274924945`, success,
ссылка из промпта) — `npx tsc --noEmit`, `npm test`, `npm run build` +
`bundle-policy --verify` не перегонялись повторно, достаточно ссылки.

Что прогнал сам (ordinary, не мутанты):

| Гейт | Команда | Результат |
|---|---|---|
| Целевые unit | `node --test test/dev-build.test.mjs test/temp-dir-hygiene.test.mjs` | PASS 18/18, 0 fail, 0 skip — совпадает с заявленным автором (14 прежних dev-build + 2 новых + 2 hygiene) |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 коммит, 1 ожидаемый WARN §562 (инфра-диапазон без S-метки до первого S7) |
| mutation-gate static | `node scripts/mutation-gate.mjs --check --changed=origin/dev..HEAD` | PASS, static-readiness definitions=137, execution=0, caught=unknown (nightly only) — мутанты не исполнялись, совпадает с заявленным |
| inventory (число тестов) | `node scripts/inventory.mjs` | Node unit 4913 — тот же источник, что в `docs/STATUS.md`; расхождения нет, число видно один раз (snapshot) и считается тем же скриптом |
| release-ledger schema | `node scripts/release-ledger.mjs catalogue --candidate=HEAD --issue=969` | без ошибок схемы |
| git diff --check | — | чисто |

Не прогонял и почему:
- `npx tsc --noEmit` / `npm test` (полный) / `npm run build` + bundle-копии — зелёный
  Validate на этом же SHA уже подтверждён (#343), диапазон не трогает `src/**`,
  `scripts/dev-build.mjs` или бандл;
- golden/`ci:golden` — нет визуального диффа, метки `ci:golden` нет, рендер не
  затронут;
- `pytest tests_backend` — Python/backend не менялись;
- HA-harness — `scripts/ha-track-dev.sh` не менялся, AC не требует;
- `smoke-select.mjs` — исполняемого frontend-диффа нет (диапазон — только тест
  и доки), автор это же отметил;
- инварианты модели (`npm run invariants`) — геометрия и ссылки на неё не
  затронуты;
- исполнение мутантов (ночной реестр) — не требуется этой задаче и запрещено
  вне ночного workflow; статический `--check` — не caught, и не выдаётся за него.

Для защитного AC2 ("неисправимая ошибка по-прежнему бросается") исполнение
временного патча самой фикстуры (чтобы заставить её покраснеть) было бы
исполнением мутанта над материалом ревью — запрещено вне ночного workflow,
в том числе ревьюеру. Проверено **чтением, не исполнением**: до правки
`fixture()` не устанавливала `receive.autogc`/`maintenance.auto`/`gc.auto`
нигде, а `rmSync` во всех прежних `finally` не имел `maxRetries`/`retryDelay`
вовсе (подтверждено по `git diff`, см. ниже). Новый тест в строках 92–107
проверяет реальный effective `git config --local --get` всех трёх репозиториев
(`origin`/`work`/`stand`) — без строки 68 (`config --local` на origin) или
строк конфигурации в `CLONE_CONFIG` эта проверка обязана была бы упасть
(конфигурация отсутствовала бы, `git config --get` возвращает ненулевой код
выхода и `execFileSync` бросает). Второй новый тест (строки 109–117) —
тривиальная демонстрация try/finally-семантики JS (sentinel `AssertionError`
+ `rmSync` в `finally`), не завязанная на реальную гонку Git; вместе с первым
тестом она подтверждает оба требования AC2 буквально, но сама по себе не
гонка — отмечаю как Low ниже.

## Находки

### Low — демонстрационный, не нагрузочный тест на "assertion survives cleanup"

`test/dev-build.test.mjs:109-117` проверяет, что `try/finally` в JavaScript
действительно выполняет `finally` при исключении и что `rmSync` в нём отрабатывает —
это гарантировано семантикой языка и не специфично для Git-гонки, которую
чинит задача. Тест не нагружает реальную гонку (нет параллельного git-процесса,
нет настоящего ассершн-фейла из проверки контракта). AC2 от этого не нарушается
буквально (его текст — "обычный assertion error сохраняется, корень после
cleanup отсутствует", что и демонстрируется), поэтому это бухгалтерская,
нечувствительная проверка, не дефект поведения и не непройденный AC — на
треке `show` это Low, цикла не открывает (`docs/process/REVIEWER.md`, «Трек show»).

Других находок нет. High: 0, Medium: 0.

## Что проверено и корректно

- Порядок применения fixture-local конфигурации логически исключает гонку с
  автообслуживанием: `origin` получает `git config --local` сразу после
  `init --bare`, до первого `clone`/`push` (`test/dev-build.test.mjs:67-69`);
  `work` и `stand` получают те же три ключа через `clone --config` **до**
  fetch/checkout (git применяет `-c`/`--config` клонируемого репозитория до
  фактического переноса объектов) — т.е. ни для одного из трёх репозиториев
  нет окна между созданием и применением изоляции.
- Используемый паттерн (`receive.autogc=false`, `maintenance.auto=false`,
  `gc.auto=0` + `rmSync` с `maxRetries:10, retryDelay:50`) — не изобретение
  этой задачи, а точное повторение уже принятого в `test/rebase-on-dev.test.mjs`
  (#717), `test/ship-review.test.mjs` (#925), `test/commit-amend.test.mjs`,
  `test/merge-candidate.test.mjs`, `test/merge-continuation-882.test.mjs`
  (сверено грепом). Дублирование константы в каждом файле — устоявшаяся
  практика этого репозитория, не повод заводить находку.
- Прежние 14 assertions `dev-build` (parseArgs, одна ветка без истории,
  устаревший `dev`, стенд, backend-интеграция, метка BUILD.json/`+dev.<sha8>`,
  два источника/один integrationTree, битый манифест, `changed`-флаг, отсутствие
  интеграции, три сценария `ha-track-dev.sh`) не изменены по существу — только
  замена инлайн-литерала `rmSync`-опций на именованную константу
  `REMOVE_FIXTURE_TREE` с теми же значениями (`git diff` построчно сверен).
- `docs/STATUS.md`: счётчик "Node unit 4910 → 4913" — один источник
  (`node scripts/inventory.mjs`, тот же скрипт регенерирует snapshot), сам
  пересчитан и совпал; расхождения между диффом и реальным деревом нет.
- `docs/DEVELOPMENT.md` и `docs/STATUS.md` получили абзацы, описывающие именно
  то, что делает код (конфигурация до push/fetch, bounded retries без
  suppressing catch, не заявляется диагноз исторической гонки) — соответствует
  документу и коду.
- Issue/User-Visible трейлеры на месте, `User-Visible: no` корректен —
  поведение продукта не меняется, changelog не нужен.
- Никакого продуктового кода, `scripts/dev-build.mjs`, `ha-track-dev.sh`,
  stand updater, workflows, browser pins, лимитов циклов не затронуто
  (`git diff --exit-code` по этим путям = 0, автором и мной).

## Чего не проверял

Та же причина, что в разделе "Как проверялось → не прогонял": полный
`tsc`/`npm test`/`npm run build` (покрыто Validate на этом SHA), golden,
pytest backend, HA-harness исполнение, инварианты геометрии, browser smokes,
ночное исполнение мутантов. Ни один из них не требуется диапазоном диффа
(только тест-фикстура + доки) или AC этой задачи.

## Маршрут побочных находок

Доверенный снимок: `mode=issues`. Побочных находок вне скоупа этой задачи нет —
новые issue не заводились.

## Вердикт

Зелёный. High: 0, Medium: 0 (одна находка Low не открывает цикл на треке show).
Route: `fix` (все шесть критериев §5 пройдены, `reclassify` не требуется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/969-dev-build-cleanup`, коммит `08768c40bb38` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0f0fb5468ddbcfff9a66fea437424e80edee874f`
  ```
  git log --all --format='%H %T' | grep 0f0fb5468ddb
  ```
- Тело issue: `a6416aa4e8ab9746f951d6c7348987c6ef9d198139316a4f45641a19d2c408d8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDIsIm91dHB1dF90b2tlbnMiOjEzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTY3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0OCwib3V0cHV0X3Rva2VucyI6MTc3MDgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzY1MDYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNzc1NjAzLCJjb3N0VXNkRXN0aW1hdGUiOjAuODM4MzIwNTk5OTk5OTk5OX1dLCJ0dXJucyI6MzEsImR1cmF0aW9uTXMiOjI0NjMyNSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODQzNDg3NTk5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5150 output_tokens=17721 cache_creation_input_tokens=76506 cache_read_input_tokens=1775603 num_turns=31 -->
