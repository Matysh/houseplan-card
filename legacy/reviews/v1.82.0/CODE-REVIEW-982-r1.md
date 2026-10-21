# CODE-REVIEW-982-r1

Issue: #982 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов израсходовано 0/2 → 1/2 после этого вердикта
Материал: `c582db5f7ada4290043ab6769a738f7f300f8cf2` (ветка `issue/982-test-partitions`, HEAD на момент ревью), база `origin/dev` = `f740accfdeb099f1631deaadd1c7611822941b10`.
`git rev-parse HEAD` на рабочей копии ревью: `c582db5f7ada4290043ab6769a738f7f300f8cf2` — совпадает с материалом.

## Скоуп

Вычисляемая (по замыканию импортов/реальных чтений, без списков имён) классификация `test/*.test.mjs` на product/tooling; `npm run test:product`/`test:tooling`; `gate:small` выбирает обязательный набор по диффу; CI разводит `frontend` (только product) и новую job `tooling` (без сборки), compound frontend-proof требует обе. Только классы B/C (`scripts/**`, `.github/**`, `test/**`, `package.json`, `PROCESS.md`, `docs/**`); продуктовый код (`src/**`, `custom_components/**`) не тронут — `docs/SCOPE.md` не применяется напрямую, это инфраструктура процесса (AGENTS.md §1, «инфраструктура — show по умолчанию»). User-Visible: no на всех трёх коммитах, changelog не требуется и не трогался — верно.

Критерии §5 track show: сложность и риск — умеренные (одна интегрированная подсистема: классификатор + gate + CI), одна поверхность (test-partition/CI-infra), миграции конфига нет, нового UX-контракта нет, продуктовой производительности/touch не касается, ожидаемое поведение зафиксировано самим ТЗ issue и обновлённым PROCESS §8/DEVELOPMENT/ARCHITECTURE в том же коммите. Переквалификация не требуется — `route: fix`.

