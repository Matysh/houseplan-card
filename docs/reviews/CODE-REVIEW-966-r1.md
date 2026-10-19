# CODE-REVIEW-966-r1

**Issue:** #966 «Allow the full browser smoke matrix to finish within its outer job window»
**Материал:** `08524c194e4e946043f751bf6cdba8fac1bbb5f0` (origin/dev..HEAD = 2 коммита:
224dad857, 08524c194)
**Этап/трек/заход:** code · track:show · r1 · блокирующих циклов 0/2

## Скоуп

Инфраструктурная задача B/C: поднять внешний wall-clock cap job `smoke`
(`.github/workflows/validate.yml`) с 20 до 25 минут, потому что в полном
Validate #963 shard 1 успел пройти 132/396 сценариев за ~14 мин, а shards 2/3
были остановлены внешним `timeout-minutes: 20` до конца детерминированного
списка. AC1–AC3 из тела issue требуют: (1) diff ограничен внешним таймаутом,
policy-assert и infra-классификацией; (2) workflow tests/`gate:small`/
`process-gate` PASS, конечность job и 180s per-smoke сохраняются; (3) материал
опубликован, прошёл независимый код-ревью и дальше автоматический S8.

Диапазон затрагивает ровно три файла (`git diff origin/dev...HEAD --stat`):

- `.github/workflows/validate.yml` — `timeout-minutes: 20` → `25` + поясняющий
  комментарий, job `smoke`;
- `test/smoke-exception-guard.test.mjs` — литерал policy-guard теста #434
  (`timeout-minutes: 20` → `25` в regex);
- `docs/release-ledger/v1.81.0/966.json` — новая запись, `category: infra`.

Класса A файлов нет, видимое пользователем поведение не меняется
(`User-Visible: no` на обоих коммитах), миграций конфига и нового UX-контракта
нет.

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| Validate на материале (`08524c194`) | PASS (ссылка автора, run 39255130638) | дешёвые гейты (`tsc`, `npm test`, `npm run build`+bundle-policy) подтверждены этим прогоном, не перегонял |
| `node --test test/smoke-exception-guard.test.mjs test/validate-gate.test.mjs test/validate-workflow.test.mjs` | PASS, 51/51 | прогнал сам, совпадает с заявленным автором числом |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | PASS, 1 ожидаемый WARN | WARN п.8 — "инфраструктурный диапазон (#562): файлов класса A нет, статусная метка не требуется до S7-code-review", совпадает с заявлением автора |
| Чтение diff + окружающего контекста job `smoke`/`smoke_done` | вручную | строки 899–1030 `.github/workflows/validate.yml` |
| Поиск второго места с тем же числом (`timeout-minutes`, "20 минут", "25 минут", "outer job window") по всему репозиторию | вручную, `grep` | кроме theste/434 второго источника константы 20/25 для job `smoke` нет; остальные 15 `timeout-minutes:` в файле относятся к другим job и не связаны с этим диапазоном |
| Сверка release-ledger схемы с соседними `infra`-записями (например `638.json`) | вручную, чтение | формат (`schema`, `issue`, `baseStable`, `category`, `rationale`) идентичен |
| Трейлеры коммитов | вручную, `git show` | оба коммита несут `Issue: #966` и `User-Visible: no`; `User-Visible: yes` не требовался бы правкой changelog — изменение не затрагивает пользователя |

