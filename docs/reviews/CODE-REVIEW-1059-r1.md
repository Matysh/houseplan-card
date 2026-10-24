# CODE-REVIEW-1059-r1

Issue: #1059 · этап: code · заход: r1 · трек: show · блокирующих циклов использовано: 0/2
Материал: `14e91df9c65b0771999ae73912de9452a8aa868c` (рабочая копия на нём; `origin/dev` = `40508a478ee7ab9a56c909fd05fdfe9fbf163aa2`, слияние чистое)
Побочные находки — mode: `issues` (REVIEW_FINDINGS_POLICY сверен, расхождений нет)

## Скоуп

Чисто инфраструктурная правка (класс B+C, без единого файла класса A): переклассифицирует
терминальный `failed` в `evaluateCiProof` (`scripts/ci-proof.mjs`) для «лишнего» product-proof —
такого, у которого реальный coverage-план кандидата просит только companion-профили
(`tooling`/`docs`), не `product`. Раньше это было fail-closed с невозможностью штатного
canonical-отката; задача делает его `stale` (ровно тот статус, на который `validate-gate.mjs`
уже реагирует повторным dispatch канонического `validate.yml`), сохраняя fail-closed для всех
подлинных дефектов (malformed/empty/duplicate план, чужая identity, красный/неполный собственный
прогон). `validate-gate.mjs` не менялся — его общий путь «cancelled/light/stale/legacy run →
не доказательство, продолжить» уже существовал и обслуживает новый `stale` без правок.

Первая строка SCOPE.md не применима буквально (задача не о продукте, а о гейте ревью
конвейера) — AGENTS.md прямо резервирует для таких задач отдельный путь входа
(«changing the pipeline, the gates or the process itself: SCOPE → AGENTS → PROCESS → STATUS»,
что и сделал автор по хендоффу). Работа закрывает техдолг пайплайна, описанный в #1058/#1059, и
не затрагивает ни один Core user job напрямую — это ожидаемо для инфраструктурного issue.

## Маршрут show (§5, route)

- **complexity** — одна функция (`evaluateCiProof`), точечное условие, 16 изменённых строк в
  продукте правки; риск локализован и полностью покрыт тестами. ≤3.
- **surfaces** — одна поверхность: состояние автоматического CI-гейта (consumer `ci-proof.mjs` +
  уже существующий fallback-путь `validate-gate.mjs`, без нового кода там).
- **migration** — схема proof (`houseplan-ci-proof/v1`) не меняется, новых совместимых полей нет.
- **ux-contract** — нет пользовательского интерфейса вообще; это внутренний CI-гейт.
- **perf-touch** — не затронуто.
- **undocumented** — поведение уже задокументировано как принцип в `docs/DEVELOPMENT.md`
  (до правки): «missing/pending companions request canonical validation, red companions fail» —
  задача расширяет тот же документированный fallback на ранее необработанный частный случай
  (корректный companion-only план), а не изобретает новый контракт. То же самое прямо
  утверждает тело issue («Канон уже требует canonical fallback при непригодном профиле —
  PROCESS §8, §10.4; поведение продукта не меняется») — сверено, подтверждаю.

Все шесть критериев пройдены → **route: fix**, трек show не повышается.

## Как проверялось

Принятый proof (review-light, https://github.com/Matysh/houseplan-card/actions/runs/40092994227,
«review-light proof is complete») покрывает материал `14e91df9c65b0771999ae73912de9452a8aa868c`
целиком: это тот же коммит, на котором стоит рабочая копия. Изменённые пути —
`scripts/ci-proof.mjs`, `test/ci-profiles.test.mjs`, `test/validate-gate.test.mjs`,
`scripts/ci-registry-inventory.json` — все классифицируются как `tooling`
(проверено `profilesForFiles` на тех же путях, см. ниже); `docs/*.md` и ledger-json — `docs`.
Авторский хендофф в issue дополнительно называет: обычный `HP_PREPUSH_GATE=1 git push` на точном
`14e91df9c` (gate:small 249s/0 fail, product units 31s, tooling 171s, build/typecheck 23s,
bundle/guards зелёные), прицельный `node --test ci-profiles/ci-proof/validate-gate` 68/68 на
`03caca92d`, и — что важнее всего для «оно вообще работает» — replay подлинного исторического
proof-артефакта (`run40089854765`/`attempt1`, SHA `a75de78179…`, артефакт
`ci-proof-40089854765-1`, независимо полученный через gh API) новым ридером: реальный
`profile=product/requiredProfiles=[tooling,docs]` даёт `stale/canonical required`, а не `failed`
и не `green`. Это тот самый ввод, из-за которого был открыт #1059 — не синтетика.