## Как проверялось

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | не перегонял — переиспользован | зелёный Validate на точном SHA материала: [39520777002](https://github.com/Matysh/houseplan-card/actions/runs/39520777002), `conclusion: success`, `headSha` совпадает (проверено `gh run view --json headSha`) |
| `frontend` job тайминг (AC2 ≤4 мин) | проверил независимо | `gh run view 39520777002 --json jobs`: `frontend` 00:21:21–00:24:59 UTC = 218 с (3:38) ≤ 240 с; `tooling` 00:21:06–00:25:08 UTC = 242 с. Оба `conclusion: success` |
| `node --test test/unit-groups.test.mjs` | прогнал сам (неизменная реализация) | 8/8 PASS |
| `node --test test/ci-proof.test.mjs test/development-loop-954.test.mjs test/proof-loop-856.test.mjs test/merge-candidate.test.mjs test/night-red.test.mjs test/release-bookkeeping.test.mjs test/release-gate.test.mjs test/validate-gate.test.mjs` | прогнал сам | 135/135 PASS (включает контракт имён job `validate.yml` ↔ `ci-proof.mjs` через `workflow-jobs.mjs`) |
| Чтение полной реализации `unit-groups.mjs`, `gate-small.mjs`, `frontend-units.mjs`, `frontend-proof.mjs`, `ci-proof.mjs`, `validate.yml`, `check-inputs.mjs` (замыкание, не только диффы) | выполнено | см. находку ниже и раздел «Проверено и корректно» |
| Ad-hoc вызов `unitGroups()`/`groupsAffectedBy()` на реальном дереве репозитория (неизменная реализация, обычный `node -e`, не мутант) | выполнено | обнаружена находка Medium (ниже); также перепроверены числа автора: product 316 / tooling 163 / всего 479 — совпадает |
| `node scripts/process-gate.mjs --issues` | не перегонял | часть того же зелёного Validate/дешёвых гейтов на этом SHA (preflight job) |
| golden/смоки/pytest/инварианты модели/perf | не прогонял | диффу не нужны: нет `src/**`, `custom_components/**`, `demo/**`, геометрии, UX, Python — AC их не называет; `smoke-select` не относится к инфраструктурному диффу без frontend-поверхности |
| Мутанты | не исполнялись | ни одного нового мутанта задача не добавляет; дорогие unit-кейсы реестра — обычные статические проверки (подтверждено чтением, автор прав) |

Трейлеры: все три коммита несут `Issue: #982` и `User-Visible: no`; CHANGELOG не тронут — корректно. `docs/release-ledger/v1.81.0/982.json`: `category: infra`, `baseStable: v1.81.0` совпадает с соседними задачами той же линии (#977/#979) — обоснование корректно, milestone не получает (инфраструктура).

## Находки

### Medium (в скоупе) — `groupsAffectedBy` теряет гарантию «общие входы требуют оба» для реальных shared-файлов `scripts/**`

`scripts/unit-groups.mjs:123-134`:

```js
export function groupsAffectedBy(files, grouping) {
  const result = new Set();
  for (const file of files) {
    if (/\.md$|^docs\//.test(file)) continue;
    if (/^(?:src|custom_components|demo|assets)\//.test(file)) { result.add('product'); continue; }
    if (/^(?:scripts|\.github|\.githooks)\//.test(file)) { result.add('tooling'); continue; }
    const tests = grouping.tests.filter(t => grouping.dependencies[t]?.includes(file));
    ...
```

Любой файл под `scripts/**` коротким путём попадает в `tooling`, минуя реальную проверку `grouping.dependencies[t]`, которая как раз вычисляется для «прочих» файлов. Это ломает именно то свойство, которое заявляют AC2, DEVELOPMENT.md и PROCESS §8 этого же коммита: «неизвестные и общие входы требуют оба».

**Воспроизведение (неизменная реализация, обычный запуск, не мутант):**

```
$ node -e "
import('./scripts/unit-groups.mjs').then(({unitGroups, groupsAffectedBy}) => {
  const g = unitGroups();
  const file = 'scripts/model-invariants.mjs';
  const deps = g.tests.filter(t => (g.dependencies[t]||[]).includes(file));
  for (const t of deps) console.log(t, g.product.includes(t) ? 'product' : 'tooling');
  console.log(groupsAffectedBy([file], g));
});"
test/cli-stream-drain-862.test.mjs product
test/gate-reuse.test.mjs product
test/geometry-corpus.test.mjs product
test/model-invariants.test.mjs product
test/near-axis.test.mjs product
test/plan-optimizer.test.mjs product
test/resize-production-path.test.mjs product
test/wall-thickness.test.mjs product
test/wall-union-isolation.test.mjs product
[ 'tooling' ]
```

`test/wall-thickness.test.mjs:36`, `test/plan-optimizer.test.mjs:16`, `test/near-axis.test.mjs:14`, `test/geometry-corpus.test.mjs:39` действительно импортируют функции из `scripts/model-invariants.mjs` (`import { checkWallRecordsPreserved, checkMixedRoleRecords, nearAxisProfile, … } from '../scripts/model-invariants.mjs'`) — это настоящая кодовая зависимость, не побочный эффект обхода каталога. `grouping.dependencies` это видит; `groupsAffectedBy` — нет, потому что префиксный ярлык срабатывает раньше, чем проверка по `dependencies`.

Это не единичный случай: пробежал по всем файлам `scripts/**`, которые реально входят в `dependencies` хотя бы одного **product**-теста, — таких 76, и для всех 76 `groupsAffectedBy` возвращает только `['tooling']`:

```
scripts files reached by at least one PRODUCT test: 76
of those, groupsAffectedBy omits product for: 76
```

**Чем краснеет:** `npm run gate:small` после правки `scripts/model-invariants.mjs` (например, исправление инварианта стен) выберет `requiredUnitGroups → ['tooling']`, не построит продукт и не прогонит `test/wall-thickness.test.mjs`/`test/geometry-corpus.test.mjs`/`test/model-invariants.test.mjs` и ещё шесть product-тестов — pre-push хук локально покажет PASS на диффе, который меняет геометрический инвариант. Это именно «невыполненный AC» (§2.7, Medium на треке `show`, docs/process/REVIEWER.md «Трек show»): AC2 и добавленный этим же диффом текст PROCESS §8/DEVELOPMENT.md прямо обещают обратное.

Страховка есть и не ослаблена: CI `frontend` job по-прежнему запускается при изменении `scripts/model-invariants.mjs` (его отдельный, не тронутый этим диффом манифест `check-inputs.mjs`/`CHECKS.frontend` это видит — проверено: `inputsOf('frontend').includes('scripts/model-invariants.mjs') === true`) и гоняет полный product-набор, так что в `dev` сломанная геометрия не пройдёт. Поэтому не High: это дефект именно локального быстрого контура — ровно того UX, ради которого затевалась задача, — а не дыра в гейте слияния.

**Предлагаемый вид исправления** (не мой выбор — решает автор): считать принадлежность по `grouping.dependencies` всегда и только добавлять префиксные ярлыки как быстрый путь для файлов, которые НЕ входят ни в один `dependencies[t]` (т.е. сами не затрагивают тестируемый код, а являются новыми/нетестируемыми файлами соответствующего дерева) — то есть поменять порядок проверок местами, а не удалять ярлыки целиком.

### Low — принято без правки

`isProductInput`'s ветка `dynamicConsumers.has(p)` (`scripts/unit-groups.mjs:22-26`) в единственном месте вызова (`readReasons`, строка 113) фактически недостижима: туда передаются уже резолвленные data-пути вида `src/...`, которые и так проходят по префиксу. Не влияет на корректность ни одного из проверенных кейсов (AC1 8/8 PASS, реальное дерево 479/479 с корректным разбиением) — оставляю как поддерживаемость-note, не блокирует.

## Проверено и корректно

- **AC1** (классификация без allowlist): `test/unit-groups.test.mjs` — 8 кейсов, лично прогнаны (8/8 PASS), включая отказ без репозиторных входов (`assert.throws(.../unclassified/)`), различение fixture-строки/реального `new URL`/CLI-таблицы, канонический leaf `mutation-registry.mjs`. Проверил чтением сам механизм: `relativeDependencies` не трогает `.ts`-литералы `new URL` (только `.mjs/.cjs/.js`), поэтому `readFileSync(new URL('../src/x.ts', import.meta.url))` идёт через AST-ветку и попадает в `data`, а не в `code`, что и отличает «тест читает продукт» (product, через `readReasons`) от «инструмент импортирует продукт» (тоже product, но через `codeReasons`) — проверено чтением и трассировкой на фикстурах теста. Счёт на реальном дереве (product 316 + tooling 163 = 479 = `tests.length`) воспроизведён независимо.
- **AC2** (frontend ≤4 мин, продуктовый/инструментальный набор раздельно) — тайминг подтверждён независимым запросом к GitHub Actions (см. таблицу выше), а не только заявлением автора. Раздельность confirmed: `tooling` job в `validate.yml:847-858` не делает `npm ci`+build, только `npm run test:tooling`; `frontend` job больше не гоняет `--group=fresh` целиком, а `--suite=product` (`.github/workflows/validate.yml:787`, `scripts/frontend-units.mjs:57-60`). Холодный прогон `test:tooling` без `test-build`/`dist` (приведён автором, правдоподобен и согласуется с найденным и исправленным по ходу раунда #862 дефектом — CLI `model-invariants` раньше тянул product-emit и ломал это свойство, тест на это есть в `test/development-loop-954.test.mjs`). Частичный дефект самого AC2 — см. Medium выше; «документный push не гоняет тесты» прямо и явно вынесен автором и ТЗ issue в не-скоуп (#980), это не находка.
- **AC3** (объединение без потерь, обе CI job обязательны) — `test/unit-groups.test.mjs` проверяет `product.length+tooling.length===tests.length` и точное равенство множеств на реальном дереве (сам прогнал, PASS). `JOB_RULES.frontend` в `scripts/ci-proof.mjs:52-53` требует оба `job: frontend` и `job: tooling`; защитный тест `test/ci-proof.test.mjs` (новый, «#982 frontend evidence requires both computed unit jobs; absent or red tooling is not green») явно проверяет оба негативных случая (job отсутствует / job failure) и возвращает `status: 'failed'` — сам прогнал, PASS, это настоящий отрицательный свидетель в самом тесте (не мутант, обычный unit на фикстуре `proofFixture`), таблица «чем краснеет» в комментарии автора для этого AC корректна.
- Контракт имён job (`resolveJobRules` против `validate.yml`) не расходится — подтверждено прогоном `test/validate-gate.test.mjs`, `test/release-gate.test.mjs`, `test/release-bookkeeping.test.mjs`, `test/night-red.test.mjs`, `test/merge-candidate.test.mjs` (все используют `jobInstanceNames(WORKFLOW.get('tooling'))`, все PASS).
- `docs/release-ledger/v1.81.0/982.json`: формат и `baseStable` совпадают с соседними записями той же бета-линии (#974 — тот же `category: infra` без поля `summary`, как и положено).
- `scripts/frontend-proof.mjs` — новый дешёвый prefilter (`git diff --quiet` по mandatory key-input файлам до скачивания артефактов) — обоснованно сужает только *когда отклонять старый producer раньше*, не решение reuse; снижает цену найденной самим автором проблемы (5+ минут скачивания несовместимых producer-ов), не подменяет #981.
- Монолит/бандл/`no-new-any`/`no-new-private-writes` не затронуты (нет правок `src/**`), соответствующие гейты в составе зелёного Validate.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` + `bundle-policy --verify` своими руками — переиспользован зелёный Validate на точном SHA материала (инструкция прогона §8, подтверждён `gh run view`).
- golden, браузерные смоки, `pytest tests_backend`, `model-invariants`-инварианты, perf-профили — диффу не нужны (нет `src/**`/`custom_components/**`/`demo/**`/геометрии/Python), AC их не называет.
- Ночной/релизный полный прогон обоих наборов — не гейт этого ревью (предрелизный); полагаюсь на то, что `npm test` (полный `node --test test/*.test.mjs`) не менялся и остаётся объединением.
- Не проверял поведение `--group=all`/ручных `gate:product`/`gate:tooling` путей вручную исполнением — только чтением (не входят в AC, существовали до задачи, #856).
- Не оценивал реальный выигрыш по времени для будущих product-only/tooling-only пушей за пределами одного измеренного инфраструктурного прогона (AC2 охватывает именно этот прогон; серийный недельный замер явно вне скоупа, см. «Не сделано» автора).

## Маршрут

`route: fix`. Критерии §5 track show пройдены (сложность/поверхность/миграция/UX/perf-touch/задокументированность — см. «Скоуп»); находка Medium — обычный дефект поведения внутри уже заявленного AC2, не повод для `reclassify`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/982-test-partitions`, коммит `c582db5f7ada` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ccbe7195f7521bd17d9fc2032359edbed66e7933`
  ```
  git log --all --format='%H %T' | grep ccbe7195f752
  ```
- Тело issue: `afaa2ba63c140558972a8820b27ea68cbe395bc9ba65574e1afbf5168a8c8c4c`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTAsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjl9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjEyMiwib3V0cHV0X3Rva2VucyI6NjE1NTMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTc0OTA0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6ODMzMzc1MCwiY29zdFVzZEVzdGltYXRlIjoyLjk4MjEzOTk5OTk5OTk5OTN9XSwidHVybnMiOjcwLCJkdXJhdGlvbk1zIjo3NzIwNzIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjk4NzQzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5312 output_tokens=61573 cache_creation_input_tokens=174904 cache_read_input_tokens=8333750 num_turns=70 -->