**Чего не проверял и почему:** `npx tsc --noEmit`, `npm test`, `npm run build`
+ сверку трёх копий бандла — не перегонял отдельно, Validate на этом же SHA
уже зелёный (ссылка в issue), а диапазон не содержит файлов класса A. Полный
повторный прогон #963 (396 сценариев, 3 шарда) не делал — это не гейт ревью,
а AC3 сам относит его к пострелизному шагу ("Повтор полного #963 состоится
после включения принятых инфраструктурных поправок"); запускать его на
обычном GitHub runner ради ревью несоразмерно задаче (PROCESS.md §8, полные
наборы — предрелизный гейт). Chromium/демо-харнес не поднимал: тело issue не
называет смоук по этому диапазону, только workflow-level таймаут. Мутанты не
исполнял и не патчил `timeout-minutes` руками — это было бы исполнением
мутанта вне ночного workflow, запрещено общей политикой.

## AC · чем доказан · чем краснеет

Единственный элемент этого диапазона, который является "защитным" в смысле
лимита — сам job-level `timeout-minutes: 25` (предохранитель от зависшего
раннера). Остальные элементы (три шарда, 180s per-smoke kill, failure
aggregation `fail=1`/`exit $fail`) в этом диффе не менялись — они
унаследованы без изменений и уже были покрыты существующим тестом #434 до
этой задачи.

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (diff ограничен внешним таймаутом/guard/классификацией) | чтение `git diff origin/dev...HEAD --stat` — ровно 3 файла, перечислены выше | n/a — не защитный AC, констатация объёма |
| AC2, `timeout-minutes: 25` (лимит) | `node --test test/smoke-exception-guard.test.mjs` → тест `#434` ASSERT `\n    timeout-minutes: 25\n` PASS | проверено чтением, не исполнением: regex требует точный литерал `25` с отступом 4 пробела и завершающим `\n`; любое другое значение (в т.ч. прежнее `20`, отсутствие строки или другой отступ) не матчится и тест падает по построению. Мутант не исполнялся (патч значения вручную запрещён общей политикой вне ночного workflow); отдельного id в `scripts/mutation-registry.mjs` для этого литерала нет, и это не требуется — проверка статическая и предохранитель работает на уровне платформы GitHub Actions, а не product-кода |
| AC2, 180s per-smoke kill + aggregation (не изменены) | чтение строк 970–1001 `.github/workflows/validate.yml` — `timeout --kill-after=10s 180s`, `fail=1`, `exit $fail` присутствуют без изменений в диффе | не применимо к этому раунду — поведение не менялось, оно было закрыто и проверено в задаче #434 (прежний материал, здесь не воспроизвожу) |
| AC3 (материал опубликован, ревью идёт, затем S8) | сам факт выполнения этого ревью на закреплённом SHA | n/a — процессный AC, не защитный |

Пустых третьих столбцов по защитным AC нет.

## Находки

Находок нет — ни High, ни Medium, ни Low.

Отдельно отмечу (не находка, просто для прозрачности раунда): первый коммит
диапазона (224dad857) поднял `timeout-minutes` до 25, не обновив тест-литерал
в `test/smoke-exception-guard.test.mjs` в том же коммите — отдельно взятый,
он красил бы `#434`. Второй коммит (08524c194) это исправляет. Итоговое
состояние диапазона (HEAD) самосогласовано и это и есть материал ревью;
правило трейлеров/гейтов не требует самосогласованности каждого
промежуточного коммита диапазона, только итогового HEAD и каждого коммита по
трейлерам — оба коммита несут корректные `Issue:`/`User-Visible:`.

## Что проверено и корректно

- Diff не выходит за объём, заявленный в AC1: только `timeout-minutes` +
  комментарий, синхронный policy-guard тест, infra-классификация в
  release-ledger.
- Единственный источник константы "25" для job `smoke` — сам workflow;
  единственная проверка синхронности — `test/smoke-exception-guard.test.mjs`
  (§8, "одно число — один источник" выполняется: тест существует именно
  затем, чтобы не разойтись).
- Три шарда, детерминированное разбиение по индексу файла, 180s
  `--kill-after`, диагностика `smoke-timeout`, `fail=1`/`exit $fail`, upload
  логов — всё это вне диффа и не затронуто.
- `docs/release-ledger/v1.81.0/966.json`: `category: infra`, обоснование
  соответствует факту (наблюдаемая отмена по внешнему окну в #963, сохранение
  шардов/лимитов/порогов), формат идентичен соседним `infra`-записям.
- Трейлеры `Issue: #966` / `User-Visible: no` на обоих коммитах диапазона.
- `process-gate.mjs --issues` PASS с единственным ожидаемым WARN
  (инфраструктурный диапазон без файлов класса A, #562).
- Маршрут `show`: критерии §5 все выполнены — сложность/риск тривиальны
  (числовой литерал + синхронизированный тест), одна поверхность (job
  `smoke`), миграции конфига нет, нового UX-контракта нет, продуктовой
  производительности/touch-контракта это не касается (CI-инфраструктура, не
  рантайм карточки), ожидаемое поведение зафиксировано в самом отчёте задачи и
  в release-ledger rationale. `route: fix`.

## Гейты — что прогнал, что нет и почему

Прогнал: `node --test test/smoke-exception-guard.test.mjs
test/validate-gate.test.mjs test/validate-workflow.test.mjs` (51 PASS),
`node scripts/process-gate.mjs --range origin/dev..HEAD --issues` (PASS, 1
ожидаемый WARN). Не прогонял: `npx tsc --noEmit`, `npm test`, `npm run
build`+bundle-policy (Validate уже зелёный на этом SHA, ссылка в issue,
диапазон без класса A); полный Validate/#963 повтор (396 сценариев — явно
постановленный AC3 шаг, не гейт ревью, несоразмерен объёму диффа);
`golden:verify` (нет `ci:golden`, рендер не затронут); `pytest tests_backend`
(нет правок Python); `npm run invariants` (геометрия не затронута);
performance (в AC не назван, workflow не продуктовый). Chromium/демо не
поднимал — тело issue не называет смоук для этого диапазона.

## Вердикт

Зелёный. Диапазон делает ровно заявленное в AC1–AC3, объём диффа минимален и
самосогласован на HEAD, синхронизирующий тест #434 подтверждён исполнением,
process-gate и трейлеры в порядке, маршрут `show` проходит все критерии §5.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/966-smoke-job-window`, коммит `08524c194e4e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `168cda9dc18ac171e701cca83ddd36926c9c284e`
  ```
  git log --all --format='%H %T' | grep 168cda9dc18a
  ```
- Тело issue: `7b6c7cfda19636d94c948340945c41cd32def9521b09523f49a92448ea4949dd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDEsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTkwOTk5OTk5OTk5OTk5NH0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzIsIm91dHB1dF90b2tlbnMiOjEzNzg0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjU5NTc1LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6OTU5NjQzLCJjb3N0VXNkRXN0aW1hdGUiOjAuNTY4MTMyNn1dLCJ0dXJucyI6MjUsImR1cmF0aW9uTXMiOjE2ODgyMywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNTczMzIzNiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5133 output_tokens=13802 cache_creation_input_tokens=59575 cache_read_input_tokens=959643 num_turns=25 -->