Адресно перепроверено мной (принятый proof не повторяется, только непокрытые или критичные для
вердикта пункты):

| Проверка | Команда | Результат |
|---|---|---|
| Классификация изменённых путей действительно `tooling`/`docs`, не `product` (самопроверка сценария issue) | `profilesForFiles` по каждому изменённому файлу | `scripts/ci-proof.mjs`, оба `test/*.mjs`, `ci-registry-inventory.json` → `tooling`; `docs/*`, ledger json → `docs` — ни одного `product` |
| Полный прогон обоих изменённых/рискованных тестовых файлов на точном материале | `node --test test/ci-profiles.test.mjs test/validate-gate.test.mjs` | 44/44 PASS, 0 fail, 0 skip (включает оба новых `test()` в ci-profiles.test.mjs и 7 под-тестов нового `test()` в validate-gate.test.mjs — все `ok`) |
| Derived-файл `ci-registry-inventory.json` не дрейфует от правки ledger | `node scripts/ci-registry-inventory.mjs --check` | PASS, без диффа |
| `ci-profiles.mjs` generated outputs не дрейфуют | `node scripts/ci-profiles.mjs --check` | PASS |
| Число `Node unit 5262` в `docs/STATUS.md` — единственный источник, совпадает с фактом | `node scripts/inventory.mjs` | `Node unit (frontend + tooling) 5262` — совпадает буквально |
| Синтаксис правленого файла | `node --check scripts/ci-proof.mjs` | OK |
| Схема нового ledger-файла | ручное чтение `docs/release-ledger/v1.82.0/1059.json` против `scripts/release-ledger.mjs` (`CATEGORIES`, обязательные поля) | валиден; `category: 'infra'`, `introducedBy` не требуется |
| Логическая гарантия «canonicalRequired⇒не green» | чтение всей функции `evaluateCiProof` (383–554): единственный `return result('green', …)` — последняя строка, которой предшествует безусловный `if (canonicalRequired) return result('stale', …)` | подтверждено чтением, не исполнением: при `canonicalRequired === true` путь к `green` структурно недостижим |

Не прогонялось повторно (уже покрыто принятым proof, не требует нового доказательства —
материал/входы не менялись): `gate:small` целиком, build/typecheck, bundle guards, product-юниты,
полный `npm test`, смоки (frontend-дифф в этой задаче отсутствует — `smoke-select` в хендоффе
сам называет «браузерные смоки не выбраны», с чем я согласен: ни один изменённый файл не входит
в product/browser-профиль). Golden/performance/pytest/invariants — не применимо: нет изменений
геометрии, Python или визуального рендера. Мутанты не исполнялись и не требовались (трек show,
ночной бюджет единый на задачу, вне ночного workflow запрещено).

## Находки

Нет.

Защитный AC (единственный содержательный AC задачи — отказ принимать лишний product proof
как PASS) доказан по правилам §2.7, таблица «AC · чем доказан · чем краснеет»:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — корректный непустой companion-only план не даёт `green`, терминальные дефекты остаются fail-closed | `test('#1059 a complete surplus product proof with a companion-only plan requires canonical validation, never acceptance')` (3 варианта плана → `stale`); replay подлинного `run40089854765` → `stale`; структурное чтение функции (единственный `green` недостижим при `canonicalRequired`) | обычный отрицательный случай в том же файле: `test('#1059 malformed plans, foreign material and incomplete/red surplus execution remain fail closed')` — malformed/empty/null/non-array/duplicate/sparse/unknown-профиль план → `failed`; красный `run.conclusion`, отсутствующая job, несогласованный `requiredChecks`, проваленный check, чужие `sha/attempt/event/workflow` → `failed`/не `green`. Запущено мной на точном материале — все 2 новых теста PASS |
| AC2 — существующий canonical fallback запрашивается на точном ref/SHA с `full=false/mutants=false` и принимает только завершённый пригодный canonical proof | `test('#1059 surplus product proof dispatches the exact light canonical request and accepts only its completed proof')` — реальный `validateGate` + `evaluateCiProof` со scripted GitHub-транспортом, 7 состояний canonical-прогона (green/failed/pending/missing/missing-proof/incomplete/foreign) | та же таблица состояний: `assert.deepEqual(requests, [{branch, mutants:false, full:false}])` — ровно один диспатч; `failed`/`incomplete` → `result:'failed'`; `pending` → `pending`; `missing`/`missing-proof`/`foreign` → `missing`. Запущено мной — 7/7 под-тестов PASS |
| AC3 — только B+C, ledger относительно v1.82.0, без расширения schema/permissions/budget, продуктовый код не изменён | `git diff --stat` (0 файлов класса A), `docs/release-ledger/v1.82.0/1059.json` (`category: infra`), оба коммита несут `Issue: #1059`/`User-Visible: no` | не отдельный «красный» сценарий (учётный AC) — проверено чтением диффа и ledger-файла, не исполнением |

Пустых третьих столбцов нет.

## Что проверено и корректно

- Диапазон коммитов (`03caca92d` + merge `14e91df9c`) merge-base равен текущему `origin/dev`
  (`40508a478`) — ветка сливается с `dev` чисто, материал ревью зафиксирован правильно.
- Оба коммита несут `Issue: #1059` и `User-Visible: no`; изменений, видимых пользователю, нет —
  `User-Visible: no` корректен, оба changelog трогать не требовалось.
- `docs/release-ledger/v1.82.0/1059.json` структурно валиден и зарегистрирован в
  `scripts/ci-registry-inventory.json` в той же правке (без отдельного derived-дрейфа).
- Единственное видимое в диффе число — счётчик тестов в `docs/STATUS.md`
  (5259→5262) — имеет один источник (`npm run inventory`) и совпадает с фактическим подсчётом.
- Старые тесты `#980`/`#1044` на нормальный путь (`requiredProfiles` включает `product`,
  положительный canonical-прогон, пропавший/красный companion) не изменены и продолжают
  проходить на новом коде — regression risk в обычном сценарии отсутствует.
- Merge-коммит `14e91df9c` подтягивает только уже принятую #1058 (ci-registry-inventory —
  единственный конфликт, решён канонической регенерацией); сам консьюмер и оба тестовых файла
  этой задачи побайтово совпадают с исходным `03caca92d` (сверено по `git show --stat` обоих
  коммитов отдельно — второй коммит не касается `scripts/ci-proof.mjs`/тестов).

## Чего не проверял

- Не повторял `gate:small`, полный `npm test`, build/typecheck, bundle guards — приняты из
  хендоффа и принятого review-light proof на точном материале; входы/окружение/oracle не
  менялись с момента прогона.
- Не запускал мутанты и не трогал исполняемую реализацию/её сборку — вне ночного workflow это
  запрещено общей политикой; для predicate-функции с открытым исходником достаточно обычных
  negative-input тестов (которые уже пригодны и исполнены).
- Не проверял golden/performance/pytest/invariants/браузерные смоки — AC их не называет, дифф не
  касается geometry/Python/рендера, `smoke-select` не выбрал ни одной сцены (frontend-дифф
  отсутствует).
- Не проверял реальный живой GitHub Actions dispatch (только scripted-транспортный unit) — задача
  описывает исправление чистой predicate-функции и не меняет сам `validate-gate.mjs`/workflow
  YAML, так что живой прогон не добавляет нового доказательства сверх уже принятого
  review-light run и исторического replay подлинного артефакта.

## Маршрут побочных находок

`REVIEW_FINDINGS_POLICY`: `mode=issues` — новых issue не заводил, побочных находок нет.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1059-product-proof-canonical-fallback`, коммит `14e91df9c65b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bb5247e417e697cba4c61e02e2ad2d3ef038527c`
  ```
  git log --all --format='%H %T' | grep bb5247e417e6
  ```
- Тело issue: `387abab41f0d92eb64a355e6027f45bf2f4b26f4ad10e9d35b88f2122cb19b8e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTAsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTh9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjc2LCJvdXRwdXRfdG9rZW5zIjoyODM3MywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMDc3MzUsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozNDg0NTYyLCJjb3N0VXNkRXN0aW1hdGUiOjEuNDExNzM0Mzk5OTk5OTk5OH1dLCJ0dXJucyI6NDMsImR1cmF0aW9uTXMiOjM4MTEwOCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNDE2OTE0NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5166 output_tokens=28391 cache_creation_input_tokens=107735 cache_read_input_tokens=3484562 num_turns=43 -->
